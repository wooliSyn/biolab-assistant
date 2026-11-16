// ==================== 实验卡片：带入物品清单 + 实验后闭环（笔记 / 完善 protocol / 后续提醒） ====================
// 只用在实验面板的实验卡片里；迷你小窗不放这些（owner 意见：小窗只管计时）。
// 数据都挂在 session 上随 sessions 一起本地保存：
//   materials（每行一项）+ matChecked { 物品名: true } · review（笔记 / 总结）· followups [{ id, at, text, fired, done }]
import { useContext, useState } from "react";
import { Package, NotebookPen, FileEdit, BellPlus, Check, X, Plus, Bell } from "lucide-react";
import { SessionActions, splitLines, quickTimes } from "../lib/sessionActions";
import { genId, dateStr, timeStr } from "../lib/core";

const pad = (n) => String(n).padStart(2, "0");
const toLocalInput = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export default function SessionFollowup({ s, now, isDone }) {
  const act = useContext(SessionActions);
  const [panel, setPanel] = useState(null); // "mat" | "note" | "remind" | null
  if (!act) return null;
  const up = (patch) => act.updateSession(s.id, patch);
  const items = splitLines(s.materials);
  const checked = s.matChecked || {};
  const matDone = items.filter((m) => checked[m]).length;
  const fus = s.followups || [];
  const pending = fus.filter((f) => !f.done);
  const due = pending.filter((f) => f.at <= now).length;
  const toggle = (k) => setPanel((p) => (p === k ? null : k));

  const chip = (k, Icon, label, tone) => (
    <button onClick={() => toggle(k)} data-no-drag
      className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg border transition ${panel === k ? "border-indigo-300 bg-indigo-50 text-indigo-700" : tone || "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
      <Icon size={12} />{label}
    </button>
  );

  return (
    <div className="px-4 pb-3" data-no-drag>
      <div className="flex items-center gap-1.5 flex-wrap">
        {chip("mat", Package, items.length ? `物品 ${matDone}/${items.length}` : "带入物品",
          items.length && matDone === items.length ? "border-emerald-200 bg-emerald-50 text-emerald-700" : undefined)}
        {chip("note", NotebookPen, s.review ? "笔记 · 总结 ✓" : isDone ? "记笔记 / 总结" : "记笔记",
          s.review ? "border-sky-200 bg-sky-50 text-sky-700" : undefined)}
        <button onClick={() => act.refineProtocol(s)} data-no-drag
          title={s.templateId ? "把这次实际用的步骤 / 时长 / 物品和笔记带回方案库，确认后保存" : "这次实验不是从方案库启动的：另存为新方案"}
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          <FileEdit size={12} />完善 protocol
        </button>
        {chip("remind", BellPlus, pending.length ? `提醒 ${pending.length}${due ? ` · ${due} 到期` : ""}` : "后续提醒",
          due ? "border-amber-300 bg-amber-50 text-amber-700" : pending.length ? "border-violet-200 bg-violet-50 text-violet-700" : undefined)}
      </div>

      {panel === "mat" && <MaterialsPanel items={items} checked={checked} materials={s.materials} up={up} sideHidden={!!s.matHidden && !isDone} />}
      {panel === "note" && <NotePanel value={s.review || ""} isDone={isDone} onSave={(review) => up({ review: review.trim() || undefined })} />}
      {panel === "remind" && <RemindPanel fus={fus} now={now} up={up} />}
    </div>
  );
}

// ---------- 带入物品：开实验前逐项核对，勾选状态随实验保存 ----------
function MaterialsPanel({ items, checked, up, sideHidden }) {
  const [add, setAdd] = useState("");
  const setChecked = (m, v) => up({ matChecked: { ...checked, [m]: v } });
  const addItem = () => {
    const names = splitLines(add.replace(/[,，、;；]/g, "\n")).filter((n) => !items.includes(n));
    if (!names.length) return;
    up({ materials: [...items, ...names].join("\n") });
    setAdd("");
  };
  const remove = (m) => {
    const { [m]: _drop, ...rest } = checked;
    up({ materials: items.filter((x) => x !== m).join("\n"), matChecked: rest });
  };
  const all = items.length > 0 && items.every((m) => checked[m]);
  return (
    <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50/60 p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10.5px] font-semibold text-gray-500">带入物品清单 · 出发前逐项核对
          {sideHidden && <button onClick={() => up({ matHidden: false })} className="ml-2 font-normal text-indigo-500 hover:underline">重新显示到侧边栏</button>}
        </span>
        {items.length > 0 && (
          <button onClick={() => up({ matChecked: all ? {} : Object.fromEntries(items.map((m) => [m, true])) })} className="text-[10.5px] text-indigo-500 hover:underline">
            {all ? "全部取消" : "全部勾选"}
          </button>
        )}
      </div>
      {items.length === 0 && <div className="text-[10.5px] text-gray-400 mb-1.5">还没有物品。可以在下面逐个添加，或在方案库里给方案写好物料清单，以后每次启动自动带上。</div>}
      <div className="space-y-1">
        {items.map((m) => (
          <label key={m} className={`group flex items-center gap-2 rounded-md border px-2 py-1 cursor-pointer transition ${checked[m] ? "border-emerald-200 bg-emerald-50/70" : "border-gray-100 bg-white"}`}>
            <input type="checkbox" checked={!!checked[m]} onChange={(e) => setChecked(m, e.target.checked)} className="accent-emerald-500" />
            <span className={`flex-1 text-[11.5px] ${checked[m] ? "line-through text-gray-400" : "text-gray-700"}`}>{m}</span>
            <button onClick={(e) => { e.preventDefault(); remove(m); }} className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100" title="移出清单"><X size={11} /></button>
          </label>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        <input value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
          placeholder="添加物品（可用逗号一次加多个）" className="flex-1 px-2 py-1 text-[11px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-200" />
        <button onClick={addItem} disabled={!add.trim()} className="px-2 py-1 text-[11px] rounded-md bg-indigo-600 text-white disabled:opacity-40 flex items-center gap-0.5"><Plus size={11} />添加</button>
      </div>
    </div>
  );
}

// ---------- 笔记 / 总结：失焦即保存 ----------
function NotePanel({ value, isDone, onSave }) {
  const [t, setT] = useState(value);
  const dirty = t !== value;
  return (
    <div className="mt-2">
      <textarea autoFocus value={t} onChange={(e) => setT(e.target.value)} onBlur={() => { if (dirty) onSave(t); }} rows={4}
        placeholder={isDone ? "结果如何？遇到了什么问题？下次要改进什么？\n（写完点「完善 protocol」可以一起带回方案库）" : "实验过程中的观察、异常、临时调整…"}
        className="w-full px-2.5 py-2 text-[11.5px] leading-relaxed border border-gray-200 rounded-lg bg-white resize-y focus:outline-none focus:ring-2 focus:ring-indigo-200" />
      <div className="flex items-center justify-end gap-2 text-[10px] text-gray-400">
        {dirty ? <button onClick={() => onSave(t)} className="px-2 py-0.5 rounded bg-indigo-600 text-white">保存</button> : value ? <span>已保存</span> : null}
      </div>
    </div>
  );
}

// ---------- 后续提醒：到点发系统通知（App 的时钟循环里检查） ----------
function RemindPanel({ fus, now, up }) {
  const [text, setText] = useState("");
  const [at, setAt] = useState(() => quickTimes(now)[2][1]);
  const add = () => {
    if (!text.trim()) return;
    up({ followups: [...fus, { id: genId(), at, text: text.trim(), fired: false, done: false }].sort((a, b) => a.at - b.at) });
    setText("");
  };
  const patch = (id, p) => up({ followups: fus.map((f) => (f.id === id ? { ...f, ...p } : f)) });
  return (
    <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50/60 p-2">
      {fus.length > 0 && (
        <div className="space-y-1 mb-2">
          {fus.map((f) => {
            const overdue = !f.done && f.at <= now;
            return (
              <div key={f.id} className={`flex items-center gap-2 rounded-md border px-2 py-1 ${f.done ? "border-gray-100 bg-white opacity-60" : overdue ? "border-amber-300 bg-amber-50" : "border-violet-100 bg-white"}`}>
                <Bell size={11} className={overdue ? "text-amber-500" : "text-violet-400"} />
                <span className={`flex-1 text-[11.5px] ${f.done ? "line-through text-gray-400" : "text-gray-700"}`}>{f.text}</span>
                <span className="text-[10px] tabular-nums text-gray-400">{dateStr(f.at)} {timeStr(f.at)}</span>
                {!f.done && <button onClick={() => patch(f.id, { done: true })} className="p-0.5 text-gray-300 hover:text-emerald-600" title="标记已处理"><Check size={12} /></button>}
                <button onClick={() => up({ followups: fus.filter((x) => x.id !== f.id) })} className="p-0.5 text-gray-300 hover:text-red-500" title="删除提醒"><X size={11} /></button>
              </div>
            );
          })}
        </div>
      )}
      <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        placeholder="提醒做什么？如：挑单菌落摇菌 / 送测序 / 查看测序结果"
        className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-200" />
      <div className="flex items-center gap-1 flex-wrap mt-1.5">
        {quickTimes(now).map(([l, ts]) => (
          <button key={l} onClick={() => setAt(ts)} className={`px-1.5 py-0.5 text-[10.5px] rounded border ${Math.abs(at - ts) < 60000 ? "border-violet-400 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-500 bg-white hover:border-violet-200"}`}>{l}</button>
        ))}
        <input type="datetime-local" value={toLocalInput(at)} onChange={(e) => { const v = new Date(e.target.value).getTime(); if (v) setAt(v); }}
          className="px-1.5 py-0.5 text-[10.5px] border border-gray-200 rounded bg-white focus:outline-none" />
        <button onClick={add} disabled={!text.trim()} className="ml-auto px-2 py-1 text-[11px] rounded-md bg-violet-600 text-white disabled:opacity-40 flex items-center gap-0.5"><Plus size={11} />添加提醒</button>
      </div>
      <div className="text-[10px] text-gray-400 mt-1">到点会发系统通知并在应用内弹横幅；托管与否都会提醒。</div>
    </div>
  );
}
