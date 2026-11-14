# BioLab 实验助手 — 设计文档 (Design Spec)

> **版本**: v1.9.9 | **产品名**: BioLab | **平台**: Windows x64 (Tauri v2 + WebView2)
> **用途**: 供 AI 或开发者理解产品设计意图，快速定位修改文件。

---

## 一、产品定位

面向分子生物学/生物化学实验室（RNA 结构生物学方向）的本地桌面工具，解决三个核心痛点：

1. **实验计时混乱** — 多步骤实验的时间推算、到点提醒、跨天记录
2. **方案/配方管理碎片化** — 模板化方案、浓度/体积自动计算
3. **质粒构建效率低** — 序列可视化、特征标注、引物设计、序列比对

设计原则：纯本地运行、零网络依赖（天气除外）、数据不离开用户机器、启动 < 2s。

---

## 二、系统架构

```
┌─────────────────────────────────────────────────────┐
│  WebView2 (Chromium)                                │
│  ┌───────────────────────────────────────────────┐  │
│  │  React 18 SPA                                 │  │
│  │  App.jsx (状态中枢 + Tab 路由)                 │  │
│  │    ├─ SessionCard / SessionDetail / Timeline   │  │
│  │    ├─ Cloning (质粒工作台)                     │  │
│  │    ├─ Recipes / Datasets / ToolsView           │  │
│  │    └─ Dialogs / Sidebar / MiniMode / ...       │  │
│  │                                               │  │
│  │  lib/core.js  — 工具函数 + 全局总线            │  │
│  │  lib/bio.js   — 生信算法                      │  │
│  │  lib/templates.js — 默认方案数据              │  │
│  └───────────────────────────────────────────────┘  │
│                      ↕ Tauri IPC (invoke)            │
├─────────────────────────────────────────────────────┤
│  Rust Backend (main.rs, 332 行)                     │
│  - load_data / save_data / load_many (JSON 持久化)  │
│  - save_text_file / save_attachment (原生对话框)    │
│  - send_notification (插件 + PowerShell Toast 兜底) │
│  - set_mini_mode / minimize / close / quit          │
│  - open_file / reveal_file (系统调用)               │
│  - 系统托盘 (左键恢复, 右键菜单)                    │
├─────────────────────────────────────────────────────┤
│  文件系统: %LOCALAPPDATA%\biolab-assistant\*.json   │
└─────────────────────────────────────────────────────┘
```

**关键决策**：
- 无状态管理库（纯 useState + props 下发），App.jsx 是唯一状态持有者
- 无路由库（Tab 切换用 activeTab 状态）
- 无 Web Worker（算法足够快，同步执行即可）
- 数据持久化走 Rust IPC 而非 localStorage（WebView2 限制）

---

## 三、数据模型

### 3.1 Session (实验会话)

```js
{
  id: string,           // genId()
  name: string,         // 实验名称
  templateId: string,   // 来源模板
  status: "running" | "completed",
  starred: boolean,     // 星标
  color: string,        // 自定义颜色 hex (可选)
  startedAt: number,    // 开始时间戳 ms
  steps: [{
    name: string,
    durationMin: number,  // 时长(分钟，可为小数表示秒级)
    location: string,     // 地点
    status: "pending" | "active" | "done" | "skipped",
    startedAt: number,
    confirmedAt: number,
  }],
  notes: string,
}
```

### 3.2 Template (方案模板)

```js
{
  id: string,
  name: string,
  category: string,
  steps: [{ name, durationMin, location }],
  notes: string,
}
```

### 3.3 Plasmid (质粒)

```js
{
  id: string,
  name: string,
  seq: string,          // 纯 ATGCN 序列
  circular: boolean,
  features: [{ name, start, end, strand: 1|-1, type }],
  source: string,       // 来源文件路径
}
```

### 3.4 存储 Key

| Key | 内容 | 文件 |
|-----|------|------|
| sessions | 实验会话数组 | sessions.json |
| templates | 方案模板数组 | templates.json |
| recipes | 配方数组 | recipes.json |
| datasets | 数据集数组 | datasets.json |
| plasmids | 质粒库数组 | plasmids.json |
| settings | 用户设置 | settings.json |
| attendance | 考勤记录 | attendance.json |
| notes | 便利贴 | notes.json |
| onboarded | 引导完成标记 | onboarded.json |

---

## 四、功能模块设计

### 4.1 实验计时 (核心)

**文件**: `App.jsx` (状态) + `SessionCard.jsx` (卡片) + `SessionDetail.jsx` (详情) + `Timeline.jsx` (甘特图)

- 步骤时间由 `computeSteps(session, now)` 推算（core.js），非存储值
- 到点提醒: setInterval 检查 → `send_notification` + `request_attention` (任务栏闪烁)
- 跨天实验: 归属开始日，次日步骤标注 "+N天"
- 已完成实验: 绿色 "已完成" 标记 (CheckCircle2 图标)

### 4.2 质粒工作台

**文件**: `Cloning.jsx` (~1200 行，最大单文件)

子功能:
- **序列视图**: 双链显示、bpPerRow 缩放 (15-120, Ctrl+滚轮)、特征标注条
- **引物设计**: 5'/3' Tag 添加、Tm 计算、GC% 分析
- **序列比对**: fastAlign 算法 → AlnSegments 渲染
- **.dna 导入**: SnapGene 二进制格式解析 (0x00=DNA, 0x0a=Features XML)
- **质粒间比对**: 选择两个已存质粒，按钮触发 fastAlign

### 4.3 工具箱

**文件**: `ToolsView.jsx`

- 秒表: 开始/暂停/计次/重置
- 倒计时: 预设 (1/3/5/10/15/30 min) + 自定义 (分+秒)
- 细胞计数器: 多行 ±计数、重命名、总计、重置

### 4.4 配方计算

**文件**: `Recipes.jsx`

- 摩尔浓度/质量浓度/稀释计算
- 常用缓冲液配方库

### 4.5 主题系统

**文件**: `index.css` (CSS 变量) + `App.jsx` (切换逻辑)

三套主题:
- 默认极简: 浅色、系统字体
- pixel: zpix 像素字体、深描边
- rhine: 深空暗底、绯红/冰青/翠绿、Rajdhani 字体、玻璃面板

切换方式: body class (`theme-pixel` / `theme-rhine`)，CSS 变量覆盖。

---

## 五、算法设计

### 5.1 fastAlign (主力比对算法)

**文件**: `lib/bio.js` 第 237-317 行

```
输入: refSeq, qrySeq (DNA 字符串)
输出: { segments, identity, gaps }

segments 类型:
  - { type: "match", seq }           → 完全匹配块 (折叠渲染)
  - { type: "aligned", alnRef, alnQry } → 局部 NW 比对结果
  - { type: "var", ref, qry }        → 可变区 (不逐碱基比对)
```

流程: k-mer(15) 索引 → 锚点延伸(≥25bp) → LIS 共线链化 → 覆盖率检查(<40%退回全程NW) → 分段构建

性能: 5000bp 高相似序列 ~2-5ms (vs 全程 NW ~200ms)

### 5.2 nwAlign (带状全局比对)

**文件**: `lib/bio.js` 第 137-232 行

- 仿射 gap (open=-5, ext=-2)
- 带宽: min(600, max(60, |Δlen|+40))
- 三矩阵 Float32Array
- 回溯: array push + reverse + join (O(n))

### 5.3 primerTm (近邻法 Tm)

**文件**: `lib/bio.js` 第 14-33 行

- <14bp: Wallace 公式 2(A+T)+4(G+C)
- ≥14bp: SantaLucia 1998 统一 ΔH/ΔS + Owczarzy 盐校正

---

## 六、修改指南 (按需求定位文件)

| 需求 | 修改文件 | 备注 |
|------|----------|------|
| 新增 Tab 页 | `App.jsx` | 加 import + tabs 数组 + 条件渲染 |
| 新增弹窗 | `Dialogs.jsx` | 遵循 Modal 组件 + mousedown 关闭逻辑 |
| 修改计时逻辑 | `lib/core.js` computeSteps | 步骤时间推算核心 |
| 修改比对算法 | `lib/bio.js` fastAlign/nwAlign | 纯函数，可独立测试 |
| 修改比对渲染 | `Cloning.jsx` AlnRow/AlnSegments | chunked 渲染，勿逐字符 |
| 新增质粒功能 | `Cloning.jsx` | 最大文件，注意性能守卫 |
| 修改主题样式 | `index.css` | CSS 变量 + .theme-xxx 选择器 |
| 修改 Rust 后端 | `src-tauri/src/main.rs` | 改后需重新编译 (~5min) |
| 修改构建配置 | `src-tauri/tauri.conf.json` | 注意 schema 限制 |
| 新增工具箱组件 | `ToolsView.jsx` | grid 布局，独立 state |
| 修改时长输入 | `Dialogs.jsx` DurInput | 内部存 durationMin |
| 修改通知逻辑 | `main.rs` send_notification | 插件 + PS Toast 双通道 |

---

## 七、关键约束 (必须遵守)

1. **性能**: 重计算必须按钮触发，不在 render/useMemo 中自动执行
2. **渲染**: 大序列 (>60bp match) 必须折叠，连续同样式字符合并单 span
3. **回溯**: 字符串构建用 array+reverse+join，禁止前置拼接
4. **WebView2**: 无 localStorage、无 anchor 下载、dataTransfer 自定义类型不可靠
5. **主题**: 新组件必须在三主题下测试，Rhine 暗色最易出问题
6. **版本**: package.json / tauri.conf.json / Cargo.toml 三处同步
7. **Modal**: mousedown+click 双事件判断，防拖选误关
8. **CSS**: lineHeight 内联必须带 "px" 字符串；z-index 层级注意 backdrop-filter

---

## 八、构建与发布

```powershell
# 构建 (产出 NSIS 安装包)
powershell -ExecutionPolicy Bypass -File build.ps1
# 产物: src-tauri/target/release/bundle/nsis/BioLab_1.9.9_x64-setup.exe

# 签名 (需 .pfx 证书)
.\sign.ps1 -CertPath "cert.pfx" -CertPass "password"
```

环境: VS Build Tools 2022 + Node.js v24 + Rust 1.97 (均不在默认 PATH，build.ps1 手动注入)

---

## 九、文件路径索引 (供 AI 直接引用)

```
项目根目录: C:\Users\Wan\.qoderworkcn\workspace\mrub8fj2efm3sv2l\outputs\biolab-desktop\

前端入口:     src/App.jsx
主样式:       src/index.css
工具库:       src/lib/core.js
生信算法:     src/lib/bio.js
模板数据:     src/lib/templates.js
质粒工作台:   src/components/Cloning.jsx
弹窗集合:     src/components/Dialogs.jsx
工具箱:       src/components/ToolsView.jsx
会话卡片:     src/components/SessionCard.jsx
会话详情:     src/components/SessionDetail.jsx
时间线:       src/components/Timeline.jsx
侧栏:         src/components/Sidebar.jsx
数据集:       src/components/Datasets.jsx
配方:         src/components/Recipes.jsx
迷你模式:     src/components/MiniMode.jsx
引导:         src/components/Onboarding.jsx

Rust 后端:    src-tauri/src/main.rs
Tauri 配置:   src-tauri/tauri.conf.json
Cargo 依赖:   src-tauri/Cargo.toml
构建脚本:     build.ps1
签名脚本:     sign.ps1
开发指南:     DEV_GUIDE.md (本文件的补充，含踩坑记录)
```
