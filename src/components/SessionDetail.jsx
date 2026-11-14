// ==================== 实验详情弹窗（每步起止 / 完成状态 / 关联数据） ====================
import { invoke } from "@tauri-apps/api/core";
import {
  X, CheckCircle2, Play, SkipForward, Circle, MapPin, Layers, Hourglass, Clock, Paperclip, Database,
} from "lucide-react";
import { computeSteps, colorOf, timeStr, dateStr, dayStart, fmtDur } from "../lib/core";

const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function SessionDetail({ session, now, onClose, datasets = [] }) {
  if (!session) return null;
  const c = colorOf(session);
  const steps = computeSteps(session, now);
  const done = steps.filter((st) => st.status === "done").length;
  const startDay = dayStart(session.startedAt);
  const linked = datasets.filter((d) => d.sessionId === session.id);

  const statusMeta = (st) =>
    st.status === "done" ? { icon: <CheckCircle2 size={14} className="text-green-500" />, label: "已完成", cls: "text-green-600 bg-green-50" }
    : st.status === "active" ? { icon: <Play size={14} className={c.text} />, label: "进行中", cls: `${c.text} ${c.soft}` }
    : st.status === "skipped" ? { icon: <SkipForward size={14} className="text-gray-400" />, label: "已跳过", cls: "text-gray-400 bg-gray-50" }
    : { icon: <Circle size={14} className="text-gray-300" />, label: "待开始", cls: "text-gray-400 bg-gray-50" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="pixel-panel shadow-2xl w-full max-w-md p-5 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full ${c.bar} flex-shrink-0`} />
            <h3 className="text-sm font-bold text-gray-800 truncate">{session.name}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-3 flex-shrink-0">
          <span className="tabular-nums">{dateStr(session.startedAt)} {timeStr(session.startedAt)} 开始</span>
          <span>·</span>
          <span>{done}/{steps.length} 步完成</span>
          {session.hosting && <span className="text-amber-600">·托管中</span>}
        </div>
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-3 flex-shrink-0">
          <div className={`h-full ${c.bar}`} style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          <div className="space-y-1.5">
            {steps.map((st, i) => {
              const meta = statusMeta(st);
              // 跨天标注
              let dayTag = "";
              if (st.start) {
                const off = Math.round((dayStart(st.start) - startDay) / 86400000);
                if (off > 0) dayTag = ` +${off}天`;
              }
              return (
                <div key={st.id} className={`flex items-start gap-2.5 px-2.5 py-2 rounded-xl border transition ${st.status === "active" ? `${c.border} ${c.soft}` : "border-gray-100 hover:border-gray-200"}`}>
                  <span className="mt-0.5 flex-shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-medium truncate ${st.status === "done" ? "text-gray-400 line-through" : "text-gray-700"}`}>{i + 1}. {st.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] text-gray-400">
                      <span className="flex items-center gap-0.5 tabular-nums">
                        <Clock size={10} />
                        {st.start ? `${timeStr(st.start)}${st.end ? " → " + timeStr(st.end) : " → …"}${dayTag}` : "未开始"}
                      </span>
                      <span>{fmtDur(st.durationMin)}</span>
                      {st.location && <span className="flex items-center gap-0.5"><MapPin size={10} />{st.location}</span>}
                      {st.params && <span className="flex items-center gap-0.5 text-indigo-400"><Layers size={10} />{st.params}</span>}
                      {st.isWait && <span className="flex items-center gap-0.5 text-amber-500"><Hourglass size={10} />等待</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {session.notes && (
            <div className="mt-3 text-[11px] text-gray-500 bg-gray-50 rounded-xl px-3 py-2">备注：{session.notes}</div>
          )}
          {linked.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] font-semibold text-gray-400 flex items-center gap-1 mb-1.5"><Database size={11} />关联原始数据（{linked.length}）</div>
              <div className="space-y-1.5">
                {linked.map((d) => (
                  <div key={d.id} className="border border-gray-100 rounded-xl px-2.5 py-2">
                    <div className="text-[11px] font-medium text-gray-700">{d.name}<span className="text-gray-300 font-normal ml-1.5">{d.date}</span></div>
                    {(d.files || []).length > 0 && (
                      <div className="space-y-0.5 mt-1">
                        {d.files.map((f) => (
                          <button key={f.id} onClick={() => f.path && invoke("open_file", { path: f.path }).catch(() => {})} disabled={!f.path}
                            className="flex items-center gap-1.5 text-[10px] text-indigo-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                            title={f.path ? "点击用系统查看器打开" : "文件过大未存储"}>
                            <Paperclip size={10} />{f.name}<span className="text-gray-300">{fmtSize(f.size)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
