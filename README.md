# dsh-music 🎵

> 🌐 Languages: [English](README.en.md) | [简体中文](README.md)

**这是一个可以让你边对话边听歌的 DeepSeek Harness 插件**，具有折叠和展开两种可自由拖动的悬浮窗口形态，接入 **QQ 音乐**（官方 musicu.fcg / vkey 解析 + Meting 兜底），支持 **扫码登录 QQ 音乐账号**（解锁 VIP 歌曲播放、导入「我喜欢」和自己的歌单），以及 QQ 音乐歌单导入和按歌名或歌手搜索单曲导入。

> 本分支已将原版的网易云音乐集成改造为 QQ 音乐：搜索、歌单、音频流全部走 QQ 音乐公开接口，通过 host 端代理绕过浏览器跨域与防盗链；并新增 QQ 账号扫码登录（凭证持久化，下次启动免登录）。

An animated floating music player plugin for DeepSeek Harness Web with a collapsible/expandable draggable frosted-glass card, deep QQ Music integration (QR-code account login, VIP playback, liked-songs & personal playlists, playlist import by link/ID, search by title/artist), an official vkey audio-stream resolver with a Meting third-party fallback, and an agent-facing music tool — queue, skip, pause, and control volume right from the chat. Zero external front-end dependencies.

## Features

- **悬浮播放器**：右下角 **QQ 绿 × 黄** 配色的深色毛玻璃小卡片（`backdrop-filter` 磨砂 + 内发光），**可拖动记忆位置**，展开/收起带物理曲线动画；播放中封面**唱片旋转**；播放/暂停、上下首、可点进度条（黄绿渐变 + 发光圆头）、音量、列表循环/单曲循环/随机、播放列表
- **自动收缩小唱片**：无论是否在播放，鼠标离开超过 5 秒，播放器自动收缩成**旋转的小唱片圈**（封面图）；**悬停显示「+」展开按钮**（点击恢复长条），悬停不会自动展开；**按住可拖动**，靠近屏幕边缘自动**吸附贴边**（像悬浮球）；**双击圈圈切下一首、三击返回上一首**
- **可一键关闭/重开**：点播放器上的 **×** 即可关闭（音乐继续播放），右下角留下一个小音符按钮；点击它重新打开——**默认就是小唱片圈吸附在边上**（首次使用才完整展示）
- **断点续播**：每首歌的播放进度自动记忆，切回同一首歌/重启后从上次位置继续
- **音质选择**：播放器内一键切换 **128k 标准 / 320k 高品质**（320k 需登录 VIP 账号，自动降级）
- **键盘快捷键**：`空格` 播放/暂停，`←` 上一首，`→` 下一首（输入框中不生效）
- **重启续播**：播放队列、音量、循环模式自动记忆（`%DSH_HOME%\dsh-music\state.json`），重启后接着播
- **精致扫码登录页**：呼吸光晕二维码卡片 + 脉冲状态指示（等待扫码/已扫码确认）+ 三步引导 + 登录成功动画，一键「登录QQ音乐」
- **QQ 音乐接入**：一键**导入/切换歌单**（粘贴链接或 id）、**搜索单曲**（搜索 + 加入）；host 端代理搜索/歌单/音频流，绕过浏览器跨域与防盗链；免费歌曲经官方 vkey 接口直接播放，VIP/受版权限制歌曲自动跳过或经 Meting 解析试听
- **QQ 账号登录**：播放器面板一键「登录QQ音乐」→ 手机 QQ 扫码授权，**凭证保存在本地**（`%DSH_HOME%\dsh-music\qq-login.json`），重启免登录；登录后 **VIP 歌曲完整播放**、可导入「**我喜欢**」（id=201）**和我创建/收藏的歌单**（含私密歌单）
- **默认曲库可配置**：通过环境变量 `DSH_MUSIC_PLAYLIST` 指定 QQ 歌单 id，启动时自动加载为内置曲库（未配置则播放列表为空，可在播放器内手动导入）
- **agent 音乐工具**：对模型说"放首歌 / 把我的歌单放进去"即可——`music` 工具支持播放指定歌曲（本地无匹配自动搜 QQ 音乐）、导入歌单、列出我的歌单、引导登录、切歌、暂停、调音量、切模式、恢复/隐藏默认歌单、查看/添加/移除队列
- **状态同步**：浏览器播放器与 host 状态机通过 REST 同步（`/dsh-music/state` 轮询 + `/dsh-music/command` 控制），无持久化，每次启动全新加载默认曲库
- **零外部前端依赖**：播放器为手写 `__ModuleLoader__` 格式，内联 SVG 图标，不依赖 CDN

## 登录 QQ 音乐账号（解锁 VIP）

1. 展开右下角 🎵 播放器 → 点「登录QQ音乐」按钮
2. 用 **手机 QQ** 扫描面板上的二维码（在手机 QQ 上确认授权）
3. 登录成功后面板显示账号昵称，点歌单按钮可浏览并导入「❤ 我喜欢 / 我创建 / 我收藏」的歌单
4. 凭证保存在 `%DSH_HOME%\dsh-music\qq-login.json`，**下次启动免登录**；过期时插件会自动刷新，刷新失败才需要重新扫码

也可以直接对模型说「登录QQ音乐」「看看我的歌单」「播放我喜欢」等，agent 会引导或直接操作。

## Install（桌面版 / Web profile）

包已安装到 `%DSH_HOME%\profiles\node_modules\@dsh-external\dsh-music`，并在 `%DSH_HOME%\profiles\web\cordis.patch.yml` 注册了 `dsh-music` 行。**重启 DeepSeek Harness 应用后生效**，页面右下角出现 🎵 播放器。

命令行版（有 `dsh` CLI 的环境）：

```sh
dsh plugin --profile web add "file:/path/to/dsh-music"
# 重启 dsh web（dsh --profile web）后生效
```

## 配置默认歌单

播放器启动时自动加载的内置曲库来自 QQ 音乐歌单，通过环境变量配置：

```sh
# 例如把默认曲库设为 QQ 歌单 8048205048
set DSH_MUSIC_PLAYLIST=8048205048
```

未设置时播放列表为空，可打开播放器 🔍 手动导入歌单。

## Usage

- 点右下角 🎵 卡片展开播放器；拖动卡片顶部任意位置可移动（位置自动记忆）；点右上角箭头展开/收起（带动画）
- **鼠标离开 5 秒** → 播放器收缩成小唱片圈（无论播不播放）；**悬停圈圈**显示「+」展开 /「×」关闭（点击操作），**悬停不会自动展开**；**按住圈圈拖动**，靠近屏幕边缘自动**吸附贴边**；**双击圈**下一首、**三击圈**上一首
- **关闭播放器**：展开面板点右上角 **×**（或小圈悬停点 **×**），播放器隐藏（音乐继续播），右下角出现音符按钮；点击音符按钮重新打开（默认以小圈形态贴边）
- 键盘：**空格** 播放/暂停、**←/→** 切歌；控制区 **128/HD 按钮**切换音质
- 点 🔍 进入 QQ 音乐搜索：输入歌名/歌手回车搜索，点 + 加入播放列表
- 第一行输入框粘贴 QQ 音乐歌单链接或 id（如 `https://y.qq.com/n/ryqq/playlist/8048205048`，登录后输入 `201` 可导入「我喜欢」），回车一键导入（替换当前曲库）
- 对话里直接说「放首歌 / 放一首周杰伦的晴天 / 导入我的歌单 / 播放我喜欢 / 下一首 / 暂停 / 随机播放 / 音量调到 50%」，agent 会调用 `music` 工具控制播放器
- 关闭/重启应用后，**队列、音量、模式自动恢复**，无需重新配置

## 开源 / 二次开发

- 协议细节参考：`L-1124/QQMusicApi`（Python，登录/歌单/播放协议）与 `yakult-green-tea/qq-music-api`（Node.js，设备指纹与播放协议）
- host 端与 client 端均为单文件零依赖实现，`cordis.patch.yml` 声明 bundle 插入点；接入其他 DSH profile 只需复制包目录 + 在 profile 的 `cordis.patch.yml` 加一行 insert
- 主要存储文件（均在 `%DSH_HOME%\dsh-music\`）：`qq-login.json`（登录凭证）、`state.json`（播放状态快照）

## 免责声明

- 本项目与 DeepSeek、腾讯 QQ 音乐无关；音频来自 QQ 音乐公开接口与第三方 Meting 解析服务，仅供学习交流
- 受版权/账号权限限制的歌曲可能无法播放（播放器会自动跳到下一首可播放的歌曲）
- 登录凭证仅保存在本地 DSH 实例中，仅用于向 QQ 音乐官方接口发起请求
- `music` 工具与 UI 的操作均在本地 DSH 实例内完成

## Structure

- `index.js` — host 端：状态机、REST API（state / command / qq search / playlist / stream / login / my-playlists）、`music` 工具、官方 vkey 音频解析（Meting → 兜底）、QQ 扫码登录（ptlogin2 → OAuth → QQLogin）与凭证持久化
- `client.js` — 浏览器端：悬浮播放器（手写 `__ModuleLoader__` 格式，内联 SVG 图标，零外部依赖），含扫码登录与我的歌单面板
- `cordis.patch.yml` — bundle 层声明

## Uninstall

```sh
dsh plugin --profile web remove @dsh-external/dsh-music
# 桌面版：删除 %DSH_HOME%\profiles\node_modules\@dsh-external\dsh-music
# 并移除 %DSH_HOME%\profiles\web\cordis.patch.yml 中的 dsh-music insert 行
```

## License

[MIT](LICENSE)
