// ==================== 台边计算：组装配比 / 血球计数 / CFU / OD260 / 梯度稀释 / 分子量 ====================
// 纯函数，无 DOM/Tauri 依赖，便于单测。体积 µL、质量 ng、浓度 ng/µL、摩尔 pmol。

// dsDNA 每 bp 平均 660 g/mol → 1 pmol 的 ng 数 = 0.66 × bp
export const ngPerPmol = (bp) => 0.66 * bp;
export const pmolFromNg = (ng, bp) => ng / ngPerPmol(bp);

// ---------- 1. Seamless / Gibson 组装片段配比 ----------
export const ASSEMBLY_PRESETS = [
  { id: "gibson", name: "Gibson (NEB E2611)", ratio: 2, vectorPmol: 0.05, vol: 20, mix: 10 },
  { id: "hifi", name: "NEBuilder HiFi (E2621)", ratio: 2, vectorPmol: 0.05, vol: 20, mix: 10 },
  { id: "clonexpress", name: "ClonExpress II (Vazyme C112)", ratio: 2, vectorPmol: 0.02, vol: 10, mix: 5 },
  { id: "infusion", name: "In-Fusion (Takara)", ratio: 2, vectorPmol: 0.03, vol: 10, mix: 2 },
  { id: "custom", name: "自定义", ratio: 2, vectorPmol: 0.05, vol: 20, mix: 10 },
];
// vector {bp, conc}, inserts [{name,bp,conc}], cfg {ratio, vectorPmol, vol, mix}
export function assembly({ vector, inserts, cfg }) {
  const V = +cfg.vol, mix = +cfg.mix, ratio = +cfg.ratio, vPmol = +cfg.vectorPmol;
  if (!(V > 0) || !(vPmol > 0)) return { ok: false, error: "反应体积与载体摩尔量需>0" };
  const rows = [];
  const vNg = vPmol * ngPerPmol(+vector.bp);
  const vVol = vNg / (+vector.conc || NaN);
  rows.push({ name: "载体 vector", bp: +vector.bp, conc: +vector.conc, pmol: vPmol, ng: vNg, vol: vVol });
  for (const ins of inserts) {
    const p = vPmol * ratio;
    const ng = p * ngPerPmol(+ins.bp);
    const vol = ng / (+ins.conc || NaN);
    rows.push({ name: ins.name || "插入片段", bp: +ins.bp, conc: +ins.conc, pmol: p, ng, vol });
  }
  if (rows.some((r) => !isFinite(r.vol) || r.vol < 0)) return { ok: false, error: "浓度需>0 才能算体积" };
  const liquid = rows.reduce((s, r) => s + r.vol, 0) + mix;
  const water = V - liquid;
  const warnings = [];
  if (water < -1e-9) warnings.push("组分+酶mix体积已超过反应体积，请降低载体量/浓度或增大体积");
  return { ok: true, rows, mix, water, total: V, warnings };
}

// ---------- 2. 血球计数板 ----------
// counts: 四角大方格计数数组; dilution 稀释倍数; 默认 Improved Neubauer 0.1mm → ×1e4
export function hemocytometer({ counts, dilution, totalVol_mL }) {
  const valid = counts.map(Number).filter((n) => isFinite(n) && n >= 0);
  if (!valid.length) return { ok: false, error: "至少填一个计数格" };
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const perML = mean * (+dilution || 1) * 1e4;
  const total = totalVol_mL ? perML * (+totalVol_mL) : null;
  return { ok: true, mean, perML, total };
}

// ---------- 3. 菌落 CFU ----------
// plates [{colonies, dilution, plated_mL}]
export function cfu({ plates }) {
  const rows = plates.map((p) => {
    const c = +p.colonies, d = +p.dilution || 1, v = +p.plated_mL || 0.1;
    const perML = v > 0 ? (c * d) / v : NaN;
    return { ...p, perML };
  }).filter((r) => isFinite(r.perML));
  if (!rows.length) return { ok: false, error: "至少一个有效平板" };
  const mean = rows.reduce((s, r) => s + r.perML, 0) / rows.length;
  return { ok: true, rows, mean };
}

// ---------- 4. OD260 核酸定量 ----------
export const NA_FACTOR = { dsDNA: 50, ssDNA: 33, RNA: 40 }; // µg/mL per A260 unit
export const NA_MW_PER_UNIT = { dsDNA: 660, ssDNA: 330, RNA: 340 }; // per bp/nt
export function od260({ a260, a280, a230, dilution, pathlength, type, length }) {
  const f = NA_FACTOR[type] || 50;
  const pl = +pathlength || 1;
  const conc_ugmL = (+a260 * f * (+dilution || 1)) / pl;
  const conc_nguL = conc_ugmL; // 1 µg/mL = 1 ng/µL
  const r280 = +a280 > 0 ? +a260 / +a280 : null;
  const r230 = +a230 > 0 ? +a260 / +a230 : null;
  let copies = null;
  if (+length > 0) {
    const mw = +length * (NA_MW_PER_UNIT[type] || 660);
    copies = (conc_nguL * 6.022e23) / (mw * 1e9); // copies/µL
  }
  return { ok: true, conc_nguL, r280, r230, copies };
}

// ---------- 5. 梯度系列稀释 ----------
export function serialDilution({ stock, unit, factor, steps, vol }) {
  const F = +factor, N = Math.max(1, Math.min(20, Math.round(+steps))), V = +vol;
  if (!(F > 1) || !(V > 0)) return { ok: false, error: "稀释倍数需>1、每管体积需>0" };
  const transfer = V / F, diluent = V - transfer;
  const rows = [];
  for (let i = 1; i <= N; i++) rows.push({ tube: i, conc: +stock / Math.pow(F, i), transfer, diluent });
  return { ok: true, rows, transfer, diluent, unit };
}

// ---------- 6. 分子量 ----------
const ATOMIC = { H: 1.008, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Na: 22.990, Mg: 24.305, P: 30.974, S: 32.06, Cl: 35.45, K: 39.098, Ca: 40.078, Fe: 55.845, Cu: 63.546, Zn: 65.38, Mn: 54.938, Co: 58.933, Mo: 95.95, Se: 78.971, I: 126.904, Br: 79.904, Li: 6.94, B: 10.81, Si: 28.085, Al: 26.982 };
// 解析化学式（支持括号与下标），返回 {mw, error}
export function formulaMW(formula) {
  const s = String(formula).replace(/\s/g, "");
  let i = 0;
  function parseGroup(close) {
    let mass = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === "(" || ch === "[") { i++; mass += parseGroup(ch === "(" ? ")" : "]"); continue; }
      if (ch === ")" || ch === "]") { i++; if (close && ch !== close) return { err: true }; const mult = readNum(); return mass * (mult || 1); }
      const m = /^([A-Z][a-z]?)/.exec(s.slice(i));
      if (!m) return { err: true };
      const el = m[1]; i += el.length;
      if (!(el in ATOMIC)) return { err: true, el };
      const n = readNum();
      mass += ATOMIC[el] * (n || 1);
    }
    return close ? { err: true } : mass;
  }
  function readNum() { const m = /^(\d+)/.exec(s.slice(i)); if (!m) return 0; i += m[1].length; return +m[1]; }
  const r = parseGroup(null);
  if (typeof r === "object" || !isFinite(r) || r <= 0) return { ok: false, error: "化学式无法解析" };
  return { ok: true, mw: r };
}
const AA_RESIDUE = { A: 71.08, R: 156.19, N: 114.10, D: 115.09, C: 103.14, E: 129.12, Q: 128.13, G: 57.05, H: 137.14, I: 113.16, L: 113.16, K: 128.17, M: 131.19, F: 147.18, P: 97.12, S: 87.08, T: 101.10, W: 186.21, Y: 163.18, V: 99.13 };
export function seqMW({ mode, seq }) {
  const t = String(seq).replace(/\s/g, "").toUpperCase();
  if (!t) return { ok: false, error: "序列为空" };
  if (mode === "protein") {
    let sum = 0;
    for (const ch of t) { if (!(ch in AA_RESIDUE)) return { ok: false, error: `无效氨基酸字母 ${ch}` }; sum += AA_RESIDUE[ch]; }
    return { ok: true, mw: sum + 18.02, n: t.length };
  }
  const per = mode === "dsDNA" ? 660 : mode === "ssDNA" ? 330 : 340;
  const valid = mode === "RNA" ? /[^ACGU]/ : /[^ACGT]/;
  if (valid.test(t)) return { ok: false, error: "序列含无效碱基" };
  return { ok: true, mw: t.length * per, n: t.length, approx: true };
}

// ---------- 通用 CSV ----------
export function tableCSV(headers, rows) {
  const esc = (s) => { const t = String(s ?? ""); return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
}
export const fmtNum = (n, d = 4) => (n == null || !isFinite(n) ? "—" : String(parseFloat((+n).toPrecision(d))));
