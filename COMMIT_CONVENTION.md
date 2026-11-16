# 提交信息规范

本仓库遵循 [Conventional Commits 1.0.0](https://www.conventionalcommits.org/zh-hans/v1.0.0/)。
统一格式的好处：一眼看出改动性质、按类型生成更新日志、判断该升哪一位版本号。

## 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **第一行（header）必填**，其余可选。header 不超过 72 个字符。
- `type` 和 `scope` 用英文小写；`subject` 和正文**用中文写**。
- 冒号后面有一个空格，`subject` 结尾不加句号。
- header、body、footer 之间各空一行。

## type

| type | 用途 | 示例 |
|---|---|---|
| `feat` | 新功能 | `feat(tools): 新增 OD260 浓度换算` |
| `fix` | 修 bug | `fix(tools): 组装配比渲染期读到 null 导致白屏` |
| `perf` | 性能优化，行为不变 | `perf(theme): 暗室卡片去掉叠加 backdrop-filter` |
| `refactor` | 重构，既不修 bug 也不加功能 | `refactor(cloning): 配色函数挪到 lib/mapstyle.js` |
| `style` | 界面样式、布局、视觉调整 | `style(ui): 统一卡片圆角和间距` |
| `docs` | 只改文档 | `docs: 补充 macOS 构建说明` |
| `test` | 加测试或改测试 | `test(map): 补充环形跨起点用例` |
| `build` | 构建系统、依赖、打包配置 | `build(tauri): 补 .icns 图标` |
| `ci` | CI 工作流 | `ci: 加三平台 cargo check` |
| `chore` | 杂项，不影响源码和产物 | `chore: 清理临时脚本` |
| `revert` | 撤销之前的提交 | `revert: feat(tools): 新增 OD260 浓度换算` |
| `release` | 发版（只改版本号） | `release: 1.13.0` |

> 本仓库里 `style` 指**界面样式**，不是 Conventional Commits 原义的「代码格式」。
> 只是代码格式化（缩进、换行）的提交归为 `chore`。

## scope

scope 是可选的，写的是改动所在的模块。常用的有：

| scope | 范围 |
|---|---|
| `cloning` | 质粒工作台（`Cloning.jsx`） |
| `map` | 质粒图谱（`PlasmidMap.jsx`、`lib/mapstyle.js`） |
| `bio` | 序列与生物计算（`lib/bio.js`：Tm、比对、清洗序列） |
| `tools` | 工具箱 / 计算器（`BenchTools.jsx`、`Calculators.jsx`、`lib/calc.js`） |
| `timeline` | 实验记录、计时、时间线 |
| `datasets` | 数据集 |
| `attendance` | 打卡 |
| `portal` | 传送门外链 |
| `theme` | 三套主题（flat / pixel / 暗室） |
| `ui` | 跨页面的通用界面：侧栏、标题栏、对话框、响应式 |
| `tauri` | Rust 外壳：IPC、托盘、通知、窗口 |
| `macos` / `windows` / `linux` | 只影响某一平台的适配 |
| `deps` | 依赖升级 |

改动跨了好几个模块就不写 scope，或者拆成多个提交。

## subject

- 说清楚**做了什么**。原因写在正文里。
- 用动词开头：「新增」「修复」「移除」「改为」「支持」。
- 能看出影响面：~~`fix: 修 bug`~~ → `fix(bio): cleanSeq 未处理 U 和 IUPAC 简并碱基`。

## body（正文）

写**为什么改**和**怎么改的**，读代码看不出来的东西写在这里：

```
fix(bio): Tm 计算改用最近邻法

原来的 Wallace 公式（2×AT + 4×GC）只适用于 14 nt 以下的引物，
长引物会偏高 10 ℃ 以上。改为 SantaLucia 1998 最近邻参数，
盐浓度默认 50 mM Na⁺，可在设置里改。
```

- 每行大约 72 个字符就换行。
- 涉及生物计算的改动，**写明公式或参数来源**。

## footer（脚注）

### 破坏性变更

改变了用户数据格式、需要迁移，或者行为和以前不兼容时：在 type 后面加 `!`，**并且**写上 `BREAKING CHANGE:` 脚注。

```
feat(timeline)!: 实验记录改为按月分文件存储

BREAKING CHANGE: 旧的 sessions.json 在首次启动时自动迁移到
sessions/2026-11.json 这样的按月文件，迁移前会备份原文件。
```

> 「数据不出设备」是产品承诺，所有本地 JSON 都是用户的实验记录。
> **改数据格式必须提供迁移，并且标注 BREAKING CHANGE。**

### 关联 issue

```
Closes #12
Refs #8
```

### AI 协作

AI 实质性参与了改动时，加一行署名：

```
Co-Authored-By: <模型名> <邮箱>
```

## 版本号对应关系

`package.json` 是版本号的唯一来源，用 `npm run version:set x.y.z` 修改。

| 自上次发版以来出现过 | 升哪一位 |
|---|---|
| `BREAKING CHANGE` / `!` | 主版本 `x` |
| `feat` | 次版本 `y` |
| 只有 `fix` / `perf` 等 | 修订号 `z` |

## 其他约定

- **一个提交只做一件事。** 「加功能顺手修了个 bug」应该拆成两个提交。
- 不要提交构建产物（`dist/`、`target/`、`.test-*.cjs`）。
- 合并 PR 时 merge commit 保留 GitHub 默认的格式就行；squash 合并时，合并后的标题也要符合本规范。

## 对照：以前的写法 → 规范写法

| 以前 | 规范 |
|---|---|
| `工具箱: 组装只输µL…; 梯度稀释…; 两列布局…` | 拆成 `feat(tools): 组装配比只需输入 µL` 等多条 |
| `UI: 组装配比补全单位/含义说明…` | `style(tools): 组装配比补全单位和含义说明` |
| `fix: 组装配比 pushText 渲染期读 null res…` | `fix(tools): 组装配比渲染期读到 null 导致白屏` |
| `perf: 暗室下工具箱卡片改纯色暗底…` | `perf(theme): 暗室工具箱卡片改用纯色暗底` |
| `Update README.md` | `docs: 更新 README` |
