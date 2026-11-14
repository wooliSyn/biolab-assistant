// ==================== 风格化提示与确认（点6） ====================
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

const TOAST_STYLE = {
  success: { icon: CheckCircle2, cls: "border-emerald-300 bg-emerald-50 text-emerald-700", ic: "text-emerald-500" },
  error: { icon: AlertTriangle, cls: "border-red-300 bg-red-50 text-red-700", ic: "text-red-500" },
  info: { icon: Info, cls: "border-indigo-300 bg-indigo-50 text-indigo-700", ic: "text-indigo-500" },
};

export function ToastStack({ toasts, dismiss }) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[90] space-y-2 w-80 max-w-[90vw]">
      {toasts.map((t) => {
        const s = TOAST_STYLE[t.type] || TOAST_STYLE.info;
        const I = s.icon;
        return (
          <div key={t.id} className={`flex items-start gap-2 px-3.5 py-2.5 rounded-xl border-2 shadow-lg backdrop-blur animate-[fadeIn_.15s_ease] ${s.cls}`}>
            <I size={15} className={`mt-0.5 flex-shrink-0 ${s.ic}`} />
            <span className="flex-1 text-[12px] leading-relaxed">{t.msg}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100"><X size={13} /></button>
          </div>
        );
      })}
    </div>
  );
}

export function ConfirmDialog({ conf, onDone }) {
  if (!conf) return null;
  const { opts, res } = conf;
  const danger = opts.danger !== false;
  const close = (v) => { res(v); onDone(); };
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-gray-900/50 p-4" onClick={() => close(false)}>
      <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center ${danger ? "bg-red-100" : "bg-indigo-100"}`}>
            <AlertTriangle size={16} className={danger ? "text-red-500" : "text-indigo-500"} />
          </span>
          <div className="text-sm font-bold text-gray-800">{opts.title || "请确认"}</div>
        </div>
        {opts.message && <p className="text-[12px] text-gray-500 leading-relaxed mb-4 whitespace-pre-line">{opts.message}</p>}
        <div className="flex gap-2">
          <button onClick={() => close(false)} className="flex-1 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">{opts.cancelText || "取消"}</button>
          <button onClick={() => close(true)}
            className={`flex-1 py-2 text-xs font-medium text-white rounded-lg ${danger ? "bg-red-500 hover:bg-red-600" : "bg-indigo-600 hover:bg-indigo-700"}`}>
            {opts.okText || "确定"}
          </button>
        </div>
      </div>
    </div>
  );
}
