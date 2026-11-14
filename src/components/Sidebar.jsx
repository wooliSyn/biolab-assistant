// ==================== 右侧栏：日历 + 便条/随笔（可拖拽排序） ====================
import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, StickyNote, Plus, Trash2, X, Pencil, Star } from "lucide-react";
import { pad, dateStr, colorOf, timeStr, toast } from "../lib/core";
import { FlipGrid } from "../lib/useFlip";
import { useLongPressDrag, arrayReorder } from "../lib/useLongPressDrag";
import RichText from "../lib/Latex";
import HelpTip from "./HelpTip";
import Attendance, { DayPunchDialog } from "./Attendance";

const WK = ["日", "一", "二", "三", "四", "五", "六"];

export default function Sidebar({ calMonth, setCalMonth, selectedDate, setSelectedDate, sessions, notes, setNotes, calExpanded, setCalExpanded, now, onJumpDate, onOpenDetail, attendance, setAttendance, theme }) {
  const { y, m } = calMonth;
  const days = new Date(y, m + 1, 0).getDate();
  const first = new Date(y, m, 1).getDay();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  const today = dateStr(now);

  const [draft, setDraft] = useState("");
  const [hovered, setHovered] = useState(null);
  const [punchDate, setPunchDate] = useState(null); // 点4：日历长按 → 打卡/补签弹窗
  // 便条内容编辑（点3：点击文本或铅笔图标进入编辑）
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const startEdit = (n) => { setEditId(n.id); setEditText(n.text); };
  const commitEdit = () => {
    if (editId == null) return;
    const t = editText.trim();
    if (t) setNotes((p) => p.map((x) => (x.id === editId ? { ...x, text: t } : x)));
    setEditId(null); setEditText("");
  };

  // 点2：便条长按磁贴拖拽排序（与上下箭头互补）
  const reorderNotes = (fromId, toId, pos) => setNotes((p) => arrayReorder(p, fromId, toId, pos));
  const { dragId: noteDragId, onPointerDown: notePointerDown } = useLongPressDrag(reorderNotes, { axis: "y" });

  // 点4：日历日期长按 500ms → 当日打卡 / 往日补签
  const pressTimer = useRef(null);
  const skipClick = useRef(false);
  const dayPressStart = (ds) => (e) => {
    if (e.button != null && e.button !== 0) return;
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null; skipClick.current = true;
      if (ds > today) { toast("未来日期不能打卡", "info"); return; }
      if (attendance.firstDay && ds < attendance.firstDay) { toast(`补签不能早于首次使用日期（${attendance.firstDay}）`, "info"); return; }
      setPunchDate(ds);
    }, 500);
  };
  const dayPressEnd = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };
  const dayClick = (ds) => () => { if (skipClick.current) { skipClick.current = false; return; } onJumpDate(ds); };

  // 点4：漏签日检测（今日之前、有实验记录、考勤不完整）→ 侧栏提示补签
  const missedDays = (() => {
    const out = [];
    if (!attendance.firstDay) return out;
    const cur = new Date(`${today}T12:00:00`);
    for (let d = new Date(`${attendance.firstDay}T12:00:00`); d < cur; d.setDate(d.getDate() + 1)) {
      const ds = dateStr(d.getTime());
      const r = attendance.records[ds];
      if (r && r.in && r.out) continue;
      if (!sessions.some((s) => dateStr(s.startedAt) === ds)) continue; // 只提示有实验的漏签日
      out.push(ds);
    }
    return out;
  })();

  const daySessions = sessions.filter((s) => {
    const sd = dateStr(s.startedAt);
    if (sd === selectedDate) return true;
    if (s.status === "running") {
      const end = s.completedAt || (s.startedAt + s.steps.reduce((a, st) => a + (st.durationMin || 0), 0) * 60000);
      return s.startedAt <= new Date(`${selectedDate}T23:59:59`).getTime() && end >= new Date(`${selectedDate}T00:00:00`).getTime();
    }
    return false;
  });

  const addNote = () => {
    if (!draft.trim()) return;
    setNotes((p) => [...p, { id: Math.random().toString(36).slice(2, 9), text: draft.trim(), createdAt: Date.now() }]);
    setDraft("");
  };

  return (
    <div className={`${calExpanded ? "w-[340px]" : "w-[280px]"} flex-shrink-0 bg-white/80 border-l-2 border-[var(--px-ink)] flex flex-col transition-all overflow-hidden`}>
      {/* 打卡 */}
      <Attendance attendance={attendance} setAttendance={setAttendance} now={now} sessions={sessions} />
      {/* 日历头 */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={() => setCalMonth((p) => (p.m === 0 ? { y: p.y - 1, m: 11 } : { ...p, m: p.m - 1 }))} className="p-1 rounded hover:bg-gray-100 text-gray-400"><ChevronLeft size={14} /></button>
          <span className="text-xs font-semibold text-gray-700 w-20 text-center">{y}年{m + 1}月</span>
          <button onClick={() => setCalMonth((p) => (p.m === 11 ? { y: p.y + 1, m: 0 } : { ...p, m: p.m + 1 }))} className="p-1 rounded hover:bg-gray-100 text-gray-400"><ChevronRight size={14} /></button>
        </div>
      </div>

      {/* 日历网格 */}
      <div className="px-3 py-2 flex-shrink-0">
        <div className="grid grid-cols-7 gap-0.5 mb-1">{WK.map((w) => <div key={w} className="text-center text-[9px] text-gray-300 py-0.5">{w}</div>)}</div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
            const has = sessions.some((s) => dateStr(s.startedAt) === ds);
            const isToday = ds === today;
            const isSel = ds === selectedDate;
            const att = attendance.records[ds];
            const isMakeup = att && (att.makeupIn || att.makeupOut); // 点5：补签日
            // 点3：选中框整体颜色随打卡状态变化 + 颜色刷新动画
            const selCls = !att ? "bg-indigo-500 text-white shadow"
              : isMakeup ? "bg-orange-500 text-white shadow"
              : att.in && att.out ? "bg-emerald-500 text-white shadow"
              : "bg-amber-500 text-white shadow";
            const selKey = !att ? "n" : isMakeup ? "m" : att.in && att.out ? "f" : "p";
            return (
              <button key={isSel ? `${ds}-sel-${selKey}` : ds} onClick={dayClick(ds)}
                onMouseDown={dayPressStart(ds)} onMouseUp={dayPressEnd} onMouseLeave={dayPressEnd}
                onTouchStart={dayPressStart(ds)} onTouchEnd={dayPressEnd}
                title="点击选中；长按 0.5s 打卡 / 补签"
                className={`relative aspect-square rounded-md text-[11px] flex items-center justify-center transition-all hover:scale-110 ${isSel ? `${selCls} day-flash` : att ? "bg-slate-700 text-white" : isToday ? "bg-indigo-50 text-indigo-600 font-medium" : "text-gray-600 hover:bg-gray-100"}`}>
                {d}
                {att && isMakeup ? (
                  <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isSel ? "bg-orange-300" : "bg-orange-400"}`} />
                ) : att && (
                  <span className="absolute bottom-0.5 flex gap-0.5">
                    {att.in && <span className={`w-1 h-1 rounded-full ${isSel ? "bg-emerald-400" : "bg-emerald-300"}`} />}
                    {att.out && <span className={`w-1 h-1 rounded-full ${isSel ? "bg-amber-400" : "bg-amber-300"}`} />}
                  </span>
                )}
                {!att && has && <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isSel ? "bg-white" : "bg-indigo-400"}`} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 点4：漏签提示（今日之前有实验但未打卡）→ 点击补签 */}
      {missedDays.length > 0 && (
        <button onClick={() => setPunchDate(missedDays[missedDays.length - 1])}
          className="mx-3 mt-2 mb-0.5 w-auto flex items-center gap-1.5 rounded-lg bg-orange-50 border border-orange-200 px-2.5 py-1.5 text-[10px] text-orange-600 hover:bg-orange-100 transition text-left flex-shrink-0"
          title="点击为最近一个漏签日补签">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
          漏签 <b className="tabular-nums">{missedDays.length}</b> 天（有实验记录）· 点击补签
        </button>
      )}

      <div className="flex-1 overflow-y-auto px-3 pb-3 border-t border-gray-100">
        {/* 当日实验概要 */}
        <div className="text-[11px] font-semibold text-gray-500 py-2 flex items-center justify-between">
          <span className="flex items-center gap-1">{selectedDate} 实验<HelpTip text="点击卡片查看每个步骤的起止时间与完成情况" /></span>
          <span className="text-gray-300">{daySessions.length}</span>
        </div>
        <div className="space-y-1.5">
          {daySessions.length === 0 && <div className="text-[11px] text-gray-300 text-center py-3">当日无实验</div>}
          {daySessions.map((s) => {
            const c = colorOf(s);
            const done = s.steps.filter((st) => st.status === "done").length;
            const hot = hovered === s.id;
            return (
              <div key={s.id} onClick={() => onOpenDetail && onOpenDetail(s.id)}
                onMouseEnter={() => setHovered(s.id)} onMouseLeave={() => setHovered(null)}
                title="点击查看步骤详情"
                className={`rounded-lg border px-2.5 py-2 transition-all duration-200 cursor-pointer ${s.star ? "border-amber-300 bg-amber-50/60" : hot ? "shadow-md" : `${c.border} ${c.soft}`}`}
                style={hot ? { backgroundColor: c.hex, borderColor: c.hex } : {}}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hot ? "bg-white" : c.bar}`} />
                  {s.star && <Star size={11} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
                  <span className={`text-xs font-medium truncate ${hot ? "text-white" : "text-gray-700"}`}>{s.name}</span>
                  <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${hot ? "bg-white/25 text-white" : s.status === "running" ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"}`}>
                    {s.status === "running" ? "进行中" : "已完成"}
                  </span>
                </div>
                <div className={`flex items-center gap-2 mt-1 text-[10px] ${hot ? "text-white/80" : "text-gray-500"}`}>
                  <span className="tabular-nums">{timeStr(s.startedAt)} 开始</span><span>·</span><span>{done}/{s.steps.length} 步</span>
                  {s.hosting && <span className={hot ? "text-white/90" : "text-amber-600"}>·托管</span>}
                </div>
                <div className={`h-1 rounded-full mt-1.5 overflow-hidden ${hot ? "bg-white/30" : "bg-white/60"}`}><div className={`h-full ${hot ? "bg-white" : c.bar}`} style={{ width: `${(done / s.steps.length) * 100}%` }} /></div>
              </div>
            );
          })}
        </div>

        {/* 便条 / 随笔（可拖拽排序） */}
        <div className="mt-3">
          <div className="text-[11px] font-semibold text-gray-500 mb-1.5 flex items-center gap-1"><StickyNote size={11} />便条 · 随笔 <HelpTip text="输入后回车成块；点击便条文字或铅笔图标可修改；左侧上下箭头调整顺序；支持 LaTeX 公式" /></div>
          <div className="flex gap-1.5 mb-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()}
              placeholder="写一条便条，回车成块…" className="flex-1 text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 bg-white/80" />
            <button onClick={addNote} className="px-2 rounded-lg bg-amber-400 text-white hover:bg-amber-500 transition"><Plus size={13} /></button>
          </div>
          <FlipGrid orderKey={notes.map((n) => n.id).join(",")} className="space-y-1.5">
            {notes.map((n, i) => {
              const rhine = theme === "rhine";
              return (
              <div key={n.id} data-flip-key={n.id} data-drag-id={n.id}
                onPointerDown={(e) => notePointerDown(e, n.id)}
                className={`group relative rounded-lg border px-2 py-1.5 transition-all hover:shadow-sm ${rhine ? "border-amber-300/60" : "bg-amber-50/70 border-amber-100"} ${noteDragId === n.id ? "lpd-dragging" : ""}`}
                style={rhine ? { background: "transparent", fontFamily: 'Georgia, "Times New Roman", SimSun, "宋体", serif' } : undefined}>
                <div className="flex items-start gap-1.5">
                  <div className="flex flex-col gap-0.5 flex-shrink-0 mt-0.5">
                    <button onClick={() => { if (i > 0) setNotes((p) => { const a = [...p]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; }); }}
                      disabled={i === 0} className="p-0.5 text-amber-400 hover:text-amber-600 disabled:opacity-20 disabled:cursor-default" title="上移"><ChevronUp size={11} /></button>
                    <button onClick={() => { if (i < notes.length - 1) setNotes((p) => { const a = [...p]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; }); }}
                      disabled={i === notes.length - 1} className="p-0.5 text-amber-400 hover:text-amber-600 disabled:opacity-20 disabled:cursor-default" title="下移"><ChevronDown size={11} /></button>
                  </div>
                  {editId === n.id ? (
                    <div className="flex-1">
                      <textarea value={editText} onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commitEdit(); else if (e.key === "Escape") { setEditId(null); setEditText(""); } }}
                        autoFocus rows={3}
                        className={`w-full text-[11px] px-1.5 py-1 border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-amber-200 ${rhine ? "bg-white/90 text-gray-800 border-amber-300" : "bg-white border-amber-200 text-gray-700"}`}
                        style={rhine ? { fontFamily: 'Georgia, "Times New Roman", SimSun, "宋体", serif' } : undefined} />
                      <div className="flex gap-1 mt-1">
                        <button onClick={commitEdit} className="px-1.5 py-0.5 text-[10px] bg-amber-400 text-white rounded hover:bg-amber-500">保存</button>
                        <button onClick={() => { setEditId(null); setEditText(""); }} className="px-1.5 py-0.5 text-[10px] border border-gray-200 text-gray-500 rounded hover:bg-gray-50">取消</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div onClick={() => startEdit(n)} title="点击编辑便条"
                        className="flex-1 cursor-text"><RichText text={n.text} className={`text-[11px] break-words ${rhine ? "text-amber-50" : "text-gray-700"}`} /></div>
                      <button onClick={() => startEdit(n)} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-amber-500 transition" title="编辑"><Pencil size={11} /></button>
                      <button onClick={() => setNotes((p) => p.filter((x) => x.id !== n.id))} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition"><X size={11} /></button>
                    </>
                  )}
                </div>
              </div>
              );
            })}
            {notes.length === 0 && <div className="text-[10px] text-gray-300 text-center py-2">还没有便条</div>}
          </FlipGrid>
        </div>
      </div>

      {/* 点4：日历长按 → 当日打卡 / 往日补签弹窗 */}
      {punchDate && <DayPunchDialog date={punchDate} now={now} attendance={attendance} setAttendance={setAttendance} onClose={() => setPunchDate(null)} />}
    </div>
  );
}
