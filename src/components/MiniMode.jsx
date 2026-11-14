// ==================== Mini 悬浮窗模式（更小巧，无待办勾选） ====================
import { FlaskConical, Maximize2, X, ArrowRight, Hourglass, Sparkles } from "lucide-react";
import { computeSteps, colorOf, fmtCountdown, fmtDur, greeting, dateStr, weekdayOf, timeStrSec } from "../lib/core";

export default function MiniMode({ runningSessions, now, confirmStep, toggleMini, startDrag, closeWindow }) {
  const s = runningSessions[0];
  const steps = s ? computeSteps(s, now) : [];
  const cur = s ? steps[s.currentStepIndex] : null;
  const next = s ? steps[s.currentStepIndex + 1] : null;
  const remaining = cur && cur.status === "active" && cur.durationMin > 0 ? cur.startedAt + cur.durationMin * 60000 - now : null;
  const c = s ? colorOf(s) : colorOf("x");
  const g = greeting(now);

  return (
    <div className={`h-screen flex flex-col ${c.soft} overflow-hidden`}>
      <div onMouseDown={startDrag} className="flex items-center justify-between px-2.5 py-1 bg-white/70 border-b border-black/5 flex-shrink-0">
        <div className="flex items-center gap-1 text-[11px] font-bold text-gray-700"><FlaskConical size={12} className={c.text} />BioLab</div>
        <div className="flex gap-0.5">
          <button onClick={toggleMini} className="p-1 rounded hover:bg-black/5 text-gray-500" title="恢复"><Maximize2 size={11} /></button>
          <button onClick={closeWindow} className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-500"><X size={11} /></button>
        </div>
      </div>
      {!s ? (
        <div className="flex-1 flex flex-col items-center justify-center px-3 text-center">
          <div className="text-2xl font-bold tabular-nums text-gray-700">{timeStrSec(now)}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{dateStr(now)} 周{weekdayOf(now)}</div>
          <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-2"><Sparkles size={11} className="text-amber-400" />{g.icon} {g.text}</div>
          <div className="text-[9px] text-gray-400 mt-2 leading-relaxed">暂无进行中的实验<br />回到主窗口，从方案库开始今天的实验吧</div>
          <button onClick={toggleMini} className="mt-2.5 px-3 py-1 text-[10px] text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 transition">打开主窗口</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col px-2.5 py-1.5 overflow-hidden">
          <div className="text-[10px] text-gray-500 truncate">{s.name}{s.hosting && <span className="ml-1 text-amber-600">·托管中</span>}</div>
          <div className="text-[11px] font-medium text-gray-700 truncate">步骤 {s.currentStepIndex + 1}/{s.steps.length}：{cur?.name}</div>
          <div className="flex-1 flex items-center justify-center">
            {remaining != null ? (
              <div className={`text-3xl font-bold tabular-nums ${remaining <= 0 ? "text-red-500 animate-pulse" : c.text}`}>{fmtCountdown(remaining)}</div>
            ) : (
              <div className="text-sm font-medium text-gray-400 flex items-center gap-1.5"><Hourglass size={14} />等待确认</div>
            )}
          </div>
          <div className="flex items-center justify-between text-[9px] text-gray-400 mb-1">
            <span>下一步</span>
            <span className="truncate ml-2 text-gray-600">{next ? `${next.name} · ${fmtDur(next.durationMin)}` : "最后一步"}</span>
          </div>
          <button onClick={() => confirmStep(s.id)} className={`w-full py-1.5 ${c.bar} text-white text-[11px] font-medium rounded-lg hover:brightness-110 transition`}>
            确认完成，进入下一步 <ArrowRight size={11} className="inline ml-0.5" />
          </button>
        </div>
      )}
    </div>
  );
}
