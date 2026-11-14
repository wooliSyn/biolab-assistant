// ==================== LaTeX 渲染（KaTeX） ====================
// 支持 $...$ 行内公式与 $$...$$ 块级公式
import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

function renderTex(tex, display) {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false });
  } catch {
    return `<span style="color:#ef4444">${tex}</span>`;
  }
}

// 将文本拆分为普通文本与公式片段，返回 HTML 字符串
// 普通文本支持 **加粗** 与 ==高亮== 标记
export function textToHtml(text) {
  if (!text) return "";
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s) =>
    s.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
      .replace(/==([^=\n]+?)==/g, "<mark>$1</mark>");
  let html = "";
  // 先处理 $$...$$ 块级，再处理 $...$ 行内
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    html += inline(esc(text.slice(last, m.index))).replace(/\n/g, "<br/>");
    if (m[1] != null) html += renderTex(m[1], true);
    else html += renderTex(m[2], false);
    last = re.lastIndex;
  }
  html += inline(esc(text.slice(last))).replace(/\n/g, "<br/>");
  return html;
}

export default function RichText({ text, className = "" }) {
  const html = useMemo(() => textToHtml(text), [text]);
  return (
    <div
      className={`latex-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// 常用符号面板（插入到编辑器光标处）
export const SYMBOL_GROUPS = [
  { label: "希腊", items: ["α", "β", "γ", "δ", "ε", "θ", "λ", "μ", "π", "σ", "φ", "ψ", "ω", "Δ", "Ω"] },
  { label: "单位", items: ["°C", "µL", "µM", "µg", "mM", "ng", "kb", "nt", "rpm", "×g"] },
  { label: "运算", items: ["→", "←", "⇌", "≈", "±", "×", "÷", "≤", "≥", "∝", "√", "∑", "∫"] },
  { label: "上标", items: ["⁰", "¹", "²", "³", "⁴", "⁻", "⁺", "²⁺", "³⁺"] },
];
