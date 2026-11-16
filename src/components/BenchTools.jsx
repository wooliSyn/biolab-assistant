// ==================== 台边工具：组装配比 / 血球计数 / CFU / OD260 / 梯度稀释 / 分子量 ====================
// 主题适配：仅用 index.css 已覆盖的 Tailwind 类词汇；打印区 rhine-exempt。
import { useState } from "react";
import { Dna, Microscope, CircleDot, Waves, ListOrdered, Atom, Plus, Trash2, Calculator, Link2 } from "lucide-react";
import { toast } from "../lib/core";
import HelpTip from "./HelpTip";
import { saveCSV, ResultActions } from "./Calculators";
import { ASSEMBLY_PRESETS, assembly, hemocytometer, cfu, od260, serialDilution, formulaMW, seqMW, tableCSV, fmtNum } from "../lib/bench";

const BTN = "px-3 py-1.5 text-xs font-medium rounded-lg text-white transition flex items-center gap-1";
const GHOST = "px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition flex items-center gap-1";
const INP = "px-2 py-1 text-xs border border-gray-200 rounded-md";
const SEL = "px-1.5 py-1 text-xs border border-gray-200 rounded-md";
const LBL = "text-[10px] text-gray-500";
const TH = "text-left px-1.5 py-1";
const TD = "px-1.5 py-1";

const Num = ({ v, on, w = "w-full", ph }) => (
  <input type="number" step="any" min="0" value={v} placeholder={ph} onChange={(e) => on(e.target.value)} className={`${INP} ${w}`} />
);
const Head = ({ icon: Icon, color, title, sub, help }) => (
  <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
    <Icon size={13} className={color} />{title}
    {sub && <span className="ml-auto text-[10px] text-gray-400">{sub}</span>}
    {help && <HelpTip text={help} />}
  </div>
);
const ResultBox = ({ children }) => (
  <div className="mt-2 bg-emerald-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-700 space-y-0.5">{children}</div>
);
const KV = ({ k, v, accent = "text-emerald-600" }) => (
  <div className="flex justify-between"><span>{k}</span><b className={`${accent} tabular-nums`}>{v}</b></div>
);

// ---------- 1. Seamless / Gibson 组装片段配比（只输出 µL） ----------
let insId = 10;
export function AssemblyCalc({ help }) {
  const [preset, setPreset] = useState("gibson");
  const [cfg, setCfg] = useState({ ...ASSEMBLY_PRESETS[0] });
  const [vector, setVector] = useState({ bp: 5000, conc: 100 });
  const [inserts, setInserts] = useState([{ id: 1, name: "插入 1", bp: 1000, conc: 50 }]);
  const [res, setRes] = useState(null);
  const applyPreset = (id) => { setPreset(id); setCfg({ ...ASSEMBLY_PRESETS.find((x) => x.id === id) }); };
  const calc = () => {
    const r = assembly({ vector, inserts, cfg });
    if (!r.ok) { toast(r.error, "error"); setRes(null); return; }
    setRes(r); if (r.warnings.length) toast(r.warnings[0], "error");
  };
  const csv = () => saveCSV(`组装配比_${Date.now()}.csv`, tableCSV(["组分", "µL"],
    [...res.rows.map((r) => [r.name, fmtNum(r.vol)]), ["Master Mix", fmtNum(res.mix)], ["总体积", fmtNum(res.total)]]));
  const pushText = res ? res.rows.map((r) => `${r.name}: ${fmtNum(r.vol)} µL`).join("\n") + `\nMaster Mix ${fmtNum(res.mix)} µL\n总 ${fmtNum(res.total)} µL` : "";
  return (
    <div className="pixel-panel p-3 h-full">
      <Head icon={Dna} color="text-indigo-600" title="质粒组装配比" sub="Seamless / Gibson" help={help} />
      <div className="text-[10px] text-gray-500 mb-1.5 leading-relaxed">Mix = 总体积 ÷ 倍数（2× 占一半）；剩余体积按载体/片段的 bp 与浓度自动分配，插入:载体默认 3:1 摩尔比。只输出各需 µL。</div>
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <select value={preset} onChange={(e) => applyPreset(e.target.value)} className={SEL}>{ASSEMBLY_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-1.5">
        <label className="block"><span className={LBL}>插入:载体摩尔比</span><Num v={cfg.ratio} on={(v) => setCfg((c) => ({ ...c, ratio: v }))} /></label>
        <label className="block"><span className={LBL}>反应总体积 (µL)</span><Num v={cfg.vol} on={(v) => setCfg((c) => ({ ...c, vol: v }))} /></label>
        <label className="block"><span className={LBL}>Mix 倍数 (2×=占一半)</span><Num v={cfg.mixFactor} on={(v) => setCfg((c) => ({ ...c, mixFactor: v }))} /></label>
        <label className="block"><span className={LBL}>载体长度 (bp)</span><Num v={vector.bp} on={(v) => setVector((s) => ({ ...s, bp: v }))} /></label>
        <label className="block col-span-2"><span className={LBL}>载体浓度 (ng/µL)</span><Num v={vector.conc} on={(v) => setVector((s) => ({ ...s, conc: v }))} /></label>
      </div>
      <div className="space-y-1">
        {inserts.map((r) => (
          <div key={r.id} className="flex items-center gap-1 border border-gray-200 rounded-lg p-1 bg-gray-50">
            <input value={r.name} onChange={(e) => setInserts((p) => p.map((x) => x.id === r.id ? { ...x, name: e.target.value } : x))} className={`${INP} w-24`} />
            <span className={LBL}>bp</span><Num v={r.bp} on={(v) => setInserts((p) => p.map((x) => x.id === r.id ? { ...x, bp: v } : x))} w="w-20" />
            <span className={LBL}>ng/µL</span><Num v={r.conc} on={(v) => setInserts((p) => p.map((x) => x.id === r.id ? { ...x, conc: v } : x))} w="w-20" />
            <button onClick={() => setInserts((p) => p.filter((x) => x.id !== r.id))} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        <button onClick={() => setInserts((p) => [...p, { id: insId++, name: `插入 ${insId - 9}`, bp: 1000, conc: 50 }])} className={GHOST}><Plus size={13} />加片段</button>
        <button onClick={calc} className={`${BTN} bg-indigo-600 hover:bg-indigo-700`}><Calculator size={13} />计算配比</button>
      </div>
      {res && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[11px] text-gray-700 border border-gray-200 rounded-lg">
            <thead><tr className="bg-gray-50 text-gray-600"><th className={TH}>组分</th><th className="text-right px-1.5 py-1">取用 µL</th></tr></thead>
            <tbody>
              {res.rows.map((r, i) => (<tr key={i} className="border-t border-gray-200"><td className={TD}>{r.name}</td><td className="text-right px-1.5 py-1 font-bold text-indigo-600 tabular-nums">{fmtNum(r.vol)}</td></tr>))}
              <tr className="border-t border-gray-200"><td className={TD}>Master Mix ({cfg.mixFactor}×)</td><td className="text-right px-1.5 py-1 font-bold tabular-nums">{fmtNum(res.mix)}</td></tr>
              <tr className="border-t border-gray-200 bg-emerald-50"><td className={`${TD} font-bold`}>总体积</td><td className="text-right px-1.5 py-1 font-bold text-emerald-600 tabular-nums">{fmtNum(res.total)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      {res && <ResultActions onCSV={csv} onPrint={() => window.print()} pushTitle="BioLab 组装配比" pushText={pushText} />}
      {res && (
        <div className="print-area rhine-exempt"><h3>BioLab 质粒组装配比（{cfg.name}，总 {fmtNum(res.total)} µL）</h3>
          <table><thead><tr><th>组分</th><th>取用 µL</th></tr></thead>
            <tbody>{res.rows.map((r, i) => <tr key={i}><td>{r.name}</td><td>{fmtNum(r.vol)}</td></tr>)}
              <tr><td>Master Mix</td><td>{fmtNum(res.mix)}</td></tr></tbody></table>
        </div>
      )}
    </div>
  );
}

// ---------- 2. 血球计数板 ----------
export function HemoCalc({ help }) {
  const [counts, setCounts] = useState(["", "", "", ""]);
  const [dil, setDil] = useState(1);
  const [tv, setTv] = useState("");
  const [res, setRes] = useState(null);
  const calc = () => { const r = hemocytometer({ counts, dilution: dil, totalVol_mL: tv }); if (!r.ok) { toast(r.error, "error"); setRes(null); return; } setRes(r); };
  return (
    <div className="pixel-panel p-3 h-full">
      <Head icon={Microscope} color="text-cyan-600" title="血球计数板" sub="cells/mL" help={help} />
      <div className="grid grid-cols-4 gap-1 mb-1.5">{counts.map((c, i) => (<label key={i} className="block"><span className={LBL}>格{i + 1}</span><Num v={c} on={(v) => setCounts((p) => p.map((x, j) => j === i ? v : x))} /></label>))}</div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={LBL}>稀释倍数</span><Num v={dil} on={setDil} w="w-16" />
        <span className={`${LBL} ml-2`}>总体积mL(选)</span><Num v={tv} on={setTv} w="w-16" />
      </div>
      <button onClick={calc} className={`${BTN} bg-cyan-600 hover:bg-cyan-700`}><Calculator size={13} />计算</button>
      {res && <ResultBox><KV k="平均/格" v={fmtNum(res.mean)} /><KV k="细胞浓度" v={`${fmtNum(res.perML)} /mL`} />{res.total != null && <KV k="总细胞数" v={fmtNum(res.total)} />}</ResultBox>}
      {res && <ResultActions onCSV={() => saveCSV(`血球计数_${Date.now()}.csv`, tableCSV(["项目", "值"], [["平均/格", fmtNum(res.mean)], ["cells/mL", fmtNum(res.perML)], ["总数", res.total == null ? "" : fmtNum(res.total)]]))} pushTitle="BioLab 血球计数" pushText={`细胞浓度 ${fmtNum(res.perML)} /mL`} />}
    </div>
  );
}

// ---------- 3. 菌落 CFU（联动稀释方案 + 自动挑可计平板） ----------
let plateId = 10;
// 联动梯度稀释是可选的（默认关）：开启且已有方案时按管号自动带稀释倍数，否则手填。
// 已联动 / 未联动用不同颜色的提示条 + 管号框描边区分，避免误以为数据来自方案。
export function CfuCalc({ help, scheme, linked = false, onLinked }) {
  const [plates, setPlates] = useState([{ id: 1, tube: "", colonies: "", plated_mL: 0.1, manualFactor: "" }]);
  const [res, setRes] = useState(null);
  const hasScheme = !!(scheme && scheme.tubes && scheme.tubes.length);
  const useScheme = linked && hasScheme;
  const calc = () => {
    const r = cfu({ plates, scheme: useScheme ? scheme : null });
    if (!r.ok) { toast(r.error, "error"); setRes(r.rows ? r : null); return; }
    setRes(r);
  };
  const upd = (id, k, v) => setPlates((p) => p.map((x) => x.id === id ? { ...x, [k]: v } : x));
  return (
    <div className="pixel-panel p-3 h-full">
      <Head icon={CircleDot} color="text-emerald-600" title="菌落 CFU" sub="30–300 可计平板取平均" help={help} />
      <div className="text-[10.5px] text-gray-500 mb-2 leading-relaxed">
        <b className="text-gray-700">CFU/mL = 菌落数 × 稀释倍数 ÷ 涂布体积(mL)</b>。例：10⁻⁴ 稀释液涂 0.1 mL 长出 150 个菌落 → 150 × 10⁴ ÷ 0.1 = 1.5 × 10⁷ CFU/mL。
        只有 30–300 个菌落的平板计入平均。
      </div>
      <label className={`flex items-center gap-2 mb-1.5 px-2 py-1.5 rounded-lg border text-[11px] cursor-pointer select-none ${useScheme ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
        <input type="checkbox" checked={linked} onChange={(e) => onLinked && onLinked(e.target.checked)} className="accent-indigo-600" />
        <Link2 size={12} className={useScheme ? "text-indigo-600" : "text-gray-400"} />
        {useScheme
          ? <span><b>已联动梯度稀释</b>：母液 {fmtNum(scheme.stock)} {scheme.unit}，共 {scheme.tubes.length} 管，选管号自动带稀释倍数</span>
          : linked
            ? <span>联动已开启，但还没有稀释方案 —— 先在「梯度稀释」里生成稀释表</span>
            : <span>未联动：稀释倍数手动填写（勾选后可从「梯度稀释」方案按管号带入）</span>}
      </label>
      <div className="space-y-1">
        {plates.map((p) => (
          <div key={p.id} className="flex items-center gap-1 border border-gray-200 rounded-lg p-1 bg-gray-50">
            {useScheme ? (
              <select value={p.tube} onChange={(e) => upd(p.id, "tube", e.target.value)} className={`${SEL} border-indigo-300 bg-indigo-50 text-indigo-700`} title="来自梯度稀释方案">
                <option value="">管号</option>
                {scheme.tubes.map((t) => <option key={t.tube} value={t.tube}>管{t.tube}（{fmtNum(t.conc)}，×{fmtNum(t.factor)}）</option>)}
              </select>
            ) : (
              <><span className={LBL}>稀释倍数</span><Num v={p.manualFactor} on={(v) => upd(p.id, "manualFactor", v)} w="w-20" ph="如 10000" /></>
            )}
            <span className={LBL}>菌落</span><Num v={p.colonies} on={(v) => upd(p.id, "colonies", v)} w="w-16" />
            <span className={LBL}>涂布mL</span><Num v={p.plated_mL} on={(v) => upd(p.id, "plated_mL", v)} w="w-16" />
            <button onClick={() => setPlates((s) => s.filter((x) => x.id !== p.id))} className="p-1 text-gray-300 hover:text-red-500" title="删除这块平板"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        <button onClick={() => setPlates((s) => [...s, { id: plateId++, tube: "", colonies: "", plated_mL: 0.1, manualFactor: "" }])} className={GHOST}><Plus size={13} />加平板</button>
        <button onClick={calc} className={`${BTN} bg-emerald-600 hover:bg-emerald-700`}><Calculator size={13} />计算</button>
      </div>
      {res && res.rows && (
        <ResultBox>
          {res.ok && <KV k={`平均 CFU/mL（${res.usedCount} 块可计平板）`} v={fmtNum(res.mean)} />}
          {res.rows.map((r, i) => (
            <div key={i} className={`flex justify-between gap-2 ${r.countable ? "" : "text-gray-400"}`}>
              <span>平板{i + 1} · {r.flag}{r.countable ? "" : "（不计入）"}</span>
              <span className="tabular-nums">{r.colonies} × {fmtNum(r.factor)} ÷ {r.plated_mL || 0.1} = <b className={r.countable ? "text-emerald-600" : ""}>{fmtNum(r.perML)}</b></span>
            </div>
          ))}
        </ResultBox>
      )}
      {res && res.ok && <ResultActions onCSV={() => saveCSV(`CFU_${Date.now()}.csv`, tableCSV(["平板", "菌落", "稀释倍数", "涂布mL", "判定", "CFU/mL"], [...res.rows.map((r, i) => [i + 1, r.colonies, fmtNum(r.factor), r.plated_mL, r.flag, fmtNum(r.perML)]), ["平均(可计)", "", "", "", "", fmtNum(res.mean)]]))} pushTitle="BioLab CFU" pushText={`平均 CFU/mL ${fmtNum(res.mean)}（${res.usedCount} 可计平板）`} />}
    </div>
  );
}

// ---------- 4. OD260 核酸定量 ----------
export function Od260Calc({ help }) {
  const [f, setF] = useState({ a260: 0.5, a280: 0.25, a230: "", dilution: 1, pathlength: 1, type: "dsDNA", length: "" });
  const [res, setRes] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const calc = () => { setRes(od260(f)); };
  return (
    <div className="pixel-panel p-3 h-full">
      <Head icon={Waves} color="text-amber-600" title="OD260 核酸定量" sub="浓度/纯度/拷贝" help={help} />
      <div className="grid grid-cols-3 gap-1 mb-1.5">
        <label className="block"><span className={LBL}>A260</span><Num v={f.a260} on={(v) => set("a260", v)} /></label>
        <label className="block"><span className={LBL}>A280</span><Num v={f.a280} on={(v) => set("a280", v)} /></label>
        <label className="block"><span className={LBL}>A230(选)</span><Num v={f.a230} on={(v) => set("a230", v)} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <select value={f.type} onChange={(e) => set("type", e.target.value)} className={SEL}><option value="dsDNA">dsDNA</option><option value="ssDNA">ssDNA</option><option value="RNA">RNA</option></select>
        <span className={LBL}>稀释</span><Num v={f.dilution} on={(v) => set("dilution", v)} w="w-14" />
        <span className={LBL}>光程cm</span><Num v={f.pathlength} on={(v) => set("pathlength", v)} w="w-14" />
        <span className={LBL}>长度bp/nt(选)</span><Num v={f.length} on={(v) => set("length", v)} w="w-20" />
      </div>
      <button onClick={calc} className={`${BTN} bg-amber-500 hover:bg-amber-600`}><Calculator size={13} />计算</button>
      {res && <ResultBox><KV k="浓度" v={`${fmtNum(res.conc_nguL)} ng/µL`} />{res.r280 != null && <KV k="A260/280" v={fmtNum(res.r280, 3)} accent={res.r280 >= 1.7 && res.r280 <= 2.1 ? "text-emerald-600" : "text-rose-600"} />}{res.r230 != null && <KV k="A260/230" v={fmtNum(res.r230, 3)} accent="text-gray-600" />}{res.copies != null && <KV k="拷贝数/µL" v={fmtNum(res.copies)} />}</ResultBox>}
      {res && <ResultActions onCSV={() => saveCSV(`OD260_${Date.now()}.csv`, tableCSV(["项目", "值"], [["ng/µL", fmtNum(res.conc_nguL)], ["A260/280", res.r280 == null ? "" : fmtNum(res.r280, 3)], ["A260/230", res.r230 == null ? "" : fmtNum(res.r230, 3)], ["copies/µL", res.copies == null ? "" : fmtNum(res.copies)]]))} pushTitle="BioLab OD260" pushText={`浓度 ${fmtNum(res.conc_nguL)} ng/µL`} />}
    </div>
  );
}

// ---------- 5. 梯度系列稀释（目标浓度驱动，产出方案供 CFU 联动） ----------
export function SerialDilCalc({ help, onScheme }) {
  const [f, setF] = useState({ stock: 100, unit: "ng/µL", mode: "range", targets: "", start: 100, end: 1.5625, count: 7, vol: 100 });
  const [res, setRes] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const calc = () => {
    const r = serialDilution(f);
    if (!r.ok) { toast(r.error, "error"); setRes(null); return; }
    setRes(r); onScheme && onScheme(r.scheme);
  };
  return (
    <div className="pixel-panel p-3 h-full">
      <Head icon={ListOrdered} color="text-rose-600" title="梯度系列稀释" sub="目标浓度驱动" help={help} />
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <span className={LBL}>母液</span><Num v={f.stock} on={(v) => set("stock", v)} w="w-16" />
        <select value={f.unit} onChange={(e) => set("unit", e.target.value)} className={SEL}><option>ng/µL</option><option>µg/µL</option><option>M</option><option>mM</option><option>µM</option><option>%</option></select>
        <span className={LBL}>每管µL</span><Num v={f.vol} on={(v) => set("vol", v)} w="w-16" />
        <select value={f.mode} onChange={(e) => set("mode", e.target.value)} className={SEL}><option value="range">范围+管数</option><option value="list">目标浓度列表</option></select>
      </div>
      {f.mode === "range" ? (
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <span className={LBL}>起</span><Num v={f.start} on={(v) => set("start", v)} w="w-16" />
          <span className={LBL}>止</span><Num v={f.end} on={(v) => set("end", v)} w="w-16" />
          <span className={LBL}>管数</span><Num v={f.count} on={(v) => set("count", v)} w="w-14" />
        </div>
      ) : (
        <textarea value={f.targets} onChange={(e) => set("targets", e.target.value)} rows={2} placeholder="各管终浓度，逗号/空格分隔，如 100,50,25,12.5" className={`${INP} w-full font-mono mb-1.5`} />
      )}
      <button onClick={calc} className={`${BTN} bg-rose-600 hover:bg-rose-700`}><Calculator size={13} />生成稀释表</button>
      {res && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[11px] text-gray-700 border border-gray-200 rounded-lg">
            <thead><tr className="bg-gray-50 text-gray-600"><th className={TH}>管</th><th className={TH}>目标浓度({res.unit})</th><th className="text-right px-1.5 py-1">取母液µL</th><th className="text-right px-1.5 py-1">补稀释剂µL</th></tr></thead>
            <tbody>{res.rows.map((r) => (<tr key={r.tube} className="border-t border-gray-200"><td className={TD}>{r.tube}</td><td className={TD}>{fmtNum(r.conc)}</td><td className="text-right px-1.5 py-1 font-bold text-rose-600 tabular-nums">{fmtNum(r.take)}</td><td className="text-right px-1.5 py-1 tabular-nums">{fmtNum(r.diluent)}</td></tr>))}</tbody>
          </table>
          <div className="text-[10px] text-gray-500 mt-1">已生成稀释方案。在「CFU 计算」里勾选「联动梯度稀释」即可按管号带入稀释倍数。</div>
        </div>
      )}
      {res && <ResultActions onCSV={() => saveCSV(`梯度稀释_${Date.now()}.csv`, tableCSV(["管", `浓度${res.unit}`, "取母液µL", "补稀释剂µL"], res.rows.map((r) => [r.tube, fmtNum(r.conc), fmtNum(r.take), fmtNum(r.diluent)])))} onPrint={() => window.print()} pushTitle="BioLab 梯度稀释" pushText={res.rows.map((r) => `管${r.tube}: ${fmtNum(r.conc)} ${res.unit} (取${fmtNum(r.take)}+补${fmtNum(r.diluent)})`).join("\n")} />}
      {res && (
        <div className="print-area rhine-exempt"><h3>BioLab 梯度稀释（母液 {fmtNum(f.stock)} {res.unit}，每管 {f.vol} µL）</h3>
          <table><thead><tr><th>管</th><th>浓度({res.unit})</th><th>取母液µL</th><th>补稀释剂µL</th></tr></thead>
            <tbody>{res.rows.map((r) => <tr key={r.tube}><td>{r.tube}</td><td>{fmtNum(r.conc)}</td><td>{fmtNum(r.take)}</td><td>{fmtNum(r.diluent)}</td></tr>)}</tbody></table>
        </div>
      )}
    </div>
  );
}

// ---------- 6. 分子量 ----------
export function MwCalc({ help }) {
  const [mode, setMode] = useState("dsDNA");
  const [seq, setSeq] = useState("");
  const [res, setRes] = useState(null);
  const calc = () => {
    const r = mode === "formula" ? formulaMW(seq) : seqMW({ mode, seq });
    if (!r.ok) { toast(r.error, "error"); setRes(null); return; }
    setRes(r);
  };
  return (
    <div className="pixel-panel p-3 h-full">
      <Head icon={Atom} color="text-indigo-600" title="分子量计算器" sub="化学式/序列" help={help} />
      <div className="flex items-center gap-1.5 mb-1.5">
        <select value={mode} onChange={(e) => { setMode(e.target.value); setRes(null); }} className={SEL}>
          <option value="formula">化学式</option><option value="dsDNA">dsDNA</option><option value="ssDNA">ssDNA</option><option value="RNA">RNA</option><option value="protein">蛋白</option>
        </select>
        <span className="text-[10px] text-gray-400">{mode === "formula" ? "如 C6H12O6 / Ca(OH)2" : mode === "protein" ? "单字母氨基酸序列" : "碱基序列"}</span>
      </div>
      <textarea value={seq} onChange={(e) => setSeq(e.target.value)} rows={2} placeholder={mode === "formula" ? "C6H12O6" : "ATCG… / 氨基酸单字母"} className={`${INP} w-full font-mono`} />
      <button onClick={calc} className={`${BTN} bg-indigo-600 hover:bg-indigo-700 mt-1.5`}><Calculator size={13} />计算 MW</button>
      {res && <ResultBox><KV k="分子量" v={`${fmtNum(res.mw, 6)} Da`} />{res.n != null && <KV k={mode === "protein" ? "残基数" : "长度"} v={res.n} accent="text-gray-600" />}{res.approx && <div className="text-[10px] text-gray-500">核酸按平均残基量估算（dsDNA 660/bp、ssDNA 330/nt、RNA 340/nt）</div>}</ResultBox>}
      {res && <ResultActions onCSV={() => saveCSV(`分子量_${Date.now()}.csv`, tableCSV(["模式", "输入", "MW(Da)"], [[mode, seq, fmtNum(res.mw, 6)]]))} pushTitle="BioLab 分子量" pushText={`MW ${fmtNum(res.mw, 6)} Da`} />}
    </div>
  );
}
