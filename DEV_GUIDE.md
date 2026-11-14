# BioLab 实验助手 — 完整开发文档

> 版本: v1.9.9 | 最后更新: 2026-07-23 | 作者: Jerry Wan (IBP Beijing)
> 本文档供接手开发的 AI 或人类开发者使用，涵盖架构、算法、约定、陷阱和构建流程。

---

## 1. 项目概述

BioLab 实验助手是一款面向分子生物学/生物化学实验室的桌面应用，核心功能包括：实验步骤计时与提醒、方案模板管理、配方计算、数据集管理、质粒工作台（序列分析/比对/引物设计）、工具箱（秒表/倒计时/细胞计数器）。

技术栈: **Tauri v2 (Rust) + React 18 + Vite 6 + Tailwind CSS 3**，单窗口 WebView2 渲染，数据持久化为本地 JSON 文件。

---

## 2. 文件结构

```
biolab-desktop/
├── package.json              # 前端依赖 (react, lucide-react, katex, html2canvas, @tauri-apps/*)
├── vite.config.js            # Vite 配置 (port 1420, esbuild minify)
├── tailwind.config.js        # Tailwind (无自定义 extend，纯 utility)
├── postcss.config.js
├── index.html                # SPA 入口
├── build.ps1                 # Windows 构建脚本 (vcvarsall + cargo + npx tauri build)
├── sign.ps1                  # Authenticode 签名脚本 (signtool + RFC3161 时间戳)
├── gen_icon.py               # 图标生成辅助
│
├── src/                      # ===== 前端 (React) =====
│   ├── main.jsx              # ReactDOM 挂载
│   ├── App.jsx               # 主应用：状态管理、Tab 路由、全局弹窗、数据加载
│   ├── index.css             # 三主题 CSS 变量 + Rhine 特效 + 全局样式
│   ├── assets/zpix.ttf       # 像素字体
│   │
│   ├── lib/
│   │   ├── core.js           # 工具函数：ID生成、日期格式化、问候语、天气、
│   │   │                     #   全局拖拽载荷、toast/confirm 总线、步骤时间推算、导出
│   │   ├── bio.js            # 生物信息学：revComp、Tm(近邻法)、密码子翻译、Tag库、
│   │   │                     #   blockAlign(锚点块比对)、nwAlign(带状NW)、fastAlign(锚点+局部NW)
│   │   ├── templates.js      # 默认实验方案模板数据
│   │   ├── Latex.jsx         # KaTeX 公式渲染组件
│   │   └── useFlip.jsx       # FLIP 动画 hook (FlipGrid)
│   │
│   └── components/
│       ├── SessionCard.jsx   # 实验会话卡片 (运行中/已完成/星标)
│       ├── SessionDetail.jsx # 实验详情面板 (步骤列表、计时、备注)
│       ├── Timeline.jsx      # 时间线视图 (甘特图式步骤展示)
│       ├── Sidebar.jsx       # 侧栏 (日期导航、会话列表、星标)
│       ├── Dialogs.jsx       # 弹窗集合：Modal、TemplatePicker、SetupDialog、
│       │                     #   TemplateEditor、DataDialog、DurInput(时长输入)
│       ├── Cloning.jsx       # 质粒工作台：序列视图、特征标注、引物设计、
│       │                     #   序列比对(AlnRow/AlnSegments/AlignPanel)、.dna 导入
│       ├── Datasets.jsx      # 数据集管理 (JSON 导入/导出)
│       ├── Recipes.jsx       # 配方计算器
│       ├── ToolsView.jsx     # 工具箱：秒表、倒计时、细胞计数器
│       ├── NoteEditor.jsx    # 便利贴/笔记编辑器
│       ├── Attendance.jsx    # 考勤/补签
│       ├── Onboarding.jsx    # 首次使用引导
│       ├── MiniMode.jsx      # 迷你置顶模式
│       ├── Feedback.jsx      # ToastStack + ConfirmDialog 渲染
│       ├── HelpTip.jsx       # 帮助提示
│       ├── LegalDialog.jsx   # 法律/关于弹窗
│       └── Portal.jsx        # React Portal 封装
│
├── src-tauri/                # ===== 后端 (Rust/Tauri) =====
│   ├── Cargo.toml            # 依赖: tauri 2, tauri-plugin-notification, dirs, rfd, chrono
│   ├── tauri.conf.json       # 应用配置 (productName "BioLab", 窗口, bundle)
│   ├── build.rs
│   ├── icons/                # 应用图标 (icon.ico, icon.png, tray.png)
│   └── src/main.rs           # Rust 入口：IPC commands、系统托盘、通知、文件对话框
│
└── dist/                     # Vite 构建产物 (前端)
```

---

## 3. 架构设计

### 3.1 数据层

**持久化**: 所有数据存为 `%LOCALAPPDATA%\biolab-assistant\{key}.json`，通过 Tauri IPC 读写。

Rust 端暴露的 commands:
- `load_data(key)` / `save_data(key, value)` — 单 key 读写
- `load_many(keys)` — 批量加载（单次 IPC 往返，加速启动）
- `data_dir_path()` — 返回数据目录路径
- `clear_all_data()` — 清空所有 JSON
- `save_text_file(title, default_name, content)` — 原生另存为对话框
- `save_attachment(name, bytes)` — 附件存储
- `open_file(path)` / `reveal_file(path)` — 系统打开/定位文件
- `send_notification(title, body)` — 系统通知 (插件优先，PowerShell Toast 兜底)
- `request_attention()` — 任务栏闪烁
- `minimize_window()` / `close_window()` / `quit_app()` — 窗口控制
- `set_mini_mode(mini)` — 迷你置顶模式切换

**前端数据流**: App.jsx 是唯一状态持有者，通过 props 下发。启动时 `loadMany` 批量加载所有 key，之后每次修改立即 `saveData` 持久化。无 Redux/Zustand，纯 useState + useCallback。

### 3.2 全局总线 (core.js)

- `registerToast(fn)` / `toast(msg, type)` — 风格化提示（替代 alert）
- `registerConfirm(fn)` / `askConfirm(opts)` — 风格化确认（替代 confirm）
- `setDragPayload(v)` / `getDragPayload()` / `clearDragPayload()` — 拖拽载荷传递（WebView2 的 dataTransfer 对自定义类型不可靠）

### 3.3 Tab 路由

App.jsx 中 `activeTab` 状态控制主内容区：
- `today` — 今日实验 (SessionCard + Timeline + SessionDetail)
- `templates` — 方案库
- `recipes` — 配方
- `datasets` — 数据集
- `cloning` — 质粒工作台
- `tools` — 工具箱

### 3.4 主题系统

三套主题通过 CSS 变量 + body class 切换：
- **默认 (极简)**: 浅色、系统字体、柔和边框
- **pixel (像素风)**: zpix 字体、深描边
- **rhine (莱茵·赛博蒸汽)**: 深空暗底、绯红#ff2d55 + 冰青#7dd3fc + 翠绿#39ff8e、Rajdhani 字体、玻璃面板、动态背景特效层

CSS 变量: `--px-ink`(描边), `--px-ink-soft`, `--px-bg`, `--px-paper`, `--px-accent`, `--app-zoom`(整体缩放)

---

## 4. 核心算法 (bio.js)

### 4.1 nwAlign — 带状 Needleman-Wunsch 全局比对

```
输入: seqA, seqB (DNA 序列字符串)
输出: { alnRef, alnQry, identity, gaps }
```

- 仿射 gap 惩罚 (GAP_OPEN=-5, GAP_EXT=-2, MATCH=2, MISMATCH=-3)
- 带宽自适应: `min(600, max(60, |lenA-lenB| + 40))`
- 三矩阵 (M/Ix/Iy) Float32Array 带状稀疏存储
- 回溯: **数组 push + reverse + join** (O(n))，绝不用字符串前置拼接 (O(n²))
- 适用场景: ≤20kb 质粒级序列，gap 区域 ≤300bp 的局部比对

### 4.2 fastAlign — 锚点链化 + 局部 NW (MUMmer/Mauve 思路)

```
输入: refSeq, qrySeq
输出: { segments: [{type:"match"|"aligned"|"var", ...}], identity, gaps }
```

流程:
1. ref 建 k-mer(k=15) 索引 (高频 k-mer 截断 ≤8 次，抑制重复区)
2. query 扫描找最大精确匹配锚点 (≥25bp)，左右延伸
3. LIS 链化保持共线性
4. 锚点覆盖率 < 40% → 退回全程 nwAlign
5. 锚点间 gap ≤ 300bp → 局部 nwAlign；> 300bp → var 块 (不做逐碱基比对)

性能: 对 >80% 相似度序列比全程 NW 快 10-100 倍，5000bp 质粒约 2-5ms。

### 4.3 blockAlign — 锚点式局部块比对 (早期版本，现被 fastAlign 替代)

返回 `{ blocks: [{type:"anchor"|"var", rStart, rLen, qStart, qLen}], identity, anchorBp }`

### 4.4 其他

- `primerTm(seq)` — 近邻法 Tm (SantaLucia 1998 + Owczarzy 盐校正)
- `analyzePrimer(seq)` — 长度 + GC% + Tm
- `translate(seq, frame)` — 密码子翻译
- `revComp(s)` / `complement(s)` / `cleanSeq(s)` — 序列基础操作
- `TAGS` / `LINKER` — 常用蛋白标签库 (His6, FLAG, HA, Myc, Strep-II, V5, T7)

---

## 5. 质粒工作台 (Cloning.jsx) 关键组件

### 5.1 AlnRow — 比对行渲染

- 将连续同样式字符合并为单个 `<span>`（chunked rendering）
- 用 useMemo 缓存分段结果
- 避免逐字符 span（5000bp × 2 行 = 万级 DOM → WebView2 崩溃）

### 5.2 AlnSegments — fastAlign 结果渲染

- match 块 > 60bp 折叠为: `前10bp + "══Nbp══" + 后10bp`
- aligned 块: 逐碱基着色 (match=灰, mismatch=红底, gap=浅灰)
- var 块: 琥珀色整块显示

### 5.3 AlignPanel — 比对面板

- **按钮触发计算**，绝不在 useMemo/render/mount 时自动运行
- 两种模式: 输入序列比对 / 质粒间比对
- 计算同步执行 (fastAlign 足够快，无需 setTimeout)

---

## 6. 关键开发约定与陷阱

### 6.1 性能铁律

| 规则 | 原因 |
|------|------|
| 重计算必须按钮触发，不在 useMemo/render 中自动运行 | WebView2 主线程阻塞 → 白屏 |
| useMemo 含昂贵计算必须加 mode/visible 守卫 | 组件挂载即执行 → 白屏 |
| nwAlign 回溯用 array push+reverse+join | 字符串前置 "-" + s 是 O(n²)，5000bp 卡死 |
| AlnRow 分段渲染，连续同样式合并单 span | 逐字符 span 在 ~5000bp 崩溃 WebView2 |
| match 块 >60bp 折叠显示 | 避免渲染数千字符 |
| 大质粒 (5000bp+) 任何重计算都需 button-triggered + setTimeout(30ms) 让 UI paint | 即使有 useMemo 守卫也不可 auto-run on mount/mode-switch |

### 6.2 React/CSS 陷阱

- **lineHeight**: 内联 style 传数字 = 无单位倍数 (lineHeight:18 = 18×字号) → 行距爆炸。必须传 `"18px"` 字符串。
- **useEffect 依赖数组引用未定义变量** → ReferenceError 崩溃整棵 React 树 → WebView2 黑屏。排查黑屏先查未定义引用。
- **CSS 层叠**: 背景特效层 fixed+z-0 时，内容容器用 `position:relative` 但 `z-index:auto`（勿 z-[1]）——auto 不建层叠上下文，避免内部 fixed 弹窗被困。
- **backdrop-filter** 建层叠上下文使玻璃面板盖住 header 下拉菜单 → 给 header 加 `relative z-[60]`。
- **Rhine 主题**: `.bg-white` 需 opacity ≥ 0.9 (0.5 仍显浅)；form 元素需显式暗底；`rhine-exempt` 类豁免所有暗色覆盖（证书/可导出内容）。

### 6.3 Modal 关闭逻辑

- mousedown + click 均在 backdrop 才关闭
- inner panel 阻止 mousedown 冒泡
- 防止拖选文本时误关弹窗

### 6.4 版本号同步

三处必须同步: `package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml`

### 6.5 SnapGene .dna 文件解析

- 0x00 = DNA 包 (payload[0] & 0x02 = 环状)
- 0x0a = Features (XML, Segment range="a-b", directionality: 1正/2反/3双向)
- 0x06 = Notes (注意: 易与 Features 混淆!)

### 6.6 DurInput 组件 (Dialogs.jsx)

- number + unit select (秒/分/时)
- 自动检测最佳单位: <1min→秒, ≥60min→时, 其余→分
- 内部存储统一为 `durationMin` (分钟，可为小数)

---

## 7. 构建流程

### 7.1 环境要求

- Windows 10/11 x64
- VS Build Tools 2022 (MSVC, 用于 Rust 编译)
- Node.js (v24, 路径 `C:\Program Files\nodejs`)
- Rust (1.97, 路径 `C:\Users\Wan\.cargo\bin`)
- 以上均不在默认 PATH，构建脚本手动注入

### 7.2 构建命令

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

build.ps1 内容:
1. 加载 vcvarsall.bat x64 环境
2. 注入 Node.js + Cargo 到 PATH
3. `cd` 到项目目录
4. `npx tauri build`

### 7.3 构建产物

- NSIS 安装包: `src-tauri/target/release/bundle/nsis/BioLab_{version}_x64-setup.exe` (~4.2MB)
- WiX MSI: `src-tauri/target/release/bundle/msi/` (中文语言包)

### 7.4 注意事项

- Rust release 编译常超 5 分钟 (Bash 默认超时)，需后台运行 + 轮询验证
- Vite build 在启动时读文件，构建启动后再改的 CSS 不会进包 → 需重建
- esbuild JSX 语法验证: 必须 `cd` 到项目目录执行
- tauri.conf.json 的 `bundle.windows` 不支持自定义 `nsis` 对象（schema 验证会报错）

### 7.5 代码签名 (解决 Smart App Control 拦截)

```powershell
.\sign.ps1 -CertPath "cert.pfx" -CertPass "password"
```

需要购买 Windows Authenticode 代码签名证书 (~$70/yr, 如 SSL.com、DigiCert)。签名后 Smart App Control 不再拦截。

---

## 8. 版本演进摘要

| 版本 | 主要变更 |
|------|----------|
| v1.0-1.2 | 基础框架: 实验计时、方案模板、Timeline、SessionDetail、Recipes |
| v1.3 | 拖拽排序 (core.js 共享载荷)、补签功能 |
| v1.4 | 莱茵主题初版 |
| v1.5.0 | 三主题系统 + registerToast 全局总线 |
| v1.5.1 | 版本号三处同步 |
| v1.6.0 | 序列缩放 (bpPerRow 15-120, Ctrl+滚轮)、比对独立输入、逐碱基错配红色 |
| v1.7.0 | splash 动画随主题变色 |
| v1.7.1 | html zoom 白边修复、莱茵改暗色 |
| v1.8.0 | 序列视图 lineHeight 修复、.dna 导入、文件拖拽、启动页重做、莱茵"水晶霓虹"重设计 |
| v1.9.0 | 莱茵赛博朋克绿网格、两阶段启动加载 |
| v1.9.5 | Modal mousedown 防误关、reveal_file 路径归一化、数据集 JSON 导入 |
| v1.9.6 | rhine-exempt 豁免类、recipe-note 排除暗色、选区信息条、质粒间比对改完整线性 |
| v1.9.7 | nwAlign 带状 NW 替代逐位比较、已完成实验标星、侧栏星标高亮 |
| v1.9.8 | fastAlign (k-mer+LIS+局部NW)、AlnRow chunked 渲染、按钮触发计算、白屏修复 |
| v1.9.9 | match 块折叠、工具箱(秒表/倒计时/细胞计数器)、DurInput 秒级时长、产品更名 BioLab |
| v1.11.0 | 回到桌面基线(剥离 v1.10 移动端层)；长按磁贴拖拽排序(配方/方案/实验/数据集/便条/质粒窗口)；细胞计数器按行归零；质粒页 React.lazy 懒加载+空心环引导页(质粒文件/粘贴/片段/示例四入口)；酶切面板按酶分组+切点频率筛选(默认隐藏高频切酶)+点击定位；元件列表面板+定位联动；比对新增"到当前质粒"参考工作流+自动双向(alignBest/alignToReference)；修复 nwAlign 带宽越界崩溃、fastAlign indel 锚点丢失、悬垂端一致度稀释 |

---

## 9. 数据存储 Key 一览

所有 key 对应 `%LOCALAPPDATA%\biolab-assistant\{key}.json`:

- `sessions` — 实验会话数组
- `templates` — 方案模板数组
- `recipes` — 配方数组
- `datasets` — 数据集数组
- `plasmids` — 质粒库数组
- `settings` — 用户设置 (主题、缩放、通知等)
- `attendance` — 考勤记录
- `notes` — 便利贴
- `onboarded` — 是否完成引导

---

## 10. 接手开发建议

1. **先跑通构建**: 执行 `build.ps1`，确认能产出 NSIS 安装包。
2. **前端验证**: 修改 JSX 后在项目目录执行 `npx esbuild src/App.jsx --bundle --outfile=/dev/null --loader:.jsx=jsx --loader:.js=jsx` 检查语法。
3. **性能第一**: 任何涉及大序列的操作，必须按钮触发、同步执行、结果缓存。绝不在 render 路径中做 O(n²) 计算。
4. **主题兼容**: 新增 UI 组件需在三主题下测试。Rhine 暗色主题最容易出问题（form 元素、白色背景、文字对比度）。
5. **WebView2 限制**: 无 localStorage（用 Tauri IPC）、无 anchor 下载（用 save_text_file）、dataTransfer 自定义类型不可靠（用全局载荷）。
6. **Rust 端修改**: 改 main.rs 后需重新编译整个 release（耗时较长），尽量在前端解决问题。
