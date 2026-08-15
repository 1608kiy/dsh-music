/**
 * @dsh-external/dsh-music — host half.
 *
 * Owns the playback state machine (queue, index, playing, volume, mode),
 * exposes it to the browser player over REST routes on the web server, and
 * gives the agent a `music` tool so the model can queue songs, skip, pause,
 * and adjust volume while chatting.
 *
 * No persistence for the queue by design: every load starts fresh, and the
 * default library is the configured QQ Music playlist, fetched at startup.
 *
 * QQ Music integration (all proxied through this host to bypass browser CORS
 * and anti-leeching):
 *   - search / playlist via the public musicu.fcg & fcg_ucc_getcdinfo_byids_cp
 *     endpoints;
 *   - audio streams via the official vkey resolver (free tracks), upgraded to
 *     full VIP playback once the user scans a QQ login QR code in the player;
 *     a Meting third-party endpoint is the last-resort fallback;
 *   - optional account login: QQ QR-code flow (ptlogin2 -> graph.qq.com OAuth
 *     -> musicu QQLogin) producing a persisted credential (musicid + musickey)
 *     under %DSH_HOME%/dsh-music/qq-login.json, enabling VIP playback, the
 *     user's own playlists and the "liked songs" (我喜欢) list across restarts
 *     without re-logging in.
 *
 * @module
 */
import { defineTool } from "@deepseek-ai/dsh-tools";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

export const name = "dsh-music";
export const inject = ["webServer", "tools"];

/** Fake browser identity for QQ Music public endpoints. */
const QQ_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const QQ_REFERER = "https://y.qq.com/";
/** Stable fake guid used when resolving vkey audio streams. */
const QQ_GUID = "7283123456";
/** QQ web login client identity (y.qq.com). */
const QQ_APPID = "716027609";
const QQ_DAID = "383";
const QQ_3RD_AID = "100497308";
/** The streamable track URL served by this plugin. */
const qqStreamUrl = (mid) => `/dsh-music/qq/stream?id=${encodeURIComponent(mid)}`;

// ── QQ account credential (persisted login state) ───────────────────────────

/** Where the QQ login credential lives: %DSH_HOME%/dsh-music/qq-login.json. */
function credentialStorePath() {
	const home = process.env.DSH_HOME ?? path.join(os.homedir(), ".dsh");
	return path.join(home, "dsh-music", "qq-login.json");
}

/** Current QQ credential (musicid + musickey), null when signed out. */
let credential = null;

/** Load the persisted credential at startup (validates shape only). */
function loadCredential() {
	try {
		const raw = JSON.parse(fs.readFileSync(credentialStorePath(), "utf8"));
		const value = raw?.credential;
		if (value && typeof value === "object" && (value.musicid || value.str_musicid) && typeof value.musickey === "string" && value.musickey !== "") {
			credential = value;
			return true;
		}
	} catch {
		/* no file or unreadable */
	}
	return false;
}

/** Persist the credential; failures degrade to in-memory only. */
function saveCredential(value) {
	credential = value;
	try {
		const file = credentialStorePath();
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, `${JSON.stringify({ credential: value, savedAt: Date.now() }, null, 2)}\n`, "utf8");
	} catch {
		/* keep in-memory credential */
	}
}

/** Clear the persisted credential (logout). */
function clearCredential() {
	credential = null;
	try {
		fs.rmSync(credentialStorePath(), { force: true });
	} catch {
		/* ignore */
	}
}

/** The numeric music id of the credential (str_musicid wins). */
function credentialMusicId(value = credential) {
	if (!value) return "";
	const stringId = String(value.str_musicid ?? "").trim();
	if (stringId && stringId !== "0") return stringId;
	return String(value.musicid ?? "");
}

/** The cookie form of a credential, accepted by the musicu RPC face and the legacy CGIs. */
function credentialCookie(value = credential) {
	if (!value) return "";
	const musicid = credentialMusicId(value);
	return [
		`uin=${musicid}`,
		`qqmusic_uin=${musicid}`,
		`qm_keyst=${value.musickey}`,
		`qqmusic_key=${value.musickey}`
	].join("; ");
}

/** Hash33 (QQ ptlogin token / g_tk); matches the Python reference bit-for-bit. */
function hash33(text, h = 0) {
	for (let i = 0; i < text.length; i += 1) h = (h * 33 + text.charCodeAt(i)) % 4294967296;
	return 2147483647 & h;
}

/** The WEB-platform comm for logged-in musicu calls. */
function webComm(value = credential) {
	const musicid = credentialMusicId(value) || "0";
	const gtk = hash33(value?.musickey ?? "", 5381);
	return {
		ct: 24,
		cv: 4747474,
		platform: "yqq.json",
		chid: "0",
		uin: musicid,
		g_tk: gtk,
		g_tk_new_20200303: gtk,
		format: "json",
		inCharset: "utf-8",
		outCharset: "utf-8",
		notice: 0,
		need_new_code: 1
	};
}

/** Build the built-in library from the configured playlist. */
const DEFAULT_PLAYLIST_ID = process.env.DSH_MUSIC_PLAYLIST ?? "";
let BUILTIN_TRACKS = [];

/** Refresh the built-in library from the configured playlist. */
async function refreshBuiltinTracks() {
	if (DEFAULT_PLAYLIST_ID === "") return;
	try {
		const playlist = await qqPlaylist(DEFAULT_PLAYLIST_ID);
		if (playlist.tracks.length === 0) return;
		BUILTIN_TRACKS = playlist.tracks.map((row) => ({
			id: `qq-${row.id}`,
			title: row.name,
			artist: row.artist,
			cover: row.cover,
			url: qqStreamUrl(row.id)
		}));
	} catch {
		/* keep the empty queue; the player can still import playlists manually */
	}
}

/** Playback modes. */
const MODES = ["list", "single", "shuffle"];

/** Clamp a number into [0, 1]. */
const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

/** Compose the queue: built-ins first (when enabled), then session custom tracks. */
function composeQueue(custom, useBuiltin) {
	return [...(useBuiltin ? BUILTIN_TRACKS : []), ...custom];
}

/** Fresh state on every load: no persistence, the default library is the playlist. */
function defaultState() {
	return {
		queue: [...BUILTIN_TRACKS],
		index: 0,
		playing: false,
		volume: 0.8,
		mode: "list",
		custom: [],
		useBuiltin: true,
		version: 1
	};
}

/** Where the playback state snapshot lives: %DSH_HOME%/dsh-music/state.json. */
function stateStorePath() {
	const home = process.env.DSH_HOME ?? path.join(os.homedir(), ".dsh");
	return path.join(home, "dsh-music", "state.json");
}

/** Serializable snapshot of the playback state (queue + prefs). */
function stateSnapshot(state) {
	const map = ({ id, title, artist, url, cover }) => ({ id, title, artist, url, cover });
	return {
		queue: state.queue.map(map),
		custom: state.custom.map(map),
		useBuiltin: state.useBuiltin,
		index: state.index,
		volume: state.volume,
		mode: state.mode,
		version: state.version
	};
}

/**
 * Restore a persisted playback snapshot into a fresh state object so a
 * restart continues the previous queue, volume and mode. Returns true when a
 * snapshot was applied (the built-in playlist refresh then skips recomposing).
 */
function restoreState(state) {
	try {
		const raw = JSON.parse(fs.readFileSync(stateStorePath(), "utf8"));
		const snap = raw?.state;
		if (!snap || !Array.isArray(snap.queue) || snap.queue.length === 0) return false;
		const clean = snap.queue.filter((track) => track && typeof track.id === "string" && typeof track.url === "string");
		if (clean.length === 0) return false;
		state.queue = clean;
		state.custom = Array.isArray(snap.custom)
			? snap.custom.filter((track) => track && typeof track.id === "string" && typeof track.url === "string")
			: [];
		state.useBuiltin = snap.useBuiltin !== false;
		state.index = Math.min(Math.max(0, Number(snap.index) || 0), clean.length - 1);
		state.volume = clamp01(snap.volume);
		if (MODES.includes(snap.mode)) state.mode = snap.mode;
		state.version += 1;
		return true;
	} catch {
		return false;
	}
}

/** Persist the current state; failures degrade to in-memory only. */
function persistState(state) {
	try {
		const file = stateStorePath();
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, `${JSON.stringify({ state: stateSnapshot(state), savedAt: Date.now() }, null, 2)}\n`, "utf8");
	} catch {
		/* keep in-memory state */
	}
}

/** Write the client-facing subset of the state. */
function publicState(state) {
	return {
		queue: state.queue.map(({ id, title, artist, url, cover }) => ({ id, title, artist, url, cover })),
		index: state.index,
		playing: state.playing,
		volume: state.volume,
		mode: state.mode,
		builtin: state.useBuiltin,
		version: state.version
	};
}

/** Apply one command intent to the state machine. */
async function applyCommand(state, command) {
	const { action } = command;
	const len = state.queue.length;
	switch (action) {
		case "play": {
			const target = Number(command.index);
			if (Number.isInteger(target) && target >= 0 && target < len) state.index = target;
			state.playing = true;
			break;
		}
		case "pause":
			state.playing = false;
			break;
		case "toggle":
			state.playing = !state.playing;
			break;
		case "next":
			if (len > 0) state.index = nextIndex(state, +1);
			state.playing = true;
			break;
		case "prev":
			if (len > 0) state.index = (state.index - 1 + len) % len;
			state.playing = true;
			break;
		case "ended":
			// Natural end of a track: single mode replays, others advance.
			if (state.mode === "single" || len === 0) {
				state.playing = state.mode === "single";
			} else {
				state.index = nextIndex(state, +1);
				state.playing = true;
			}
			break;
		case "volume":
			state.volume = clamp01(command.volume);
			break;
		case "mode":
			if (MODES.includes(command.mode)) state.mode = command.mode;
			break;
		case "add": {
			const url = typeof command.url === "string" ? command.url.trim() : "";
			const isExternal = /^https?:\/\/\S+$/.test(url);
			const isLocal = /^\/dsh-music\/\S*$/.test(url);
			if (!isExternal && !isLocal) return { ok: false, message: "需要 http(s) 音频直链或站内音乐链接" };
			const track = {
				id: `custom-${Date.now().toString(36)}`,
				title: (typeof command.title === "string" && command.title.trim() !== ""
					? command.title.trim()
					: url.split("/").pop() || url).slice(0, 120),
				artist: "自定义",
				url
			};
			state.custom.push(track);
			state.queue = composeQueue(state.custom, state.useBuiltin);
			state.version += 1;
			return { ok: true, message: `已添加「${track.title}」到播放列表` };
		}
		case "remove": {
			const target = Number(command.index);
			if (!Number.isInteger(target) || target < 0 || target >= len) return { ok: false, message: "索引无效" };
			const removed = state.queue[target];
			state.custom = state.custom.filter((track) => track.id !== removed.id);
			state.queue = composeQueue(state.custom, state.useBuiltin);
			if (state.index > target) state.index -= 1;
			else if (state.index === target && state.queue.length > 0) state.index = state.index % state.queue.length;
			if (state.queue.length === 0) {
				state.index = 0;
				state.playing = false;
			}
			state.version += 1;
			return { ok: true, message: `已移除「${removed.title}」` };
		}
		case "importPlaylist": {
			const raw = typeof command.id === "string" ? command.id.trim() : "";
			const id = parsePlaylistId(raw);
			if (id === void 0) return { ok: false, message: "歌单 id 或链接无效" };
			const playlist = await qqPlaylist(id);
			if (playlist.tracks.length === 0) return { ok: false, message: "歌单为空、不可访问或已失效（私密歌单需要先登录）" };
			state.custom = playlist.tracks.map((row) => ({
				id: `qq-${row.id}`,
				title: row.name,
				artist: row.artist,
				cover: row.cover,
				url: qqStreamUrl(row.id)
			}));
			state.useBuiltin = command.clear === false;
			state.queue = composeQueue(state.custom, state.useBuiltin);
			// Random start support: explicit shuffle, or already in shuffle mode.
			if (command.shuffle === true || state.mode === "shuffle") {
				state.mode = "shuffle";
				state.index = state.queue.length > 0 ? Math.floor(Math.random() * state.queue.length) : 0;
			} else {
				state.index = 0;
			}
			state.playing = true;
			state.version += 1;
			return {
				ok: true,
				message: `已导入歌单「${playlist.name}」（${playlist.tracks.length} 首）${state.useBuiltin ? "" : "，默认歌单已隐藏"}，开始播放第一首`
			};
		}
		case "builtin": {
			state.useBuiltin = command.enable === true;
			state.queue = composeQueue(state.custom, state.useBuiltin);
			state.version += 1;
			return { ok: true, message: state.useBuiltin ? "已恢复默认歌单" : "已隐藏默认歌单" };
		}
		case "reset":
			state.custom = [];
			state.useBuiltin = true;
			state.queue = composeQueue(state.custom, state.useBuiltin);
			state.index = 0;
			state.playing = false;
			state.version += 1;
			return { ok: true, message: "播放列表已重置为默认歌单" };
		default:
			return { ok: false, message: `未知操作: ${String(action)}` };
	}
	state.version += 1;
	return { ok: true, message: "ok" };
}

/** Advance index by one step honoring the playback mode. */
function nextIndex(state, step) {
	const len = state.queue.length;
	if (len === 0) return 0;
	if (state.mode === "shuffle") {
		if (len === 1) return 0;
		let next = state.index;
		while (next === state.index) next = Math.floor(Math.random() * len);
		return next;
	}
	return (state.index + step + len) % len;
}

/** Write a JSON response. */
function json(res, body, status = 200) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(JSON.stringify(body));
}

/** Collect the request body as text. */
function readBody(req) {
	return new Promise((resolve, reject) => {
		let data = "";
		req.on("data", (chunk) => {
			data += chunk;
			if (data.length > 1e6) {
				req.destroy();
				reject(new Error("body too large"));
			}
		});
		req.on("end", () => resolve(data));
		req.on("error", reject);
	});
}

/** Find a queue entry whose title matches the query. */
function findTrack(state, query) {
	const needle = query.trim().toLowerCase();
	if (needle === "") return void 0;
	return state.queue.find((track) => track.title.toLowerCase().includes(needle))
		?? state.queue.find((track) => track.artist.toLowerCase().includes(needle));
}

/** Format the queue as one line per track. */
function renderQueue(state) {
	return state.queue.map((track, i) => {
		const marker = i === state.index ? (state.playing ? "▶" : "⏸") : " ";
		return `${marker} [${i}] ${track.title} — ${track.artist}`;
	}).join("\n") || "（播放列表为空）";
}

// ── QQ Music integration ────────────────────────────────────────────────────

/** QQ Music cache (search 30s, playlist 5min, stream 8min). */
const qqCache = new Map();

/**
 * Post one request bundle to QQ Music's unified musicu.fcg endpoint.
 * @param reqs - {req_0: {...}} request bundle.
 * @param opts - { ct, comm, credential } — pass credential for logged-in calls.
 */
async function musicuFetch(reqs, opts = {}) {
	const loggedIn = Boolean(opts.credential);
	const base = loggedIn
		? webComm(opts.credential)
		: { uin: "0", format: "json", ct: opts.ct ?? 23, cv: 0, authst: "" };
	const body = { comm: { ...base, ...(opts.comm || {}) }, ...reqs };
	const headers = {
		"user-agent": QQ_UA,
		referer: QQ_REFERER,
		"content-type": "application/json"
	};
	if (loggedIn) headers.cookie = credentialCookie(opts.credential);
	const res = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
		method: "POST",
		headers,
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(`musicu.fcg ${res.status}`);
	return await res.json();
}

/** Resolve a QQ Music cover URL from an album mid (or ""). */
function qqCover(albumMid) {
	return typeof albumMid === "string" && albumMid !== ""
		? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg`
		: "";
}

/** Normalize one QQ song row into the plugin's track shape. */
function songRow(song) {
	const id = song?.mid ?? song?.songmid ?? "";
	const name = String(song?.name ?? song?.songname ?? "未知歌曲");
	const singers = song?.singer ?? song?.singers;
	const artist = Array.isArray(singers) && singers.length > 0
		? singers.map((s) => s?.name ?? "").filter(Boolean).join(" / ")
		: "未知歌手";
	const albumMid = song?.album?.mid ?? song?.albummid ?? song?.album?.albummid;
	const albumName = song?.album?.name ?? song?.albumname ?? "";
	const interval = song?.interval ?? song?.duration;
	return {
		id: String(id),
		name,
		artist,
		album: albumName,
		cover: qqCover(albumMid),
		durationMs: typeof interval === "number" ? interval * 1000 : 0
	};
}

/** Search QQ Music for songs; resolves to trimmed song rows. */
async function qqSearch(query, limit = 20) {
	const key = `q:${query}:${limit}`;
	const cached = qqCache.get(key);
	if (cached !== void 0 && Date.now() - cached.at < 30_000) return cached.rows;
	let rows = [];
	for (const ct of [23, 24, 19]) {
		try {
			const data = await musicuFetch({
				req_1: {
					module: "music.search.SearchCgiService",
					method: "DoSearchForQQMusicDesktop",
					param: { num_per_page: limit, page_num: 1, query, search_type: 0 }
				}
			}, { ct });
			const songs = data?.req_1?.data?.body?.song?.list;
			if (!Array.isArray(songs) || songs.length === 0) continue;
			rows = songs.filter((song) => song && typeof song.mid === "string" && song.mid !== "").map(songRow);
			if (rows.length > 0) break;
		} catch {
			/* try next variant */
		}
	}
	qqCache.set(key, { rows, at: Date.now() });
	return rows;
}

/** Best-effort playlist name from a response item (field names vary by API). */
function playlistItemName(item, fallback) {
	return String(item?.dissname ?? item?.title ?? item?.name ?? item?.dirName ?? item?.dirname ?? fallback);
}

/** Best-effort playlist cover from a response item. */
function playlistItemCover(item) {
	return String(item?.picurl ?? item?.picUrl ?? item?.albumPicUrl ?? item?.bigpicUrl ?? item?.cover ?? item?.logo ?? "");
}

/**
 * Fetch one QQ playlist's tracks (paginated to full length):
 * logged-in CgiGetDiss (dirid then disstid) first, public CGI fallback.
 * Empty results are NOT cached, so a later login can still unlock them.
 */
async function qqPlaylist(id) {
	const key = `pl:${id}`;
	const cached = qqCache.get(key);
	if (cached !== void 0 && Date.now() - cached.at < 300_000) return { name: cached.name, tracks: cached.rows };
	let name = "";
	let rows = [];
	// Logged-in path: dirid covers "liked songs" (201) and own playlists;
	// disstid covers favorited/other playlists (incl. private ones).
	if (credential && credential.encryptUin && /^\d+$/.test(id)) {
		const numericId = Number(id);
		const diridCandidates = numericId === 201 ? [201] : [numericId, 0];
		const disstidCandidates = numericId === 201 ? [0] : [0, numericId];
		for (let attempt = 0; attempt < diridCandidates.length && rows.length === 0; attempt += 1) {
			try {
				let begin = 0;
				const batch = 100;
				let total = Infinity;
				const collected = [];
				while (begin < Math.min(total, 2000)) {
					const data = await musicuFetch({
						req_0: {
							module: "music.srfDissInfo.DissInfo",
							method: "CgiGetDiss",
							param: {
								disstid: disstidCandidates[attempt],
								dirid: diridCandidates[attempt],
								tag: true,
								song_begin: begin,
								song_num: batch,
								userinfo: true,
								orderlist: true,
								enc_host_uin: credential.encryptUin
							}
						}
					}, { credential });
					const songs = data?.req_0?.data?.songlist;
					const totalNum = Number(data?.req_0?.data?.total_song_num ?? 0);
					if (totalNum > 0) total = totalNum;
					if (!Array.isArray(songs) || songs.length === 0) break;
					collected.push(...songs);
					if (name === "") {
						const info = data?.req_0?.data?.dirinfo;
						name = String(info?.dir_name ?? info?.title ?? info?.dissname ?? "");
					}
					begin += songs.length;
					const hasmore = data?.req_0?.data?.hasmore;
					if (songs.length < batch || !(hasmore === true || hasmore === 1)) break;
				}
				if (collected.length > 0) {
					rows = collected.filter((song) => song && typeof song.mid === "string" && song.mid !== "").map(songRow);
				}
			} catch {
				/* try the next candidate path */
			}
		}
	}
	if (rows.length === 0) {
		// Public path: any playlist by disstid.
		try {
			const url = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg`
				+ `?type=1&json=1&utf8=1&onlysong=0&disstid=${encodeURIComponent(id)}`
				+ `&format=json&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8`
				+ `&notice=0&platform=yqq.json&needNewCode=0`;
			const res = await fetch(url, {
				headers: {
					"user-agent": QQ_UA,
					referer: QQ_REFERER,
					cookie: `pgv_pvid=7283123456; ts_refer=ADTAGyqq${credential ? `; ${credentialCookie(credential)}` : ""}`
				}
			});
			if (res.ok) {
				const text = await res.text();
				// Unwrap the MusicJsonCallback(...) JSONP envelope when present.
				const trimmed = text.trim();
				let payload = trimmed;
				if (/^[A-Za-z_$][\w$]*\([\s\S]*\)$/.test(trimmed)) {
					const cbOpen = trimmed.indexOf("(");
					payload = trimmed.slice(cbOpen + 1, trimmed.length - 1);
				}
				const data = JSON.parse(payload);
				const cd = data?.cdlist?.[0];
				const tracks = cd?.songlist;
				if (Array.isArray(tracks)) {
					name = String(cd?.dissname ?? cd?.title ?? "");
					rows = tracks.filter((song) => song && typeof song.songmid === "string" && song.songmid !== "").map(songRow);
				}
			}
		} catch {
			/* keep empty rows */
		}
	}
	if (rows.length > 0) qqCache.set(key, { name, rows, at: Date.now() });
	return { name, tracks: rows };
}

/** The user's own playlists: 我喜欢 + created + favorited (paginated). Requires login. */
async function myPlaylists() {
	if (!credential) throw Object.assign(new Error("未登录"), { status: 401 });
	const uin = credentialMusicId(credential);
	const list = [];
	try {
		const data = await musicuFetch({
			req_0: {
				module: "music.musicasset.PlaylistBaseRead",
				method: "GetPlaylistByUin",
				param: { uin }
			}
		}, { credential });
		for (const item of data?.req_0?.data?.v_playlist ?? []) {
			const id = item?.dirId ?? item?.dirid ?? item?.tid ?? item?.dissid;
			if (id === void 0 || id === null || String(id) === "") continue;
			list.push({
				id: String(id),
				name: playlistItemName(item, "未命名歌单"),
				cover: playlistItemCover(item),
				songCount: Number(item?.songnum ?? item?.songNum ?? 0),
				type: "created"
			});
		}
	} catch {
		/* created playlists unavailable */
	}
	if (credential.encryptUin) {
		try {
			const pageSize = 100;
			let offset = 0;
			while (offset < 2000) {
				const data = await musicuFetch({
					req_0: {
						module: "music.musicasset.PlaylistFavRead",
						method: "CgiGetPlaylistFavInfo",
						param: { uin: credential.encryptUin, offset, size: pageSize }
					}
				}, { credential });
				const items = data?.req_0?.data?.v_list ?? [];
				for (const item of items) {
					const id = item?.tid ?? item?.dissid;
					if (id === void 0 || id === null || String(id) === "") continue;
					list.push({
						id: String(id),
						name: playlistItemName(item, "收藏歌单"),
						cover: playlistItemCover(item),
						songCount: Number(item?.songnum ?? item?.songNum ?? 0),
						type: "favorite"
					});
				}
				const hasmore = data?.req_0?.data?.hasmore;
				offset += items.length;
				if (items.length === 0 || !(hasmore === true || hasmore === 1)) break;
			}
		} catch {
			/* favorited playlists unavailable */
		}
	}
	// Best-effort count for the liked-songs list (dir 201).
	let likedCount = 0;
	if (credential.encryptUin) {
		try {
			const data = await musicuFetch({
				req_0: {
					module: "music.srfDissInfo.DissInfo",
					method: "CgiGetDiss",
					param: {
						disstid: 0,
						dirid: 201,
						tag: true,
						song_begin: 0,
						song_num: 1,
						userinfo: true,
						orderlist: true,
						enc_host_uin: credential.encryptUin
					}
				}
			}, { credential });
			likedCount = Number(data?.req_0?.data?.total_song_num ?? 0);
		} catch {
			/* keep 0 */
		}
	}
	return [{ id: "201", name: "我喜欢", cover: "", songCount: likedCount, type: "favorite" }, ...list];
}

/** Verify the persisted credential with QQ (GetLoginUserInfo); true = valid. */
async function checkCredential() {
	if (!credential) return false;
	try {
		const data = await musicuFetch({
			req_0: { module: "music.UserInfo.userInfoServer", method: "GetLoginUserInfo", param: {} }
		}, { credential });
		return data?.req_0?.code === 0;
	} catch {
		return false;
	}
}

/** Refresh the QQ credential via the QQ-connect refresh flow (loginType 2). */
async function refreshCredential() {
	if (!credential || Number(credential.loginType ?? 0) !== 2) return false;
	try {
		const data = await musicuFetch({
			req_0: {
				module: "music.login.LoginServer",
				method: "Login",
				param: {
					openid: String(credential.openid ?? ""),
					access_token: String(credential.access_token ?? ""),
					refresh_token: String(credential.refresh_token ?? ""),
					expired_in: Number(credential.expired_at ?? 0),
					str_musicid: credentialMusicId(credential),
					musicid: Number(credential.musicid ?? 0),
					musickey: String(credential.musickey ?? ""),
					refresh_key: String(credential.refresh_key ?? ""),
					loginMode: 2
				}
			}
		}, { credential, comm: { tmeLoginType: 2 } });
		const value = data?.req_0?.data;
		if (data?.req_0?.code === 0 && value && value.musickey) {
			saveCredential({ ...value, loginType: Number(value.loginType ?? 2) });
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/** Ensure a usable credential: refresh when stale; clear when refresh fails. */
async function ensureCredential() {
	if (!credential) return false;
	if (await checkCredential()) return true;
	if (await refreshCredential()) return true;
	clearCredential();
	return false;
}

// ── QQ QR-code login (ptlogin2 web flow) ─────────────────────────────────────

/** One in-flight login session (started by the player UI, polled by the client). */
let loginSession = null;

/** Parse quoted args from a ptuiCB(...) payload. */
function parsePtuiArgs(text) {
	const match = /ptuiCB\((.*?)\)\s*;?\s*$/.exec(text.trim());
	if (!match) return [];
	return [...match[1].matchAll(/'((?:\\.|[^'])*)'/g)].map((m) => m[1]);
}

/** Start a QQ QR-code login: returns the QR image as a data URL. */
async function qqLoginStart() {
	const url = `https://ssl.ptlogin2.qq.com/ptqrshow?appid=${QQ_APPID}&e=2&l=M&s=3&d=72&v=4&t=${Math.random()}&daid=${QQ_DAID}&pt_3rd_aid=${QQ_3RD_AID}`;
	const res = await fetch(url, {
		headers: { "user-agent": QQ_UA, referer: "https://xui.ptlogin2.qq.com/" }
	});
	if (!res.ok) throw new Error(`ptqrshow ${res.status}`);
	const setCookies = res.headers.getSetCookie?.() ?? [];
	const qrsig = setCookies.map((c) => c.split(";")[0]).find((c) => c.startsWith("qrsig="))?.slice(6) ?? "";
	if (!qrsig) throw new Error("获取登录二维码失败");
	const bytes = Buffer.from(await res.arrayBuffer());
	loginSession = { qrsig, state: "waiting", createdAt: Date.now() };
	return {
		qrImage: `data:image/png;base64,${bytes.toString("base64")}`,
		expiresIn: 180
	};
}

/** Exchange the QR result (uin + ptsigx) for a music credential. */
async function exchangeQqCredential(uin, ptsigx) {
	const step = async (url, headers, body) => {
		const res = await fetch(url, {
			method: body ? "POST" : "GET",
			headers,
			body,
			redirect: "manual"
		});
		const setCookies = (res.headers.getSetCookie?.() ?? [])
			.map((c) => c.split(";")[0])
			.filter((c) => c.includes("="))
			.join("; ");
		return { res, setCookies };
	};
	// 1. check_sig: ptlogin cookie -> p_skey.
	const checkUrl = `https://ssl.ptlogin2.graph.qq.com/check_sig?uin=${encodeURIComponent(uin)}`
		+ `&pttype=1&service=ptqrlogin&nodirect=0&ptsigx=${encodeURIComponent(ptsigx)}`
		+ `&s_url=${encodeURIComponent("https://graph.qq.com/oauth2.0/login_jump")}&ptlang=2052&ptredirect=100`
		+ `&aid=${QQ_APPID}&daid=${QQ_DAID}&j_later=0&low_login_hour=0&regmaster=0&pt_login_type=3`
		+ `&pt_aid=0&pt_aaid=16&pt_light=0&pt_3rd_aid=${QQ_3RD_AID}`;
	const check = await step(checkUrl, { "user-agent": QQ_UA, referer: "https://xui.ptlogin2.qq.com/" });
	const pSkey = check.setCookies.split("; ").find((c) => c.startsWith("p_skey="))?.slice(7) ?? "";
	if (!pSkey) throw new Error("获取 p_skey 失败");
	// 2. oauth authorize: swap p_skey for an authorization code.
	const form = new URLSearchParams({
		response_type: "code",
		client_id: QQ_3RD_AID,
		redirect_uri: "https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/",
		scope: "get_user_info,get_app_friends",
		state: "state",
		switch: "",
		from_ptlogin: "1",
		src: "1",
		update_auth: "1",
		openapi: "1010_1030",
		g_tk: String(hash33(pSkey, 5381)),
		auth_time: String(Date.now()),
		ui: `${Date.now()}${Math.floor(Math.random() * 1e6)}`
	});
	const auth = await step("https://graph.qq.com/oauth2.0/authorize", {
		"user-agent": QQ_UA,
		referer: "https://graph.qq.com/",
		"content-type": "application/x-www-form-urlencoded",
		cookie: check.setCookies
	}, form.toString());
	const location = auth.res.headers.get("location") ?? "";
	const code = /[?&]code=([^&]+)/.exec(location)?.[1];
	if (!code) throw new Error("获取授权 code 失败");
	// 3. musicu QQLogin: swap the code for the music credential.
	const data = await musicuFetch({
		req_0: {
			module: "QQConnectLogin.LoginServer",
			method: "QQLogin",
			param: { code }
		}
	}, { ct: 24, comm: { tmeLoginType: 2 } });
	const value = data?.req_0?.data;
	if (data?.req_0?.code !== 0 || !value?.musickey) {
		throw new Error(`QQ 登录失败 (code=${data?.req_0?.code ?? "unknown"})`);
	}
	saveCredential({ ...value, loginType: Number(value.loginType ?? 2) });
	loginSession = null;
	// Drop playlist caches that may hold stale (pre-login) empty results.
	for (const cacheKey of [...qqCache.keys()]) {
		if (cacheKey.startsWith("pl:")) qqCache.delete(cacheKey);
	}
	return value;
}

/**
 * Poll the current login QR. State machine:
 * "none" (no session) | "waiting" | "scanned" | "confirmed" | "done" | "expired" | "failed"
 */
async function qqLoginPoll() {
	if (!loginSession) return { state: "none" };
	if (Date.now() - loginSession.createdAt > 180_000) {
		loginSession = null;
		return { state: "expired", message: "二维码已过期，请重新获取" };
	}
	const { qrsig } = loginSession;
	const url = `https://ssl.ptlogin2.qq.com/ptqrlogin?u1=${encodeURIComponent("https://graph.qq.com/oauth2.0/login_jump")}`
		+ `&ptqrtoken=${hash33(qrsig)}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052`
		+ `&action=0-0-${Date.now()}&js_ver=20102616&js_type=1&login_sig=&pt_uistyle=40`
		+ `&aid=${QQ_APPID}&daid=${QQ_DAID}&pt_3rd_aid=${QQ_3RD_AID}&has_onekey=1`;
	let text = "";
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 15_000);
		const res = await fetch(url, {
			headers: { "user-agent": QQ_UA, referer: "https://xui.ptlogin2.qq.com/", cookie: `qrsig=${qrsig}` },
			signal: controller.signal
		});
		clearTimeout(timer);
		text = await res.text();
	} catch {
		return { state: loginSession?.state ?? "waiting", message: "网络错误，重试中…" };
	}
	const args = parsePtuiArgs(text);
	const code = args[0] ?? "";
	if (code === "0") {
		const jump = args[2] ?? "";
		const uinMatch = /(?:^|[?&])uin=([^&]+)/.exec(jump);
		const sigxMatch = /(?:^|[?&])ptsigx=([^&]+)/.exec(jump);
		if (!uinMatch || !sigxMatch) return { state: "failed", message: "登录响应缺少参数" };
		loginSession.state = "confirmed";
		try {
			const value = await exchangeQqCredential(decodeURIComponent(uinMatch[1]), decodeURIComponent(sigxMatch[1]));
			return {
				state: "done",
				nickname: String(value.nick ?? value.nickname ?? ""),
				musicid: credentialMusicId(value)
			};
		} catch (error) {
			loginSession = null;
			return { state: "failed", message: error instanceof Error ? error.message : String(error) };
		}
	}
	if (code === "66" || code === "65") {
		loginSession.state = "waiting";
		return { state: "waiting", message: "请使用手机 QQ 扫码" };
	}
	if (code === "67") {
		loginSession.state = "scanned";
		return { state: "scanned", message: "已扫码，请在手机上确认" };
	}
	if (code === "68" || code === "69") {
		return { state: "failed", message: "二维码已失效，请重新获取" };
	}
	return { state: loginSession?.state ?? "waiting", message: `等待扫码（${code}）` };
}

/** Cancel the in-flight login session. */
function qqLoginCancel() {
	loginSession = null;
}

/** Issue an http(s) request choosing the module by protocol. */
function agentRequest(url, headers) {
	return url.startsWith("https:")
		? httpsRequest(url, { headers })
		: httpRequest(url, { headers });
}

/**
 * Resolve playable URLs for one or more QQ song mids via the official vkey
 * endpoint (CgiGetVkey). Logged-in calls carry the account cookie, which is
 * what unlocks VIP tracks. Resolves to an array aligned with the input mids.
 */
async function resolveQqVkey(mids) {
	const out = new Array(mids.length).fill("");
	try {
		const data = await musicuFetch({
			req_0: {
				module: "vkey.GetVkeyServer",
				method: "CgiGetVkey",
				param: {
					guid: QQ_GUID,
					songmid: mids,
					songtype: mids.map(() => 0),
					uin: credentialMusicId(credential) || "0",
					loginflag: 1,
					platform: "20"
				}
			}
		}, { ct: 24, credential: credential ?? undefined });
		const sip = data?.req_0?.data?.sip?.[0];
		const info = data?.req_0?.data?.midurlinfo;
		if (Array.isArray(info) && typeof sip === "string") {
			for (let i = 0; i < info.length && i < mids.length; i += 1) {
				const purl = info[i]?.purl;
				if (typeof purl === "string" && purl !== "") out[i] = sip + purl;
			}
		}
	} catch {
		/* all unresolvable */
	}
	return out;
}

/**
 * Second-stage vkey resolution (UrlGetVkey with an explicit two-part
 * filename), used for logged-in VIP tracks the basic call rejects.
 * @param prefix - C400 (m4a 128k) | M800 (mp3 320k) | F000 (flac).
 * @param ext - file extension matching the prefix.
 */
async function resolveQqVkeyWithFilename(mid, prefix = "C400", ext = ".m4a") {
	if (!credential) return "";
	try {
		const data = await musicuFetch({
			req_0: {
				module: "music.vkey.GetVkey",
				method: "UrlGetVkey",
				param: {
					filename: [`${prefix}${mid}${mid}${ext}`],
					guid: QQ_GUID,
					songmid: [mid],
					songtype: [0],
					uin: credentialMusicId(credential),
					ctx: 0
				}
			}
		}, { ct: 24, credential });
		const purl = data?.req_0?.data?.midurlinfo?.[0]?.purl;
		if (typeof purl !== "string" || purl === "") return "";
		const sip = data?.req_0?.data?.sip?.[0];
		const domain = sip && !sip.startsWith("http://ws") ? sip : "http://dl.stream.qqmusic.qq.com/";
		return purl.startsWith("http") ? purl : domain + purl;
	} catch {
		return "";
	}
}

/** Resolve via the Meting third-party API as a last-resort fallback. */
function resolveMetingUrl(mid) {
	return new Promise((resolve) => {
		const url = `https://api.injahow.cn/meting/?server=tencent&type=url&id=${encodeURIComponent(mid)}`;
		const req = agentRequest(url, { "user-agent": QQ_UA })
			.on("error", () => resolve(void 0));
		req.setTimeout(10000, () => {
			req.destroy();
			resolve(void 0);
		});
		req.on("response", (res) => {
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				res.resume();
				resolve(res.headers.location);
				return;
			}
			res.resume();
			resolve(void 0);
		});
		req.end();
	});
}

/**
 * Pick a playable CDN url: HQ (320k, logged-in VIP) -> vkey -> filename vkey
 * -> Meting. Every level degrades gracefully to the next one.
 */
async function resolveStreamUrl(mid, quality = "128") {
	const key = `stream:${mid}:${quality}`;
	const cached = qqCache.get(key);
	if (cached !== void 0 && Date.now() - cached.at < 480_000) return cached.url;
	// High quality needs a logged-in account; falls back to standard below.
	if (quality === "320" && credential) {
		const hq = await resolveQqVkeyWithFilename(mid, "M800", ".mp3");
		if (hq !== "") {
			qqCache.set(key, { url: hq, at: Date.now() });
			return hq;
		}
	}
	let [vkeyUrl] = await resolveQqVkey([mid]);
	// A logged-in account whose credential went stale gets one silent refresh
	// retry, so playback keeps working across restarts without re-scanning.
	if (vkeyUrl === "" && credential && !(await checkCredential()) && await refreshCredential()) {
		[vkeyUrl] = await resolveQqVkey([mid]);
	}
	if (vkeyUrl !== "") {
		qqCache.set(key, { url: vkeyUrl, at: Date.now() });
		return vkeyUrl;
	}
	const filenameUrl = await resolveQqVkeyWithFilename(mid);
	if (filenameUrl !== "") {
		qqCache.set(key, { url: filenameUrl, at: Date.now() });
		return filenameUrl;
	}
	const meting = await resolveMetingUrl(mid);
	if (meting !== void 0) {
		qqCache.set(key, { url: meting, at: Date.now() });
		return meting;
	}
	return void 0;
}

/** Write audio response head mirroring the upstream status and range headers. */
function writeAudioHead(res, upstream) {
	res.writeHead(upstream.statusCode ?? 200, {
		"content-type": upstream.headers["content-type"] ?? "audio/mpeg",
		"cache-control": "no-store",
		"accept-ranges": upstream.headers["accept-ranges"] ?? "bytes",
		...(upstream.headers["content-range"] ? { "content-range": upstream.headers["content-range"] } : {}),
		...(upstream.headers["content-length"] ? { "content-length": upstream.headers["content-length"] } : {})
	});
}

/** Pipe one final audio url into the browser response with timeout/abort safety. */
function pipeStream(url, range, res, fail) {
	const headers = { "user-agent": QQ_UA, referer: QQ_REFERER };
	if (typeof range === "string" && range !== "") headers.range = range;
	let active;
	// When the browser aborts (seek/skip/reload), tear the upstream down instead
	// of letting it pipe into a dead response and emit unhandled errors.
	res.on("close", () => active?.destroy());
	const req = agentRequest(url, headers).on("error", () => fail("音频流获取失败"));
	req.setTimeout(12000, () => {
		req.destroy();
		fail("音频流获取超时");
	});
	active = req;
	req.on("response", (upstream) => {
		if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
			upstream.resume();
			const next = agentRequest(upstream.headers.location, { "user-agent": QQ_UA, ...(typeof range === "string" && range !== "" ? { range } : {}) })
				.on("error", () => fail("音频流获取失败"));
			next.setTimeout(12000, () => {
				next.destroy();
				fail("音频流获取超时");
			});
			active = next;
			next.on("response", (final) => {
				if (final.statusCode !== 200 && final.statusCode !== 206) {
					final.resume();
					fail(`上游返回 ${final.statusCode}`);
					return;
				}
				final.on("error", () => { /* aborted by client */ });
				writeAudioHead(res, final);
				final.pipe(res);
			});
			next.end();
			return;
		}
		if (upstream.statusCode !== 200 && upstream.statusCode !== 206) {
			upstream.resume();
			fail(`上游返回 ${upstream.statusCode}`);
			return;
		}
		upstream.on("error", () => { /* aborted by client */ });
		writeAudioHead(res, upstream);
		upstream.pipe(res);
	});
	req.end();
}

/** Stream a QQ Music track through this host (bypasses browser CORS/anti-leech). */
async function proxyQqStream(mid, quality, req, res) {
	const fail = (message) => {
		// The response may already be gone (browser aborted the stream on skip).
		try {
			res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
			res.end(JSON.stringify({ error: message }));
		} catch {
			/* response closed */
		}
	};
	let target;
	try {
		target = await resolveStreamUrl(mid, quality);
	} catch {
		target = void 0;
	}
	if (target === void 0) {
		fail(credential ? "音频流获取失败（该歌曲可能不支持当前账号播放）" : "音频流获取失败（VIP 歌曲需先登录，或受版权限制）");
		return;
	}
	pipeStream(target, req.headers.range, res, fail);
}

/** Extract a playlist id from a raw id or QQ Music share link. */
function parsePlaylistId(raw) {
	const value = String(raw ?? "").trim();
	if (/^\d+$/.test(value)) return value;
	const match = /y\.qq\.com\/(?:n\/ryqq\/)?playlist\/(\d+)/.exec(value)
		?? /music\.qq\.com\/\S*playlist\/(\d+)/.exec(value)
		?? /playlist\/(\d+)/.exec(value);
	return match ? match[1] : void 0;
}

/**
 * The plugin entry: register the REST surface and the agent tool.
 * @param ctx - host context.
 */
export function apply(ctx) {
	const state = defaultState();

	// Restore the persisted playback snapshot (queue / volume / mode) so a
	// restart continues where the last session left off.
	const restored = restoreState(state);

	// Restore the QQ credential at startup and validate/refresh it lazily.
	loadCredential();
	if (credential) {
		ensureCredential().catch(() => { /* leave as loaded */ });
	}

	// Load the configured QQ Music playlist as the built-in queue at startup.
	// A restored snapshot keeps its own queue; the built-in refresh only
	// recomposes when no snapshot was restored.
	refreshBuiltinTracks().then(() => {
		if (restored) return;
		state.queue = composeQueue(state.custom, state.useBuiltin);
		if (state.index >= state.queue.length) state.index = 0;
		state.version += 1;
	});

	// Periodically persist the playback state (5s throttle on changes).
	ctx.effect(() => {
		let lastVersion = state.version;
		const timer = setInterval(() => {
			if (state.version !== lastVersion) {
				lastVersion = state.version;
				persistState(state);
			}
		}, 5000);
		return () => clearInterval(timer);
	});

	// State snapshot for the browser player.
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/state",
		handler: (_req, res) => json(res, publicState(state))
	}));

	// Player intents from the browser.
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/command",
		handler: async (req, res) => {
			try {
				const body = await readBody(req);
				const command = JSON.parse(body || "{}");
				const result = await applyCommand(state, command);
				json(res, { ...publicState(state), result });
			} catch (error) {
				json(res, { error: error instanceof Error ? error.message : String(error) }, 400);
			}
		}
	}));

	// QQ Music search proxy (browser cannot call musicu.fcg directly).
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/qq/search",
		handler: async (req, res) => {
			try {
				const query = new URL(req.url, "http://localhost").searchParams.get("q") ?? "";
				if (query.trim() === "") {
					json(res, { songs: [] });
					return;
				}
				const songs = await qqSearch(query.trim(), 20);
				json(res, { songs });
			} catch (error) {
				json(res, { error: error instanceof Error ? error.message : String(error) }, 502);
			}
		}
	}));

	// QQ Music playlist proxy (supports 201/我喜欢 and private playlists when logged in).
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/qq/playlist",
		handler: async (req, res) => {
			try {
				const raw = new URL(req.url, "http://localhost").searchParams.get("id") ?? "";
				const id = parsePlaylistId(raw);
				if (id === void 0) {
					json(res, { error: "歌单 id 或链接无效" }, 400);
					return;
				}
				const playlist = await qqPlaylist(id);
				json(res, { name: playlist.name, tracks: playlist.tracks });
			} catch (error) {
				json(res, { error: error instanceof Error ? error.message : String(error) }, 502);
			}
		}
	}));

	// QQ Music audio stream proxy.
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/qq/stream",
		handler: (req, res) => {
			const params = new URL(req.url, "http://localhost").searchParams;
			const mid = params.get("id") ?? "";
			if (!/^[A-Za-z0-9]+$/.test(mid)) {
				json(res, { error: "无效的歌曲 id" }, 400);
				return;
			}
			const quality = params.get("q") === "320" ? "320" : "128";
			proxyQqStream(mid, quality, req, res);
		}
	}));

	// QQ account login status.
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/qq/login/status",
		handler: (_req, res) => {
			json(res, {
				loggedIn: Boolean(credential),
				musicid: credential ? credentialMusicId(credential) : "",
				nickname: credential ? String(credential.nick ?? credential.nickname ?? "") : ""
			});
		}
	}));

	// Start a QQ QR-code login session; returns the QR image.
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/qq/login/start",
		handler: async (_req, res) => {
			try {
				json(res, await qqLoginStart());
			} catch (error) {
				json(res, { error: error instanceof Error ? error.message : String(error) }, 502);
			}
		}
	}));

	// Poll the in-flight QR login session.
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/qq/login/poll",
		handler: async (_req, res) => {
			try {
				json(res, await qqLoginPoll());
			} catch (error) {
				json(res, { error: error instanceof Error ? error.message : String(error) }, 502);
			}
		}
	}));

	// Cancel the in-flight QR login session.
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/qq/login/cancel",
		handler: (_req, res) => {
			qqLoginCancel();
			json(res, { ok: true });
		}
	}));

	// Sign out: drop the persisted credential.
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/qq/login/logout",
		handler: (_req, res) => {
			clearCredential();
			json(res, { ok: true });
		}
	}));

	// The user's own playlists (我喜欢 + created + favorited).
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/qq/my-playlists",
		handler: async (_req, res) => {
			try {
				json(res, { playlists: await myPlaylists() });
			} catch (error) {
				const status = error?.status === 401 ? 401 : 502;
				json(res, { error: error instanceof Error ? error.message : String(error) }, status);
			}
		}
	}));

	// Agent-facing music control tool.
	ctx.tools.register(defineTool({
		name: "music",
		description: "控制 DeepSeek Harness 的音乐播放器：播放/暂停/切歌/调音量/切换循环模式/查看队列/导入QQ音乐歌单/QQ音乐搜歌/查看我的歌单。用户提到放歌、听歌、切歌、暂停、下一首、导入歌单等场景时使用。",
		parameters: {
			action: {
				type: "string",
				required: true,
				description: "play(播放；query 先匹配本地曲库，未命中自动搜QQ音乐并播放) / pause / next / prev / list(查看队列) / search(QQ音乐搜歌) / playlist(导入QQ音乐歌单，id 可为歌单链接、id 或 201=我喜欢) / myplaylists(列出已登录账号的歌单) / login(引导用户扫码登录QQ音乐账号，解锁VIP播放与我的歌单) / logout(退出QQ音乐账号) / add(添加直链) / remove(按索引移除) / volume / mode / builtin(恢复/隐藏默认歌单) / reset"
			},
			query: { type: "string", description: "歌名或歌手关键词，配合 play/search 使用" },
			url: { type: "string", description: "音频直链(http/https)，配合 add 使用" },
			title: { type: "string", description: "自定义歌曲标题，配合 add 使用" },
			id: { type: "string", description: "QQ音乐歌单 id 或分享链接，配合 playlist 使用（201 表示「我喜欢」）" },
			clear: { type: "boolean", description: "playlist 是否隐藏默认歌单（默认 true，仅保留新歌单）" },
			shuffle: { type: "boolean", description: "playlist 是否随机播放歌单（默认跟随当前模式；当前已是随机模式则自动随机起播）" },
			enable: { type: "boolean", description: "builtin 是否恢复默认歌单" },
			index: { type: "number", description: "队列索引，配合 play/remove 使用" },
			volume: { type: "number", description: "音量 0-1，配合 volume 使用" },
			mode: { type: "string", description: "循环模式：list(列表循环)/single(单曲循环)/shuffle(随机)，配合 mode 使用" }
		},
		output: {
			schema: { type: "string" },
			render: (_args, value) => [{ type: "text", text: value }]
		},
		async execute(args) {
			const action = args.action;
			switch (action) {
				case "play": {
					if (typeof args.query === "string" && args.query.trim() !== "") {
						const track = findTrack(state, args.query);
						if (track !== void 0) {
							state.index = state.queue.indexOf(track);
						} else {
							// Local miss: fall back to QQ Music search, skipping
							// tracks the official resolver cannot stream.
							const songs = await qqSearch(args.query, 5);
							if (songs.length === 0) {
								return `曲库中没有匹配「${args.query}」的歌曲，QQ音乐搜索也没有结果。当前队列：\n${renderQueue(state)}`;
							}
							const urls = await resolveQqVkey(songs.map((song) => song.id));
							let chosen = songs[0];
							for (let i = 0; i < songs.length; i += 1) {
								if (urls[i] !== "") { chosen = songs[i]; break; }
							}
							const song = chosen;
							const trackRow = {
								id: `qq-${song.id}`,
								title: song.name,
								artist: song.artist,
								cover: song.cover,
								url: qqStreamUrl(song.id)
							};
							state.custom.push(trackRow);
							state.queue = composeQueue(state.custom, state.useBuiltin);
							state.index = state.queue.length - 1;
							return `本地曲库无匹配，已从QQ音乐搜索并加入：▶ 「${song.name} — ${song.artist}」（自动播放）`;
						}
					} else if (Number.isInteger(args.index)) {
						state.index = args.index;
					}
					state.playing = true;
					state.version += 1;
					const current = state.queue[state.index];
					return `▶ 正在播放「${current.title} — ${current.artist}」（${state.index + 1}/${state.queue.length}）`;
				}
				case "pause":
					state.playing = false;
					state.version += 1;
					return "⏸ 已暂停";
				case "next":
				case "prev": {
					if (state.queue.length === 0) return "播放列表为空";
					state.index = action === "next" ? nextIndex(state, +1) : (state.index - 1 + state.queue.length) % state.queue.length;
					state.playing = true;
					state.version += 1;
					const current = state.queue[state.index];
					return `${action === "next" ? "⏭" : "⏮"} 切到「${current.title} — ${current.artist}」`;
				}
				case "list":
					return `正在${state.playing ? "播放" : "暂停"}：${state.queue[state.index]?.title ?? "无"}\n模式：${state.mode}｜音量：${Math.round(state.volume * 100)}%\n\n${renderQueue(state)}`;
				case "search": {
					if (typeof args.query !== "string" || args.query.trim() === "") return "请提供搜索关键词 query";
					const songs = await qqSearch(args.query.trim(), 10);
					if (songs.length === 0) return `QQ音乐没有搜到「${args.query}」`;
					return `QQ音乐搜索结果（前 ${songs.length} 条）：\n${songs.map((song, i) =>
						`${i + 1}. ${song.name} — ${song.artist}${song.album ? `（专辑：${song.album}）` : ""}${song.durationMs ? `（${Math.round(song.durationMs / 1000 / 60)}:${String(Math.round(song.durationMs / 1000) % 60).padStart(2, "0")}）` : ""}`
					).join("\n")}\n\n告诉用户序号，或用 play 播放指定歌曲。`;
				}
				case "login": {
					if (credential) return `已登录 QQ 音乐账号（${credentialMusicId(credential)}${credential.nick ? `，昵称 ${credential.nick}` : ""}）。`;
					return "请在播放器面板中点击「登录 QQ 音乐」按钮，用手机 QQ 扫码完成登录。登录后即可播放 VIP 歌曲、导入「我喜欢」和自己的歌单。";
				}
				case "logout": {
					if (!credential) return "当前未登录 QQ 音乐账号";
					clearCredential();
					return "已退出 QQ 音乐账号，VIP 歌曲将恢复为不可播放";
				}
				case "myplaylists": {
					if (!credential) return "尚未登录 QQ 音乐账号。请让用户到播放器面板扫码登录，或直接说「登录QQ音乐」。";
					const playlists = await myPlaylists();
					if (playlists.length === 0) return "账号下没有找到歌单";
					return `QQ音乐账号（${credentialMusicId(credential)}）的歌单：\n${playlists.map((p, i) =>
						`${i + 1}. ${p.name}（${p.songCount} 首）— playlist id=${p.id}`
					).join("\n")}\n\n告诉用户序号，或用 playlist 导入指定歌单。`;
				}
				case "add": {
					if (typeof args.url !== "string" || args.url.trim() === "") return "请提供音频直链 url";
					const result = await applyCommand(state, { action: "add", url: args.url, title: args.title });
					return result.message;
				}
				case "remove": {
					const result = await applyCommand(state, { action: "remove", index: args.index });
					return result.message;
				}
				case "volume": {
					if (typeof args.volume !== "number") return "请提供 volume(0-1)";
					state.volume = clamp01(args.volume);
					state.version += 1;
					return `音量已设为 ${Math.round(state.volume * 100)}%`;
				}
				case "mode": {
					if (!MODES.includes(args.mode)) return `模式必须是 ${MODES.join("/")}`;
					state.mode = args.mode;
					state.version += 1;
					return `循环模式已切换为 ${state.mode}`;
				}
				case "playlist": {
					const id = parsePlaylistId(args.id ?? args.url);
					if (id === void 0) return "请提供QQ音乐歌单 id 或分享链接（如 https://y.qq.com/n/ryqq/playlist/xxx，201=我喜欢）";
					if (id === "201" && !credential) return "「我喜欢」需要先登录 QQ 音乐账号：请让用户到播放器面板扫码登录，或直接说「登录QQ音乐」。";
					const result = await applyCommand(state, { action: "importPlaylist", id, clear: args.clear !== false, shuffle: args.shuffle === true });
					return result.message;
				}
				case "builtin": {
					const result = await applyCommand(state, { action: "builtin", enable: args.enable === true });
					return result.message;
				}
				case "reset": {
					const result = await applyCommand(state, { action: "reset" });
					return result.message;
				}
				default:
					return `未知操作「${String(action)}」。可用：play/pause/next/prev/list/search/playlist/myplaylists/login/logout/add/remove/volume/mode/builtin/reset`;
			}
		}
	}));
}
