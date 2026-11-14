// ==================== 实验卡片（简略 + 展开详情） ====================
import { useState } from "react";
import {
  ChevronUp, ChevronDown, Trash2, MapPin, Layers, Hourglass, Timer,
  Check, SkipForward, Play, Circle, CheckCircle2, ArrowRight, Eye, Star,
} from "lucide-react";
import { computeSteps, colorOf, timeStr, dateStr, fmtCountdown, fmtDur, SESSION_COLORS } from "../lib/core";

export default function SessionCard({ s, now, confirmStep, skipStep, toggleHosting, adjustActive, deleteSession, setSessionColor, toggleStar, reorderSessions, expanded, toggle, onOpenDetail, onMoveUp, onMoveDown }) {
  const c = colorOf(s);
  const isDone = s.status !== "running"; // 点11：已完成实验仅可删除，隐藏操作按钮
  const [colorOpen, setColorOpen] = useState(false);
  const steps = computeSteps(s, now);
  const cur = steps[s.currentStepIndex];
  const next = steps[s.currentStepIndex + 1];
  const remaining = cur && cur.status === "active" && cur.durationMin > 0 ? cur.startedAt + cur.durationMin * 60000 - now : null;
  const progress = (steps.filter((st) => st.status === "done" || st.status === "skipped").length / steps.length) * 100;
  const overdue = remaining != null && remaining <= 0;
  // 实验起止点
  const lastEnd = [...steps].reverse().find((st) => st.end != null)?.end;

  return (
    <div className={`relative bg-white border-2 ${c.border} shadow-sm rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${s.star ? "rhine-pin" : ""}`}>
      {/* 简略头部 */}
      <div className={`px-4 py-2.5 ${c.soft} flex items-center justify-between`}>
        <div className="flex items-center gap-2 min-w-0">
          {reorderSessions && (
            <span className="flex flex-col gap-0 flex-shrink-0">
              <button onClick={onMoveUp} className="p-0.5 text-gray-300 hover:text-indigo-500 disabled:opacity-20" title="上移"><ChevronUp size={11} /></button>
              <button onClick={onMoveDown} className="p-0.5 text-gray-300 hover:text-indigo-500 disabled:opacity-20" title="下移"><ChevronDown size={11} /></button>
            </span>
          )}
          <span className={`w-2 h-2 rounded-full ${c.bar} flex-shrink-0`} />
          {s.star && <Star size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
          <span className="text-sm font-semibold text-gray-800 truncate">{s.name}</span>
          {s.hosting && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0" title="托管中：仅不再弹出到点系统提醒，计时与记录不受影响">托管中</span>}
          {s.expectedDays > 1 ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">{s.expectedDays}天</span>
            : s.overnight ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex-shrink-0" title="该实验跨过午夜（熬夜跨天）">跨天</span> : null}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-gray-400 mr-1 tabular-nums">
            {dateStr(s.startedAt)} {timeStr(s.startedAt)} → {lastEnd ? timeStr(lastEnd) : "—"}
          </span>
          {/* 自定义颜色（已完成实验隐藏） */}
          {!isDone && <div className="relative">
            <button onClick={() => setColorOpen((v) => !v)} className="p-1 rounded hover:bg-white/70 transition" title="自定义颜色">
              <span className="block w-3 h-3 border-2 border-white outline outline-1 outline-black/20" style={{ background: c.hex }} />
            </button>
            {colorOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setColorOpen(false)} />
                <div className="absolute right-0 top-7 z-50 bg-white border-2 border-[var(--px-ink)] shadow-lg p-1.5 flex gap-1">
                  {SESSION_COLORS.map((pc) => (
                    <button key={pc.hex}
                      onClick={() => { setSessionColor && setSessionColor(s.id, pc.hex); setColorOpen(false); }}
                      className={`w-5 h-5 border-2 hover:scale-110 transition ${pc.hex === c.hex ? "border-gray-800" : "border-transparent"}`}
                      style={{ background: pc.hex }} title={pc.hex} />
                  ))}
                </div>
              </>
            )}
          </div>}
          {/* 重点标记（所有实验均可标星/取消） */}
          {toggleStar && (
            <button onClick={() => toggleStar(s.id)} className={`p-1 rounded hover:bg-white/70 transition ${s.star ? "text-amber-500" : "text-gray-300 hover:text-amber-400"}`} title={s.star ? "取消重点标记" : "重点标记"}>
              <Star size={13} className={s.star ? "fill-amber-400" : ""} />
            </button>
          )}
          {onOpenDetail && (
            <button onClick={() => onOpenDetail(s.id)} className="p-1 rounded hover:bg-white/70 text-gray-400 hover:text-indigo-600 transition" title="查看每步起止与完成情况">
              <Eye size={13} />
            </button>
          )}
          <button onClick={toggle} className="p-1 rounded hover:bg-white/70 text-gray-400 transition-transform" title={expanded ? "收起" : "展开细节"}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={() => deleteSession(s.id)} className="p-1 rounded hover:bg-white/70 text-gray-300 hover:text-red-400"><Trash2 size={13} /></button>
        </div>
      </div>

      <div className="h-1 bg-gray-100"><div className={`h-full ${c.bar} transition-all`} style={{ width: `${progress}%` }} /></div>

      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-gray-400">当前步骤 {s.currentStepIndex + 1}/{s.steps.length}</div>
            <div className="text-sm font-medium text-gray-800 mt-0.5">{cur?.name}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-gray-500">
              {cur?.location && <span className="flex items-center gap-0.5"><MapPin size={11} />{cur.location}</span>}
              {cur?.params && <span className="flex items-center gap-0.5 text-indigo-500"><Layers size={11} />{cur.params}</span>}
              {cur?.isWait && <span className="flex items-center gap-0.5 text-amber-500"><Hourglass size={11} />孵育/等待</span>}
            </div>
            {cur?.notes && <div className="text-[11px] text-gray-400 mt-1">{cur.notes}</div>}
          </div>
          <div className="text-right flex-shrink-0">
            {remaining != null ? (
              <>
                <div className={`text-3xl font-bold tabular-nums ${overdue ? "text-red-500 animate-pulse" : c.text}`}>{fmtCountdown(remaining)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{overdue ? "已到时，请确认" : `共 ${fmtDur(cur.durationMin)}`}</div>
              </>
            ) : isDone ? (
              <div className="text-sm font-medium text-green-500 flex items-center gap-1 justify-end"><CheckCircle2 size={14} />已完成</div>
            ) : (
              <div className="text-sm font-medium text-gray-400 flex items-center gap-1 justify-end"><Hourglass size={14} />等待确认</div>
            )}
          </div>
        </div>

        {!isDone && <div className="flex items-center justify-end flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-50">
          {cur?.durationMin > 0 && (
            <div className="flex items-center gap-0.5 bg-gray-50 rounded-lg px-1 mr-auto">
              <button onClick={() => adjustActive(s.id, -5)} className="px-1.5 py-1 text-xs text-gray-500 hover:text-gray-800">−5</button>
              <Timer size={11} className="text-gray-300" />
              <button onClick={() => adjustActive(s.id, 5)} className="px-1.5 py-1 text-xs text-gray-500 hover:text-gray-800">+5</button>
            </div>
          )}
          <button onClick={() => toggleHosting(s.id)} title="托管：仅不再弹出到点系统提醒（计时、记录均不受影响）；适合离开工位长时间孵育时" className={`px-2.5 py-1.5 text-xs rounded-lg border transition ${s.hosting ? "bg-amber-50 border-amber-200 text-amber-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
            {s.hosting ? "取消托管" : "托管"}
          </button>
          <button onClick={() => skipStep(s.id)} className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center gap-1">
            <SkipForward size={12} />跳过
          </button>
          <button onClick={() => confirmStep(s.id)} className={`px-3 py-1.5 ${c.bar} text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-sm hover:brightness-110 transition`}>
            <Check size={14} />{s.currentStepIndex === s.steps.length - 1 ? "完成实验" : "确认，下一步"}
          </button>
        </div>}

        {next && (
          <div className="mt-2 text-[11px] text-gray-400 flex items-center gap-1">
            <ArrowRight size={11} />下一步：{next.name} · {fmtDur(next.durationMin)}{next.location ? ` · ${next.location}` : ""}
          </div>
        )}
      </div>

      {/* 展开：全部步骤 + 记录（平滑动画） */}
      <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: expanded ? "1fr" : "0fr", opacity: expanded ? 1 : 0 }}>
        <div className="overflow-hidden">
        <div className="px-4 pb-3 border-t border-gray-50">
          <div className="text-[10px] font-semibold text-gray-400 py-2">全部步骤与记录</div>
          <div className="space-y-1">
            {steps.map((st) => (
              <div key={st.id} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition ${st.status === "active" ? c.soft : "hover:bg-gray-50"}`}>
                {st.status === "done" ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                  : st.status === "active" ? <Play size={13} className={`${c.text} flex-shrink-0`} />
                  : st.status === "skipped" ? <SkipForward size={13} className="text-gray-300 flex-shrink-0" />
                  : <Circle size={13} className="text-gray-300 flex-shrink-0" />}
                <span className={`flex-1 truncate ${st.status === "done" ? "text-gray-400 line-through" : st.status === "active" ? "text-gray-800 font-medium" : "text-gray-500"}`}>{st.name}</span>
                {st.location && <span className="text-[10px] text-gray-400 flex-shrink-0">{st.location}</span>}
                <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">{st.start ? timeStr(st.start) : ""}{st.end ? "–" + timeStr(st.end) : ""}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0 w-14 text-right">{fmtDur(st.durationMin)}</span>
              </div>
            ))}
          </div>
          {s.notes && <div className="mt-2 text-[11px] text-gray-500 bg-gray-50 rounded-lg px-2.5 py-2">备注：{s.notes}</div>}
        </div>
        </div>
      </div>
    </div>
  );
}
