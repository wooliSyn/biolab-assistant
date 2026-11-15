// ==================== 工具箱：计时器 / 倒计时 / 细胞计数 / 稀释 / 混合配比 ====================
// 桌面优先：紧凑尺寸、大数字显示。细胞计数器支持每行单独归零（点1）。
// 卡片支持长按拖拽自定义排序（useLongPressDrag），顺序/溶剂名持久化到 toolPrefs。
// 每个小工具带 HelpTip 问号操作说明。
import { useState, useEffect, useRef } from "react";
import { Timer, AlarmClock, Grid3X3, Play, Pause, RotateCcw, Plus, Minus, Trash2, Maximize2, Minimize2 } from "lucide-react";
import { DilutionCalc, MixCalc } from "./Calculators";
import HelpTip from "./HelpTip";
import { useLongPressDrag, arrayReorder } from "../lib/useLongPressDrag";
import { AssemblyCalc, HemoCalc, CfuCalc, Od260Calc, SerialDilCalc, MwCalc } from "./BenchTools";

const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (totalSec) => {
  const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

// 桌面紧凑样式
const PRIMARY_BTN = "px-4 py-1.5 text-xs font-medium rounded-lg text-white transition";
const GHOST_BTN = "px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition";
const DISPLAY = "text-center font-mono text-3xl font-bold tabular-nums py-3";

export const TOOL_IDS = ["stopwatch", "countdown", "cell", "hemo", "dilution", "mix", "assembly", "cfu", "od260", "serial", "mw"];
export const DEFAULT_TOOL_PREFS = { order: TOOL_IDS, solvent: "水", filler: "水", wide: ["assembly", "serial"], scheme: null };

const HELP = {
  stopwatch: "开始/暂停计时；「计次」记录分段时间；重置清零。长按卡片空白处可拖拽调整顺序。",
  countdown: "点预设（1/3/5/10/15/30分）或自定义分秒；开始后倒数，到点显示「时间到」并脉冲提醒。长按卡片可拖拽排序。",
  cell: "每行 ± 计数、可重命名；单行归零或全部归零；顶部自动求总计。长按卡片可拖拽排序。",
  dilution: "填母液浓度C₁、目标浓度C₂、终体积V₂，点「计算」得取母液体积V₁与需补溶剂量（C₁V₁=C₂V₂）。支持跨单位自动换算；溶剂名称可自定义；结果可导出CSV或推送手机。长按卡片可拖拽排序。",
  mix: "设终体积；每组分选「目标=浓度/质量」与「母液=溶液/固体」，点「计算配比」得各组分取用量，并按终体积自动算补液/溶剂；组分体积超终体积会标红。可导出CSV/打印/推送手机。长按卡片可拖拽排序。",
  assembly: "选 Seamless/Gibson 试剂盒预设（或自定义插入:载体摩尔比、载体pmol、反应与Mix体积）；填载体与插入片段的 bp 和 ng/µL，点「计算配比」得各组分 pmol/ng/取用µL，并自动算补水；超体积标红。可导出CSV/打印/推送。长按拖拽排序。",
  hemo: "填四角大方格计数、稀释倍数（可选总体积），点计算得平均/格、cells/mL（平均×稀释×10⁴）与总细胞数。长按拖拽排序。",
  cfu: "每平板填菌落数、稀释倍数、涂布体积mL，点计算得各平板与平均 CFU/mL（菌落×稀释/涂布体积）。长按拖拽排序。",
  od260: "填 A260/A280/(A230)、稀释倍数、光程、核酸类型与长度(选)，点计算得 ng/µL、A260/280 纯度、拷贝数/µL。dsDNA50/ssDNA33/RNA40 系数。长按拖拽排序。",
  serial: "设母液浓度、稀释倍数、步数、每管体积，点「生成稀释表」得每管浓度与取上管/补稀释剂体积（取=V/倍数）。可导出CSV/打印/推送。长按拖拽排序。",
  mw: "选化学式或 dsDNA/ssDNA/RNA/蛋白序列，输入后点计算得分子量 Da。化学式支持括号；核酸按平均残基量、蛋白按残基加和。长按拖拽排序。",
};

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
    <div className="pixel-panel p-3 h-full">
      <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><Timer size={13} className="text-indigo-600" />秒表<HelpTip text={HELP.stopwatch} className="ml-auto" /></div>
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
    <div className="pixel-panel p-3 h-full">
      <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><AlarmClock size={13} className="text-rose-600" />倒计时<HelpTip text={HELP.countdown} className="ml-auto" /></div>
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
    <div className="pixel-panel p-3 h-full">
      <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><Grid3X3 size={13} className="text-cyan-600" />细胞计数器
        <span className="ml-auto text-[10px] text-gray-400 tabular-nums">总计 {total}</span>
        <HelpTip text={HELP.cell} />
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
export default function ToolsView({ prefs, setPrefs }) {
  const p = { ...DEFAULT_TOOL_PREFS, ...(prefs || {}) };
  const order = [...(p.order || []), ...TOOL_IDS.filter((id) => !(p.order || []).includes(id))];
  const setP = (patch) => setPrefs && setPrefs((prev) => ({ ...DEFAULT_TOOL_PREFS, ...(prev || {}), ...patch }));
  const reorder = (from, to, pos) => setP({ order: arrayReorder(order, from, to, pos, (x) => x) });
  const { dragId, onPointerDown } = useLongPressDrag(reorder, { axis: "auto" });

  const cards = {
    stopwatch: <Stopwatch />,
    countdown: <Countdown />,
    cell: <CellCounter />,
    dilution: <DilutionCalc solvent={p.solvent} onSolvent={(v) => setP({ solvent: v })} help={HELP.dilution} />,
    mix: <MixCalc filler={p.filler} onFiller={(v) => setP({ filler: v })} help={HELP.mix} />,
    assembly: <AssemblyCalc help={HELP.assembly} />,
    hemo: <HemoCalc help={HELP.hemo} />,
    cfu: <CfuCalc help={HELP.cfu} scheme={p.scheme} />,
    od260: <Od260Calc help={HELP.od260} />,
    serial: <SerialDilCalc help={HELP.serial} onScheme={(s) => setP({ scheme: s })} />,
    mw: <MwCalc help={HELP.mw} />,
  };

  const wideSet = new Set(p.wide || []);
  const toggleWide = (id) => setP({ wide: wideSet.has(id) ? (p.wide || []).filter((x) => x !== id) : [...(p.wide || []), id] });

  return (
    <div className="tools-grid grid grid-cols-1 md:grid-cols-2 gap-3.5 max-w-5xl">
      {order.map((id) => (
        <div
          key={id}
          data-drag-id={id}
          onPointerDown={(e) => onPointerDown(e, id)}
          className={`relative ${wideSet.has(id) ? "md:col-span-2" : ""} ${dragId === id ? "lpd-dragging" : ""}`}
        >
          <button
            onClick={() => toggleWide(id)}
            data-no-drag
            title={wideSet.has(id) ? "改为半栏" : "改为整栏"}
            className="absolute -top-2 -right-2 z-20 p-1 rounded-full border border-gray-200 bg-white text-gray-500 hover:text-indigo-600 shadow"
          >
            {wideSet.has(id) ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          {cards[id]}
        </div>
      ))}
    </div>
  );
}
