# 贡献指南 Contributing

感谢你对 **dsh-music** 感兴趣！无论你是修 bug、加功能、改进文档还是提建议，都欢迎参与。请先花两分钟读完这份指南，能让协作更顺畅。

## 项目速览

dsh-music 是一个运行在 DeepSeek Harness（DSH）里的悬浮音乐播放器插件：

- **host 端（Node.js 进程）**：`index.js` — 播放状态机、REST API、QQ 音乐接口代理（搜索/歌单/音频流）、QQ 扫码登录、凭证与状态持久化、`music` agent 工具
- **client 端（浏览器）**：`client.js` — 毛玻璃悬浮播放器、自动收缩小唱片圈、扫码登录面板、我的歌单 UI
- **挂载声明**：`cordis.patch.yml` — bundle 层的插入点

## 开发环境准备

1. 安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（桌面版或 CLI 均可）
2. 克隆本仓库到本地，把 `index.js` / `client.js` / `package.json` / `cordis.patch.yml` 复制到 profile 的插件目录：
   - 桌面版：`%DSH_HOME%\profiles\node_modules\@dsh-external\dsh-music\`
   - 并在 `%DSH_HOME%\profiles\web\cordis.patch.yml` 中注册：
     ```yaml
     - insert:
         - id: dsh-music
           name: '@dsh-external/dsh-music'
     ```
3. **重启 DeepSeek Harness 应用**，页面右下角出现 🎵 播放器即为生效

> 提示：修改 host 端（index.js）需重启应用；修改 client 端（client.js）刷新页面即可（具体取决于 DSH 版本的热重载能力）。

## 本地验证

每次改动后至少做语法检查：

```sh
node --check index.js
node --check client.js
```

更完整的冒烟测试（host 端逻辑，需在能解析 `@deepseek-ai/dsh-tools` 的环境下运行，例如将测试脚本放在 profile 的 node_modules 同级目录）：

```js
// 模拟 apply(ctx) 后直接调用各 REST 路由 / music 工具
import { apply } from "./index.js";
// ...见仓库历史或 issue 讨论中的测试脚本示例
```

**涉及 UI 的改动请务必在浏览器里实际验证**：展开/折叠、小唱片圈的拖动/吸附/双击三击、扫码登录流程、音质切换、断点续播。

## 代码风格

| 项 | 约定 |
|---|---|
| 语言 | host 端 ESM（`import`）；client 端为浏览器可直接执行的普通 JS（`window.__ModuleLoader__.load` 格式） |
| 语法 | **无 TypeScript / JSX / 构建步骤**——不要引入需要编译的语法 |
| client 渲染 | 使用 `React.createElement`（`h(...)`），**不要写 JSX** |
| 依赖 | host 端仅依赖 `@deepseek-ai/dsh-tools`；client 端零外部依赖（图标用内联 SVG）——**不要新增 npm 依赖** |
| 注释 | 中文注释为主，说明"为什么"而非"是什么" |
| 格式 | 使用 Tab 缩进，保持与现有文件一致 |
| 安全 | 不要在任何日志/输出中打印凭证（musickey 等）完整值 |

## 第三方接口与合规

- QQ 音乐接口为**非官方公开接口**（`musicu.fcg`、`fcg_ucc_getcdinfo_byids_cp`、ptlogin2 等），协议细节参考：
  - [`L-1124/QQMusicApi`](https://github.com/L-1124/QQMusicApi)（Python）
  - [`yakult-green-tea/qq-music-api`](https://github.com/yakult-green-tea/qq-music-api)（Node.js）
- 上游接口随时可能变动，**改动前先实测**；无法实测的改动请在 PR 描述中说明
- 新增的网络请求必须经过 host 端代理（浏览器不能直接跨域调用）
- 保持"仅供学习交流"的定位，不承诺 VIP 绕过能力，不用于商业用途

## 提 PR 流程

1. Fork 本仓库，从 `main` 开分支：`git checkout -b feat/xxx`
2. 完成改动并自测（见上文"本地验证"）
3. 提交信息建议遵循：`feat:` / `fix:` / `docs:` / `refactor:` 前缀
4. 发起 PR，描述中说明：改了什么、为什么、如何验证
5. 维护者 review 后会合并或给出修改意见

### 小建议

- 先开 issue 讨论大改动，避免白做
- 一个 PR 只做一件事，保持 diff 小
- UI 改动请附上效果截图

## 想做的方向

- 断点续播增强、歌词显示、系统通知
- 队列拖拽排序、多账号切换
- 更多平台的音频源接入（参照 README 的协议参考）
- 测试脚本整理成正式测试套件 + CI（GitHub Actions `node --check`）

再次感谢你的贡献！🎵
