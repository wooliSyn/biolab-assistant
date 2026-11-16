// ==================== 小问号操作提示 ====================
import { useState } from "react";
import { HelpCircle } from "lucide-react";

export default function HelpTip({ text, className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`relative inline-flex ${className}`}>
      {/* 这里刻意不用 <button>：HelpTip 经常被放进可折叠标题这类外层按钮里
          （如「当日备注」的展开按钮），button 套 button 是非法 DOM，React 会报
          validateDOMNesting 并可能导致点击行为异常。用 role=button 的 span 等效且合法。 */}
      <span
        role="button"
        tabIndex={0}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }
          else if (e.key === "Escape") setOpen(false);
        }}
        className="inline-flex p-0.5 rounded-full text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition cursor-pointer"
        title="操作说明"
        aria-label="操作说明"
      >
        <HelpCircle size={13} />
      </span>
      {open && (
        <span className="absolute z-50 top-full mt-1.5 left-1/2 -translate-x-1/2 w-64 px-2.5 py-2 bg-gray-900 text-white text-[10.5px] leading-relaxed whitespace-pre-line border-2 border-[var(--px-ink)] shadow-lg pointer-events-none">
          {text}
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-gray-900 rotate-45 border-l-2 border-t-2 border-[var(--px-ink)]" />
        </span>
      )}
    </span>
  );
}
