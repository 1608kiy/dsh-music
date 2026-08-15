# dsh-music 🎵

**A floating QQ Music player plugin for DeepSeek Harness** — chat and listen at the same time. A draggable frosted-glass card that collapses into a spinning mini disc, deep QQ Music integration (QR-code account login, VIP playback, liked-songs & personal playlists, playlist import by link/ID, search by title/artist), an official vkey audio-stream resolver with a Meting third-party fallback, and an agent-facing `music` tool — queue, skip, pause, and control volume right from the chat. Zero external front-end dependencies.

> 🌐 Languages: [English](README.en.md) | [简体中文](README.md)

## Features

- **Floating player**: QQ-green × yellow dark frosted-glass card (`backdrop-filter` blur + inner glow), **draggable with position memory**, expand/collapse with spring-physics animation; the cover **spins like a vinyl record** while playing; play/pause, prev/next, click-to-seek progress bar (green→yellow gradient with a glowing knob), volume, list-loop/single-loop/shuffle, playlist view
- **Auto-collapsing mini disc**: whether playing or not, moving the mouse away for 5 seconds collapses the player into a **spinning mini disc** (album art); **hover shows a "+" expand button** (click to restore — hovering never auto-expands); **drag it anywhere**, it **snaps to the screen edge** on release (floating-ball style); **double-click = next track, triple-click = previous track**
- **One-tap close/reopen**: hit the **×** on the player to hide it (music keeps playing) — a small note button stays in the corner; click it to reopen — **it defaults to the snapped mini disc** (only the very first run shows the full card)
- **Resume playback**: per-track progress is remembered — switching back to the same track or restarting the app continues from where you left off
- **Quality switch**: one-tap **128k standard / 320k high quality** (320k requires a logged-in VIP account; auto-degrades)
- **Keyboard shortcuts**: `Space` play/pause, `←` previous, `→` next (ignored while typing in inputs)
- **Restart-safe**: queue, volume and mode are persisted (`%DSH_HOME%\dsh-music\state.json`) and restored on the next launch
- **Polished QR login page**: breathing-glow QR card, pulsing status indicator (waiting / scanned / confirmed), 3-step guide, success animation — one tap on 「登录QQ音乐」
- **QQ Music integration**: one-tap **playlist import/switch** (paste a link or id), **song search** (search + add); the host proxies search/playlist/streams to bypass browser CORS and anti-leeching; free tracks play via the official vkey API, VIP/restricted tracks auto-skip or fall back to Meting
- **QQ account login**: scan with the **mobile QQ app** in the player panel; the credential is stored locally (`%DSH_HOME%\dsh-music\qq-login.json`) and **survives restarts** (auto-refresh, no re-scan); unlocks **full VIP playback** and importing **「我喜欢」 (id=201)** plus **your created/favorited playlists** (including private ones)
- **Configurable default library**: set the `DSH_MUSIC_PLAYLIST` env var to a QQ playlist id to auto-load it as the built-in queue at startup (otherwise the queue starts empty and can be filled from the player UI)
- **Agent music tool**: just say "play a song / put on my playlist" — the `music` tool plays by query (auto-searches QQ Music on local miss), imports playlists, lists your playlists, guides login, skips, pauses, sets volume/mode, and manages the queue
- **State sync**: browser player ↔ host state machine over REST (`/dsh-music/state` polling + `/dsh-music/command` intents)
- **Zero front-end dependencies**: hand-written `__ModuleLoader__` format with inline SVG icons, no CDN

## Login with your QQ account (unlock VIP)

1. Expand the 🎵 player → tap **「登录QQ音乐」**
2. Scan the QR code with the **mobile QQ app** (confirm on your phone)
3. After success the panel shows your nickname; tap the playlist button to browse and import **❤ 我喜欢 / created / favorited** playlists
4. The credential is stored at `%DSH_HOME%\dsh-music\qq-login.json` — **no re-scan on restart**; it auto-refreshes when expiring (re-scan only if refresh fails)

You can also just tell the agent 「登录QQ音乐」「看看我的歌单」「播放我喜欢」 and it will guide or operate directly.

## Install (desktop app / Web profile)

The package lives at `%DSH_HOME%\profiles\node_modules\@dsh-external\dsh-music` and is registered in `%DSH_HOME%\profiles\web\cordis.patch.yml`. **Restart the DeepSeek Harness app** — the 🎵 player appears in the bottom-right corner.

With the `dsh` CLI:

```sh
dsh plugin --profile web add "file:/path/to/dsh-music"
# restart dsh web (dsh --profile web) to activate
```

## Configure the default playlist

The built-in library is loaded from a QQ playlist configured through the environment:

```sh
# e.g. use playlist 8048205048 as the default library
set DSH_MUSIC_PLAYLIST=8048205048
```

Without it the queue starts empty; import playlists manually from the player 🔍.

## Usage

- Click the 🎵 card in the bottom-right to expand; drag the header anywhere (position is remembered); use the arrow button to expand/collapse
- **While playing, move the mouse away for 3s** → the player collapses into a mini disc; **hover the disc** to reveal the "+" expand button (click to restore); **drag the disc** — it **snaps to the nearer screen edge** on release; **double-click = next, triple-click = previous**
- Keyboard: **Space** play/pause, **←/→** skip; the **128/HD button** toggles quality
- 🔍 opens QQ Music search: type a title/artist, Enter to search, "+" to add to the queue
- The first input accepts a QQ playlist link or id (e.g. `https://y.qq.com/n/ryqq/playlist/8048205048`; when logged in, `201` imports 「我喜欢」), Enter to import (replaces the current queue)
- Just talk to the agent: 「放首歌 / 放一首周杰伦的晴天 / 导入我的歌单 / 播放我喜欢 / 下一首 / 暂停 / 随机播放 / 音量调到 50%」
- The queue, volume and mode restore automatically after a restart

## Development / Third-party development

- Protocol references: `L-1124/QQMusicApi` (Python — login/playlist/playback protocol) and `yakult-green-tea/qq-music-api` (Node.js — device fingerprint & playback protocol)
- Both the host and client halves are single-file zero-dependency implementations; `cordis.patch.yml` declares the bundle insertion point. To mount on another DSH profile: copy the package directory + add one insert row in that profile's `cordis.patch.yml`
- Local storage (all under `%DSH_HOME%\dsh-music\`): `qq-login.json` (login credential), `state.json` (playback state snapshot)

## Disclaimer

- This project is not affiliated with DeepSeek or Tencent QQ Music; audio comes from QQ Music public endpoints and a third-party Meting resolver — for learning and communication only
- Songs restricted by copyright/account permissions may not play (the player auto-skips to the next playable track)
- The login credential is stored locally in your DSH instance and is only used to call QQ Music's official endpoints
- All `music` tool and UI operations run locally inside your DSH instance

## Structure

- `index.js` — host half: state machine, REST API (state / command / qq search / playlist / stream / login / my-playlists), `music` tool, official vkey resolver (Meting fallback), QQ QR login (ptlogin2 → OAuth → QQLogin) with credential persistence
- `client.js` — browser half: floating player (hand-written `__ModuleLoader__` format, inline SVG icons, zero external deps), QR login & my-playlists panel
- `cordis.patch.yml` — bundle layer declaration

## Uninstall

```sh
dsh plugin --profile web remove @dsh-external/dsh-music
# desktop: delete %DSH_HOME%\profiles\node_modules\@dsh-external\dsh-music
# and remove the dsh-music insert row from %DSH_HOME%\profiles\web\cordis.patch.yml
```

## License

[MIT](LICENSE)
