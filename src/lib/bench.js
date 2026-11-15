// ==================== 台边计算：组装配比 / 血球计数 / CFU / OD260 / 梯度稀释 / 分子量 ====================
// 纯函数，无 DOM/Tauri 依赖，便于单测。体积 µL、质量 ng、浓度 ng/µL、摩尔 pmol。

// dsDNA 每 bp 平均 660 g/mol → 1 pmol 的 ng 数 = 0.66 × bp
export const ngPerPmol = (bp) => 0.66 * bp;
export const pmolFromNg = (ng, bp) => ng / ngPerPmol(bp);
// 每 µL 母液含多少 pmol = conc(ng/µL) / (0.66*bp)
export const pmolPerUL = (conc, bp) => +conc / ngPerPmol(+bp);

// ---------- 1. Seamless / Gibson 组装片段配比（只输出 µL） ----------
// 约定：插入:载体 = ratio:1（摩尔比，默认3:1）；Master Mix 为 2×（mixFactor=2）占总体积一半；
// 剩余体积 R = V - mix 全部分配给载体+插入片段（不另加水），按 bp+浓度自动解出各 µL。
export const ASSEMBLY_PRESETS = [
  { id: "gibson", name: "Gibson (NEB E2611)", ratio: 3, vol: 6, mixFactor: 2 },
  { id: "hifi", name: "NEBuilder HiFi (E2621)", ratio: 3, vol: 6, mixFactor: 2 },
  { id: "clonexpress", name: "ClonExpress II (Vazyme C112)", ratio: 3, vol: 6, mixFactor: 2 },
  { id: "infusion", name: "In-Fusion (Takara)", ratio: 3, vol: 6, mixFactor: 2 },
  { id: "custom", name: "自定义", ratio: 3, vol: 6, mixFactor: 2 },
];
// vector {bp,conc}, inserts [{name,bp,conc}], cfg {ratio, vol, mixFactor}
export function assembly({ vector, inserts, cfg }) {
  const V = +cfg.vol, mf = +cfg.mixFactor, ratio = +cfg.ratio;
  if (!(V > 0)) return { ok: false, error: "反应总体积需>0" };
  if (!(mf >= 1)) return { ok: false, error: "Mix 倍数需≥1（2× 即占一半）" };
  if (!(ratio >= 0)) return { ok: false, error: "插入:载体摩尔比需≥0" };
  if (!(+vector.bp > 0) || !(+vector.conc > 0)) return { ok: false, error: "载体长度(bp)与浓度(ng/µL)需>0" };
  for (const ins of inserts) if (!(+ins.bp > 0) || !(+ins.conc > 0)) return { ok: false, error: `插入片段「${ins.name || ""}」长度与浓度需>0` };
  const mix = V / mf;
  const R = V - mix;
  if (!(R > 0)) return { ok: false, error: "剩余体积需>0（Mix 倍数不能为1）" };
  const kv = pmolPerUL(vector.conc, vector.bp);
  const ks = inserts.map((i) => pmolPerUL(i.conc, i.bp));
  // v_vol * (1 + ratio*kv*Σ(1/k_i)) = R
  const denom = 1 + ratio * kv * ks.reduce((s, k) => s + (k > 0 ? 1 / k : 0), 0);
  const vVol = R / denom;
  const rows = [{ name: "载体 vector", bp: +vector.bp, conc: +vector.conc, vol: vVol, pmol: vVol * kv }];
  inserts.forEach((ins, i) => {
    const vol = ratio * vVol * kv / ks[i];
    rows.push({ name: ins.name || `插入 ${i + 1}`, bp: +ins.bp, conc: +ins.conc, vol, pmol: vol * ks[i] });
  });
  const warnings = [];
  for (const r of rows) if (r.vol < 0.05) warnings.push(`${r.name} 取量 ${r.vol.toFixed(3)} µL 过小，难以准确移液，建议提高母液浓度或增大反应体积`);
  return { ok: true, rows, mix, water: 0, total: V, warnings };
}

// ---------- 2. 血球计数板 ----------
export function hemocytometer({ counts, dilution, totalVol_mL }) {
  const valid = counts.map(Number).filter((n) => isFinite(n) && n >= 0);
  if (!valid.length) return { ok: false, error: "至少填一个计数格" };
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const perML = mean * (+dilution || 1) * 1e4;
  const total = totalVol_mL ? perML * (+totalVol_mL) : null;
  return { ok: true, mean, perML, total };
}

// ---------- 3. 菌落 CFU（联动稀释方案，自动挑 30–300 可计平板） ----------
// plates [{tube, colonies, plated_mL, manualFactor}]；scheme {tubes:[{tube,conc,factor}]} 可选
export const CFU_MIN = 30, CFU_MAX = 300;
export function cfu({ plates, scheme }) {
  const rows = plates.map((p) => {
    const c = +p.colonies, v = +p.plated_mL || 0.1;
    let factor = null;
    if (scheme && scheme.tubes && p.tube) {
      const t = scheme.tubes.find((x) => x.tube === +p.tube);
      if (t) factor = t.factor;
    }
    if (factor == null) factor = +p.manualFactor || null;
    const perML = factor && v > 0 ? (c * factor) / v : NaN;
    const countable = c >= CFU_MIN && c <= CFU_MAX;
    const flag = c > CFU_MAX ? "TNTC" : c < CFU_MIN ? "太少" : "可计";
    return { ...p, factor, perML, countable, flag };
  }).filter((r) => isFinite(r.perML));
  if (!rows.length) return { ok: false, error: "至少一个有效平板（需稀释倍数/方案管号 + 涂布体积）" };
  const used = rows.filter((r) => r.countable);
  if (!used.length) return { ok: false, error: `无可计平板（菌落数需在 ${CFU_MIN}–${CFU_MAX}），请调整稀释度`, rows };
  const mean = used.reduce((s, r) => s + r.perML, 0) / used.length;
  return { ok: true, rows, mean, usedCount: used.length };
}

// ---------- 4. OD260 核酸定量 ----------
export const NA_FACTOR = { dsDNA: 50, ssDNA: 33, RNA: 40 };
export const NA_MW_PER_UNIT = { dsDNA: 660, ssDNA: 330, RNA: 340 };
export function od260({ a260, a280, a230, dilution, pathlength, type, length }) {
  const f = NA_FACTOR[type] || 50;
  const pl = +pathlength || 1;
  const conc_nguL = (+a260 * f * (+dilution || 1)) / pl;
  const r280 = +a280 > 0 ? +a260 / +a280 : null;
  const r230 = +a230 > 0 ? +a260 / +a230 : null;
  let copies = null;
  if (+length > 0) {
    const mw = +length * (NA_MW_PER_UNIT[type] || 660);
    copies = (conc_nguL * 6.022e23) / (mw * 1e9);
  }
  return { ok: true, conc_nguL, r280, r230, copies };
}

// ---------- 5. 梯度系列稀释（目标浓度驱动） ----------
// mode 'list': targets 文本(逗号/空格分隔各管终浓度); mode 'range': start/end/count 几何梯度
// 每管从母液平行稀释：取母液 = V*t/stock，补 = V-取。产出 scheme 供 CFU 联动。
export function serialDilution({ stock, unit, mode, targets, start, end, count, vol }) {
  const S = +stock, V = +vol;
  if (!(S > 0) || !(V > 0)) return { ok: false, error: "母液浓度与每管体积需>0" };
  let list = [];
  if (mode === "range") {
    const a = +start, b = +end, n = Math.max(2, Math.min(12, Math.round(+count)));
    if (!(a > 0) || !(b > 0) || a === b) return { ok: false, error: "范围起止浓度需>0 且不相等" };
    const f = Math.pow(a / b, 1 / (n - 1));
    for (let i = 0; i < n; i++) list.push(a / Math.pow(f, i));
  } else {
    list = String(targets).split(/[,，;\s]+/).map(Number).filter((n) => isFinite(n) && n > 0);
    if (!list.length) return { ok: false, error: "请填写至少一个目标浓度" };
  }
  if (list.some((t) => t > S)) return { ok: false, error: "目标浓度不能高于母液浓度" };
  const rows = list.map((t, i) => ({ tube: i + 1, conc: t, factor: S / t, take: (V * t) / S, diluent: V - (V * t) / S }));
  const scheme = { stock: S, unit, vol: V, tubes: rows.map((r) => ({ tube: r.tube, conc: r.conc, factor: r.factor })) };
  return { ok: true, rows, unit, scheme };
}

// ---------- 6. 分子量 ----------
const ATOMIC = { H: 1.008, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Na: 22.990, Mg: 24.305, P: 30.974, S: 32.06, Cl: 35.45, K: 39.098, Ca: 40.078, Fe: 55.845, Cu: 63.546, Zn: 65.38, Mn: 54.938, Co: 58.933, Mo: 95.95, Se: 78.971, I: 126.904, Br: 79.904, Li: 6.94, B: 10.81, Si: 28.085, Al: 26.982 };
export function formulaMW(formula) {
  const s = String(formula).replace(/\s/g, "");
  let i = 0;
  function readNum() { const m = /^(\d+)/.exec(s.slice(i)); if (!m) return 0; i += m[1].length; return +m[1]; }
  function parseGroup(close) {
    let mass = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === "(" || ch === "[") { i++; mass += parseGroup(ch === "(" ? ")" : "]"); continue; }
      if (ch === ")" || ch === "]") { i++; if (close && ch !== close) return { err: true }; const mult = readNum(); return mass * (mult || 1); }
      const m = /^([A-Z][a-z]?)/.exec(s.slice(i));
      if (!m) return { err: true };
      const el = m[1]; i += el.length;
      if (!(el in ATOMIC)) return { err: true };
      mass += ATOMIC[el] * (readNum() || 1);
    }
    return close ? { err: true } : mass;
  }
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
