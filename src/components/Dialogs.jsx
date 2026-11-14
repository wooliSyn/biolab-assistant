// ==================== 弹窗：模板选择 / 启动实验 / 模板编辑 / 数据管理 / 通用 Modal ====================
import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Plus, Trash2, Play, FileText, ChevronDown, ChevronUp, BookOpen, Moon, Download, Upload, AlertTriangle, Bold, Highlighter, HardDrive, Sparkles, Database } from "lucide-react";
import { genId, pad, fmtDur, dayStart, timeStr, dateStr, toast } from "../lib/core";
import RichText from "../lib/Latex";

export function Modal({ children, onClose, title, wide }) {
  const downOnBackdrop = useRef(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (downOnBackdrop.current && e.target === e.currentTarget) onClose(); downOnBackdrop.current = false; }}>
      <div className={`pixel-panel shadow-2xl ${wide ? "w-full max-w-lg" : "w-full max-w-sm"} p-5 max-h-[90vh] flex flex-col`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ---------- 时长输入（支持秒/分/时单位切换，内部存 durationMin） ----------
function DurInput({ value, onChange, className }) {
  // 自动推断最佳单位
  const unit = value > 0 && value < 1 ? "s" : value >= 60 ? "h" : "m";
  const [u, setU] = useState(unit);
  const factor = u === "s" ? 1 / 60 : u === "h" ? 60 : 1;
  const display = u === "s" ? Math.round(value * 60) : u === "h" ? +(value / 60).toFixed(2) : value;
  return (
    <span className={`inline-flex items-center gap-0.5 ${className || ""}`}>
      <input type="number" min="0" step={u === "s" ? "1" : u === "h" ? "0.1" : "0.1"} value={display}
        onChange={(e) => onChange(Math.max(0, +e.target.value * factor))}
        className="w-14 px-1.5 py-0.5 border border-gray-200 rounded text-[11px] bg-white" />
      <select value={u} onChange={(e) => setU(e.target.value)} className="px-0.5 py-0.5 border border-gray-200 rounded text-[10px] bg-white text-gray-500">
        <option value="s">秒</option>
        <option value="m">分</option>
        <option value="h">时</option>
      </select>
    </span>
  );
}

// ---------- 模板选择（分类 + 原始 protocol 查看） ----------
export function TemplatePicker({ templates, setPicker, setSetup, setEditor, insertTs }) {
  const [protocol, setProtocol] = useState(null); // 当前查看 protocol 的模板
  const cats = [...new Set(templates.map((t) => t.category || "未分类"))];

  const start = (t) => {
    const nowTs = Date.now();
    const rounded = Math.ceil(nowTs / 300000) * 300000;
    setSetup({ templateId: t.id, name: t.name, startTime: insertTs || rounded, hosting: false, expectedDays: 1, notes: "", materials: t.materials || "", steps: t.steps.map((s) => ({ ...s, id: genId() })) });
    setPicker(false);
  };

  return (
    <Modal onClose={() => setPicker(false)} title="选择实验方案" wide>
      {protocol ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1"><BookOpen size={13} />原始 Protocol</span>
            <button onClick={() => setProtocol(null)} className="text-[11px] text-gray-400 hover:text-gray-600">← 返回选择</button>
          </div>
          <div className="text-sm font-bold text-gray-800 mb-2">{protocol.name}</div>
          <RichText text={protocol.protocol} className="whitespace-pre-wrap text-[11px] leading-relaxed text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-3 max-h-[50vh] overflow-y-auto" />
          <button onClick={() => start(protocol)} className="mt-3 w-full py-2 bg-indigo-500 text-white text-xs font-medium rounded-lg hover:bg-indigo-600 flex items-center justify-center gap-1"><Play size={13} />使用此方案开始</button>
        </div>
      ) : (
        <div className="max-h-[62vh] overflow-y-auto space-y-3 pr-1">
          {cats.map((cat) => (
            <div key={cat}>
              <div className="text-[10px] font-semibold text-gray-400 mb-1.5">{cat}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {templates.filter((t) => (t.category || "未分类") === cat).map((t) => (
                  <div key={t.id} className="text-left bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 rounded-xl p-3 transition group">
                    <button onClick={() => start(t)} className="block w-full text-left">
                      <div className="text-sm font-medium text-gray-800">{t.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{t.steps.length} 步 · 约 {fmtDur(t.steps.reduce((a, s) => a + (s.durationMin || 0), 0))}</div>
                    </button>
                    {t.protocol ? (
                      <button onClick={() => setProtocol(t)} className="mt-1.5 text-[10px] text-indigo-500 hover:underline flex items-center gap-0.5"><BookOpen size={10} />查看原始 protocol</button>
                    ) : (
                      <span title="该方案暂无原始 protocol，可在方案库中编辑补充" className="mt-1.5 text-[10px] text-gray-300 cursor-not-allowed flex items-center gap-0.5"><BookOpen size={10} />无 protocol（不可查看）</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {!protocol && (
        <button onClick={() => { setPicker(false); setEditor({ id: genId(), name: "", category: "", protocol: "", steps: [] }); }} className="mt-3 w-full py-2 text-xs text-indigo-500 border border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50 flex-shrink-0">+ 没有合适的？新建自定义方案</button>
      )}
    </Modal>
  );
}

// ---------- 启动实验 ----------
export function SetupDialog({ setup, setSetup, createSession, recipes = [], now = Date.now(), firstDay = null }) {
  const [s, setS] = useState(setup);
  const [adding, setAdding] = useState(false);
  const [ns, setNs] = useState({ name: "", durationMin: 30, location: "", params: "", notes: "", isWait: false });
  const [sleepOpen, setSleepOpen] = useState(false);
  const [splitAt, setSplitAt] = useState(0);
  const [nextStart, setNextStart] = useState("09:00");
  // 时间点验证：开始时间早于当前 → 询问当前做到第几步（前面跳过）
  const isPast = s.startTime < now - 60000;
  const [resumeIdx, setResumeIdx] = useState(0);
  // 时间点验证：过早（早于首次使用当天）或过晚（间隔一天以上）不允许建立
  const firstUseTs = firstDay ? new Date(`${firstDay}T00:00:00`).getTime() : null;
  const tooEarly = firstUseTs != null && s.startTime < firstUseTs;
  const tooLate = s.startTime > now + 86400000;
  const blocked = tooEarly || tooLate;
  // 实验前物料清单：勾选状态 + 内联配方查看
  const matItems = (s.materials || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const [matChecked, setMatChecked] = useState({});
  const [matRecipe, setMatRecipe] = useState(null); // 当前展开查看配方的物料名
  const [stepRecipe, setStepRecipe] = useState(null); // 当前展开查看配方的步骤 id
  const toggleMat = (name) => setMatChecked((p) => ({ ...p, [name]: !p[name] }));
  const checkAllMat = () => setMatChecked(Object.fromEntries(matItems.map((m) => [m, true])));
  const matDone = matItems.filter((m) => matChecked[m]).length;
  const findRecipe = (name) => recipes.find((r) => name.includes(r.name) || r.name.includes(name) || (r.tag && name.includes(r.tag)));
  const up = (patch) => setS((p) => ({ ...p, ...patch }));
  const upStep = (i, patch) => setS((p) => ({ ...p, steps: p.steps.map((st, j) => (j === i ? { ...st, ...patch } : st)) }));
  const rmStep = (i) => setS((p) => ({ ...p, steps: p.steps.filter((_, j) => j !== i) }));
  const addStep = () => { if (!ns.name.trim()) return; setS((p) => ({ ...p, steps: [...p.steps, { id: genId(), ...ns }] })); setNs({ name: "", durationMin: 30, location: "", params: "", notes: "", isWait: false }); setAdding(false); };
  const totalMin = s.steps.reduce((a, st) => a + (st.durationMin || 0), 0);
  const toLocalInput = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  // ---------- 跨天睡眠助手：检测是否有步骤落在 23:00–07:00 ----------
  const cumEndAt = (k) => s.startTime + s.steps.slice(0, k + 1).reduce((a, st) => a + (st.durationMin || 0), 0) * 60000;
  const lateIdx = (() => {
    for (let i = 0; i < s.steps.length; i++) {
      if (!(s.steps[i].durationMin > 0)) continue;
      const nxt = s.steps[i + 1];
      if (nxt && nxt.isWait && /过夜/.test(nxt.name)) continue; // 已重排过
      const d = new Date(cumEndAt(i));
      const hm = d.getHours() * 60 + d.getMinutes();
      if (hm >= 23 * 60 || hm < 7 * 60) return i;
    }
    return null;
  })();
  const predictedEnd = s.startTime + totalMin * 60000;
  const openSleep = () => { setSplitAt(Math.max(0, Math.min((lateIdx ?? 1) - 1, s.steps.length - 2))); setSleepOpen(true); };
  // 第 day1End 天结束时刻 + 次日开始时刻 → 等待时长
  const sleepPlan = (() => {
    const cum = cumEndAt(splitAt);
    const [hh, mm] = nextStart.split(":").map((x) => +x || 0);
    let base = dayStart(cum) + (hh * 60 + mm) * 60000;
    if (base <= cum) base += 86400000;
    return { day1End: cum, resume: base, waitMin: Math.round((base - cum) / 60000) };
  })();
  const applySleepPlan = () => {
    const waitStep = {
      id: genId(), name: `过夜 · 保证睡眠（次日 ${nextStart} 继续）`,
      durationMin: sleepPlan.waitMin, isWait: true, location: "", params: "", notes: "跨天重排：好好休息",
    };
    const steps = [...s.steps]; steps.splice(splitAt + 1, 0, waitStep);
    up({ steps, expectedDays: Math.max(s.expectedDays || 1, 2) });
    setSleepOpen(false);
  };

  return (
    <Modal onClose={() => setSetup(null)} title="启动实验" wide>
      <div className="space-y-3 pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] font-medium text-gray-500 block mb-1">实验名称</label>
            <input value={s.name} onChange={(e) => up({ name: e.target.value })} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200" /></div>
          <div><label className="text-[10px] font-medium text-gray-500 block mb-1">开始时间</label>
            <input type="datetime-local" value={toLocalInput(s.startTime)} onChange={(e) => up({ startTime: new Date(e.target.value).getTime() })} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200" /></div>
        </div>

        {/* 时间点验证：过早 / 过晚 不允许建立 */}
        {blocked && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-red-700 leading-relaxed">
              {tooEarly ? <>无法在早于首次使用（{firstDay}）的时间点新建实验。请调整开始时间。</> : <>开始时间距现在超过一天，暂不允许新建。请调整到明天此时以内的时间。</>}
            </div>
          </div>
        )}

        {/* 时间点验证：开始时间早于当前 → 询问当前做到第几步 */}
        {isPast && !blocked && s.steps.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
              <div className="flex-1 text-[11px] text-amber-800">开始时间（{dateStr(s.startTime)} {timeStr(s.startTime)}）早于当前时间，这是一次补录。</div>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <label className="text-[11px] text-amber-800">现在实际做到</label>
              <select value={resumeIdx} onChange={(e) => setResumeIdx(+e.target.value)} className="px-2 py-1 border border-amber-200 rounded-lg text-[11px] bg-white focus:outline-none max-w-[280px]">
                {s.steps.map((st, i) => (<option key={st.id} value={i}>第 {i + 1} 步 · {st.name}</option>))}
              </select>
            </div>
            <div className="mt-1.5 text-[10px] text-amber-700 bg-white/70 rounded-lg px-2.5 py-1.5 border border-amber-100">
              第 {resumeIdx + 1} 步之前的步骤将标记为跳过，第 {resumeIdx + 1} 步定位到当前时间视为刚开始；之前的时间戳可事后在详情中补录。
            </div>
          </div>
        )}
        <div className="flex items-center gap-4">
          <div><label className="text-[10px] font-medium text-gray-500 block mb-1">预计天数</label>
            <input type="number" min="1" value={s.expectedDays} onChange={(e) => up({ expectedDays: Math.max(1, +e.target.value) })} className="w-20 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200" /></div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 mt-3 cursor-pointer">
            <input type="checkbox" checked={s.hosting} onChange={(e) => up({ hosting: e.target.checked })} className="accent-amber-500" />
            托管模式（不主动提醒，回来再确认）
          </label>
          <span className="text-[10px] text-gray-400 mt-3 ml-auto">总时长约 {fmtDur(totalMin)} · 预计 {dateStr(predictedEnd)} {timeStr(predictedEnd)} 结束</span>
        </div>

        {/* 跨天睡眠助手 */}
        {lateIdx != null && s.steps.length > 1 && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Moon size={14} className="text-indigo-600 flex-shrink-0" />
              <div className="flex-1 text-[11px] text-indigo-900">
                按当前安排，步骤「{s.steps[lateIdx].name}」将做到深夜（约 {timeStr(cumEndAt(lateIdx))}）。要重新安排以保证睡眠吗？
              </div>
              <button onClick={() => (sleepOpen ? setSleepOpen(false) : openSleep())}
                className="px-2.5 py-1 text-[11px] font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex-shrink-0">
                {sleepOpen ? "收起" : "次日重排…"}
              </button>
            </div>
            {sleepOpen && (
              <div className="mt-2.5 pt-2.5 border-t border-indigo-200 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-[11px] text-indigo-900">第一天做到</label>
                  <select value={splitAt} onChange={(e) => setSplitAt(+e.target.value)}
                    className="px-2 py-1 border border-indigo-200 rounded-lg text-[11px] bg-white focus:outline-none max-w-[260px]">
                    {s.steps.map((st, i) => i < s.steps.length - 1 && (
                      <option key={st.id} value={i}>第 {i + 1} 步 · {st.name}（约 {timeStr(cumEndAt(i))} 结束）</option>
                    ))}
                  </select>
                  <label className="text-[11px] text-indigo-900">次日开始时间</label>
                  <input type="time" value={nextStart} onChange={(e) => setNextStart(e.target.value)}
                    className="px-2 py-1 border border-indigo-200 rounded-lg text-[11px] bg-white focus:outline-none" />
                </div>
                <div className="text-[11px] text-indigo-700 bg-white rounded-lg px-2.5 py-2 border border-indigo-100">
                  第一天 {timeStr(sleepPlan.day1End)} 左右结束 → 插入「过夜等待」约 {fmtDur(sleepPlan.waitMin)} → 次日 {nextStart} 自动提醒继续后续步骤。
                </div>
                <button onClick={applySleepPlan} className="w-full py-1.5 text-[11px] font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                  按此方案插入过夜步骤
                </button>
              </div>
            )}
          </div>
        )}

        {/* 实验前物料清单 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">实验前物料清单（试剂 / 耗材 / 用具）</span>
            {matItems.length > 0 && (
              <span className="flex items-center gap-2">
                <span className={`text-[10px] tabular-nums ${matDone === matItems.length ? "text-emerald-600 font-semibold" : "text-gray-400"}`}>{matDone}/{matItems.length} 已备齐</span>
                <button onClick={checkAllMat} className="text-[10px] text-indigo-500 hover:underline">一键全勾选</button>
              </span>
            )}
          </div>
          {matItems.length > 0 ? (
            <div className="space-y-1 mb-2">
              {matItems.map((m) => {
                const rec = findRecipe(m);
                const open = matRecipe === m;
                return (
                  <div key={m}>
                    <div className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-all ${matChecked[m] ? "border-emerald-200 bg-emerald-50/60" : "border-gray-100 bg-gray-50"}`}>
                      <input type="checkbox" checked={!!matChecked[m]} onChange={() => toggleMat(m)} className="accent-emerald-500 flex-shrink-0" />
                      <span className={`flex-1 text-xs transition-all duration-300 ${matChecked[m] ? "line-through text-gray-400" : "text-gray-700"}`}>{m}</span>
                      {rec && (
                        <button onClick={() => setMatRecipe(open ? null : m)} className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 transition ${open ? "bg-indigo-500 text-white" : "text-indigo-500 border border-indigo-200 hover:bg-indigo-50"}`}>配方</button>
                      )}
                    </div>
                    {open && rec && (
                      <div className="mt-1 mb-1.5 ml-6 rounded-lg border border-indigo-100 bg-indigo-50/50 px-2.5 py-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rec.color || "#6366f1" }} />
                          <span className="text-[11px] font-semibold text-gray-700">{rec.name}</span>
                          {rec.volume && <span className="text-[10px] text-gray-400">{rec.volume}</span>}
                        </div>
                        <div className="space-y-0.5">
                          {(rec.rows || []).map((rw) => (
                            <div key={rw.id} className="flex items-baseline gap-2 text-[10px]">
                              <span className="text-gray-600 flex-1">{rw.name}</span>
                              <span className="text-gray-500 tabular-nums">{rw.amount}</span>
                              {rw.note && <span className="text-gray-400">{rw.note}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[10px] text-gray-300 mb-1">尚未填写物料清单，可在下方补充（每行一项）。</div>
          )}
          <textarea value={s.materials || ""} onChange={(e) => up({ materials: e.target.value })} rows={2} placeholder={"每行一项，例如：\nLB 液体培养基\n1.5 mL 离心管\n移液器与枪头"} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[11px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>

        <div>
          <div className="text-[11px] font-semibold text-gray-500 mb-1.5">步骤（时间/浓度均可调整，时长支持小数精确到秒）</div>
          <div className="space-y-1.5">
            {s.steps.map((st, i) => (
              <div key={st.id} className={`bg-gray-50 rounded-lg p-2 border ${st.isWait && /过夜/.test(st.name) ? "border-indigo-200 bg-indigo-50/60" : "border-gray-100"}`}>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <input value={st.name} onChange={(e) => upStep(i, { name: e.target.value })} className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-200 bg-white" />
                  <button onClick={() => rmStep(i)} className="p-1 text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 pl-7">
                  <label className="flex items-center gap-1 text-[10px] text-gray-500">时长
                    <DurInput value={st.durationMin} onChange={(v) => upStep(i, { durationMin: v })} /></label>
                  <input value={st.location} onChange={(e) => upStep(i, { location: e.target.value })} placeholder="地点" className="w-28 px-1.5 py-0.5 border border-gray-200 rounded text-[11px] bg-white" />
                  <input value={st.params} onChange={(e) => upStep(i, { params: e.target.value })} placeholder="浓度/参数" className="flex-1 min-w-[100px] px-1.5 py-0.5 border border-gray-200 rounded text-[11px] bg-white" />
                  <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={!!st.isWait} onChange={(e) => upStep(i, { isWait: e.target.checked })} className="accent-amber-500" />孵育</label>
                  {(() => { const sr = findRecipe(`${st.name} ${st.params} ${st.notes || ""}`); return sr ? (
                    <button onClick={() => setStepRecipe(stepRecipe === st.id ? null : st.id)} className={`text-[10px] px-1.5 py-0.5 rounded transition ${stepRecipe === st.id ? "bg-indigo-500 text-white" : "text-indigo-500 border border-indigo-200 hover:bg-indigo-50"}`}>配方</button>
                  ) : null; })()}
                </div>
                {(() => { const sr = findRecipe(`${st.name} ${st.params} ${st.notes || ""}`); return sr && stepRecipe === st.id ? (
                  <div className="mt-1.5 ml-7 rounded-lg border border-indigo-100 bg-indigo-50/50 px-2.5 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sr.color || "#6366f1" }} />
                      <span className="text-[11px] font-semibold text-gray-700">{sr.name}</span>
                      {sr.volume && <span className="text-[10px] text-gray-400">{sr.volume}</span>}
                    </div>
                    <div className="space-y-0.5">
                      {(sr.rows || []).map((rw) => (
                        <div key={rw.id} className="flex items-baseline gap-2 text-[10px]">
                          <span className="text-gray-600 flex-1">{rw.name}</span>
                          <span className="text-gray-500 tabular-nums">{rw.amount}</span>
                          {rw.note && <span className="text-gray-400">{rw.note}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null; })()}
              </div>
            ))}
          </div>
          {adding ? (
            <div className="mt-2 bg-indigo-50/50 rounded-lg p-2.5 border border-indigo-100 space-y-1.5">
              <input value={ns.name} onChange={(e) => setNs((p) => ({ ...p, name: e.target.value }))} placeholder="事件名称（如：37°C 孵育）" className="w-full px-2 py-1 border border-gray-200 rounded text-xs bg-white" />
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-1 text-[10px] text-gray-500">时长
                  <DurInput value={ns.durationMin} onChange={(v) => setNs((p) => ({ ...p, durationMin: v }))} /></label>
                <input value={ns.location} onChange={(e) => setNs((p) => ({ ...p, location: e.target.value }))} placeholder="地点" className="w-28 px-1.5 py-0.5 border border-gray-200 rounded text-[11px] bg-white" />
                <input value={ns.params} onChange={(e) => setNs((p) => ({ ...p, params: e.target.value }))} placeholder="浓度/参数" className="flex-1 min-w-[100px] px-1.5 py-0.5 border border-gray-200 rounded text-[11px] bg-white" />
              </div>
              <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                <input type="checkbox" checked={ns.isWait} onChange={(e) => setNs((p) => ({ ...p, isWait: e.target.checked }))} className="accent-amber-500" />孵育/等待步骤</label>
              <div className="flex gap-2">
                <button onClick={addStep} className="px-3 py-1 bg-indigo-600 text-white text-[11px] rounded-md hover:bg-indigo-700">添加步骤</button>
                <button onClick={() => setAdding(false)} className="px-3 py-1 text-gray-500 text-[11px] rounded-md hover:bg-gray-100">取消</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="mt-2 w-full py-1.5 text-[11px] text-indigo-600 border border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50 flex items-center justify-center gap-1"><Plus size={12} />添加步骤</button>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-4 flex-shrink-0">
        <button onClick={() => setSetup(null)} className="flex-1 py-2 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50">取消</button>
        <button onClick={() => createSession({ ...s, resumeIdx: isPast ? resumeIdx : 0 })} disabled={!s.name.trim() || s.steps.length === 0 || blocked} className="flex-1 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40">开始实验</button>
      </div>
    </Modal>
  );
}

// ---------- 模板编辑器 ----------
export function TemplateEditor({ editor, setEditor, saveTemplate }) {
  const [t, setT] = useState(editor);
  const [adding, setAdding] = useState(false);
  const [ns, setNs] = useState({ name: "", durationMin: 30, location: "", params: "", notes: "", isWait: false });
  const [protoPreview, setProtoPreview] = useState(false);
  const protoRef = useRef(null);
  // 在光标/选区处包裹标记（**加粗** / ==高亮==）
  const wrapSel = (pre, post = pre) => {
    const el = protoRef.current; if (!el) return;
    const a = el.selectionStart ?? 0, b = el.selectionEnd ?? 0;
    const v = t.protocol || "";
    setT((p) => ({ ...p, protocol: v.slice(0, a) + pre + v.slice(a, b) + post + v.slice(b) }));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + pre.length, b + pre.length); });
  };
  // 从文件导入 protocol（.md / .txt 等纯文本；已有内容则追加）
  const importProtocolFile = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".md,.txt,.markdown,.text,.protocol";
    input.onchange = async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      const text = await f.text();
      setT((p) => ({ ...p, protocol: p.protocol && p.protocol.trim() ? p.protocol + "\n\n" + text : text }));
    };
    input.click();
  };
  // 从剪贴板粘贴导入
  const pasteProtocol = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      setT((p) => ({ ...p, protocol: p.protocol && p.protocol.trim() ? p.protocol + "\n\n" + text : text }));
    } catch { toast("无法读取剪贴板，请直接在文本框中 Ctrl+V 粘贴", "error"); }
  };
  const upStep = (i, patch) => setT((p) => ({ ...p, steps: p.steps.map((st, j) => (j === i ? { ...st, ...patch } : st)) }));
  const rmStep = (i) => setT((p) => ({ ...p, steps: p.steps.filter((_, j) => j !== i) }));
  const addStep = () => { if (!ns.name.trim()) return; setT((p) => ({ ...p, steps: [...p.steps, { id: genId(), ...ns }] })); setNs({ name: "", durationMin: 30, location: "", params: "", notes: "", isWait: false }); setAdding(false); };

  return (
    <Modal onClose={() => setEditor(null)} title={editor.name ? "编辑方案" : "新建方案"} wide>
      <div className="space-y-3 pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] font-medium text-gray-500 block mb-1">方案名称</label>
            <input value={t.name} onChange={(e) => setT((p) => ({ ...p, name: e.target.value }))} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200" /></div>
          <div><label className="text-[10px] font-medium text-gray-500 block mb-1">分类</label>
            <input value={t.category} onChange={(e) => setT((p) => ({ ...p, category: e.target.value }))} placeholder="如 RNA制备" className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200" /></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-medium text-gray-500">原始 Protocol（可选，供查阅）</label>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => wrapSel("**")} title="加粗选中文本（**文字**）" className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded"><Bold size={11} /></button>
              <button type="button" onClick={() => wrapSel("==")} title="高亮选中文本（==文字==）" className="p-1 text-gray-400 hover:text-amber-500 hover:bg-gray-100 rounded"><Highlighter size={11} /></button>
              <button type="button" onClick={importProtocolFile} title="从 .md / .txt 文件导入" className="text-[10px] text-indigo-500 hover:underline flex items-center gap-0.5"><Upload size={10} />导入文件</button>
              <button type="button" onClick={pasteProtocol} title="从剪贴板粘贴导入" className="text-[10px] text-indigo-500 hover:underline">粘贴导入</button>
              <button type="button" onClick={() => setProtoPreview((v) => !v)} className="text-[10px] text-gray-400 hover:text-gray-600">{protoPreview ? "返回编辑" : "预览"}</button>
            </div>
          </div>
          {protoPreview ? (
            <RichText text={t.protocol || "（暂无内容）"} className="min-h-[110px] w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[11px] leading-relaxed text-gray-600 bg-gray-50 overflow-y-auto max-h-[220px]" />
          ) : (
            <textarea ref={protoRef} value={t.protocol || ""} onChange={(e) => setT((p) => ({ ...p, protocol: e.target.value }))} rows={5} placeholder={"记录该实验的原始 protocol、原理、要点…\n支持 **加粗**、==高亮== 与 $LaTeX$ 公式"} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[11px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          )}
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-500 block mb-1">实验前物料清单（可选，每行一项试剂 / 耗材 / 用具）</label>
          <textarea value={t.materials || ""} onChange={(e) => setT((p) => ({ ...p, materials: e.target.value }))} rows={3} placeholder={"每行一项，开始实验时会生成可勾选清单，例如：\nLB 液体培养基\n1.5 mL 离心管\n移液器与枪头"} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[11px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>
        <div>
          <div className="text-[11px] font-semibold text-gray-500 mb-1.5">步骤</div>
          <div className="space-y-1.5">
            {t.steps.map((st, i) => (
              <div key={st.id} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <input value={st.name} onChange={(e) => upStep(i, { name: e.target.value })} className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs bg-white" />
                  <button onClick={() => rmStep(i)} className="p-1 text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 pl-7">
                  <label className="flex items-center gap-1 text-[10px] text-gray-500">时长
                    <DurInput value={st.durationMin} onChange={(v) => upStep(i, { durationMin: v })} /></label>
                  <input value={st.location} onChange={(e) => upStep(i, { location: e.target.value })} placeholder="地点" className="w-28 px-1.5 py-0.5 border border-gray-200 rounded text-[11px] bg-white" />
                  <input value={st.params} onChange={(e) => upStep(i, { params: e.target.value })} placeholder="浓度/参数" className="flex-1 min-w-[100px] px-1.5 py-0.5 border border-gray-200 rounded text-[11px] bg-white" />
                  <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={!!st.isWait} onChange={(e) => upStep(i, { isWait: e.target.checked })} className="accent-amber-500" />孵育</label>
                </div>
              </div>
            ))}
          </div>
          {adding ? (
            <div className="mt-2 bg-indigo-50/50 rounded-lg p-2.5 border border-indigo-100 space-y-1.5">
              <input value={ns.name} onChange={(e) => setNs((p) => ({ ...p, name: e.target.value }))} placeholder="事件名称" className="w-full px-2 py-1 border border-gray-200 rounded text-xs bg-white" />
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-1 text-[10px] text-gray-500">时长
                  <DurInput value={ns.durationMin} onChange={(v) => setNs((p) => ({ ...p, durationMin: v }))} /></label>
                <input value={ns.location} onChange={(e) => setNs((p) => ({ ...p, location: e.target.value }))} placeholder="地点" className="w-28 px-1.5 py-0.5 border border-gray-200 rounded text-[11px] bg-white" />
                <input value={ns.params} onChange={(e) => setNs((p) => ({ ...p, params: e.target.value }))} placeholder="浓度/参数" className="flex-1 min-w-[100px] px-1.5 py-0.5 border border-gray-200 rounded text-[11px] bg-white" />
              </div>
              <div className="flex gap-2">
                <button onClick={addStep} className="px-3 py-1 bg-indigo-500 text-white text-[11px] rounded-md">添加</button>
                <button onClick={() => setAdding(false)} className="px-3 py-1 text-gray-500 text-[11px] rounded-md hover:bg-gray-100">取消</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="mt-2 w-full py-1.5 text-[11px] text-indigo-500 border border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50 flex items-center justify-center gap-1"><Plus size={12} />添加步骤</button>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-4 flex-shrink-0">
        <button onClick={() => setEditor(null)} className="flex-1 py-2 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50">取消</button>
        <button onClick={() => saveTemplate(t)} disabled={!t.name.trim() || t.steps.length === 0} className="flex-1 py-2 bg-indigo-500 text-white text-xs font-medium rounded-lg hover:bg-indigo-600 disabled:opacity-40">保存方案</button>
      </div>
    </Modal>
  );
}

// ---------- 数据管理（备份导出 / 恢复覆盖 / 清空全部数据） ----------
export function DataDialog({ onClose, data, onRestore }) {
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const backup = async () => {
    const blob = JSON.stringify({ _biolab: "full-backup", version: 1, exportedAt: Date.now(), ...data }, null, 2);
    try {
      const p = await invoke("save_text_file", { title: "导出 BioLab 数据备份", defaultName: `BioLab备份_${dateStr(Date.now())}.json`, content: blob });
      setMsg(p ? `已导出备份：${p}` : "");
    } catch (e) { setMsg("导出失败：" + e); }
  };

  const restoreFile = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      try {
        const bk = JSON.parse(await f.text());
        if (bk._biolab !== "full-backup") { setMsg("不是有效的 BioLab 全量备份文件"); return; }
        if (!confirmOverwrite) { setMsg("请先勾选「覆盖当前数据」再恢复"); return; }
        onRestore(bk);
        setMsg("已用备份覆盖当前数据（自动保存中）");
        setConfirmOverwrite(false);
      } catch { setMsg("备份文件解析失败"); }
    };
    input.click();
  };

  const clearAll = async () => {
    if (!confirmDel) return;
    setBusy(true);
    try {
      const n = await invoke("clear_all_data");
      toast(`已删除 ${n} 个本地数据文件，即将恢复到初始状态`, "success");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) { setMsg("清空失败：" + e); setBusy(false); }
  };

  return (
    <Modal onClose={onClose} title="数据管理" wide>
      <div className="space-y-3">
        {msg && <div className="text-[11px] px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-800">{msg}</div>}

        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs font-semibold text-gray-700 mb-1">备份与恢复</div>
          <p className="text-[11px] text-gray-400 mb-2.5">全部数据（方案 / 实验 / 备注 / 便签 / 数据集 / 配方）打包为一个 JSON 文件；恢复时会覆盖当前数据。</p>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={backup} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"><Download size={12} />导出全部数据备份</button>
            <label className={`flex items-center gap-1.5 text-[11px] cursor-pointer ${confirmOverwrite ? "text-amber-600" : "text-gray-500"}`}>
              <input type="checkbox" checked={confirmOverwrite} onChange={(e) => setConfirmOverwrite(e.target.checked)} className="accent-amber-500" />覆盖当前数据
            </label>
            <button onClick={restoreFile} disabled={!confirmOverwrite} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"><Upload size={12} />从备份恢复…</button>
          </div>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
          <div className="text-xs font-semibold text-red-600 mb-1 flex items-center gap-1"><AlertTriangle size={13} />危险操作：清空全部数据</div>
          <p className="text-[11px] text-gray-500 mb-2.5">删除本机存储的所有实验记录、方案、备注等（便于测试或重新开始）。此操作不可撤销，建议先导出备份。</p>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
              <input type="checkbox" checked={confirmDel} onChange={(e) => setConfirmDel(e.target.checked)} className="accent-red-500" />我确认要删除原来全部数据
            </label>
            <button onClick={clearAll} disabled={!confirmDel || busy} className="px-2.5 py-1.5 text-[11px] text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-40">{busy ? "删除中…" : "立即清空"}</button>
          </div>
        </div>

        <div className="text-[10px] text-gray-400">数据位置：%LOCALAPPDATA%\biolab-assistant\（每个页面一个 JSON 文件）</div>
      </div>
      <div className="flex gap-2 mt-4 flex-shrink-0">
        <button onClick={onClose} className="flex-1 py-2 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50">关闭</button>
      </div>
    </Modal>
  );
}

// ---------- 首次运行：数据起点选择（保留本机 / 导入先前数据 / 全新安装） ----------
export function DataStartDialog({ onKeep, onImport, onFresh }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const importFile = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      try {
        const bk = JSON.parse(await f.text());
        if (bk._biolab !== "full-backup") { setMsg("不是有效的 BioLab 全量备份文件（需由「数据管理 → 导出全部数据备份」生成）"); return; }
        onImport(bk);
      } catch { setMsg("备份文件解析失败"); }
    };
    input.click();
  };

  const fresh = async () => {
    setBusy(true);
    try { await onFresh(); } catch { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-gray-900/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-[fadeIn_.18s_ease]">
        <div className="flex items-center gap-2 text-base font-bold text-gray-800 mb-1.5"><HardDrive size={18} className="text-indigo-600" />选择数据起点</div>
        <p className="text-[12px] text-gray-500 leading-relaxed mb-4">欢迎使用 BioLab。首次启动请选择如何初始化你的数据：保留本机已有数据、从备份导入先前数据，或全新开始。此选择仅出现一次。</p>
        {msg && <div className="text-[11px] px-2.5 py-1.5 mb-3 bg-red-50 border border-red-200 rounded-lg text-red-700">{msg}</div>}
        <div className="space-y-2">
          <button onClick={onKeep} className="w-full flex items-start gap-3 p-3 rounded-xl border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition">
            <Database size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
            <span><span className="block text-sm font-semibold text-gray-800">保留本机已有数据</span><span className="block text-[11px] text-gray-400 mt-0.5">升级安装推荐：继续使用本机已保存的方案 / 实验 / 配方等</span></span>
          </button>
          <button onClick={importFile} className="w-full flex items-start gap-3 p-3 rounded-xl border-2 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-left transition">
            <Upload size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <span><span className="block text-sm font-semibold text-gray-800">从备份导入先前数据</span><span className="block text-[11px] text-gray-400 mt-0.5">选择此前导出的 BioLab 全量备份 JSON 文件恢复</span></span>
          </button>
          <button onClick={fresh} disabled={busy} className="w-full flex items-start gap-3 p-3 rounded-xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50/50 text-left transition disabled:opacity-50">
            <Sparkles size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <span><span className="block text-sm font-semibold text-gray-800">全新安装（从零开始）</span><span className="block text-[11px] text-gray-400 mt-0.5">{busy ? "正在清空…" : "清空本机数据，仅保留内置示例方案与配方"}</span></span>
          </button>
        </div>
      </div>
    </div>
  );
}
