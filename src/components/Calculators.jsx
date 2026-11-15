// ==================== 工具箱：浓度稀释计算器 / 多组分混合配比计算器 ====================
// 主题适配：仅使用 index.css 已有 .theme-rhine 覆盖的 Tailwind 类词汇
// （pixel-panel / text-gray-* / border-gray-200 / bg-gray-50 / bg-*-50 / 饱和按钮色 / 全局 input）。
// 打印区使用 rhine-exempt 保证所有主题下浅底黑字。导出走 save_text_file（WebView2 无 anchor 下载）。
// 溶剂/补液名称可自定义（持久化于 toolPrefs）；稀释计算器不提供打印（仅混合配比打印）。
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FlaskConical, Beaker, Printer, Download, Smartphone, Plus, Trash2, Calculator } from "lucide-react";
import { toast } from "../lib/core";
import HelpTip from "./HelpTip";
import { CONC_UNITS, MASS_UNITS, VOL_UNITS, dilution, mix, fmtVol, fmtMass, dilutionToCSV, mixToCSV } from "../lib/calc";
import { pushToPhone, mixToText } from "../lib/push";

const BTN = "px-3 py-1.5 text-xs font-medium rounded-lg text-white transition flex items-center gap-1";
const GHOST = "px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition flex items-center gap-1";
const INP = "px-2 py-1 text-xs border border-gray-200 rounded-md";
const SEL = "px-1.5 py-1 text-xs border border-gray-200 rounded-md";
const LBL = "text-[10px] text-gray-500";

const concKeys = Object.keys(CONC_UNITS);
const massKeys = Object.keys(MASS_UNITS);
const volKeys = Object.keys(VOL_UNITS);

export async function saveCSV(name, content) {
  try {
    await invoke("save_text_file", { title: "导出计算结果", defaultName: name, content });
    toast("已导出 CSV", "success");
  } catch (e) {
    toast("导出失败：" + (e?.message || e), "error");
  }
}

// ---------- 结果操作条：导出 / 打印(可选) / 推送(预留) ----------
export function ResultActions({ onCSV, onPrint, pushText, pushTitle }) {
  const [webhook, setWebhook] = useState("");
  const [showCfg, setShowCfg] = useState(false);
  const doPush = async () => {
    const r = await pushToPhone({ title: pushTitle, text: pushText }, { webhook });
    if (r.reserved) { setShowCfg(true); toast(r.message, "info"); }
    else if (r.ok) toast("已推送到手机", "success");
    else toast(r.message, "error");
  };
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button onClick={onCSV} className={GHOST}><Download size={13} />导出CSV</button>
        {onPrint && <button onClick={onPrint} className={GHOST}><Printer size={13} />打印</button>}
        <button onClick={doPush} className={GHOST}><Smartphone size={13} />推送到手机</button>
      </div>
      {showCfg && (
        <div className="flex items-center gap-1.5">
          <input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="预留：钉钉/飞书机器人 webhook URL" className={`${INP} flex-1 min-w-0`} />
          <button onClick={doPush} className={`${BTN} bg-indigo-600 hover:bg-indigo-700`}>发送</button>
        </div>
      )}
    </div>
  );
}

// ---------- 浓度稀释计算器 ----------
export function DilutionCalc({ solvent = "水", onSolvent, help }) {
  const [f, setF] = useState({ c1: 1, u1: "M", c2: 50, u2: "mM", v2: 50, uV: "mL" });
  const [res, setRes] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const calc = () => {
    const r = dilution(f);
    if (!r.ok) { toast(r.error, "error"); setRes(null); return; }
    setRes(r);
  };
  const sol = solvent || "水";
  return (
    <div className="pixel-panel p-3 h-full">
      <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><FlaskConical size={13} className="text-indigo-600" />浓度稀释计算器
        <span className="ml-auto text-[10px] text-gray-400">C₁V₁ = C₂V₂</span>{help && <HelpTip text={help} />}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <label className="block"><span className={LBL}>母液浓度 C₁</span>
          <div className="flex gap-1"><input type="number" step="any" value={f.c1} onChange={(e) => set("c1", e.target.value)} className={`${INP} w-full`} /><select value={f.u1} onChange={(e) => set("u1", e.target.value)} className={SEL}>{concKeys.map((u) => <option key={u}>{u}</option>)}</select></div>
        </label>
        <label className="block"><span className={LBL}>目标浓度 C₂</span>
          <div className="flex gap-1"><input type="number" step="any" value={f.c2} onChange={(e) => set("c2", e.target.value)} className={`${INP} w-full`} /><select value={f.u2} onChange={(e) => set("u2", e.target.value)} className={SEL}>{concKeys.map((u) => <option key={u}>{u}</option>)}</select></div>
        </label>
        <label className="block"><span className={LBL}>终体积 V₂</span>
          <div className="flex gap-1"><input type="number" step="any" value={f.v2} onChange={(e) => set("v2", e.target.value)} className={`${INP} w-full`} /><select value={f.uV} onChange={(e) => set("uV", e.target.value)} className={SEL}>{volKeys.map((u) => <option key={u}>{u}</option>)}</select></div>
        </label>
        <label className="block"><span className={LBL}>溶剂名称（自定义）</span>
          <input value={solvent} onChange={(e) => onSolvent && onSolvent(e.target.value)} placeholder="水 / PBS / TE…" className={`${INP} w-full`} />
        </label>
      </div>
      <button onClick={calc} className={`${BTN} bg-indigo-600 hover:bg-indigo-700 mt-2`}><Calculator size={13} />计算</button>
      {res && (
        <div className="mt-2 bg-emerald-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-700 space-y-0.5">
          <div className="flex justify-between"><span>取母液体积 V₁</span><b className="text-emerald-600 tabular-nums">{fmtVol(res.v1_mL)}</b></div>
          <div className="flex justify-between"><span>加{sol}</span><b className="text-emerald-600 tabular-nums">{fmtVol(res.diluent_mL)}</b></div>
          {res.mass_mg != null && <div className="flex justify-between"><span>溶质质量</span><b className="tabular-nums">{fmtMass(res.mass_mg)}</b></div>}
        </div>
      )}
      {res && <ResultActions onCSV={() => saveCSV(`稀释计算_${Date.now()}.csv`, dilutionToCSV(res, f, sol))} pushTitle="BioLab 稀释计算" pushText={`取母液 ${fmtVol(res.v1_mL)}，加${sol} ${fmtVol(res.diluent_mL)}，终体积 ${f.v2} ${f.uV}`} />}
    </div>
  );
}

// ---------- 多组分混合配比计算器 ----------
let mixRowId = 100;
const newRow = () => ({ id: mixRowId++, name: `组分 ${mixRowId - 100}`, targetMode: "conc", targetValue: "", targetUnit: "mM", stockMode: "solution", stockValue: "", stockUnit: "M" });

export function MixCalc({ filler = "水", onFiller, help }) {
  const [vFinal, setVFinal] = useState(50);
  const [uV, setUV] = useState("mL");
  const [rows, setRows] = useState([
    { id: 1, name: "Tris", targetMode: "conc", targetValue: 50, targetUnit: "mM", stockMode: "solution", stockValue: 1, stockUnit: "M" },
    { id: 2, name: "NaCl", targetMode: "conc", targetValue: 150, targetUnit: "mM", stockMode: "solution", stockValue: 5, stockUnit: "M" },
  ]);
  const [res, setRes] = useState(null);
  const upd = (id, k, v) => setRows((p) => p.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  const calc = () => {
    const r = mix({ rows, vFinal, uV });
    if (!r.ok) { toast(r.error, "error"); setRes(null); return; }
    setRes(r);
    if (r.warnings.length) toast(r.warnings[0], "error");
  };
  const targetUnits = (r) => (r.targetMode === "mass" ? massKeys : concKeys);
  const fill = filler || "水";
  return (
    <div className="pixel-panel p-3 h-full">
      <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><Beaker size={13} className="text-cyan-600" />混合液配比计算器
        <span className="ml-auto text-[10px] text-gray-400">多组分 · 自动算补液</span>{help && <HelpTip text={help} />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className={LBL}>终体积</span>
        <input type="number" step="any" value={vFinal} onChange={(e) => setVFinal(e.target.value)} className={`${INP} w-24`} />
        <select value={uV} onChange={(e) => setUV(e.target.value)} className={SEL}>{volKeys.map((u) => <option key={u}>{u}</option>)}</select>
        <span className={`${LBL} ml-2`}>补液名称</span>
        <input value={filler} onChange={(e) => onFiller && onFiller(e.target.value)} placeholder="水 / PBS…" className={`${INP} w-24`} />
        <button onClick={() => setRows((p) => [...p, newRow()])} className={`${GHOST} ml-auto`}><Plus size={13} />加组分</button>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.id} className="border border-gray-200 rounded-lg p-1.5 bg-gray-50">
            <div className="flex items-center gap-1 mb-1">
              <input value={r.name} onChange={(e) => upd(r.id, "name", e.target.value)} className={`${INP} flex-1 min-w-0`} />
              <button onClick={() => setRows((p) => p.filter((x) => x.id !== r.id))} aria-label="删除组分" className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="flex gap-1 items-center">
                <span className={LBL}>需</span>
                <select value={r.targetMode} onChange={(e) => upd(r.id, "targetMode", e.target.value)} className={SEL}><option value="conc">浓度</option><option value="mass">质量</option></select>
                <input type="number" step="any" value={r.targetValue} onChange={(e) => upd(r.id, "targetValue", e.target.value)} className={`${INP} w-full`} />
                <select value={r.targetUnit} onChange={(e) => upd(r.id, "targetUnit", e.target.value)} className={SEL}>{targetUnits(r).map((u) => <option key={u}>{u}</option>)}</select>
              </div>
              <div className="flex gap-1 items-center">
                <span className={LBL}>母</span>
                <select value={r.stockMode} onChange={(e) => upd(r.id, "stockMode", e.target.value)} className={SEL}><option value="solution">溶液</option><option value="solid">固体</option></select>
                {r.stockMode === "solution" ? (<>
                  <input type="number" step="any" value={r.stockValue} onChange={(e) => upd(r.id, "stockValue", e.target.value)} className={`${INP} w-full`} />
                  <select value={r.stockUnit} onChange={(e) => upd(r.id, "stockUnit", e.target.value)} className={SEL}>{concKeys.map((u) => <option key={u}>{u}</option>)}</select>
                </>) : <span className="text-[10px] text-gray-400">纯固体，直接称取</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={calc} className={`${BTN} bg-cyan-600 hover:bg-cyan-700 mt-2`}><Calculator size={13} />计算配比</button>
      {res && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[11px] text-gray-700 border border-gray-200 rounded-lg">
            <thead><tr className="bg-gray-50 text-gray-600">
              <th className="text-left px-1.5 py-1">组分</th><th className="text-left px-1.5 py-1">目标</th><th className="text-left px-1.5 py-1">母液</th><th className="text-right px-1.5 py-1">取用</th><th className="text-left px-1.5 py-1">备注</th>
            </tr></thead>
            <tbody>
              {res.rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-200">
                  <td className="px-1.5 py-1">{r.name}</td>
                  <td className="px-1.5 py-1 tabular-nums">{r.targetValue} {r.targetUnit}{r.targetMode === "mass" ? "(质量)" : ""}</td>
                  <td className="px-1.5 py-1 tabular-nums">{r.stockMode === "solid" ? "固体" : `${r.stockValue} ${r.stockUnit}`}</td>
                  <td className="px-1.5 py-1 text-right font-bold text-cyan-600 tabular-nums">{r.take_mL > 0 ? fmtVol(r.take_mL) : r.take_mg != null ? fmtMass(r.take_mg) : "—"}</td>
                  <td className="px-1.5 py-1 text-gray-500">{r.note}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-200 bg-emerald-50">
                <td className="px-1.5 py-1 font-bold">补{fill}</td><td></td><td></td>
                <td className={`px-1.5 py-1 text-right font-bold tabular-nums ${res.filler_mL < 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmtVol(res.filler_mL)}</td>
                <td className="px-1.5 py-1 text-gray-500">{res.filler_mL < 0 ? "超体积!" : "自动补足"}</td>
              </tr>
              <tr className="border-t border-gray-200"><td className="px-1.5 py-1 font-bold">终体积</td><td></td><td></td><td className="px-1.5 py-1 text-right font-bold tabular-nums">{fmtVol(res.total_mL)}</td><td></td></tr>
            </tbody>
          </table>
        </div>
      )}
      {res && <ResultActions onCSV={() => saveCSV(`混合配比_${Date.now()}.csv`, mixToCSV(res, uV, `补${fill}`))} onPrint={() => window.print()} pushTitle="BioLab 混合配比" pushText={mixToText(res, `补${fill}`)} />}
      {res && (
        <div className="print-area rhine-exempt">
          <h3>BioLab 混合液配比（终体积 {fmtVol(res.total_mL)}）</h3>
          <table>
            <thead><tr><th>组分</th><th>目标</th><th>母液</th><th>取用</th><th>备注</th></tr></thead>
            <tbody>
              {res.rows.map((r) => (
                <tr key={r.id}><td>{r.name}</td><td>{r.targetValue} {r.targetUnit}</td><td>{r.stockMode === "solid" ? "固体" : `${r.stockValue} ${r.stockUnit}`}</td><td>{r.take_mL > 0 ? fmtVol(r.take_mL) : r.take_mg != null ? fmtMass(r.take_mg) : "—"}</td><td>{r.note}</td></tr>
              ))}
              <tr><td>补{fill}</td><td></td><td></td><td>{fmtVol(res.filler_mL)}</td><td>{res.filler_mL < 0 ? "超体积!" : ""}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
