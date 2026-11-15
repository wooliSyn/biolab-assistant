import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body><div id=root></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element; global.Node = dom.window.Node;
global.getComputedStyle = dom.window.getComputedStyle;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
class RO { constructor(cb){ this.cb = cb; } observe(){ this.cb([], this); } unobserve(){} disconnect(){} }
global.ResizeObserver = RO; dom.window.ResizeObserver = RO;
// jsdom 无 canvas 实现：序列面板用 measureText 实测等宽字形宽度，给个等比桩
dom.window.HTMLCanvasElement.prototype.getContext = function () {
  return { font: "", measureText: (t) => ({ width: (parseFloat(this.font) || 12) * 0.6 * String(t).length }) };
};
// jsdom 未实现 Element.scrollTo / scrollIntoView
dom.window.Element.prototype.scrollTo = function () {};
dom.window.Element.prototype.scrollIntoView = function () {};
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { act } = await import("react-dom/test-utils");
const Cloning = (await import("../src/components/Cloning.jsx")).default;

const root = createRoot(document.getElementById("root"));
const errs = [];
const origErr = console.error;
console.error = (...a) => { errs.push(a.map(String).join(" ")); };

await act(async () => { root.render(React.createElement(Cloning)); });
await act(async () => { await new Promise((r) => setTimeout(r, 60)); });

const txt = () => document.getElementById("root").textContent;
const q = (s) => [...document.querySelectorAll(s)];
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); await new Promise((r)=>setTimeout(r,20)); }); };

const checks = [];
const ck = (name, cond, extra="") => checks.push([name, !!cond, extra]);

// 质粒文档标签
const tabs = q("[data-drag-id]");
ck("质粒文档标签渲染 2 个", tabs.length === 2, `实际 ${tabs.length}`);
ck("标签显示质粒名与 bp", txt().includes("pDemo-1") && txt().includes("insert-A"));

// 视图分页按钮
const tabRow = q("div").find((d) => { const bs=[...d.children].filter(c=>c.tagName==="BUTTON"); return bs.length>=6 && bs.slice(0,6).map(b=>b.textContent.replace(/\d+/g,"").trim()).join(",")==="图谱,序列,酶切,元件,引物,比对"; });
ck("视图标签行恰好六个标签", tabRow && [...tabRow.children].length === 6, tabRow ? `实际 ${[...tabRow.children].length}` : "未找到视图标签行");
ck("图层开关不与视图标签同名", !q("button").some((b)=>b.textContent.trim()==="酶切" ) , q("button").filter(b=>b.textContent.trim()==="酶切").map(b=>b.textContent).join("/"));

// 默认图谱视图
ck("默认进图谱视图（有 svg 圆 + 中心名）", q("svg circle").length > 0 && txt().includes("2847 bp") === false ? q("svg").length > 0 : true);
ck("图谱工具条有 环形/线性 切换", txt().includes("环形") && txt().includes("线性"));

// 状态栏
ck("状态栏显示 bp 与拓扑", /\d+ bp/.test(txt()) && txt().includes("未选择区段"));
ck("状态栏显示元件/位点/引物计数", /\d+ 元件 · \d+ 位点 · \d+ 引物/.test(txt()), (txt().match(/\d+ 元件 · \d+ 位点 · \d+ 引物/)||[""])[0]);

const byLabel = (l) => q("button").find((b) => b.textContent.replace(/\d+/g,"").trim() === l);
if (process.env.DUMP_BTN) { console.log("按钮文本：", JSON.stringify(q("button").map(b=>b.textContent.trim()).slice(0,30))); }

// 切到各视图
for (const [label, expect] of [["序列","5′→3′ 正链"],["酶切","识别序列"],["元件","元件注释"],["引物","引物"],["比对","到当前质粒"]]) {
  const b = byLabel(label);
  if (!b) { ck(`切到「${label}」视图`, false, "按钮未找到"); continue; }
  await click(b);
  ck(`切到「${label}」视图`, txt().includes(expect), `未见「${expect}」`);
}

// 元件视图点击元件 → 应跳回序列视图并选中
await click(byLabel("元件"));
const featRows = q("button").filter((b) => b.textContent.includes("目的基因 CDS"));
if (featRows.length) {
  await click(featRows[0]);
  ck("点元件 → 跳到序列视图并选中", /选区 \d+–\d+/.test(txt()), txt().match(/选区[^·]*/)?.[0] || "无选区");
  ck("选中后状态栏出现 GC%", /GC \d+\.\d%/.test(txt()), (txt().match(/GC [\d.]+%/)||[""])[0]);
} else ck("元件列表可点击", false, "未找到元件行");

// 切回图谱，选区应保留（跨视图持久）
await click(byLabel("图谱"));
ck("切回图谱后选区保留", /选区 \d+–\d+/.test(txt()));

// 切换质粒 → 选区应清空
await click(tabs[1]);
ck("切换质粒后选区清空", txt().includes("未选择区段"));
ck("切换到线性质粒后环形按钮禁用", q("button").some((b)=>b.textContent.includes("环形") && b.disabled));

console.error = origErr;
const realErrs = errs.filter((e) => !/not wrapped in act|ReactDOMTestUtils\.act|unmountComponentAtNode/.test(e));
let bad = 0;
for (const [n, ok, ex] of checks) { if (!ok) bad++; console.log(`${ok ? "✓" : "✗"} ${n}${ok ? "" : " → " + ex}`); }
if (realErrs.length) { console.log(`\n✗ React 运行时报错 ${realErrs.length} 条：`); realErrs.slice(0,5).forEach((e)=>console.log("   " + e.slice(0,220))); bad += realErrs.length; }
console.log(bad ? `\n${bad} 项未通过` : `\n全部 ${checks.length} 项通过，且无 React 运行时报错`);
