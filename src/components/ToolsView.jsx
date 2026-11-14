// ==================== 工具箱：计时器 / 倒计时 / 细胞计数器 ====================
// 桌面优先：紧凑尺寸、大数字显示。细胞计数器支持每行单独归零（点1）。
import { useState, useEffect, useRef } from "react";
import { Timer, AlarmClock, Grid3X3, Play, Pause, RotateCcw, Plus, Minus, Trash2 } from "lucide-react";

const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (totalSec) => {
  const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

// 桌面紧凑样式
const PRIMARY_BTN = "px-4 py-1.5 text-xs font-medium rounded-lg text-white transition";
const GHOST_BTN = "px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition";
const DISPLAY = "text-center font-mono text-3xl font-bold tabular-nums py-3";

// ---------- 秒表/计时器 ----------
function Stopwatch() {
  const [sec, setSec] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState([]);
  const iv = useRef(null);

  useEffect(() => {
    if (running) { iv.current = setInterval(() => setSec((s) => s + 1), 1000); }
    else clearInterval(iv.current);
    return () => clearInterval(iv.current);
  }, [running]);

  return (
    <div className="pixel-panel p-3">
      <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><Timer size={13} className="text-indigo-600" />秒表</div>
      <div className={`${DISPLAY} text-gray-800 select-all`}>{fmtTime(sec)}</div>
      <div className="flex justify-center gap-2">
        <button onClick={() => setRunning(!running)} className={`${PRIMARY_BTN} ${running ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700"}`}>
          {running ? <span className="flex items-center gap-1"><Pause size={14} />暂停</span> : <span className="flex items-center gap-1"><Play size={14} />开始</span>}
        </button>
        <button onClick={() => { if (running) setLaps((p) => [...p, sec]); }} disabled={!running} className={`${GHOST_BTN} disabled:opacity-30`}>计次</button>
        <button onClick={() => { setRunning(false); setSec(0); setLaps([]); }} className={GHOST_BTN} aria-label="重置"><RotateCcw size={14} /></button>
      </div>
      {laps.length > 0 && (
        <div className="mt-2 max-h-28 overflow-y-auto space-y-0.5">
          {laps.map((l, i) => <div key={i} className="flex justify-between text-[10px] text-gray-500 tabular-nums px-2"><span>#{i + 1}</span><span>{fmtTime(l)}</span></div>)}
        </div>
      )}
    </div>
  );
}

// ---------- 倒计时 ----------
function Countdown() {
  const [preset, setPreset] = useState(300); // 默认5分钟
  const [remain, setRemain] = useState(300);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const iv = useRef(null);

  useEffect(() => {
    if (running && remain > 0) {
      iv.current = setInterval(() => {
        setRemain((r) => {
          if (r <= 1) { setRunning(false); setDone(true); clearInterval(iv.current); return 0; }
          return r - 1;
        });
      }, 1000);
    } else clearInterval(iv.current);
    return () => clearInterval(iv.current);
  }, [running]);

  const setAndReset = (s) => { setPreset(s); setRemain(s); setRunning(false); setDone(false); };
  const presets = [[60, "1分"], [180, "3分"], [300, "5分"], [600, "10分"], [900, "15分"], [1800, "30分"]];

  return (
    <div className="pixel-panel p-3">
      <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><AlarmClock size={13} className="text-rose-600" />倒计时</div>
      <div className={`${DISPLAY} ${done ? "text-rose-600 animate-pulse" : "text-gray-800"}`}>
        {done ? "时间到！" : fmtTime(remain)}
      </div>
      <div className="flex flex-wrap justify-center gap-1 mb-2">
        {presets.map(([s, l]) => (
          <button key={s} onClick={() => setAndReset(s)} className={`px-2 py-1 text-[10px] rounded-md border transition ${preset === s ? "bg-rose-600 text-white border-rose-700" : "border-gray-200 text-gray-600 hover:border-rose-300"}`}>{l}</button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <input type="number" min="0" max="999" value={Math.floor(preset / 60)} onChange={(e) => setAndReset(Math.max(0, +e.target.value) * 60 + preset % 60)} className="w-12 px-2 py-1 text-xs text-center border border-gray-200 rounded-md" />
        <span className="text-[10px] text-gray-400">分</span>
        <input type="number" min="0" max="59" value={preset % 60} onChange={(e) => setAndReset(Math.floor(preset / 60) * 60 + Math.min(59, Math.max(0, +e.target.value)))} className="w-12 px-2 py-1 text-xs text-center border border-gray-200 rounded-md" />
        <span className="text-[10px] text-gray-400">秒</span>
      </div>
      <div className="flex justify-center gap-2">
        <button onClick={() => { if (remain > 0) { setRunning(!running); setDone(false); } }} className={`${PRIMARY_BTN} ${running ? "bg-amber-500 hover:bg-amber-600" : "bg-rose-600 hover:bg-rose-700"}`}>
          {running ? <span className="flex items-center gap-1"><Pause size={14} />暂停</span> : <span className="flex items-center gap-1"><Play size={14} />开始</span>}
        </button>
        <button onClick={() => setAndReset(preset)} className={GHOST_BTN} aria-label="重置"><RotateCcw size={14} /></button>
      </div>
    </div>
  );
}

// ---------- 细胞计数器（点1：每行单独归零） ----------
function CellCounter() {
  const [counts, setCounts] = useState([{ id: 1, name: "计数 1", val: 0 }]);
  const nextId = useRef(2);

  const addRow = () => setCounts((p) => [...p, { id: nextId.current++, name: `计数 ${p.length + 1}`, val: 0 }]);
  const removeRow = (id) => setCounts((p) => p.filter((c) => c.id !== id));
  const bump = (id, d) => setCounts((p) => p.map((c) => c.id === id ? { ...c, val: Math.max(0, c.val + d) } : c));
  const resetRow = (id) => setCounts((p) => p.map((c) => c.id === id ? { ...c, val: 0 } : c));
  const rename = (id, name) => setCounts((p) => p.map((c) => c.id === id ? { ...c, name } : c));
  const total = counts.reduce((s, c) => s + c.val, 0);

  return (
    <div className="pixel-panel p-3">
      <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><Grid3X3 size={13} className="text-cyan-600" />细胞计数器
        <span className="ml-auto text-[10px] text-gray-400 tabular-nums">总计 {total}</span>
      </div>
      <div className="space-y-1.5">
        {counts.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5">
            <input value={c.name} onChange={(e) => rename(c.id, e.target.value)} className="flex-1 min-w-0 px-1.5 py-1 text-[11px] border border-gray-200 rounded-md" />
            <button onClick={() => bump(c.id, -1)} aria-label="减一" className="p-1 text-gray-400 hover:text-rose-500 border border-gray-200 rounded-md"><Minus size={14} /></button>
            <span className="w-12 text-center text-sm font-bold tabular-nums text-gray-800">{c.val}</span>
            <button onClick={() => bump(c.id, 1)} aria-label="加一" className="p-1 text-white bg-cyan-600 hover:bg-cyan-700 rounded-md"><Plus size={14} /></button>
            <button onClick={() => resetRow(c.id)} aria-label="归零此行" title="归零此行" className="p-1 text-gray-400 hover:text-cyan-600 border border-gray-200 rounded-md"><RotateCcw size={13} /></button>
            <button onClick={() => removeRow(c.id)} aria-label="删除行" title="删除行" className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={addRow} className={`${GHOST_BTN} flex items-center gap-1`}><Plus size={13} />添加行</button>
        <button onClick={() => setCounts((p) => p.map((c) => ({ ...c, val: 0 })))} className={`${GHOST_BTN} flex items-center gap-1`} title="将所有行归零"><RotateCcw size={13} />全部归零</button>
      </div>
    </div>
  );
}

// ---------- 主组件 ----------
export default function ToolsView() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 max-w-4xl">
      <Stopwatch />
      <Countdown />
      <CellCounter />
    </div>
  );
}