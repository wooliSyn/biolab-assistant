# BioLab 实验助手 — 项目说明

## 这是什么

**Tauri v2 桌面应用**，不是 webapp。Rust 外壳 + React 前端，打包成原生程序分发。
面向湿实验台，核心是实验记录、计时、质粒/克隆设计。

**关键：所有数据是本地 JSON 文件**（OS app-data 目录），没有服务器、没有账号、完全离线。
「数据不出设备」是产品承诺，不要引入任何需要联网的持久化方案。

## 归属与授权

本仓库的作者是 **YunPlover**，不是当前在改它的人。改动经作者授权。
当前目标是**加跨平台支持**（原项目是 Windows 优先）。

## 架构

```
src-tauri/          Rust 外壳，15 个 IPC 命令，数据读写 + 通知 + 托盘 + 窗口控制
src/App.jsx         唯一的状态持有者。没有 router，没有状态库，全局状态都在这
src/components/     各个页签：Cloning（质粒工作台）、Portal（传送门）等
src/lib/            纯函数：mapstyle.js（图谱配色/分泳道）、portalLinks.js（42 条外链）
```

前端经 Vite 打包进二进制，`invoke()` 走 IPC 调 Rust。**不存在 HTTP 层。**

### WebView 引擎按平台不同

Windows 用 WebView2（Chromium），macOS 用 WKWebView（WebKit），Linux 用 WebKitGTK。
**跨平台的成本几乎全在这里，不在 Rust。** 改 CSS/布局时要想到 WebKit 的行为差异。

## 必须知道的几个坑

### 1. `html { zoom: var(--app-zoom) }`

全局用 `zoom` 做界面缩放。后果：**视口单位和媒体查询跟实际布局宽度对不上**。
要拿布局宽度只能用 `document.documentElement.clientWidth`（它在 zoom 后的坐标系里）。
`window.innerWidth` 和 `@media` 都不可信。

### 2. Fast Refresh 要求模块只导出组件

`vite-plugin-react` 的 Fast Refresh 在模块混有非组件导出时会整个失效。
`PlasmidMap.jsx` 因此只有 `export default`，配色和分泳道函数被挪到 `lib/mapstyle.js`。
**往组件文件里加工具函数导出 = 悄悄弄坏热更新。**

### 3. Tauri 平台配置对数组是整体替换

`tauri.macos.conf.json` 这类平台覆盖文件，合并时**数组直接替换，不深合并**。
`app.windows` 是数组，所以平台文件里必须写**完整的** window 对象，
只写要改的几个字段会把 title/width/height/minWidth 全部丢掉。

### 4. 主题靠 `html` 的 class + CSS 变量

三套：`theme-flat`（基线，定义在 `:root`）、`theme-pixel`、`theme-rhine`（界面上叫「暗室」）。
**SVG 里的颜色必须用 inline `style={{ fill: "var(--map-fg)" }}`，不能用 presentation 属性**，
否则主题切换时不生效。

### 5. 托盘只能有一个来源

`tauri.conf.json` 的 `app.trayIcon` 会让 Tauri 自动建 id 为 `main` 的托盘。
Rust 里要用 `app.tray_by_id("main")` 往上挂菜单/事件，**不能再 `TrayIconBuilder::new()`**，
否则会多出一个没图标的托盘（能看到的点了没反应）。
另外 `trafficLightPosition.y` 不是「按钮距窗口顶」，实测按钮顶 ≈ y − 9pt。

### 6. node_modules 不能跨系统共用

`@esbuild/*`、`@rollup/*`、`@tauri-apps/cli-*` 都是平台门控的二进制。
换系统必须重新 `npm install`。

## 命令

```bash
npm run dev            # vite 开发服务器（浏览器里打开会白屏，见下）
npx tauri dev          # 真正的应用开发模式
npx tauri build        # 出 .app / .dmg / .exe

npm run version:sync   # package.json 是版本号唯一来源，同步到 tauri.conf.json / Cargo.toml
npm run test:map       # 质粒图谱几何回归，18 组
npm run test:mount     # ⚠️ 目前挂死，见 tests/README.md
```

**浏览器里打开 `npm run dev` 会白屏**，因为 `getCurrentWindow()` 在模块顶层执行，
没有 Tauri 注入就抛异常。已加 try/catch 兜底，但很多功能在浏览器里本来就不可用。
要看真实效果用 `npx tauri dev`。

## 近期改动（2026-11-14 ~ 15）

- **质粒工作台对标 SnapGene 重构**：改成分页视图（图谱/序列/酶切/元件/引物/比对），
  新增 `PlasmidMap.jsx`（环形 + 线性图谱，三档酶切图层，标签避让）
- **传送门页**：42 条科研外链，用真实站点 favicon（`fetch-portal-icons.mjs` 抓取）
- **第三套主题重做**：原霓虹风改为「暗室」暖琥珀配色
- **版本号统一**：`sync-version.mjs`，package.json 为唯一来源，`--check` 把关构建
- **响应式**：窄屏（<1080）侧栏转浮层，更窄（<920）导航收成纯图标
- **macOS 适配**：`tauri.macos.conf.json`（Overlay 标题栏 + 托盘 template 图标），
  `ps_toast` 收进 `#[cfg(windows)]`，标题栏给红绿灯让位

## 待办

### 跨平台

- **macOS 已在真机编译验证（2026-11-15）**：红绿灯用 `trafficLightPosition {x:16, y:24}`
  对齐 44pt 标题栏中线，标题栏左边 `pl-24` 让位。托盘图标（`icons/tray-template.png`）
  和托盘菜单还没亲眼确认（被菜单栏管理工具收起了）
- **iOS 完全没开始**：Rust 里有 11 处调用在 iOS 上不存在（托盘、窗口最小化/置顶/
  改尺寸改位置、`rfd` 文件对话框），**不加 `#[cfg(desktop)]` 门禁连编译都过不了**。
  另外触屏布局是大工程 —— 整个应用围绕 1180×740 桌面布局建的，
  设计文档里写了「桌面优先」红线，动之前先确认产品方向
- `build.ps1` 在 Apple Silicon 的 Parallels（Windows ARM64）上参数错了：
  `vcvarsall.bat` 的参数是 `[host_]target`，写死 `x64` 在 ARM 宿主上不对
- 图标缺 `.icns`，`icon.png` 只有 512×512（macOS 期望 1024）

### 原始审查发现的问题（都还没动）

- Tm 计算公式有误
- 加标签时序列读码框处理有 bug
- `cleanSeq` 没处理 U 和 IUPAC 简并碱基
- `nwAlign` 没有内存上限保护，长序列会爆
- 环形质粒跨起点的比对不正确

### UI

- 极简风的字重/间距层次还没做完（要逐个组件改 JSX，不是改 CSS 能解决的）
- 嵌套卡片有重复边框
