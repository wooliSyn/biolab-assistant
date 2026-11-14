# BioLab 实验助手

> 本地优先的分子生物学桌面工具 · 实验计时 / 配方便利贴墙 / 质粒工作台 / 数据集 / 工具箱
>
> **Tauri v2 + React 18 + Rust** · 数据永不离开你的电脑 · 当前版本 **v1.12.0**

BioLab 是一款面向分子生物学 / 生物化学实验室（尤其 RNA 结构生物学方向）的**本地桌面工具**，解决科研人员在实验台前的三个真实痛点：

1. **实验计时混乱** —— 多步骤实验的时间推算、到点提醒、跨天记录，离开孵育箱就忘了下一步几点做。
2. **方案 / 配方碎片化** —— 实验方案散落在各处，试剂配方每次重新查、重新算。
3. **质粒构建效率低** —— 序列看不清、特征找不到、引物设计靠手算、比对要开网页工具。

设计原则：**纯本地运行**（数据存于本机，不上传、不联网、不依赖账号）、**零学习成本**、**快**（启动 < 2s，计时秒级响应）、**桌面优先**（像素风设计语言为桌面鼠标 + 大屏而生）。

---

## 功能特性

### 六大主功能模块

| 模块 | 说明 |
|------|------|
| **今日实验** | 计时核心。多步骤实验会话卡片，实时倒计时、到点系统通知 + 任务栏闪烁、托管模式（离座长孵育）、跨天实验、甘特图式时间线、星标 / 自定义颜色 / 长按拖拽排序。 |
| **方案库** | 实验流程模板沉淀，一键开实验。内置 RNA 制备 / 结构分析 / 分子生物学 / 蛋白质等多类带原始 protocol 的模板；支持导入 / 导出 JSON、长按拖拽排序。 |
| **配方墙** | 试剂配方便利贴墙，随手记、随手算。内置 LB / TAE / TBE / PBS / TBS / TBST / SSC / 杂交液 / DMEM / RIPA 等 20+ 配方；单元格直接编辑、分类筛选、长按磁贴拖拽换位。 |
| **数据集** | 原始数据登记（测序 / 胶图 / tif），附件复制存储到本地、待处理提醒、关联实验跳转、JSON 导入导出。 |
| **质粒工作台** | 差异化核心，对标 SnapGene。SnapGene 风格双链序列视图、特征元件标注与列表、限制酶切分析（按酶分组 + 切点频率筛选）、引物设计（Tm 近邻法 / Tag 融合 / 正反向）、序列比对（到当前质粒参考比对 / 自动双向 / 质粒间）、环形 / 线性图谱。支持 GenBank / FASTA / SnapGene `.dna` 导入。 |
| **工具箱** | 秒表、倒计时、细胞计数器（每行单独归零）。 |

### 辅助系统

- **侧栏**：日历导航（按天看实验）、便条速记（LaTeX 公式）、考勤连续天数、星标高亮。
- **考勤打卡**：上下班打卡、连续天数激励、补签、工作证明 / 月度总结导出。
- **迷你模式**：置顶小窗，离开工位也能瞥一眼当前计时。
- **传送门**：顶刊 / 图书馆 / 科研数据库 / 引物设计 / 数据分析 / 文献阅读 / AI+ 科研工具（Biomni、RF3、RhoFold、AlphaFold3 等）快捷入口，支持自定义。

### 三套主题

- **默认极简（flat）**：浅色、系统字体、柔和边框。
- **像素风（pixel）**：zpix 像素字体、深描边、复古游戏面板（设计语言基底）。
- **莱茵（rhine）**：暗色赛博旗舰主题，动态光场背景层。

---

## 技术栈

- **前端**：React 18 + Vite 6 + Tailwind CSS 3，纯 `useState + props` 状态管理（无 Redux / 路由库）。
- **后端**：Tauri v2（Rust），本地 JSON 持久化、系统托盘、Windows 通知、原生文件对话框。
- **生信算法**（`src/lib/bio.js`）：近邻法 Tm（SantaLucia 1998 + 盐校正）、密码子翻译、锚点链化 + 带状 Needleman-Wunsch 比对（fastAlign）、自动双向参考比对（alignBest / alignToReference）。
- **渲染**：单窗口 WebView2；大序列分段合并渲染（chunked），重计算按钮触发，避免主线程阻塞白屏。

---

## 快速开始

### 方式一：下载安装包（推荐）

从 [Releases](https://github.com/wooliSyn/biolab-assistant/releases) 下载 `BioLab_<版本>_x64-setup.exe`（NSIS）或 `_zh-CN.msi`（WiX），双击安装即可。首次启动可选择**保留本机数据 / 从备份导入 / 全新安装**。

> 未签名的安装包可能触发 Windows Smart App Control 提示，选择"仍要运行"即可（代码签名见 `sign.ps1`）。

### 方式二：从源码构建

**前置条件**（Windows 10/11 x64）：

- [Node.js](https://nodejs.org/)（v20+）
- [Rust](https://www.rust-lang.org/tools/install)（MSVC target）
- Visual Studio Build Tools 2022（含 C++ 桌面开发 workload）
- WebView2 Runtime（Windows 11 自带）

**构建步骤**：

```powershell
git clone https://github.com/wooliSyn/biolab-assistant.git
cd biolab-assistant
npm install
# 一键构建（自动注入 MSVC / Node / Cargo 环境，路径见 build.ps1）
powershell -ExecutionPolicy Bypass -File build.ps1
```

产物位于 `src-tauri/target/release/bundle/`：

- NSIS：`nsis/BioLab_<版本>_x64-setup.exe`
- WiX MSI：`msi/BioLab_<版本>_x64_zh-CN.msi`

开发模式：`npm run tauri dev`。

> `build.ps1` 中的工具链路径（Node / Cargo / vcvarsall）按本机环境硬编码，移植时请按实际路径调整。

---

## 数据与隐私

- 所有数据存于 `%LOCALAPPDATA%\biolab-assistant\`，每个页面一个 JSON 文件（`sessions` / `templates` / `recipes` / `datasets` / `cloning` / `attendance` / `notes` 等）。
- **不上传、不联网、不依赖账号**。唯一例外是首页天气（可关）。
- 「数据管理」支持全量备份导出 / 从备份恢复 / 清空。原始实验数据请务必另行妥善保管备份。

---

## 项目结构

```
biolab-assistant/
├── src/                      # 前端（React）
│   ├── App.jsx               # 主应用：状态管理 / Tab 路由 / 全局弹窗 / 数据加载
│   ├── index.css             # 三主题 CSS 变量 + 莱茵特效 + 全局样式
│   ├── lib/
│   │   ├── core.js           # 工具函数 / 全局总线 / 步骤时间推算 / 导出
│   │   ├── bio.js            # 生信算法：Tm / 翻译 / fastAlign / alignBest / alignToReference
│   │   ├── templates.js      # 默认实验方案模板（含 protocol）
│   │   ├── useFlip.jsx       # FLIP 磁贴换位动画
│   │   └── useLongPressDrag.js  # 长按磁贴拖拽排序
│   └── components/           # 各功能组件（Cloning / Recipes / ToolsView / Sidebar ...）
├── src-tauri/                # 后端（Rust / Tauri）
│   ├── src/main.rs           # IPC commands / 托盘 / 通知 / 文件对话框
│   ├── tauri.conf.json       # 应用配置
│   └── Cargo.toml
├── DESIGN_PRODUCT.md         # 产品设计"宪法"（权威基线，改 UI 前必读）
├── DEV_GUIDE.md              # 完整开发文档（架构 / 算法 / 约定 / 陷阱 / 构建）
├── DESIGN.md / DESIGN_MOBILE.md / ANDROID_SETUP.md  # 设计规格与移动端草案
└── build.ps1 / sign.ps1      # 构建 / 代码签名脚本
```

---

## 开发文档

- **[DESIGN_PRODUCT.md](DESIGN_PRODUCT.md)** —— 产品设计的"宪法"。任何修改（无论人或 AI）都必须先符合本方案，不得偏离产品定位与艺术风格。
- **[DEV_GUIDE.md](DEV_GUIDE.md)** —— 接手开发必读：架构、核心算法、关键约定与陷阱（性能铁律 / 主题兼容 / WebView2 限制）、构建流程、版本演进。

---

## 未来计划（Roadmap）

本项目将持续改进以下方面：

- **a. 交互** —— 持续打磨桌面端交互细节：更顺手的拖拽与选区、更清晰的序列 / 图谱联动、更完善的引物与比对工作流、键盘快捷键与无障碍优化。
- **b. 移植到其他端，尤其是手机端（重要）** —— 基于 Tauri v2 Mobile 将核心能力（离座计时提醒、台旁快捷工具、质粒查看 / 比对）扩展到 Android / iOS，让手机在口袋里也能收到步骤到点推送，并在实验台旁随手查看质粒。这是后续工作的重点。详见 `DESIGN_MOBILE.md` 草案。
- **c. 领域前沿周报（如有可能）** —— 集成文献追踪能力，定期更新核酸 / 结构生物学 / 生物物理领域前沿周报，关注 CNS 及顶级子刊的最新进展，把"读文献"也接进实验助手。

---

## 版本历史（节选）

| 版本 | 里程碑 |
|------|--------|
| v1.0–1.2 | 基础框架：实验计时、方案模板、时间线、配方 |
| v1.4–1.5 | 三主题系统 + 全局 toast 总线 |
| v1.6–1.8 | 质粒序列缩放、`.dna` 导入、莱茵"水晶霓虹"重设计 |
| v1.9.x | fastAlign 锚点比对、chunked 渲染、白屏修复、工具箱三件套、产品更名 BioLab |
| v1.11.0 | 回到桌面基线；长按磁贴拖拽；质粒页懒加载 + 引导页；酶切分组 + 频率筛选；元件列表；参考比对 + 自动双向；修复比对崩溃 |
| v1.12.0 | 拖拽更温和；质粒页切换无闪现；首次运行数据起点选择；传送门扩充（引物 / 分析 / 文献 / AI+）；配方与方案库扩充 |

完整演进见 [DEV_GUIDE.md](DEV_GUIDE.md) 第 8 节。

---

## 作者

**Jerry Wan** · 中国科学院生物物理研究所（IBP Beijing）· RNA 结构生物学方向

本项目为个人科研工具，欢迎 Issue / PR 交流。