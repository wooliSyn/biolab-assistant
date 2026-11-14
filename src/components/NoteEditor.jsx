// ==================== 笔记编辑器（LaTeX / 符号面板 / 上传） ====================
// 空格 + 反斜杠 → 自动插入 $…$ 公式定界；光标移出输入框自动渲染公式，方便检查
import { useRef, useState } from "react";
import { Sigma, Paperclip, Eye, Pencil, FunctionSquare } from "lucide-react";
import RichText, { SYMBOL_GROUPS } from "../lib/Latex";

// 判断内容里是否含公式定界符
const hasFormula = (t) => /\$[^$\n]+?\$|\$\$[\s\S]+?\$\$/.test(t || "");

export default function NoteEditor({ value, onChange, attachments = [], onAttachments, placeholder = "记录…（空格+\\ 插入公式，$…$ 行内 / $$…$$ 块级）", rows = 5, splitView = false }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(splitView);
  const [showSymbols, setShowSymbols] = useState(false);
  const [focused, setFocused] = useState(false);

  // 在光标处插入文本
  const insertAt = (text) => {
    const el = ref.current;
    if (!el) { onChange(value + text); return; }
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? value.length;
    const nv = value.slice(0, s) + text + value.slice(e);
    onChange(nv);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + text.length, s + text.length); });
  };

  // 空格 + 反斜杠 → 插入 $ $ 并定位光标到中间
  const onKeyDown = (e) => {
    if (e.key === "\\" ) {
      const el = ref.current;
      const s = el?.selectionStart ?? 0;
      const before = value[s - 1];
      if (before === " " || s === 0 || before === "\n") {
        e.preventDefault();
        const nv = value.slice(0, s) + "$ $" + value.slice(el?.selectionEnd ?? s);
        onChange(nv);
        requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + 1, s + 1); });
      }
    }
  };

  const addFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !onAttachments) return;
    Promise.all(files.map((f) => new Promise((res) => {
      const reader = new FileReader();
      reader.onload = () => res({ name: f.name, size: f.size, type: f.type, dataUrl: String(reader.result).slice(0, 200000) });
      reader.readAsDataURL(f);
    }))).then((items) => onAttachments([...attachments, ...items]));
    e.target.value = "";
  };

  // 失焦自动预览：光标移出代码框且含公式时，自动渲染在下方
  const autoPreview = !focused && !preview && value.trim() && hasFormula(value);

  return (
    <div className="pixel-inset bg-white overflow-hidden">
      {/* 工具条 */}
      <div className="flex items-center gap-1 px-2 py-1 border-b-2 border-[var(--px-ink)] bg-[var(--px-bg)]">
        <button onClick={() => setShowSymbols((v) => !v)} className={`p-1 text-[var(--px-ink)] hover:bg-white ${showSymbols ? "bg-white pixel-inset" : ""}`} title="符号面板"><Sigma size={13} /></button>
        <label className="p-1 text-[var(--px-ink)] hover:bg-white cursor-pointer" title="上传结果/附件">
          <Paperclip size={13} /><input type="file" multiple className="hidden" onChange={addFiles} />
        </label>
        <button onClick={() => setPreview((v) => !v)} className={`ml-auto flex items-center gap-1 px-1.5 py-0.5 text-[10px] border-2 border-[var(--px-ink)] ${preview ? "bg-[var(--px-accent)] text-white" : "bg-white text-[var(--px-ink)] hover:bg-indigo-50"}`}>
          {preview ? <><Pencil size={11} />编辑</> : splitView ? <><Eye size={11} />仅预览</> : <><Eye size={11} />预览</>}
        </button>
      </div>

      {/* 符号面板 */}
      {showSymbols && (
        <div className="px-2 py-1.5 border-b-2 border-[var(--px-ink)] bg-indigo-50/60 space-y-1">
          {SYMBOL_GROUPS.map((g) => (
            <div key={g.label} className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] text-gray-500 w-7">{g.label}</span>
              {g.items.map((sym) => (
                <button key={sym} onClick={() => insertAt(sym)} className="px-1.5 py-0.5 text-[11px] bg-white border-2 border-gray-300 hover:border-[var(--px-accent)] hover:text-indigo-600">{sym}</button>
              ))}
            </div>
          ))}
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-500 w-7">公式</span>
            <button onClick={() => insertAt("$  $")} className="px-1.5 py-0.5 text-[10px] bg-white border-2 border-gray-300 hover:border-[var(--px-accent)]">行内 $…$</button>
            <button onClick={() => insertAt("$$\n\n$$")} className="px-1.5 py-0.5 text-[10px] bg-white border-2 border-gray-300 hover:border-[var(--px-accent)]">块级 $$…$$</button>
            <button onClick={() => insertAt("$\\Delta G = -RT\\ln K$")} className="px-1.5 py-0.5 text-[10px] bg-white border-2 border-gray-300 hover:border-[var(--px-accent)]">示例 ΔG</button>
          </div>
        </div>
      )}

      {preview ? (
        <div className="px-3 py-2 min-h-[60px] text-[12px] text-gray-700 max-h-48 overflow-y-auto">
          {value ? <RichText text={value} /> : <span className="text-gray-300">（空）</span>}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {attachments.map((a, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 border border-gray-300 flex items-center gap-1"><Paperclip size={10} />{a.name}</span>
              ))}
            </div>
          )}
        </div>
      ) : splitView ? (
        <div className="flex">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            rows={rows}
            className="flex-1 text-[12px] px-3 py-2 resize-none focus:outline-none bg-transparent font-mono border-r-2 border-[var(--px-ink)] min-w-0"
          />
          <div className="flex-1 px-3 py-2 text-[12px] text-gray-700 overflow-y-auto max-h-48 bg-indigo-50/40 min-w-0">
            {value ? <RichText text={value} /> : <span className="text-gray-300">（实时渲染）</span>}
          </div>
        </div>
      ) : (
        <>
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            rows={rows}
            className="w-full text-[12px] px-3 py-2 resize-none focus:outline-none bg-transparent font-mono"
          />
          {/* 失焦自动预览：光标移出代码框后自动渲染公式，方便检查 */}
          {autoPreview && (
            <div
              className="border-t-2 border-dashed border-[var(--px-ink)] bg-indigo-50/70 px-3 py-2 cursor-text"
              onClick={() => ref.current?.focus()}
              title="点击继续编辑"
            >
              <div className="flex items-center gap-1 text-[9px] text-indigo-400 mb-1">
                <FunctionSquare size={10} />公式渲染（点击可继续编辑）
              </div>
              <div className="text-[12px] text-gray-800 max-h-40 overflow-y-auto">
                <RichText text={value} />
              </div>
            </div>
          )}
          {attachments.length > 0 && !focused && (
            <div className="flex flex-wrap gap-1.5 px-3 py-1.5 border-t border-gray-200">
              {attachments.map((a, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 border border-gray-300 flex items-center gap-1"><Paperclip size={10} />{a.name}</span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
