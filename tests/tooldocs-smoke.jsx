// #10 冒烟测试：工具箱 Markdown 详解（SSR，不依赖 DOM）
// 构建：node tests/run-tooldocs.mjs（esbuild 插件处理 ?raw 与 css）→ node .test-tooldocs.cjs
import { renderToString } from "react-dom/server";
import Markdown, { markdownToHtml } from "../src/lib/Markdown.jsx";
import { TOOL_DOCS } from "../src/lib/toolDocs.js";

const strip = (h) => h.replace(/<!-- -->/g, "");
let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.error("FAIL:", msg); } else console.log("ok:", msg); };

// 1) 9 个计算工具都有详解，且带「实现对照」
const IDS = ["cell", "dilution", "mix", "assembly", "hemo", "serial", "cfu", "od260", "mw"];
ok(IDS.every((id) => TOOL_DOCS[id] && TOOL_DOCS[id].length > 500), "9 个工具详解均存在且非空");
ok(IDS.every((id) => TOOL_DOCS[id].includes("实现对照")), "每篇详解含「实现对照」");
ok(TOOL_DOCS.assembly.includes("660") && TOOL_DOCS.assembly.includes("650"), "assembly 标明 660/650 差异");
ok(TOOL_DOCS.serial.includes("平行稀释"), "serial 标明平行稀释模式");

// 2) Markdown 渲染：标题 / 表格 / 引用 / 列表 / 公式
const html = markdownToHtml(TOOL_DOCS.assembly);
ok(html.includes("<table"), "表格渲染");
ok(html.includes("<blockquote"), "引用块渲染");
ok(html.includes("katex"), "KaTeX 公式渲染");
ok(html.includes("<h4") || html.includes("<h3"), "标题渲染");
ok(!html.includes("\u0000"), "公式占位符全部还原");

// 3) SSR 组件渲染
const ssr = strip(renderToString(<Markdown text={TOOL_DOCS.cell} />));
ok(ssr.includes("台盼蓝"), "细胞计数详解 SSR 含理论内容");
ok(ssr.includes("katex"), "细胞计数详解 SSR 含公式");
ok(ssr.includes("md-doc"), "容器类名正确");

// 4) 安全：HTML 注入被转义
const evil = markdownToHtml("<script>alert(1)</script> **粗** $x^2$");
ok(!evil.includes("<script>"), "script 标签被转义");
ok(evil.includes("<strong>粗</strong>"), "加粗正常");
ok(evil.includes("katex"), "行内公式正常");

// 5) 引用块内嵌套列表/公式（手册算例结构）
const q = markdownToHtml("> **场景**：$N=200$\n>\n> 1. 第一步 $C_1V_1$\n> 2. 第二步\n>\n> - 注意一\n> - 注意二");
ok(q.includes("<blockquote") && q.includes("<ol") && q.includes("<ul"), "引用块内嵌套有序/无序列表");
ok((q.match(/katex/g) || []).length >= 2, "引用块内公式还原");

if (failed) { console.error(`\n${failed} 项失败`); process.exit(1); }
console.log("\ntooldocs smoke: 全部通过");