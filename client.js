window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-music",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		var react = require("react");
		var react_dom = require("react-dom");
		var h = react.createElement;

		/** Poll interval for the host playback state. */
		var POLL_MS = 2000;
		/** Card width. */
		var WIDTH = 280;
		/** Mini disc diameter. */
		var MINI_SIZE = 46;
		/** Expanded card height (used for drag clamping). */
		var EXPANDED_HEIGHT = 520;
		/** Storage keys. */
		var STORE_COLLAPSED = "dsh-music:collapsed";
		var STORE_X = "dsh-music:x";
		var STORE_Y = "dsh-music:y";
		var STORE_QUALITY = "dsh-music:quality";
		var STORE_HIDDEN = "dsh-music:hidden";
		var STORE_ONBOARDED = "dsh-music:onboarded";
		var PROGRESS_KEY = "dsh-music:progress";

		/**
		 * Player chrome: dark frosted glass with QQ Music green (#31c27c) and
		 * yellow (#ffd23f) accents.
		 */
		var CSS = [
			"#dsh-music-root{position:fixed;left:0;top:0;z-index:2147483000;font-family:system-ui,-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;user-select:none}",
			// ── card shell ────────────────────────────────────────────────────
			".dshm-card{width:" + WIDTH + "px;border-radius:22px;overflow:hidden;background:linear-gradient(155deg,rgba(255,255,255,0.14),rgba(255,255,255,0.03) 40%,rgba(49,194,124,0.06)),rgba(10,16,14,0.55);backdrop-filter:blur(28px) saturate(180%);-webkit-backdrop-filter:blur(28px) saturate(180%);border:1px solid rgba(255,255,255,0.14);box-shadow:0 24px 64px rgba(0,0,0,0.45),0 2px 8px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.18),inset 0 -1px 0 rgba(49,194,124,0.12);color:#fff;cursor:default}",
			".dshm-drag{cursor:grab}.dshm-drag:active{cursor:grabbing}",
			// ── header ────────────────────────────────────────────────────────
			".dshm-header{display:flex;align-items:center;gap:10px;padding:8px 12px;position:relative}",
			".dshm-cover{flex:none;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;color:#fff;overflow:hidden;border:2px solid rgba(255,255,255,0.22);box-shadow:0 6px 16px rgba(0,0,0,0.35),inset 0 0 0 2px rgba(0,0,0,0.08);transition:width .35s cubic-bezier(.22,1,.36,1),height .35s cubic-bezier(.22,1,.36,1),font-size .35s cubic-bezier(.22,1,.36,1),box-shadow .35s cubic-bezier(.22,1,.36,1)}",
			".dshm-cover-lg{width:56px;height:56px;font-size:24px;border-width:2.5px;box-shadow:0 10px 24px rgba(0,0,0,0.4),0 0 0 4px rgba(49,194,124,0.16),inset 0 0 0 2px rgba(0,0,0,0.08)}",
			".dshm-cover img{width:100%;height:100%;object-fit:cover;display:block}",
			"@keyframes dshm-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
			".dshm-cover-spinning{animation:dshm-spin 16s linear infinite}",
			".dshm-meta{flex:1;min-width:0}",
			".dshm-title{font-size:13.5px;font-weight:600;line-height:19px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.45);transition:font-size .35s cubic-bezier(.22,1,.36,1),line-height .35s cubic-bezier(.22,1,.36,1)}",
			".dshm-header-mini .dshm-title{font-size:12.5px;line-height:17px}",
			".dshm-artist{font-size:10.5px;line-height:14px;color:rgba(255,255,255,0.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px rgba(0,0,0,0.35)}",
			".dshm-head-actions{position:relative;flex:none;width:96px;height:36px}",
			".dshm-head-group{position:absolute;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:flex-end;gap:4px;opacity:0;pointer-events:none}",
			".dshm-head-group-in{opacity:1;pointer-events:auto}",
			".dshm-head-group-out{opacity:0;pointer-events:none;transition:opacity .18s ease-out}",
			".dshm-vt-fade{animation:dshm-fade-in .28s ease-out .42s both}",
			"@keyframes dshm-fade-in{from{opacity:0}to{opacity:1}}",
			".dshm-play-btn{view-transition-name:dshm-play}",
			".dshm-next-btn{view-transition-name:dshm-next}",
			".dshm-head-group-out .dshm-play-btn,.dshm-head-group-out .dshm-next-btn{view-transition-name:none}",
			".dshm-card:not(.dshm-card-expanded) .dshm-controls .dshm-play-btn,.dshm-card:not(.dshm-card-expanded) .dshm-controls .dshm-next-btn{view-transition-name:none}",
			"::view-transition-group(dshm-play),::view-transition-group(dshm-next){animation-duration:.38s;animation-timing-function:cubic-bezier(.22,1,.36,1)}",
			"::view-transition-old(root),::view-transition-new(root){animation:none}",
			// ── buttons ───────────────────────────────────────────────────────
			".dshm-btn{flex:none;border:none;background:transparent;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;padding:0;text-shadow:0 1px 3px rgba(0,0,0,0.35);transition:background .15s ease,transform .1s ease,box-shadow .15s ease,color .15s ease;border-radius:10px}",
			".dshm-btn:active{transform:scale(.92)}",
			".dshm-btn:hover{background:rgba(255,255,255,0.14)}",
			".dshm-btn-icon{width:28px;height:28px}",
			".dshm-btn-primary{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#3ddc84,#00a854);color:#fff;box-shadow:0 4px 16px rgba(0,190,96,0.45),inset 0 1px 0 rgba(255,255,255,0.35);font-size:14px}",
			".dshm-btn-primary:hover{background:linear-gradient(135deg,#4fea93,#00b95f);box-shadow:0 4px 20px rgba(0,210,105,0.6),inset 0 1px 0 rgba(255,255,255,0.4)}",
			".dshm-btn-active{background:rgba(49,194,124,0.28);color:#5ce6a8;box-shadow:inset 0 0 0 1px rgba(49,194,124,0.4)}",
			".dshm-btn-ghost{border:1px solid rgba(255,255,255,0.24);background:rgba(255,255,255,0.08);border-radius:999px;padding:5px 14px;font-size:11.5px;color:rgba(255,255,255,0.9)}",
			".dshm-btn-ghost:hover{background:rgba(255,255,255,0.16)}",
			".dshm-btn-solid{border:none;background:linear-gradient(135deg,#3ddc84,#00a854);border-radius:999px;padding:5px 14px;font-size:11.5px;color:#fff;font-weight:600;box-shadow:0 3px 12px rgba(0,190,96,0.4)}",
			".dshm-btn-solid:hover{filter:brightness(1.08)}",
			".dshm-btn-qq{border:none;background:linear-gradient(135deg,#ffd23f,#ffb400);border-radius:999px;padding:6px 13px;font-size:11.5px;color:#3a2c00;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:0 3px 12px rgba(255,196,0,0.35)}",
			".dshm-btn-qq:hover{filter:brightness(1.08);box-shadow:0 4px 16px rgba(255,196,0,0.5)}",
			// ── body ──────────────────────────────────────────────────────────
			".dshm-body{padding:2px 12px 12px}",
			".dshm-row{display:flex;align-items:center;gap:8px;margin-top:8px}",
			".dshm-progress{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,0.18);position:relative;cursor:pointer;box-shadow:inset 0 1px 2px rgba(0,0,0,0.3)}",
			".dshm-progress-fill{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:linear-gradient(90deg,#31c27c,#3ddc84 70%,#ffd23f);box-shadow:0 0 10px rgba(49,194,124,0.55)}",
			".dshm-progress-fill::after{content:'';position:absolute;right:-3px;top:50%;width:9px;height:9px;border-radius:50%;background:#ffd23f;transform:translateY(-50%);box-shadow:0 0 8px rgba(255,210,63,0.8),0 0 0 2px rgba(255,255,255,0.25)}",
			".dshm-time{font-size:10px;color:rgba(255,255,255,0.75);font-variant-numeric:tabular-nums;width:80px;text-align:center;flex:none;text-shadow:0 1px 3px rgba(0,0,0,0.3)}",
			".dshm-controls{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:8px}",
			".dshm-slider{flex:1;accent-color:#31c27c;height:4px;cursor:pointer}",
			".dshm-mode{font-size:10.5px;color:rgba(255,255,255,0.8);text-shadow:0 1px 3px rgba(0,0,0,0.3);white-space:nowrap}",
			// ── inputs / lists ────────────────────────────────────────────────
			".dshm-search{display:flex;gap:6px;margin-top:8px}",
			".dshm-input{flex:1;min-width:0;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);border-radius:11px;color:#fff;font-size:12px;padding:6px 10px;outline:none;backdrop-filter:blur(6px);transition:border-color .15s ease,box-shadow .15s ease,background .15s ease}",
			".dshm-input:focus{border-color:rgba(49,194,124,0.65);background:rgba(255,255,255,0.14);box-shadow:0 0 0 3px rgba(49,194,124,0.16)}",
			".dshm-input::placeholder{color:rgba(255,255,255,0.5)}",
			".dshm-list{max-height:170px;overflow-y:auto;overflow-x:hidden;margin-top:8px;padding-top:4px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.25) transparent}",
			".dshm-list::-webkit-scrollbar{width:4px}.dshm-list::-webkit-scrollbar-track{background:transparent}.dshm-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.22);border-radius:2px}.dshm-list:hover::-webkit-scrollbar-thumb{background:rgba(49,194,124,0.5)}",
			".dshm-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:11px;cursor:pointer;font-size:11.5px;line-height:15px;color:#fff;transition:background .12s ease,transform .1s ease}",
			".dshm-item:active{transform:scale(.985)}",
			".dshm-item:hover{background:rgba(255,255,255,0.1)}",
			".dshm-item-current{background:linear-gradient(90deg,rgba(49,194,124,0.3),rgba(49,194,124,0.08));box-shadow:inset 0 0 0 1px rgba(49,194,124,0.35)}",
			".dshm-item-title{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshm-item-sub{flex:none;font-size:9.5px;color:rgba(255,255,255,0.6);max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dshm-item-cover{flex:none;width:42px;height:42px;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.2),0 2px 8px rgba(0,0,0,0.35)}",
			".dshm-item-cover img{width:100%;height:100%;object-fit:cover;display:block}",
			".dshm-item-action{flex:none;border:none;background:transparent;color:rgba(255,255,255,0.7);cursor:pointer;font-size:12px;padding:3px 6px;border-radius:8px;transition:color .12s ease,background .12s ease}",
			".dshm-item-action:hover{color:#3ddc84;background:rgba(49,194,124,0.18)}",
			".dshm-item-remove:hover{color:#ff8d9a;background:rgba(255,141,154,0.15)}",
			".dshm-item-note{flex:none;font-size:9.5px;color:#ffd23f;display:flex;align-items:center;gap:3px}",
			".dshm-empty{font-size:11px;color:rgba(255,255,255,0.6);text-align:center;padding:8px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshm-note{font-size:10px;color:rgba(255,255,255,0.5);margin-top:8px;line-height:14px;text-align:center}",
			// ── account bar ───────────────────────────────────────────────────
			".dshm-account{display:flex;align-items:center;gap:6px;margin-top:9px;padding:6px 8px;border-radius:13px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1)}",
			".dshm-account-name{flex:1;min-width:0;font-size:11px;color:#5ce6a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;display:flex;align-items:center;gap:5px;text-shadow:0 1px 3px rgba(0,0,0,0.3)}",
			".dshm-account-badge{flex:none;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#31c27c,#00a854);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;box-shadow:0 2px 6px rgba(0,190,96,0.4)}",
			".dshm-account-login{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:9px}",
			// ── login (QR) panel ──────────────────────────────────────────────
			".dshm-login{margin-top:9px;padding:12px 10px 10px;border-radius:18px;background:linear-gradient(160deg,rgba(49,194,124,0.16),rgba(255,210,63,0.05) 60%,rgba(255,255,255,0.05));border:1px solid rgba(49,194,124,0.35);display:flex;flex-direction:column;align-items:center;gap:6px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.1)}",
			".dshm-login-title{font-size:13px;font-weight:700;color:#fff;display:flex;align-items:center;gap:6px;letter-spacing:.5px}",
			".dshm-login-title .dshm-lt-badge{width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#31c27c,#00a854);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 2px 8px rgba(0,190,96,0.5)}",
			".dshm-login-sub{font-size:10.5px;color:rgba(255,255,255,0.62)}",
			".dshm-qr-wrap{position:relative;width:150px;height:150px;border-radius:18px;padding:9px;background:#fff;box-shadow:0 0 0 5px rgba(49,194,124,0.14),0 14px 36px rgba(0,0,0,0.4);animation:dshm-qr-pulse 2.6s ease-in-out infinite;flex:none}",
			"@keyframes dshm-qr-pulse{0%,100%{box-shadow:0 0 0 5px rgba(49,194,124,0.12),0 14px 36px rgba(0,0,0,0.4)}50%{box-shadow:0 0 0 11px rgba(49,194,124,0.3),0 16px 44px rgba(49,194,124,0.3)}}",
			".dshm-qr{width:100%;height:100%;border-radius:12px;display:block;background:#fff}",
			".dshm-login-status{display:flex;align-items:center;gap:7px;min-height:18px;font-size:11.5px;color:rgba(255,255,255,0.92)}",
			".dshm-status-dot{flex:none;width:8px;height:8px;border-radius:50%;background:#3ddc84;box-shadow:0 0 8px rgba(61,220,132,0.9);animation:dshm-dot 1.5s ease-in-out infinite}",
			".dshm-status-dot-warn{background:#ffd23f;box-shadow:0 0 8px rgba(255,210,63,0.9)}",
			".dshm-status-dot-err{background:#ff6b6b;box-shadow:0 0 8px rgba(255,107,107,0.9);animation:none}",
			".dshm-status-dot-ok{background:#3ddc84;box-shadow:0 0 8px rgba(61,220,132,0.9);animation:none}",
			"@keyframes dshm-dot{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}",
			".dshm-steps{display:flex;align-items:center;gap:6px;font-size:9.5px;color:rgba(255,255,255,0.55)}",
			".dshm-step{display:flex;align-items:center;gap:3px}",
			".dshm-step i{flex:none;width:14px;height:14px;border-radius:50%;background:rgba(49,194,124,0.25);color:#5ce6a8;font-style:normal;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center}",
			".dshm-step-arrow{color:rgba(255,255,255,0.3);font-size:9px}",
			".dshm-login-actions{display:flex;gap:8px;align-items:center}",
			// ── success toast ─────────────────────────────────────────────────
			".dshm-success{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:9px;padding:8px;border-radius:13px;background:linear-gradient(90deg,rgba(49,194,124,0.3),rgba(255,210,63,0.12));border:1px solid rgba(49,194,124,0.5);color:#7dffc4;font-size:11.5px;font-weight:600;animation:dshm-pop .35s cubic-bezier(.22,1,.36,1)}",
			"@keyframes dshm-pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}",
			// ── my playlists ──────────────────────────────────────────────────
			".dshm-playlists-head{display:flex;align-items:center;justify-content:space-between;margin-top:9px;padding:0 2px}",
			".dshm-playlists-title{font-size:11.5px;font-weight:700;color:#5ce6a8;display:flex;align-items:center;gap:5px}",
			".dshm-heart{color:#ff5d7a}",
			// ── error toast ───────────────────────────────────────────────────
			".dshm-error{display:flex;align-items:center;gap:7px;margin-top:8px;padding:7px 10px;border-radius:11px;background:rgba(255,107,107,0.14);border:1px solid rgba(255,107,107,0.3);color:#ffc9cd;font-size:10.5px;line-height:14px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);cursor:pointer;transition:background .15s ease}",
			".dshm-error:hover{background:rgba(255,107,107,0.22)}",
			".dshm-error svg{flex:none;opacity:0.9}",
			// ── collapsible panel ─────────────────────────────────────────────
			".dshm-panel{display:grid;grid-template-rows:0fr;transform:translateY(-10px);pointer-events:none;transition:grid-template-rows .36s cubic-bezier(.22,1,.36,1),transform .36s cubic-bezier(.22,1,.36,1)}",
			".dshm-card-expanded .dshm-panel{grid-template-rows:1fr;transform:translateY(0);pointer-events:auto}",
			".dshm-panel-inner{overflow:hidden;min-height:0}",
			// ── mini disc (auto-collapsed while playing) ──────────────────────
			".dshm-mini{position:fixed;width:" + MINI_SIZE + "px;height:" + MINI_SIZE + "px;border-radius:50%;background:linear-gradient(155deg,rgba(255,255,255,0.16),rgba(49,194,124,0.1)),rgba(10,16,14,0.62);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);border:1px solid rgba(255,255,255,0.22);box-shadow:0 8px 24px rgba(0,0,0,0.45),0 0 0 4px rgba(49,194,124,0.16),inset 0 1px 0 rgba(255,255,255,0.22);display:flex;align-items:center;justify-content:center;cursor:grab;animation:dshm-mini-pop .32s cubic-bezier(.22,1,.36,1)}",
			".dshm-mini:active{cursor:grabbing}",
			"@keyframes dshm-mini-pop{from{transform:scale(.45);opacity:0}to{transform:scale(1);opacity:1}}",
			".dshm-mini-disc{width:34px;height:34px;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,0.3);box-shadow:0 4px 12px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;background:#fff}",
			".dshm-mini-disc img{width:100%;height:100%;object-fit:cover;display:block}",
			".dshm-mini-pulse{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(49,194,124,0.55);animation:dshm-mini-pulse 2.2s ease-out infinite;pointer-events:none}",
			"@keyframes dshm-mini-pulse{0%{transform:scale(1);opacity:.75}100%{transform:scale(1.5);opacity:0}}",
			".dshm-mini-hover{box-shadow:0 8px 24px rgba(0,0,0,0.45),0 0 0 6px rgba(49,194,124,0.3),inset 0 1px 0 rgba(255,255,255,0.22)}",
			".dshm-mini-expand{position:absolute;top:-4px;right:-4px;width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);background:linear-gradient(135deg,#3ddc84,#00a854);color:#fff;font-size:13px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 10px rgba(0,190,96,0.55);animation:dshm-mini-pop .18s ease-out;padding:0}",
			".dshm-mini-close{position:absolute;bottom:-4px;left:-4px;width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);background:linear-gradient(135deg,#ff6b6b,#e03333);color:#fff;font-size:12px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 10px rgba(255,80,80,0.5);animation:dshm-mini-pop .18s ease-out;padding:0}",
			".dshm-card{animation:dshm-mini-in .28s cubic-bezier(.22,1,.36,1)}",
			"@keyframes dshm-mini-in{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}"
		].join("");

		/** Inject the player stylesheet once. */
		function injectCss() {
			if (document.getElementById("dsh-music-css")) return;
			var tag = document.createElement("style");
			tag.id = "dsh-music-css";
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		/** mm:ss formatting. */
		function formatTime(seconds) {
			if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
			var m = Math.floor(seconds / 60);
			var s = Math.floor(seconds % 60);
			return m + ":" + (s < 10 ? "0" : "") + s;
		}

		/** Cover hue for a queue position. */
		function coverStyle(index) {
			return { background: "linear-gradient(135deg, hsl(" + ((index * 47) % 360) + ",62%,52%), hsl(" + (((index * 47) + 60) % 360) + ",62%,38%))" };
		}

		/**
		 * Cover art: round vinyl-style disc that spins while playing.
		 * Album image when available, gradient placeholder otherwise.
		 */
		function CoverArt(props) {
			var cls = "dshm-cover" + (props.large ? " dshm-cover-lg" : "") + " dshm-cover-spinning";
			var style = props.cover
				? { animationPlayState: props.spinning ? "running" : "paused" }
				: Object.assign(coverStyle(props.index || 0), { animationPlayState: props.spinning ? "running" : "paused" });
			var inner = props.cover
				? h("img", { src: props.cover, alt: "", draggable: false })
				: h("svg", {
					width: props.large ? 26 : 18,
					height: props.large ? 26 : 18,
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 2,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					style: { opacity: 0.9 }
				}, [
					h("path", { d: "M9 18V5l12-2v13" }),
					h("circle", { cx: 6, cy: 18, r: 3 }),
					h("circle", { cx: 18, cy: 16, r: 3 })
				]);
			return h("div", { className: cls, style: style }, inner);
		}

		/** Hand-drawn stroke icon set (Feather/Lucide style, currentColor). */
		var ICONS = {
			play: [["polygon", { points: "7 5 18 12 7 19", fill: "currentColor", stroke: "none" }]],
			pause: [
				["rect", { x: 6.5, y: 4.5, width: 3.6, height: 15, rx: 1, fill: "currentColor", stroke: "none" }],
				["rect", { x: 13.9, y: 4.5, width: 3.6, height: 15, rx: 1, fill: "currentColor", stroke: "none" }]
			],
			prev: [
				["polygon", { points: "19 20 9 12 19 4" }],
				["line", { x1: 5, y1: 19, x2: 5, y2: 5 }]
			],
			next: [
				["polygon", { points: "5 4 15 12 5 20" }],
				["line", { x1: 19, y1: 5, x2: 19, y2: 19 }]
			],
			shuffle: [
				["polyline", { points: "16 3 21 3 21 8" }],
				["line", { x1: 4, y1: 20, x2: 21, y2: 3 }],
				["polyline", { points: "21 16 21 21 16 21" }],
				["line", { x1: 15, y1: 15, x2: 21, y2: 21 }],
				["line", { x1: 4, y1: 4, x2: 9, y2: 9 }]
			],
			repeat: [
				["polyline", { points: "17 1 21 5 17 9" }],
				["path", { d: "M3 11V9a4 4 0 0 1 4-4h14" }],
				["polyline", { points: "7 23 3 19 7 15" }],
				["path", { d: "M21 13v2a4 4 0 0 1-4 4H3" }]
			],
			repeatOne: [
				["polyline", { points: "17 1 21 5 17 9" }],
				["path", { d: "M3 11V9a4 4 0 0 1 4-4h14" }],
				["polyline", { points: "7 23 3 19 7 15" }],
				["path", { d: "M21 13v2a4 4 0 0 1-4 4H3" }],
				["path", { d: "M11 10h1v4" }]
			],
			volume: [
				["polygon", { points: "11 5 6 9 2 9 2 15 6 15 11 19 11 5" }],
				["path", { d: "M15.54 8.46a5 5 0 0 1 0 7.07" }]
			],
			search: [
				["circle", { cx: 11, cy: 11, r: 8 }],
				["line", { x1: 21, y1: 21, x2: 16.65, y2: 16.65 }]
			],
			import_: [
				["path", { d: "M3 5h13" }],
				["path", { d: "M3 11h13" }],
				["path", { d: "M3 17h7" }],
				["line", { x1: 18, y1: 15, x2: 18, y2: 21 }],
				["line", { x1: 15, y1: 18, x2: 21, y2: 18 }]
			],
			chevronDown: [["polyline", { points: "6 9 12 15 18 9" }]],
			chevronUp: [["polyline", { points: "6 15 12 9 18 15" }]],
			arrowLeft: [
				["line", { x1: 19, y1: 12, x2: 5, y2: 12 }],
				["polyline", { points: "12 19 5 12 12 5" }]
			],
			plus: [
				["line", { x1: 12, y1: 5, x2: 12, y2: 19 }],
				["line", { x1: 5, y1: 12, x2: 19, y2: 12 }]
			],
			close: [
				["line", { x1: 18, y1: 6, x2: 6, y2: 18 }],
				["line", { x1: 6, y1: 6, x2: 18, y2: 18 }]
			],
			restore: [
				["polyline", { points: "1 4 1 10 7 10" }],
				["path", { d: "M3.51 15a9 9 0 1 0 2.13-9.36L1 10" }]
			],
			user: [
				["path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }],
				["circle", { cx: 12, cy: 7, r: 4 }]
			],
			list: [
				["line", { x1: 8, y1: 6, x2: 21, y2: 6 }],
				["line", { x1: 8, y1: 12, x2: 21, y2: 12 }],
				["line", { x1: 8, y1: 18, x2: 21, y2: 18 }],
				["line", { x1: 3, y1: 6, x2: 3.01, y2: 6 }],
				["line", { x1: 3, y1: 12, x2: 3.01, y2: 12 }],
				["line", { x1: 3, y1: 18, x2: 3.01, y2: 18 }]
			],
			refresh: [
				["polyline", { points: "23 4 23 10 17 10" }],
				["path", { d: "M20.49 15a9 9 0 1 1-2.12-9.36L23 10" }]
			],
			logout: [
				["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }],
				["polyline", { points: "16 17 21 12 16 7" }],
				["line", { x1: 21, y1: 12, x2: 9, y2: 12 }]
			],
			check: [["polyline", { points: "20 6 9 17 4 12" }]],
			heart: [["path", { d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" }]],
			alert: [
				["path", { d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }],
				["line", { x1: 12, y1: 9, x2: 12, y2: 13 }],
				["line", { x1: 12, y1: 17, x2: 12.01, y2: 17 }]
			],
			qq: [
				["path", { d: "M21.74 13.02a8 8 0 0 0-1.25-4.4 8.5 8.5 0 0 0-3.06-2.94 9 9 0 0 0-4.18-.94 9.1 9.1 0 0 0-4.2.95 8.4 8.4 0 0 0-3.06 2.95A8.1 8.1 0 0 0 4.1 13.1a8.2 8.2 0 0 0 .82 3.48 8 8 0 0 0 2.36 2.9 8.6 8.6 0 0 0 3.52 1.52 8.7 8.7 0 0 0 2.03.04 8.7 8.7 0 0 0 2.03-.04 8.6 8.6 0 0 0 3.52-1.52 8 8 0 0 0 2.36-2.9 8.2 8.2 0 0 0 .82-3.48z" }],
				["circle", { cx: 9, cy: 13, r: 1.3, fill: "currentColor", stroke: "none" }],
				["circle", { cx: 15, cy: 13, r: 1.3, fill: "currentColor", stroke: "none" }],
				["path", { d: "M12 14.5c.9 0 1.6.4 2 .9-.5.5-1.3.9-2 .9s-1.5-.4-2-.9c.4-.5 1.1-.9 2-.9z", fill: "currentColor", stroke: "none" }]
			]
		};

		/** Render one named icon as an inline SVG. */
		function Icon(props) {
			return h("svg", {
				width: props.size || 14,
				height: props.size || 14,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: props.thin ? 1.8 : 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				style: { display: "block", flex: "none" }
			}, (ICONS[props.name] || []).map(function (part) {
				return h(part[0], part[1]);
			}));
		}

		/** Resolve a possibly-relative track URL against the page origin. */
		function resolveUrl(url) {
			try { return new URL(url, location.href).href; } catch { return url; }
		}

		/** Fetch the current host state. */
		function fetchState() {
			return fetch("/dsh-music/state", { cache: "no-store" }).then(function (res) {
				if (!res.ok) throw new Error("state " + res.status);
				return res.json();
			});
		}

		/** Post a player intent; resolves to the applied state. */
		function postCommand(command) {
			return fetch("/dsh-music/command", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(command)
			}).then(function (res) {
				return res.json();
			});
		}

		/** Search QQ Music through the host proxy. */
		function qqSearch(query) {
			return fetch("/dsh-music/qq/search?q=" + encodeURIComponent(query), { cache: "no-store" })
				.then(function (res) { return res.json(); });
		}

		/**
		 * The floating player. Compact and draggable: the mini bar
		 * collapses into a card with progress, volume, modes, the queue,
		 * a QQ Music search panel and the account login panel.
		 */
		function MusicPlayer() {
			var audioRef = react.useRef(null);
			var lastRef = react.useRef({ key: "", index: -1, playing: false });
			var posRef = react.useRef(null); // {x, y} | null = default bottom-right
			var dragRef = react.useRef(null);
			var suppressClickRef = react.useRef(false);
			var [remote, setRemote] = react.useState(null);
			var [pos, setPos] = react.useState(null);
			var [collapsed, setCollapsed] = react.useState(function () {
				try { return localStorage.getItem(STORE_COLLAPSED) === "1"; } catch { return false; }
			});
			var [current, setCurrent] = react.useState(0);
			var [duration, setDuration] = react.useState(0);
			var [error, setError] = react.useState(null);
			var [searchMode, setSearchMode] = react.useState(false);
			var [searchQuery, setSearchQuery] = react.useState("");
			var [searching, setSearching] = react.useState(false);
			var [results, setResults] = react.useState(null);
			var [searchError, setSearchError] = react.useState(null);
			var [playlistDraft, setPlaylistDraft] = react.useState("");
			// QQ account login state.
			var [loginInfo, setLoginInfo] = react.useState(null);
			var [loginQr, setLoginQr] = react.useState(null);
			var [loginState, setLoginState] = react.useState(null);
			var [myLists, setMyLists] = react.useState(null);
			// Mini-disc auto-collapse while playing.
			var [mini, setMini] = react.useState(false);
			var [miniHover, setMiniHover] = react.useState(false);
			// Player hidden (closed) state — music keeps playing; a small
			// reopen button stays in the corner.
			var [hidden, setHidden] = react.useState(function () {
				try { return localStorage.getItem(STORE_HIDDEN) === "1"; } catch { return false; }
			});
			var hiddenRef = react.useRef(hidden);
			hiddenRef.current = hidden;
			var miniLeaveTimerRef = react.useRef(null);
			var miniClicksRef = react.useRef(0);
			var miniClickTimerRef = react.useRef(null);
			var playingRef = react.useRef(false);
			// Resume progress & playback quality.
			var [quality, setQuality] = react.useState(function () {
				try { return localStorage.getItem(STORE_QUALITY) === "320" ? "320" : "128"; } catch { return "128"; }
			});
			var pendingSeekRef = react.useRef(null);
			var lastProgressSaveRef = react.useRef(0);
			var qualityRef = react.useRef(quality);
			qualityRef.current = quality;

			// Restore the saved position, or fall back to the bottom-right corner.
			var restorePos = function () {
				try {
					var x = localStorage.getItem(STORE_X);
					var y = localStorage.getItem(STORE_Y);
					if (x !== null && y !== null) {
						var p = { x: Number(x), y: Number(y) };
						if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
							posRef.current = p;
							setPos(p);
							return;
						}
					}
				} catch { /* ignore */ }
				posRef.current = null;
				setPos(null);
			};
			react.useEffect(restorePos, []);

			// First run shows the full card as onboarding; afterwards the
			// player starts (and reopens) as a snapped mini disc.
			react.useEffect(function () {
				try {
					if (localStorage.getItem(STORE_ONBOARDED) === "1") {
						snapMiniPosition();
						setMini(true);
					} else {
						localStorage.setItem(STORE_ONBOARDED, "1");
					}
				} catch { /* ignore */ }
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, []);

			// Keep the card inside the viewport (height changes when collapsing).
			react.useEffect(function () {
				var height = collapsed ? 52 : EXPANDED_HEIGHT;
				var p = posRef.current;
				if (p) {
					var clamped = {
						x: Math.max(4, Math.min(window.innerWidth - WIDTH - 4, p.x)),
						y: Math.max(4, Math.min(window.innerHeight - height - 4, p.y))
					};
					if (clamped.x !== p.x || clamped.y !== p.y) {
						posRef.current = clamped;
						setPos(clamped);
					}
				}
			}, [collapsed]);

			// Consecutive failed tracks before we stop auto-skipping.
			var errorSkipRef = react.useRef(0);
			// Timestamp of the last explicit user action; failures right after a
			// user gesture must NOT auto-skip (respect the user's intent).
			var lastUserOpRef = react.useRef(0);

			// Own the audio element for the component lifetime.
			react.useEffect(function () {
				var audio = new Audio();
				audio.preload = "auto";
				audio.volume = 0.8;
				audioRef.current = audio;
				var onTime = function () {
					setCurrent(audio.currentTime);
					// Throttled resume-progress save.
					var trackId = audio.dataset ? audio.dataset.trackId : "";
					if (trackId && audio.currentTime > 3) {
						var now = Date.now();
						if (now - lastProgressSaveRef.current > 5000) {
							lastProgressSaveRef.current = now;
							try {
								localStorage.setItem(PROGRESS_KEY, JSON.stringify({ id: trackId, time: audio.currentTime, at: now }));
							} catch { /* ignore */ }
						}
					}
				};
				var onMeta = function () {
					var d = audio.duration || 0;
					setDuration(d);
					// Resume from the saved position when it still makes sense.
					var pending = pendingSeekRef.current;
					var trackId = audio.dataset ? audio.dataset.trackId : "";
					if (pending && pending.id === trackId && d > 0 && pending.time > 5 && pending.time < d - 10) {
						audio.currentTime = pending.time;
					}
					pendingSeekRef.current = null;
				};
				var onEnded = function () {
					var trackId = audio.dataset ? audio.dataset.trackId : "";
					if (trackId) {
						try {
							var saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
							if (saved && saved.id === trackId) localStorage.removeItem(PROGRESS_KEY);
						} catch { /* ignore */ }
					}
					postCommand({ action: "ended" }).then(function (state) {
						if (state && state.queue) {
							setRemote(state);
							applyStateToAudio(state);
						}
					}).catch(function () {});
				};
				var onPlaying = function () { errorSkipRef.current = 0; };
				var onError = function () {
					// Reset the element so a bad source cannot wedge future play() calls.
					audio.removeAttribute("src");
					audio.load();
					var count = errorSkipRef.current;
					var recentUserOp = Date.now() - lastUserOpRef.current < 3000;
					if (!recentUserOp && count < 3 && lastRef.current.playing) {
						// Auto-skip only during unattended playback (e.g. one dead
						// VIP track in the middle of a queue); never right after a
						// user click, or the player would seem to hijack gestures.
						errorSkipRef.current = count + 1;
						setError(null);
						postCommand({ action: "next" }).then(function (state) {
							if (state && state.queue) {
								setRemote(state);
								applyStateToAudio(state);
							}
						}).catch(function () {});
					} else {
						errorSkipRef.current = 0;
						setError("播放失败：音频源不可达或格式不支持");
					}
				};
				audio.addEventListener("timeupdate", onTime);
				audio.addEventListener("loadedmetadata", onMeta);
				audio.addEventListener("ended", onEnded);
				audio.addEventListener("playing", onPlaying);
				audio.addEventListener("error", onError);
				return function () {
					audio.pause();
					audio.removeEventListener("timeupdate", onTime);
					audio.removeEventListener("loadedmetadata", onMeta);
					audio.removeEventListener("ended", onEnded);
					audio.removeEventListener("playing", onPlaying);
					audio.removeEventListener("error", onError);
				};
			}, []);

			/** Track URL with the selected quality appended (host proxy param). */
			var trackUrl = function (track) {
				var url = resolveUrl(track.url);
				if (qualityRef.current === "320") {
					return url + (url.indexOf("?") >= 0 ? "&" : "?") + "q=320";
				}
				return url;
			};

			// Ask the audio element to play the current track, healing a wedged
			// or errored source before retrying.
			var tryPlay = function (state) {
				var audio = audioRef.current;
				if (!audio) return;
				var track = state.queue[state.index];
				if (track) {
					var url = trackUrl(track);
					if (audio.src !== url || audio.error) {
						audio.src = url;
						setCurrent(0);
						setDuration(0);
					}
				}
				audio.play().catch(function (err) {
					if (err && err.name === "NotAllowedError") setError("浏览器拦截了自动播放，点一下播放按钮即可");
					else setError("播放失败：音频源不可达或格式不支持");
				});
			};

			// Apply one host state snapshot to the audio element (idempotent diff).
			var applyStateToAudio = function (state) {
				var audio = audioRef.current;
				if (!audio) return;
				var key = state.queue.map(function (t) { return t.id; }).join("|");
				var last = lastRef.current;
				if (key !== last.key || state.index !== last.index) {
					last.key = key;
					last.index = state.index;
					last.playing = state.playing;
					var track = state.queue[state.index];
					if (track) {
						var url = trackUrl(track);
						if (audio.src !== url) {
							audio.src = url;
							if (audio.dataset) audio.dataset.trackId = track.id;
							// Prepare a resume seek from the saved progress.
							pendingSeekRef.current = null;
							try {
								var saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
								if (saved && saved.id === track.id && saved.time > 5) {
									pendingSeekRef.current = { id: track.id, time: saved.time };
								}
							} catch { /* ignore */ }
							setCurrent(0);
							setDuration(0);
							setError(null);
						}
						if (state.playing) tryPlay(state);
						else audio.pause();
					}
				} else if (state.playing !== last.playing) {
					last.playing = state.playing;
					if (state.playing) tryPlay(state);
					else audio.pause();
				}
				if (Math.abs(audio.volume - state.volume) > 0.01) audio.volume = state.volume;
			};

			// Poll the host state and apply diffs to the audio element. Also
			// checks the visibility bridge: the agent can ask to reopen the
			// player after it was closed (fully hidden).
			react.useEffect(function () {
				var alive = true;
				var poll = function () {
					fetchState().then(function (state) {
						if (!alive) return;
						setRemote(state);
						applyStateToAudio(state);
					}).catch(function () { /* host restarting */ });
					fetch("/dsh-music/visibility", { cache: "no-store" }).then(function (res) {
						return res.json();
					}).then(function (visibility) {
						if (!alive || !visibility || !visibility.show || !hiddenRef.current) return;
						fetch("/dsh-music/visibility", {
							method: "POST",
							headers: { "content-type": "application/json" },
							body: JSON.stringify({ show: false })
						}).catch(function () {});
						try { localStorage.setItem(STORE_HIDDEN, "0"); } catch { /* ignore */ }
						setHidden(false);
						snapMiniPosition();
						setMini(true);
					}).catch(function () {});
				};
				poll();
				var timer = setInterval(poll, POLL_MS);
				return function () { alive = false; clearInterval(timer); };
			}, []);

			// Error toast auto-dismisses after a few seconds.
			react.useEffect(function () {
				if (!error) return;
				var timer = setTimeout(function () { setError(null); }, 6000);
				return function () { clearTimeout(timer); };
			}, [error]);

			// Login-success toast auto-dismisses.
			react.useEffect(function () {
				if (!loginState || loginState.state !== "done") return;
				var timer = setTimeout(function () { setLoginState(null); }, 3500);
				return function () { clearTimeout(timer); };
			}, [loginState]);

			// ── drag to reposition ─────────────────────────────────────────────
			var startDrag = function (event) {
				if (event.button !== 0) return;
				dragRef.current = {
					startX: event.clientX,
					startY: event.clientY,
					origX: posRef.current ? posRef.current.x : null,
					origY: posRef.current ? posRef.current.y : null,
					moved: false
				};
				window.addEventListener("mousemove", onDragMove);
				window.addEventListener("mouseup", onDragUp);
			};
			var onDragMove = function (event) {
				var drag = dragRef.current;
				if (!drag) return;
				var dx = event.clientX - drag.startX;
				var dy = event.clientY - drag.startY;
				if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
				drag.moved = true;
				// Clamp with the CURRENT shape's size: the mini disc must be
				// draggable across the full viewport, edge to edge.
				var size = mini ? MINI_SIZE : WIDTH;
				var height = mini ? MINI_SIZE : (collapsed ? 52 : EXPANDED_HEIGHT);
				var baseX = drag.origX !== null ? drag.origX : window.innerWidth - WIDTH - 18;
				var baseY = drag.origY !== null ? drag.origY : window.innerHeight - height - 18;
				var x = Math.max(0, Math.min(window.innerWidth - size, baseX + dx));
				var y = Math.max(0, Math.min(window.innerHeight - height, baseY + dy));
				posRef.current = { x: x, y: y };
				setPos({ x: x, y: y });
			};
			var onDragUp = function () {
				var drag = dragRef.current;
				dragRef.current = null;
				window.removeEventListener("mousemove", onDragMove);
				window.removeEventListener("mouseup", onDragUp);
				if (drag && drag.moved) {
					suppressClickRef.current = true;
					// Mini disc: snap to the nearer screen edge (floating-ball
					// behavior) with a short slide animation.
					if (mini) snapMiniPosition();
					try {
						localStorage.setItem(STORE_X, String(posRef.current.x));
						localStorage.setItem(STORE_Y, String(posRef.current.y));
					} catch { /* ignore */ }
				}
			};
			var handleClick = function (handler) {
				return function (event) {
					if (suppressClickRef.current) {
						suppressClickRef.current = false;
						return;
					}
					handler(event);
				};
			};

			// Keep the queue list's wheel scrolling from bleeding into the page:
			// at the edges, swallow the gesture instead of scrolling the document.
			var stopListWheel = function (event) {
				var el = event.currentTarget;
				if (el.scrollHeight <= el.clientHeight + 1) return;
				var atTop = el.scrollTop <= 0;
				var atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
				if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
					event.preventDefault();
				}
			};

			// FLIP shared play/next buttons between the header and the controls row:
			// Preferred: the View Transitions API (browser-native same-element
			// cross-position transition). Fallback: manual FLIP.
			var playFlipRef = react.useRef(null);
			var nextFlipRef = react.useRef(null);
			var flipFromRef = react.useRef(null);

			var toggleCollapsed = function () {
				// Record the old button rects for the manual-FLIP fallback.
				var p = playFlipRef.current;
				var n = nextFlipRef.current;
				flipFromRef.current = {
					play: p ? p.getBoundingClientRect() : null,
					next: n ? n.getBoundingClientRect() : null
				};
				var apply = function () {
					setCollapsed(function (prev) {
						var next = !prev;
						try { localStorage.setItem(STORE_COLLAPSED, next ? "1" : "0"); } catch { /* ignore */ }
						return next;
					});
				};
				if (document.startViewTransition && react_dom.flushSync) {
					document.startViewTransition(function () {
						react_dom.flushSync(apply);
					});
				} else {
					apply();
				}
			};

			// Manual FLIP fallback (used when View Transitions is unavailable).
			react.useLayoutEffect(function () {
				var from = flipFromRef.current;
				flipFromRef.current = null;
				if (!from) return;
				var fly = function (el, fromRect) {
					if (!el || !fromRect) return;
					var to = el.getBoundingClientRect();
					var dx = fromRect.left - to.left;
					var dy = fromRect.top - to.top;
					var sx = fromRect.width / to.width;
					var sy = fromRect.height / to.height;
					el.style.transition = "none";
					el.style.transform = "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")";
					void el.getBoundingClientRect(); // commit the initial frame
					requestAnimationFrame(function () {
						el.style.transition = "transform .38s cubic-bezier(.22,1,.36,1)";
						el.style.transform = "";
					});
				};
				fly(playFlipRef.current, from.play);
				fly(nextFlipRef.current, from.next);
			}, [collapsed]);
			var run = function (command) {
				lastUserOpRef.current = Date.now();
				postCommand(command).then(function (state) {
					if (state && state.queue) {
						setRemote(state);
						applyStateToAudio(state);
					}
				}).catch(function () { setError("播放器服务连接失败，稍后重试"); });
			};
			// ── draggable progress bar ─────────────────────────────────────────
			var progressRef = react.useRef(null);
			var draggingRef = react.useRef(false);
			var [dragRatio, setDragRatio] = react.useState(null);

			var seekTo = function (ratio) {
				var audio = audioRef.current;
				if (audio && Number.isFinite(duration) && duration > 0) {
					audio.currentTime = ratio * duration;
				}
			};
			var progressRatio = function (event, el) {
				var rect = (el || event.currentTarget).getBoundingClientRect();
				return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
			};
			var onProgressMove = function (event) {
				var el = progressRef.current;
				if (!el || !draggingRef.current) return;
				var ratio = progressRatio(event, el);
				setDragRatio(ratio);
				seekTo(ratio);
			};
			var onProgressUp = function () {
				draggingRef.current = false;
				setDragRatio(null);
				window.removeEventListener("mousemove", onProgressMove);
				window.removeEventListener("mouseup", onProgressUp);
			};
			var onProgressDown = function (event) {
				if (event.button !== 0) return;
				draggingRef.current = true;
				var ratio = progressRatio(event);
				setDragRatio(ratio);
				seekTo(ratio);
				window.addEventListener("mousemove", onProgressMove);
				window.addEventListener("mouseup", onProgressUp);
			};
			var volume = function (event) {
				var value = Number(event.target.value);
				if (audioRef.current) audioRef.current.volume = value;
				run({ action: "volume", volume: value });
			};
			var cycleMode = function () {
				var order = { list: "single", single: "shuffle", shuffle: "list" };
				var mode = remote ? (order[remote.mode] || "list") : "list";
				run({ action: "mode", mode: mode });
			};
			// Toggle playback quality (128k standard / 320k HD for logged-in
			// VIP accounts) and reload the current track with the new setting.
			var cycleQuality = function () {
				var next = quality === "320" ? "128" : "320";
				try { localStorage.setItem(STORE_QUALITY, next); } catch { /* ignore */ }
				setQuality(next);
				qualityRef.current = next;
				var audio = audioRef.current;
				if (audio && track) {
					var url = trackUrl(track);
					if (audio.src !== url) {
						audio.src = url;
						audio.load();
						setCurrent(0);
						setDuration(0);
						pendingSeekRef.current = null;
						if (playing) {
							audio.play().catch(function () { /* user gesture chain */ });
						}
					}
				}
			};
			var doSearch = function () {
				var query = searchQuery.trim();
				if (!query) return;
				setSearching(true);
				setSearchError(null);
				setResults(null);
				qqSearch(query).then(function (data) {
					setSearching(false);
					if (data.error) {
						setSearchError(String(data.error));
						setResults([]);
						return;
					}
					setResults(data.songs || []);
				}).catch(function () {
					setSearching(false);
					setSearchError("搜索失败（网络或服务问题）");
					setResults([]);
				});
			};
			var addQq = function (song) {
				run({
					action: "add",
					url: "/dsh-music/qq/stream?id=" + encodeURIComponent(song.id),
					title: song.name + " - " + song.artist
				});
			};
			var importPlaylist = function () {
				var raw = playlistDraft.trim();
				var match = /(\d+)/.exec(raw);
				if (!raw || !match) {
					setSearchError("请输入歌单 id 或分享链接");
					return;
				}
				run({ action: "importPlaylist", id: match[1], clear: true });
				setPlaylistDraft("");
				setSearchMode(false);
				setResults(null);
				setSearchError(null);
			};

			// ── QQ account login ─────────────────────────────────────────────
			var refreshLoginStatus = function () {
				fetch("/dsh-music/qq/login/status", { cache: "no-store" }).then(function (res) {
					return res.json();
				}).then(function (data) {
					setLoginInfo(data);
				}).catch(function () {});
			};
			react.useEffect(refreshLoginStatus, []);
			var startLogin = function () {
				setLoginState({ state: "starting", message: "正在获取二维码…" });
				setMyLists(null);
				fetch("/dsh-music/qq/login/start", { method: "POST" }).then(function (res) {
					return res.json();
				}).then(function (data) {
					if (data.error) {
						setLoginState({ state: "failed", message: String(data.error) });
						return;
					}
					setLoginQr(data);
					setLoginState({ state: "waiting", message: "请使用手机 QQ 扫一扫" });
				}).catch(function () {
					setLoginState({ state: "failed", message: "无法连接登录服务" });
				});
			};
			var cancelLogin = function () {
				fetch("/dsh-music/qq/login/cancel", { method: "POST" }).catch(function () {});
				setLoginQr(null);
				setLoginState(null);
			};
			var logoutLogin = function () {
				fetch("/dsh-music/qq/login/logout", { method: "POST" }).then(function () {
					setLoginInfo(null);
					setMyLists(null);
				}).catch(function () {});
			};
			var loadMyPlaylists = function () {
				setMyLists([]);
				fetch("/dsh-music/qq/my-playlists", { cache: "no-store" }).then(function (res) {
					return res.json();
				}).then(function (data) {
					if (data.error) {
						setMyLists({ error: String(data.error) });
						return;
					}
					setMyLists(data.playlists || []);
				}).catch(function () {
					setMyLists({ error: "加载失败" });
				});
			};
			var importMyPlaylist = function (id) {
				run({ action: "importPlaylist", id: id, clear: true });
				setMyLists(null);
				setLoginQr(null);
				setLoginState(null);
			};
			// Poll the QR login state while a session is active.
			react.useEffect(function () {
				if (!loginQr) return;
				var alive = true;
				var poll = function () {
					fetch("/dsh-music/qq/login/poll", { cache: "no-store" }).then(function (res) {
						return res.json();
					}).then(function (data) {
						if (!alive || !loginQr) return;
						if (data.error) {
							setLoginState({ state: "failed", message: String(data.error) });
							return;
						}
						if (data.state === "done") {
							setLoginQr(null);
							setLoginState({ state: "done", message: "登录成功" });
							refreshLoginStatus();
							return;
						}
						if (data.state === "none") return;
						setLoginState(data);
					}).catch(function () {});
				};
				poll();
				var timer = setInterval(poll, 2000);
				return function () { alive = false; clearInterval(timer); };
			}, [loginQr]);

			var track = remote && remote.queue[remote.index] ? remote.queue[remote.index] : null;
			var playing = Boolean(remote && remote.playing);
			playingRef.current = playing;
			var modeLabel = { list: "列表循环", single: "单曲循环", shuffle: "随机播放" };
			var modeIcon = { list: "repeat", single: "repeatOne", shuffle: "shuffle" };
			var cardStyle = pos
				? { position: "fixed", left: pos.x, top: pos.y }
				: { position: "fixed", right: 18, bottom: 18 };
			// Mini disc style: smooth slide when snapping to an edge, none
			// while dragging (so the disc follows the cursor 1:1).
			var miniStyle = pos
				? {
					position: "fixed",
					left: pos.x,
					top: pos.y,
					transition: pos.snap
						? "left .24s cubic-bezier(.22,1,.36,1), top .24s cubic-bezier(.22,1,.36,1)"
						: "none"
				}
				: { position: "fixed", right: 18, bottom: 18 };
			var expanded = !collapsed;

			// ── mini disc: auto-collapse while idle (playing or not) ──────────
			// Snap the disc to the nearer screen edge (floating-ball behavior).
			var snapMiniPosition = function () {
				var p = posRef.current;
				if (!p) return;
				var distanceRight = window.innerWidth - (p.x + MINI_SIZE);
				var snappedX = p.x < distanceRight ? 8 : window.innerWidth - MINI_SIZE - 8;
				var y = Math.max(4, Math.min(window.innerHeight - MINI_SIZE - 4, p.y));
				posRef.current = { x: snappedX, y: y, snap: true };
				setPos({ x: snappedX, y: y, snap: true });
			};
			// Collapse to the mini disc after the mouse leaves for 5 seconds —
			// regardless of playback state, so an idle player never lingers as
			// a large bar.
			var onCardLeave = function () {
				if (miniLeaveTimerRef.current) clearTimeout(miniLeaveTimerRef.current);
				miniLeaveTimerRef.current = setTimeout(function () {
					miniLeaveTimerRef.current = null;
					snapMiniPosition();
					setMini(true);
				}, 5000);
			};
			// Close (hide) the player; music keeps playing. A small reopen
			// button appears in the corner.
			var closePlayer = function (event) {
				if (event && event.stopPropagation) event.stopPropagation();
				try { localStorage.setItem(STORE_HIDDEN, "1"); } catch { /* ignore */ }
				setHidden(true);
			};
			var reopenPlayer = function () {
				try { localStorage.setItem(STORE_HIDDEN, "0"); } catch { /* ignore */ }
				setHidden(false);
				// Reopen as a snapped mini disc by default; hover + to expand.
				snapMiniPosition();
				setMini(true);
			};
			// Let the settings card (or anything else) show/hide the player.
			react.useEffect(function () {
				var onSetHidden = function (event) {
					var next = Boolean(event.detail);
					try { localStorage.setItem(STORE_HIDDEN, next ? "1" : "0"); } catch { /* ignore */ }
					if (next) {
						setHidden(true);
					} else {
						setHidden(false);
						snapMiniPosition();
						setMini(true);
					}
				};
				window.addEventListener("dsh-music:set-hidden", onSetHidden);
				return function () { window.removeEventListener("dsh-music:set-hidden", onSetHidden); };
			}, []);
			var onCardEnter = function () {
				if (miniLeaveTimerRef.current) {
					clearTimeout(miniLeaveTimerRef.current);
					miniLeaveTimerRef.current = null;
				}
			};
			// Expand from the mini disc, nudging a screen-edge-snapped position
			// back inside the viewport for the full card.
			var expandFromMini = function () {
				var p = posRef.current;
				if (p) {
					var clamped = {
						x: Math.max(4, Math.min(window.innerWidth - WIDTH - 4, p.x)),
						y: Math.max(4, Math.min(window.innerHeight - EXPANDED_HEIGHT - 4, p.y))
					};
					if (clamped.x !== p.x || clamped.y !== p.y) {
						posRef.current = clamped;
						setPos(clamped);
					}
				}
				setMini(false);
			};
			// Double-click the disc -> next track; triple-click -> previous.
			var handleMiniClick = function (event) {
				if (suppressClickRef.current) {
					suppressClickRef.current = false;
					return;
				}
				miniClicksRef.current += 1;
				if (miniClickTimerRef.current) clearTimeout(miniClickTimerRef.current);
				miniClickTimerRef.current = setTimeout(function () {
					var count = miniClicksRef.current;
					miniClicksRef.current = 0;
					if (count === 2) run({ action: "next" });
					else if (count >= 3) run({ action: "prev" });
				}, 260);
			};
			// Global keyboard shortcuts: Space toggles play, arrows skip tracks
			// (ignored while typing in an input).
			react.useEffect(function () {
				var onKey = function (event) {
					var target = event.target;
					if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
					if (event.code === "Space") {
						event.preventDefault();
						run({ action: playing ? "pause" : "play" });
					} else if (event.code === "ArrowRight") {
						event.preventDefault();
						run({ action: "next" });
					} else if (event.code === "ArrowLeft") {
						event.preventDefault();
						run({ action: "prev" });
					}
				};
				window.addEventListener("keydown", onKey);
				return function () { window.removeEventListener("keydown", onKey); };
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, [playing]);

			// Login panel status dot class / text.
			var loginStateKind = loginState ? loginState.state : "none";
			var statusDotClass = "dshm-status-dot";
			if (loginStateKind === "scanned") statusDotClass += " dshm-status-dot-warn";
			else if (loginStateKind === "failed" || loginStateKind === "expired") statusDotClass += " dshm-status-dot-err";
			else if (loginStateKind === "done") statusDotClass += " dshm-status-dot-ok";

			// Hidden (closed) state: the player fully disappears from the page
			// (no corner button). Reopen via the settings card button or by
			// telling the agent to show the player (visibility bridge).
			if (hidden) return null;

			// Mini disc view: spinning album art while playing. Draggable; it
			// snaps to screen edges on drop. Hovering shows an expand button —
			// it never auto-expands, so the disc can be grabbed reliably.
			if (mini) {
				return h("div", {
					className: "dshm-mini" + (miniHover ? " dshm-mini-hover" : ""),
					style: miniStyle,
					onMouseDown: startDrag,
					onMouseEnter: function () { setMiniHover(true); },
					onMouseLeave: function () { setMiniHover(false); },
					onClick: handleMiniClick,
					title: "双击：下一首 · 三击：上一首 · 按住拖动，松手自动贴边"
				}, [
					playing ? h("span", { className: "dshm-mini-pulse" }) : null,
					h("div", {
						className: "dshm-mini-disc",
						style: { animationPlayState: playing ? "running" : "paused" }
					}, track && track.cover
						? h("img", { src: track.cover, alt: "", draggable: false })
						: h("div", {
							style: Object.assign(coverStyle(remote ? remote.index : 0), {
								width: "100%", height: "100%",
								display: "flex", alignItems: "center", justifyContent: "center"
							})
						}, h("svg", {
							width: 16, height: 16, viewBox: "0 0 24 24",
							fill: "none", stroke: "currentColor", strokeWidth: 2,
							strokeLinecap: "round", strokeLinejoin: "round", style: { opacity: 0.9 }
						}, [
							h("path", { d: "M9 18V5l12-2v13" }),
							h("circle", { cx: 6, cy: 18, r: 3 }),
							h("circle", { cx: 18, cy: 16, r: 3 })
						]))),
					miniHover
						? h("button", {
							className: "dshm-mini-expand",
							title: "展开播放器",
							onMouseDown: function (event) { event.stopPropagation(); },
							onClick: function (event) {
								event.stopPropagation();
								expandFromMini();
							}
						}, "+")
						: null,
					miniHover
						? h("button", {
							className: "dshm-mini-close",
							title: "关闭播放器（音乐继续播放）",
							onMouseDown: function (event) { event.stopPropagation(); },
							onClick: function (event) {
								event.stopPropagation();
								closePlayer();
							}
						}, "×")
						: null
				]);
			}

			return h("div", {
				style: cardStyle,
				onMouseEnter: onCardEnter,
				onMouseLeave: onCardLeave
			}, h("div", { className: "dshm-card" + (expanded ? " dshm-card-expanded" : "") }, [
				// ── header: spinning cover + meta + action groups ─────────────
				h("div", {
					className: "dshm-header dshm-drag" + (collapsed ? " dshm-header-mini" : ""),
					onMouseDown: startDrag,
					onClick: collapsed ? handleClick(toggleCollapsed) : void 0
				}, [
					h(CoverArt, {
						cover: track ? track.cover : "",
						index: remote ? remote.index : 0,
						large: expanded,
						spinning: playing
					}),
					h("div", { className: "dshm-meta" }, [
						h("div", { className: "dshm-title" }, track ? track.title : (expanded ? "未在播放" : "音乐播放器")),
						h("div", { className: "dshm-artist" }, track ? track.artist : (expanded ? "点一首歌开始吧" : "点击展开"))
					]),
					h("div", { className: "dshm-head-actions" }, [
						// Collapsed group: play / next / expand.
						h("div", { className: "dshm-head-group" + (expanded ? " dshm-head-group-out" : " dshm-head-group-in"), key: "mini" }, [
							h("button", {
								ref: playFlipRef,
								className: "dshm-btn dshm-btn-primary dshm-play-btn",
								title: playing ? "暂停" : "播放",
								onClick: handleClick(function (event) {
									event.stopPropagation();
									run({ action: playing ? "pause" : "play" });
								})
							}, h(Icon, { name: playing ? "pause" : "play", size: 14 })),
							h("button", {
								ref: nextFlipRef,
								className: "dshm-btn dshm-btn-icon dshm-next-btn",
								title: "下一首",
								onClick: handleClick(function (event) {
									event.stopPropagation();
									run({ action: "next" });
								})
							}, h(Icon, { name: "next", size: 14 })),
							h("button", {
								className: "dshm-btn dshm-btn-icon",
								title: "展开播放器",
								onClick: handleClick(function (event) {
									event.stopPropagation();
									toggleCollapsed();
								})
							}, h(Icon, { name: "chevronDown", size: 14 }))
						]),
						// Expanded group: search toggle / collapse.
						h("div", { className: "dshm-head-group" + (expanded ? " dshm-head-group-in" : " dshm-head-group-out"), key: "full" }, [
							h("button", {
								className: "dshm-btn dshm-btn-icon dshm-vt-fade",
								title: searchMode ? "返回播放列表" : "搜索QQ音乐",
								onClick: handleClick(function (event) {
									event.stopPropagation();
									setSearchMode(function (prev) {
										if (!prev) { setSearchQuery(""); setResults(null); setSearchError(null); }
										return !prev;
									});
								})
							}, h(Icon, { name: searchMode ? "arrowLeft" : "search", size: 14 })),
							h("button", {
								className: "dshm-btn dshm-btn-icon dshm-vt-fade",
								title: "折叠",
								onClick: handleClick(function (event) {
									event.stopPropagation();
									toggleCollapsed();
								})
							}, h(Icon, { name: "chevronUp", size: 14 })),
							h("button", {
								className: "dshm-btn dshm-btn-icon dshm-vt-fade",
								title: "关闭播放器（音乐继续播放）",
								onClick: handleClick(function (event) {
									event.stopPropagation();
									closePlayer();
								})
							}, h(Icon, { name: "close", size: 13 }))
						])
					])
				]),
				// ── expanded panel ─────────────────────────────────────────────
				h("div", { className: "dshm-panel" }, h("div", { className: "dshm-panel-inner" }, [
					h("div", { className: "dshm-body" }, [
						// progress
						h("div", { className: "dshm-row" }, [
							h("div", {
								className: "dshm-progress",
								ref: progressRef,
								onMouseDown: onProgressDown,
								title: "拖动调整播放进度"
							}, h("div", {
								className: "dshm-progress-fill",
								style: {
									width: (dragRatio !== null
										? dragRatio * 100
										: duration > 0 ? Math.min(100, current / duration * 100) : 0) + "%"
								}
							})),
							h("span", { className: "dshm-time" }, formatTime(current) + " / " + formatTime(duration))
						]),
						// controls
						h("div", { className: "dshm-controls" }, [
							h("button", { className: "dshm-btn dshm-btn-icon", title: "上一首", onClick: handleClick(function () { run({ action: "prev" }); }) }, h(Icon, { name: "prev", size: 15 })),
							h("button", {
								ref: playFlipRef,
								className: "dshm-btn dshm-btn-primary dshm-play-btn",
								title: playing ? "暂停" : "播放",
								onClick: handleClick(function () { run({ action: playing ? "pause" : "play" }); })
							}, h(Icon, { name: playing ? "pause" : "play", size: 16 })),
							h("button", {
								ref: nextFlipRef,
								className: "dshm-btn dshm-btn-icon dshm-next-btn",
								title: "下一首",
								onClick: handleClick(function () { run({ action: "next" }); })
							}, h(Icon, { name: "next", size: 15 })),
							h("button", {
								className: "dshm-btn dshm-btn-icon" + (remote && remote.mode !== "list" ? " dshm-btn-active" : ""),
								title: "切换模式：" + modeLabel[remote ? remote.mode : "list"],
								onClick: handleClick(cycleMode)
							}, h(Icon, { name: modeIcon[remote ? remote.mode : "list"], size: 14 })),
							h("button", {
								className: "dshm-btn dshm-btn-icon" + (quality === "320" ? " dshm-btn-active" : ""),
								title: "音质：" + (quality === "320" ? "320k 高品质（需登录 VIP）" : "128k 标准") + "，点击切换",
								onClick: handleClick(cycleQuality)
							}, h("span", { style: { fontSize: 9, fontWeight: 700, letterSpacing: 0.5 } }, quality === "320" ? "HD" : "128"))
						]),
						// volume (hidden while the QR login panel is open)
						!loginQr
							? h("div", { className: "dshm-row" }, [
								h("span", { style: { display: "flex", flex: "none", color: "rgba(255,255,255,0.75)" } }, h(Icon, { name: "volume", size: 13 })),
								h("input", {
									type: "range",
									className: "dshm-slider",
									min: 0,
									max: 1,
									step: 0.02,
									value: remote ? remote.volume : 0.8,
									onChange: volume
								}),
								h("span", { className: "dshm-mode" }, modeLabel[remote ? remote.mode : "list"])
							])
							: null,
						// ── account bar / login panel / my playlists ───────────
						loginInfo && loginInfo.loggedIn
							? h("div", { className: "dshm-account" }, [
								h("span", { className: "dshm-account-badge" }, "♪"),
								h("span", { className: "dshm-account-name", title: "QQ音乐账号：" + (loginInfo.nickname || loginInfo.musicid) },
									(loginInfo.nickname || loginInfo.musicid) + (loginInfo.nickname ? "" : "（已登录）")),
								h("button", {
									className: "dshm-btn dshm-btn-icon" + (myLists ? " dshm-btn-active" : ""),
									title: "我的歌单",
									onClick: handleClick(function () {
										if (myLists) { setMyLists(null); return; }
										loadMyPlaylists();
									})
								}, h(Icon, { name: "list", size: 13 })),
								h("button", {
									className: "dshm-btn dshm-btn-icon",
									title: "退出登录",
									onClick: handleClick(logoutLogin)
								}, h(Icon, { name: "logout", size: 13 }))
							])
							: h("div", { className: "dshm-account-login" }, [
								h("button", {
									className: "dshm-btn dshm-btn-qq",
									title: "登录QQ音乐账号（解锁VIP播放与我的歌单）",
									onClick: handleClick(startLogin)
								}, [h(Icon, { name: "qq", size: 13 }), h("span", null, "登录QQ音乐")])
							]),
						loginState && loginState.state === "done"
							? h("div", { className: "dshm-success" }, [
								h(Icon, { name: "check", size: 13 }),
								h("span", null, "登录成功，VIP 歌曲已解锁")
							])
							: null,
						// ── QR login panel ─────────────────────────────────────
						loginQr
							? h("div", { className: "dshm-login" }, [
								h("div", { className: "dshm-login-title" }, [
									h("span", { className: "dshm-lt-badge" }, h(Icon, { name: "qq", size: 12 })),
									h("span", null, "登录 QQ 音乐")
								]),
								h("div", { className: "dshm-login-sub" }, "扫码解锁 VIP 歌曲与我的歌单"),
								h("div", { className: "dshm-qr-wrap" },
									h("img", { className: "dshm-qr", src: loginQr.qrImage, alt: "QQ登录二维码" })),
								h("div", { className: "dshm-login-status" }, [
									loginStateKind === "done"
										? h(Icon, { name: "check", size: 13 })
										: h("span", { className: statusDotClass }),
									h("span", null, loginState ? loginState.message : "正在连接…")
								]),
								loginStateKind === "waiting" || loginStateKind === "starting"
									? h("div", { className: "dshm-steps" }, [
										h("span", { className: "dshm-step" }, [h("i", null, "1"), h("span", null, "打开手机QQ")]),
										h("span", { className: "dshm-step-arrow" }, "›"),
										h("span", { className: "dshm-step" }, [h("i", null, "2"), h("span", null, "扫一扫")]),
										h("span", { className: "dshm-step-arrow" }, "›"),
										h("span", { className: "dshm-step" }, [h("i", null, "3"), h("span", null, "确认登录")])
									])
									: null,
								h("div", { className: "dshm-login-actions" }, [
									h("button", { className: "dshm-btn dshm-btn-ghost", onClick: handleClick(cancelLogin) }, "取消"),
									loginStateKind === "expired" || loginStateKind === "failed"
										? h("button", { className: "dshm-btn dshm-btn-solid", onClick: handleClick(startLogin) }, "重新获取")
										: null
								])
							])
							: null,
						// ── my playlists list ──────────────────────────────────
						myLists && !loginQr
							? [
								h("div", { className: "dshm-playlists-head" }, [
									h("span", { className: "dshm-playlists-title" }, [h(Icon, { name: "list", size: 12 }), h("span", null, "我的歌单")]),
									h("button", {
										className: "dshm-btn dshm-btn-ghost",
										title: "收起",
										onClick: handleClick(function () { setMyLists(null); })
									}, "收起")
								]),
								h("div", { className: "dshm-list", onWheel: stopListWheel },
									Array.isArray(myLists) && myLists.length === 0
										? h("div", { className: "dshm-empty" }, "加载中…")
										: Array.isArray(myLists)
											? myLists.map(function (item, i) {
												var isLiked = item.name === "我喜欢";
												return h("div", {
													className: "dshm-item",
													key: item.id + "-" + i,
													title: "点击导入并播放",
													onClick: handleClick(function () { importMyPlaylist(item.id); })
												}, [
													h("span", {
														className: "dshm-item-cover",
														style: item.cover
															? void 0
															: { background: "linear-gradient(135deg,rgba(49,194,124,0.55),rgba(255,210,63,0.35))" }
													}, item.cover
														? h("img", { src: item.cover, alt: "", draggable: false })
														: h(Icon, { name: isLiked ? "heart" : "list", size: 16, thin: true })),
													h("span", { className: "dshm-item-title" }, item.name),
													h("span", { className: "dshm-item-sub" }, item.songCount ? item.songCount + " 首" : ""),
													h("span", { className: "dshm-item-note" }, [h(Icon, { name: "play", size: 8 }), "播放"])
												]);
											})
											: h("div", { className: "dshm-empty" }, myLists.error || "加载失败")
								)
							]
							: null,
						// ── search panel / queue (hidden while QR login is open) ──
						loginQr ? null : (searchMode
							? [
								h("div", { className: "dshm-search" }, [
									h("input", {
										className: "dshm-input",
										placeholder: "QQ音乐歌单链接或 id",
										title: "粘贴QQ音乐歌单链接或 id，回车导入",
										value: playlistDraft,
										onChange: function (event) { setPlaylistDraft(event.target.value); },
										onKeyDown: function (event) { if (event.key === "Enter") importPlaylist(); }
									}),
									h("button", {
										className: "dshm-btn dshm-btn-primary",
										title: "导入歌单（替换默认歌单）",
										onClick: handleClick(importPlaylist)
									}, h(Icon, { name: "import_", size: 13 }))
								]),
								h("div", { className: "dshm-search" }, [
									h("input", {
										className: "dshm-input",
										placeholder: "歌名或歌手，回车搜索",
										title: "输入歌名或歌手，回车搜索",
										value: searchQuery,
										onChange: function (event) { setSearchQuery(event.target.value); },
										onKeyDown: function (event) { if (event.key === "Enter") doSearch(); }
									}),
									h("button", {
										className: "dshm-btn dshm-btn-primary",
										title: "搜索",
										disabled: searching,
										onClick: handleClick(doSearch)
									}, h(Icon, { name: "search", size: 13 }))
								]),
								h("div", { className: "dshm-list", onWheel: stopListWheel },
									searching
										? h("div", { className: "dshm-empty" }, "搜索中…")
										: results === null
											? null
											: results.length === 0
												? h("div", { className: "dshm-empty" }, searchError || "没有搜索结果")
												: results.map(function (song) {
													return h("div", {
														className: "dshm-item",
														key: song.id,
														onClick: handleClick(function () { addQq(song); })
													}, [
														h("span", { className: "dshm-item-title" }, song.name + " - " + song.artist),
														h("span", { className: "dshm-item-sub" }, song.durationMs ? formatTime(song.durationMs / 1000) : ""),
														h("button", {
															className: "dshm-item-action",
															title: "加入播放列表",
															onClick: function (event) {
																event.stopPropagation();
																addQq(song);
															}
														}, h(Icon, { name: "plus", size: 12 }))
													]);
												})
								),
								h("div", { className: "dshm-note" }, "受版权/VIP 限制的歌曲可能无法播放")
							]
							: [
								h("div", { className: "dshm-list", onWheel: stopListWheel },
									remote && remote.queue.length === 0
										? h("div", { className: "dshm-empty" }, "播放列表为空")
										: remote && remote.queue.map(function (item, i) {
											var isCurrent = i === remote.index;
											return h("div", {
												className: "dshm-item" + (isCurrent ? " dshm-item-current" : ""),
												key: item.id + "-" + i,
												onClick: handleClick(function () { run({ action: "play", index: i }); })
											}, [
												h("span", { className: "dshm-item-title" },
													(isCurrent ? "▶ " : "") + item.title),
												h("span", { className: "dshm-item-sub" }, item.artist),
												h("button", {
													className: "dshm-item-action dshm-item-remove",
													title: "移除",
													onClick: function (event) {
														event.stopPropagation();
														run({ action: "remove", index: i });
													}
												}, h(Icon, { name: "close", size: 10 }))
											]);
										})
								),
								remote && !remote.builtin
									? h("div", {
										className: "dshm-empty",
										style: { cursor: "pointer", color: "#5ce6a8", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 4 },
										title: "恢复默认歌单",
										onClick: handleClick(function () { run({ action: "builtin", enable: true }); })
									}, [h(Icon, { name: "restore", size: 11 }), "恢复默认歌单"])
									: null
							]),
						error ? h("div", {
							className: "dshm-error",
							title: "点击关闭",
							onClick: handleClick(function () { setError(null); })
						}, [h(Icon, { name: "alert", size: 12 }), h("span", null, error)]) : null
					])
				])
			)]));
		}

		/**
		 * Settings card shown under 设置 → 插件 → 插件配置: plugin identity,
		 * live playback/login status, and show/hide controls. Communicates with
		 * the floating player through the "dsh-music:set-hidden" window event.
		 */
		function MusicSettingsCard() {
			var [now, setNow] = react.useState(null);
			var [login, setLogin] = react.useState(null);
			react.useEffect(function () {
				var alive = true;
				var refresh = function () {
					Promise.all([
						fetch("/dsh-music/state", { cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return null; }),
						fetch("/dsh-music/qq/login/status", { cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return null; })
					]).then(function (values) {
						if (!alive) return;
						setNow(values[0]);
						setLogin(values[1]);
					});
				};
				refresh();
				var timer = setInterval(refresh, 4000);
				return function () { alive = false; clearInterval(timer); };
			}, []);
			var track = now && now.queue && now.queue[now.index] ? now.queue[now.index] : null;
			var playing = Boolean(now && now.playing);
			var setHidden = function (hidden) {
				try {
					window.dispatchEvent(new CustomEvent("dsh-music:set-hidden", { detail: hidden }));
				} catch { /* ignore */ }
			};
			var label = { color: "var(--dsw-alias-label-primary)", fontSize: 13, lineHeight: "20px" };
			var muted = { color: "var(--dsw-alias-label-tertiary)", fontSize: 13, lineHeight: "20px" };
			var badge = { color: "var(--dsw-alias-label-secondary)", fontSize: 11, border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 999, padding: "1px 8px", whiteSpace: "nowrap" };
			var btn = { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", borderRadius: 8, padding: "5px 14px", fontSize: 13, cursor: "pointer" };
			return h("div", { style: { display: "flex", flexDirection: "column", gap: 6, padding: "12px 16px 14px" } }, [
				h("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, [
					h("span", { style: { fontSize: 14, fontWeight: 600, color: "var(--dsw-alias-label-primary)" } }, "🎵 音乐播放器（QQ 音乐）"),
					h("span", { style: badge }, "v0.6.1"),
					h("span", { style: Object.assign({}, badge, { color: playing ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-label-tertiary)" }) }, playing ? "播放中" : "已暂停")
				]),
				h("div", { style: track ? label : muted }, track ? "正在播放：" + track.title + " — " + track.artist : "当前没有播放歌曲"),
				h("div", { style: muted }, login && login.loggedIn
					? "QQ 音乐账号：已登录" + (login.nickname ? "（" + login.nickname + "）" : "")
					: "QQ 音乐账号：未登录（VIP 歌曲不可播）"),
				h("div", { style: { display: "flex", gap: 8, marginTop: 2 } }, [
					h("button", { type: "button", style: btn, onClick: function () { setHidden(false); } }, "显示播放器"),
					h("button", { type: "button", style: btn, onClick: function () { setHidden(true); } }, "隐藏播放器")
				])
			]);
		}

		/**
		 * Client plugin entry: mount the floating player and its stylesheet,
		 * and register the settings card under 设置 → 插件.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(function () {
				var root = document.createElement("div");
				root.id = "dsh-music-root";
				document.body.appendChild(root);
				injectCss();
				react_dom.render(h(MusicPlayer), root);
				return function () {
					react_dom.unmountComponentAtNode(root);
					if (root.parentNode) root.parentNode.removeChild(root);
				};
			});
			// Show the plugin in the settings plugins page (plugin configuration tab).
			var slots = ctx.get && ctx.get("slots");
			if (slots) {
				ctx.effect(function () {
					return slots.inject("settings.plugin.item", function* () {
						yield slots.register({
							name: "settings.plugin.item",
							id: "dsh-music",
							order: 30,
							label: function () { return "音乐播放器"; },
							inject: function () { return {}; }
						}, MusicSettingsCard);
					});
				});
			}
		}

		var inject = [];
		exports.apply = apply;
		exports.inject = inject;
		exports.name = "dsh-music";
		return module.exports;
	}
});
