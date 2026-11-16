// ==================== 工具箱：计时器 / 倒计时 / 细胞计数 / 稀释 / 混合配比 ====================
// 桌面优先：紧凑尺寸、大数字显示。细胞计数器支持每行单独归零（点1）。
// 视图模式 / 顺序 / 收藏 / 隐藏 / 整栏半栏 / 溶剂名都持久化到 toolPrefs。
// 每个小工具带 HelpTip 问号操作说明。
import { useState, useEffect, useRef } from "react";
import { Timer, AlarmClock, Grid3X3, Play, Pause, RotateCcw, Plus, Minus, Trash2, Beaker, FlaskConical, Layers, Microscope, Sigma, Atom, Dna, TestTubes, Star, EyeOff, Eye, ChevronDown, ChevronRight, Square, LayoutGrid, Maximize2, Minimize2 } from "lucide-react";
import { useLongPressDrag, arrayReorder } from "../lib/useLongPressDrag";
import { invoke } from "@tauri-apps/api/core";
import { DilutionCalc, MixCalc } from "./Calculators";
import HelpTip from "./HelpTip";
import { AssemblyCalc, HemoCalc, CfuCalc, Od260Calc, SerialDilCalc, MwCalc } from "./BenchTools";

const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (totalSec) => {
  const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

// 桌面紧凑样式
const PRIMARY_BTN = "px-4 py-1.5 text-xs font-medium rounded-lg text-white transition";
const GHOST_BTN = "px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition";
const DISPLAY = "text-center font-mono text-5xl font-bold tabular-nums py-6";

const TOOL_IDS = ["stopwatch", "countdown", "cell", "hemo", "dilution", "mix", "assembly", "cfu", "od260", "serial", "mw"];
const DEFAULT_TOOL_PREFS = { view: "single", order: TOOL_IDS, solvent: "水", filler: "水", wide: ["assembly", "serial"], scheme: null };

const DRAG_TIP = "左侧列表可长按拖动排序、☆ 收藏置顶；「工作台」视图下长按卡片空白处拖动，右上角切整栏 / 半栏。";
// 说明文案须与 lib/bench.js、lib/calc.js 的实际算法保持一致；原理与公式的完整版见 docs/tools.md
const HELP = {
  stopwatch: "开始 / 暂停计时；「计次」记录分段时间；重置清零。切到别的页面也会继续计时。",
  countdown: "点预设（1/3/5/10/15/30 分）或自定义分秒后开始。到点显示 00:00 并发系统通知；结束后直接点「开始」即按设定时长重新计时。切页不停。",
  cell: "每行 ± 计数、可重命名；单行归零或全部归零；顶部自动求总计。",
  dilution: "C₁V₁ = C₂V₂：填母液浓度 C₁、目标浓度 C₂、终体积 V₂，得取母液 V₁ = C₂V₂ / C₁ 与补溶剂 V₂ − V₁。同维度单位自动换算（摩尔 / 质量体积 / 倍数不能混算）；质量体积浓度时同时给出溶质质量 C₂V₂。",
  mix: "设终体积 V；每个组分选目标（浓度或质量）与母液（溶液或固体）：溶液取 V·C目标 / C母液（质量目标为 m / C母液），固体直接称 C目标·V 或 m。补液 = V − 各液体组分之和，超出终体积会提示。",
  assembly: "Gibson / Seamless 组装，只输出 µL。2× Mix 占总体积一半，剩余体积全部分给载体 + 插入片段（不另加水）；按各片段 bp 与 ng/µL 换算 pmol（1 pmol = 0.66 × bp ng），以插入:载体 = 3:1（可改）摩尔比自动解出各片段取用量。取量 < 0.05 µL 会提示。",
  hemo: "填四角大方格计数（可只填部分）、稀释倍数，选填总体积：cells/mL = 平均每格 × 稀释倍数 × 10⁴（每大格 0.1 µL）；总细胞数 = cells/mL × 总体积。",
  cfu: "CFU/mL = 菌落数 × 稀释倍数 ÷ 涂布体积(mL)。只有菌落数在 30–300 之间的平板参与平均（< 30 统计误差大，> 300 记为 TNTC）。稀释倍数可手填，或开启「联动梯度稀释」后按管号自动带入。",
  od260: "浓度(ng/µL) = A260 × 系数 × 稀释倍数 ÷ 光程(cm)，系数 dsDNA 50 / ssDNA 33 / RNA 40。A260/280 ≈ 1.8（DNA）/ 2.0（RNA）为纯；A260/230 反映盐和有机物残留。填长度时给出拷贝数/µL。",
  serial: "按目标浓度驱动：给出起止浓度 + 管数（等比梯度），或直接列出各管目标浓度。每管都从母液平行稀释：取母液 = V × 目标 / 母液，补稀释剂 = V − 取母液。生成的方案可供 CFU 联动。",
  mw: "化学式按原子量求和，支持括号与结晶水；核酸按平均残基量估算（dsDNA 660 / ssDNA 330 / RNA 340 Da 每 bp 或 nt）；蛋白按氨基酸残基量求和 + 18.02（水）。",
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
      <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><Timer size={13} className="text-indigo-600" />秒表<HelpTip text={`${HELP.stopwatch}\n\n${DRAG_TIP}`} className="ml-auto" /></div>
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
          if (r <= 1) {
            setRunning(false); setDone(true); clearInterval(iv.current);
            // 人可能在别的页面：发系统通知（工具箱现在常驻挂载，倒计时切页也不会停）
            invoke("send_notification", { title: "BioLab · 倒计时结束", body: "工具箱里的倒计时时间到了" }).catch(() => {});
            return 0;
          }
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
      <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><AlarmClock size={13} className="text-rose-600" />倒计时<HelpTip text={`${HELP.countdown}\n\n${DRAG_TIP}`} className="ml-auto" /></div>
      <div className={`${DISPLAY} ${done ? "text-rose-600 animate-pulse" : "text-gray-800"}`}>{fmtTime(remain)}</div>
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
        <button onClick={() => {
          // 结束后（剩 0）直接点开始 = 按设定时长重新计时，不用先按重置
          if (remain <= 0) { if (preset > 0) { setRemain(preset); setDone(false); setRunning(true); } return; }
          setRunning(!running); setDone(false);
        }} className={`${PRIMARY_BTN} ${running ? "bg-amber-500 hover:bg-amber-600" : "bg-rose-600 hover:bg-rose-700"}`}>
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
        <HelpTip text={`${HELP.cell}\n\n${DRAG_TIP}`} />
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
// 两种视图，用户随时切换（选择持久化到 toolPrefs）：
//   「单个工具」左侧列表 + 右侧只显示选中的工具，适合专注用一个
//   「工作台」  原来的磁贴网格：多个工具同屏，长按空白处拖动排序，每张可切整栏 / 半栏
// 两种视图共用同一个顺序（order）；左侧列表也能长按拖动排序。
// 另外可以收藏（置顶到「常用」）和隐藏（收进「已隐藏」，随时恢复）。
// 所有工具始终只挂载一份，切视图 / 切工具 / 切页面都不丢输入，秒表倒计时也不停。
const META = {
  stopwatch: ["秒表", Timer], countdown: ["倒计时", AlarmClock],
  cell: ["细胞计数器", Grid3X3], hemo: ["血球计数板", Microscope], cfu: ["CFU 计算", TestTubes],
  dilution: ["浓度稀释", Beaker], mix: ["混合配比", FlaskConical], serial: ["梯度稀释", Layers],
  assembly: ["组装配比", Dna], od260: ["OD260 定量", Sigma], mw: ["分子量", Atom],
};

export default function ToolsView({ prefs, setPrefs }) {
  const p = { ...DEFAULT_TOOL_PREFS, ...(prefs || {}) };
  const setP = (patch) => setPrefs && setPrefs((prev) => ({ ...DEFAULT_TOOL_PREFS, ...(prev || {}), ...patch }));
  const order = [...(p.order || []).filter((id) => TOOL_IDS.includes(id)), ...TOOL_IDS.filter((id) => !(p.order || []).includes(id))];
  const fav = new Set(p.fav || []);
  const hid = new Set(p.hidden || []);
  const view = p.view === "grid" ? "grid" : "single"; // 默认单个工具（owner 认可列表版），工作台可选
  const shownOrder = [...order.filter((id) => fav.has(id) && !hid.has(id)), ...order.filter((id) => !fav.has(id) && !hid.has(id))];
  const sel = shownOrder.includes(p.sel) ? p.sel : shownOrder[0];
  const [showHidden, setShowHidden] = useState(false);

  // 在「看到的顺序」上重排（收藏置顶后，底层 order 和显示顺序不一致，直接改 order 会出现拖了没反应 / 乱跳）。
  // 拖进「常用」区（目标是收藏项）就自动收藏，拖出来就取消收藏，所见即所得。
  const reorder = (from, to, pos) => {
    const next = arrayReorder(shownOrder, from, to, pos, (x) => x);
    const nextFav = fav.has(to) ? [...new Set([...fav, from])] : [...fav].filter((x) => x !== from);
    const favSet = new Set(nextFav);
    setP({
      order: [...next.filter((id) => favSet.has(id)), ...next.filter((id) => !favSet.has(id)), ...order.filter((id) => hid.has(id))],
      fav: nextFav,
    });
  };
  const listDrag = useLongPressDrag(reorder, { axis: "y" });
  const gridDrag = useLongPressDrag(reorder, { axis: "auto" });

  const toggleFav = (id) => setP({ fav: fav.has(id) ? [...fav].filter((x) => x !== id) : [...fav, id] });
  const toggleHide = (id) => setP({ hidden: hid.has(id) ? [...hid].filter((x) => x !== id) : [...hid, id] });
  const wideSet = new Set(p.wide || []);
  const gridRef = useRef(null);
  const [gridW, setGridW] = useState(900);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setGridW(el.clientWidth));
    ro.observe(el);
    setGridW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const twoCol = gridW >= 640; // 每列 ≥ 310px 才排两列，否则半栏卡片里的输入框放不下
  const toggleWide = (id) => setP({ wide: wideSet.has(id) ? (p.wide || []).filter((x) => x !== id) : [...(p.wide || []), id] });
  const pick = (id) => {
    setP({ sel: id });
    if (view === "grid") document.getElementById(`tool-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const cards = {
    stopwatch: <Stopwatch />,
    countdown: <Countdown />,
    cell: <CellCounter />,
    dilution: <DilutionCalc solvent={p.solvent} onSolvent={(v) => setP({ solvent: v })} help={`${HELP.dilution}\n\n${DRAG_TIP}`} />,
    mix: <MixCalc filler={p.filler} onFiller={(v) => setP({ filler: v })} help={`${HELP.mix}\n\n${DRAG_TIP}`} />,
    assembly: <AssemblyCalc help={`${HELP.assembly}\n\n${DRAG_TIP}`} />,
    hemo: <HemoCalc help={`${HELP.hemo}\n\n${DRAG_TIP}`} />,
    cfu: <CfuCalc help={`${HELP.cfu}\n\n${DRAG_TIP}`} scheme={p.scheme} linked={!!p.cfuLink} onLinked={(v) => setP({ cfuLink: v })} />,
    od260: <Od260Calc help={`${HELP.od260}\n\n${DRAG_TIP}`} />,
    serial: <SerialDilCalc help={`${HELP.serial}\n\n${DRAG_TIP}`} onScheme={(s) => setP({ scheme: s })} />,
    mw: <MwCalc help={`${HELP.mw}\n\n${DRAG_TIP}`} />,
  };

  const iconAct = "p-0.5 rounded text-gray-300 hover:text-gray-600";
  const item = (id) => {
    const [label, I] = META[id];
    const on = view === "single" && sel === id;
    const isOver = listDrag.over && listDrag.over.id === id && listDrag.dragId !== id;
    return (
      <div key={id} data-drag-id={id} role="button" tabIndex={0} aria-current={on ? "page" : undefined}
        onPointerDown={(e) => listDrag.onPointerDown(e, id)} onClick={() => pick(id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(id); } }}
        className={`group relative mx-1.5 px-2.5 py-1.5 rounded-md flex items-center gap-2.5 text-[12.5px] select-none cursor-default ${on ? "bg-indigo-600 text-white font-semibold" : "text-gray-700 hover:bg-gray-50"} ${listDrag.dragId === id ? "lpd-dragging" : ""}`}>
        {isOver && <div className={`absolute left-2 right-2 h-[2px] rounded-full bg-indigo-500 ${listDrag.over.pos === "before" ? "-top-px" : "-bottom-px"}`} />}
        <I size={14} className={on ? "" : "text-gray-400"} />
        <span className="flex-1 truncate">{label}</span>
        <span data-no-drag className={`flex items-center gap-0.5 ${fav.has(id) ? "" : "opacity-0 group-hover:opacity-100"}`}>
          <span role="button" title={fav.has(id) ? "取消收藏" : "收藏到「常用」"} onClick={(e) => { e.stopPropagation(); toggleFav(id); }}
            className={`${iconAct} ${on ? "!text-white/80 hover:!text-white" : ""} ${fav.has(id) ? "!text-amber-400" : ""}`}><Star size={12} fill={fav.has(id) ? "currentColor" : "none"} /></span>
          <span role="button" title="隐藏这个工具" onClick={(e) => { e.stopPropagation(); toggleHide(id); }}
            className={`${iconAct} ${on ? "!text-white/80 hover:!text-white" : ""} opacity-0 group-hover:opacity-100`}><EyeOff size={12} /></span>
        </span>
      </div>
    );
  };

  const favList = shownOrder.filter((id) => fav.has(id));
  const restList = shownOrder.filter((id) => !fav.has(id));
  const hiddenList = order.filter((id) => hid.has(id));

  return (
    <div className="h-full min-h-[420px] flex gap-4">
      <div className="w-[196px] flex-shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="p-2 border-b border-gray-100">
          <div className="flex p-0.5 rounded-lg bg-gray-100 text-[11.5px]" role="tablist" aria-label="工具箱视图">
            {[["single", "单个工具", Square], ["grid", "工作台", LayoutGrid]].map(([k, l, I]) => (
              <button key={k} role="tab" aria-selected={view === k} onClick={() => setP({ view: k })}
                className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md ${view === k ? "bg-white text-gray-800 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-700"}`}><I size={12} />{l}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2" data-drag-scope>
          {favList.length > 0 && (
            <>
              <div className="px-3.5 pb-1 text-[10.5px] font-semibold text-gray-400">常用</div>
              {favList.map(item)}
              <div className="mx-3.5 my-2 border-t border-gray-100" />
            </>
          )}
          <div className="px-3.5 pb-1 text-[10.5px] font-semibold text-gray-400">{favList.length ? "其他工具" : "全部工具"}</div>
          {restList.map(item)}
          {hiddenList.length > 0 && (
            <div className="mt-2">
              <button onClick={() => setShowHidden((v) => !v)} className="w-full px-3.5 py-1 text-left text-[10.5px] font-semibold text-gray-400 hover:text-gray-600 flex items-center gap-1">
                {showHidden ? <ChevronDown size={11} /> : <ChevronRight size={11} />}已隐藏 {hiddenList.length}
              </button>
              {showHidden && hiddenList.map((id) => {
                const [label, I] = META[id];
                return (
                  <div key={id} className="mx-1.5 px-2.5 py-1 rounded-md flex items-center gap-2.5 text-[12px] text-gray-400">
                    <I size={13} /><span className="flex-1 truncate">{label}</span>
                    <button onClick={() => toggleHide(id)} className="p-0.5 rounded hover:text-indigo-600" title="恢复显示"><Eye size={12} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-3 py-1.5 border-t border-gray-100 text-[10px] text-gray-300 text-center leading-relaxed">长按拖动排序 · ☆ 收藏置顶 · 悬停可隐藏</div>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto">
        {shownOrder.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center bg-white rounded-xl border border-dashed border-gray-300">
            <p className="text-sm text-gray-500">所有工具都被隐藏了</p>
            <button onClick={() => setP({ hidden: [] })} className="mt-2 text-xs text-indigo-600 hover:underline">全部恢复显示</button>
          </div>
        )}
        {/* 列数按网格自己的宽度定，不用 md: 媒体查询：右侧今日面板（日历）展开时内容区只剩一半宽，
            媒体查询看的是窗口宽度，仍然排两列，半栏卡片被挤到 150px，输入框溢出成一格一格的伪影。
            现在宽度不够两列就整体改单列，侧栏保持完整不动 */}
        <div ref={gridRef} data-drag-scope className={view === "grid" ? "tools-grid grid gap-3.5 pt-2 pr-2" : ""}
          style={view === "grid" ? { gridTemplateColumns: twoCol ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)" } : undefined}>
          {shownOrder.map((id) => {
            const visible = view === "grid" || id === sel;
            const narrow = id === "stopwatch" || id === "countdown" || id === "cell";
            return (
              <div key={id} id={`tool-${id}`} hidden={!visible} data-drag-id={view === "grid" ? id : undefined}
                onPointerDown={view === "grid" ? (e) => gridDrag.onPointerDown(e, id) : undefined}
                className={view === "grid"
                  ? `relative ${gridDrag.dragId === id ? "lpd-dragging" : ""} ${sel === id ? "tool-focus" : ""}`
                  : `${narrow ? "max-w-[520px]" : "max-w-[860px]"}`}
                style={view === "grid" && twoCol && wideSet.has(id) ? { gridColumn: "span 2" } : undefined}>
                {view === "grid" && twoCol && (
                  <button onClick={() => toggleWide(id)} data-no-drag title={wideSet.has(id) ? "改为半栏" : "改为整栏"}
                    className="absolute -top-2 -right-2 z-20 p-1 rounded-full border border-gray-200 bg-white text-gray-500 hover:text-indigo-600 shadow">
                    {wideSet.has(id) ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  </button>
                )}
                {cards[id]}
                {/* 单个工具：卡片下方展开完整操作说明（工作台网格里只留卡片右上角的小问号，不占地方） */}
                {view !== "grid" && id === sel && HELP[id] && (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-white/70 px-4 py-3">
                    <div className="text-[11px] font-semibold text-gray-500 mb-1">操作说明</div>
                    <div className="text-[12px] leading-relaxed text-gray-600 whitespace-pre-line">{HELP[id]}</div>
                    <div className="text-[10.5px] text-gray-400 mt-2">{DRAG_TIP} 完整原理与公式见项目文档 docs/tools.md。</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
