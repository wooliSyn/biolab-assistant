// ==================== 轻量 Markdown 渲染（含 KaTeX 公式） ====================
// #10：工具箱「原理 · 公式 · 算例 · 排错」详解用。支持：标题 / 表格 / 引用块 /
// 有序无序列表 / 分隔线 / 段落 / **加粗** / `行内代码` / $...$ 与 $$...$$ 公式。
// 不引第三方 markdown 库（体积与依赖最小化）；文本一律先 HTML 转义，公式交给 KaTeX。
import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tex = (t, display) => {
  try {
    return katex.renderToString(t, { displayMode: display, throwOnError: false });
  } catch {
    return `<code>${esc(t)}</code>`;
  }
};

// 块级解析（math 数组在递归进引用块时共享，占位符才能正确还原）
function parseBlocks(lines, math) {
  const inline = (t) =>
    esc(t)
      .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+?)`/g, "<code>$1</code>")
      .replace(/\u0000(\d+)\u0000/g, (_, k) => math[+k] || "");
  const out = [];
  let i = 0;
  const isTableSep = (s) => /^\s*\|?[\s:|-]+\|?\s*$/.test(s) && s.includes("-");
  while (i < lines.length) {
    const ln = lines[i];
    if (!ln.trim()) { i++; continue; }
    let m;
    if ((m = ln.match(/^(#{1,4})\s+(.*)$/))) {
      const lv = Math.min(6, m[1].length + 2); // # → h3，面板内层级收敛
      out.push(`<h${lv} class="md-h">${inline(m[2])}</h${lv}>`);
      i++; continue;
    }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(ln)) { out.push("<hr/>"); i++; continue; }
    if (/^\s*\|/.test(ln)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i].trim()); i++; }
      const cells = (r) => r.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(rows.length > 1 && isTableSep(rows[1]) ? 2 : 1);
      out.push(
        `<div class="md-tablewrap"><table class="md-table"><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` +
        `<tbody>${body.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      );
      continue;
    }
    if (/^\s*>/.test(ln)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      out.push(`<blockquote class="md-quote">${parseBlocks(buf, math)}</blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
      out.push(`<ul class="md-ul">${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      out.push(`<ol class="md-ol">${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ol>`);
      continue;
    }
    // 段落：收集到空行 / 其它块级结构为止
    const buf = [ln]; i++;
    while (
      i < lines.length && lines[i].trim() &&
      !/^(#{1,4}\s|\s*\||\s*>|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]) &&
      !/^\s*(---+|\*\*\*+)\s*$/.test(lines[i])
    ) { buf.push(lines[i]); i++; }
    out.push(`<p class="md-p">${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

export function markdownToHtml(src) {
  if (!src) return "";
  // 先把公式整体保护成占位符（块级 $$ 优先于行内 $），避免 markdown 解析误伤 LaTeX
  const math = [];
  const s = String(src).replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (_, d, n) => {
    math.push(tex(d != null ? d : n, d != null));
    return `\u0000${math.length - 1}\u0000`;
  });
  return parseBlocks(s.split(/\r?\n/), math);
}

export default function Markdown({ text, className = "" }) {
  const html = useMemo(() => markdownToHtml(text), [text]);
  return <div className={`md-doc latex-content ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}