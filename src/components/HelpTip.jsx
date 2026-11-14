// ==================== 小问号操作提示 ====================
import { useState } from "react";
import { HelpCircle } from "lucide-react";

export default function HelpTip({ text, className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-0.5 rounded-full text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition"
        title="操作说明"
      >
        <HelpCircle size={13} />
      </button>
      {open && (
        <span className="absolute z-50 top-full mt-1.5 left-1/2 -translate-x-1/2 w-52 px-2.5 py-2 bg-gray-900 text-white text-[10px] leading-relaxed border-2 border-[var(--px-ink)] shadow-lg pointer-events-none">
          {text}
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-gray-900 rotate-45 border-l-2 border-t-2 border-[var(--px-ink)]" />
        </span>
      )}
    </span>
  );
}
