# 测试脚本

两个不依赖测试框架的脚本，用 esbuild 现场打包后在 Node 里跑。
目的是在**没有 Windows / 没有打开应用**的情况下，抓住质粒图谱最容易出的两类问题。

## map-geometry.jsx — 几何回归

`renderToString` 把 `PlasmidMap` 在 18 组尺寸/数据组合下渲染一遍，检查：

- 输出里是否出现 `NaN`（半径、角度算出 NaN 时 SVG 会静默画歪，不报错）
- 是否抛异常（空序列、单酶切位点、超长 feature 这些边界）

几何代码改动后先跑这个，比开应用快。

## cloning-mount.jsx — 挂载集成（⚠️ 目前挂死，待修）

在 jsdom 里挂载**真实的** `Cloning` 组件，`@tauri-apps/api/core` 用 `stub-tauri.js` 顶替，
跑 18 项断言并捕获 React 运行时报错。能抓到 `validateDOMNesting`、
hook 顺序错误、以及 TDZ 这类白屏级问题。

## 跑法

```bash
npm run test:map     # 几何 —— 可用，18 组全过
npm run test:mount   # 挂载 —— 目前会无限挂起
```

### test:mount 挂死的已知线索

2026-11-15 的 UI 改动之后开始挂：`node` 跑满 70s 无任何输出，
连第一条 `ck` 都没打印，说明卡在 `act()` 里的首次挂载。

排除过的原因：

- **不是** 缺 `ResizeObserver` —— 脚本第 11 行本来就有 shim
- **不是** stub 没接上 —— 补上 `--alias:@tauri-apps/api/core` 之后
  组件已经能拿到 demo 质粒（之前拿不到数据会退回空状态）

还没查的方向：`act()` 等待一个永不落定的状态更新。
嫌疑点是 Cloning 里 `bodyRef` + ResizeObserver 算 `bodyH` 那段 ——
shim 在 `observe()` 里同步回调，若 `setBodyH` 又触发重新 observe 就会自锁。
建议改成 shim 里异步回调一次，或在测试里直接 mock 掉 `bodyH`。

## stub-tauri.js

假的 `invoke`，按命令名返回固定的质粒数据（CDS / 启动子 / 酶切位点）。
加新的 IPC 命令时要在这里补一个分支，否则挂载测试会拿到 undefined。
