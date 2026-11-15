// ==================== 计算与转换：浓度稀释 / 多组分混合配比 ====================
// 纯函数模块，无 DOM / Tauri 依赖，便于单测。
// 单位内部统一换算到基准：浓度→M(摩尔) 或 mg/mL(质量体积) 或 X(倍数)；质量→mg；体积→mL。

export const CONC_UNITS = {
  M: { dim: "molar", f: 1 },
  mM: { dim: "molar", f: 1e-3 },
  "µM": { dim: "molar", f: 1e-6 },
  nM: { dim: "molar", f: 1e-9 },
  "g/mL": { dim: "massvol", f: 1000 },
  "mg/mL": { dim: "massvol", f: 1 },
  "µg/mL": { dim: "massvol", f: 1e-3 },
  "ng/mL": { dim: "massvol", f: 1e-6 },
  "%": { dim: "massvol", f: 10 }, // 1% w/v = 1 g/100mL = 10 mg/mL
  X: { dim: "fold", f: 1 },
};
export const MASS_UNITS = { g: { f: 1000 }, mg: { f: 1 }, "µg": { f: 1e-3 }, ng: { f: 1e-6 } };
export const VOL_UNITS = { L: { f: 1000 }, mL: { f: 1 }, "µL": { f: 1e-3 }, nL: { f: 1e-6 } };

export const concDim = (u) => CONC_UNITS[u]?.dim || null;
const toBase = (v, u, table) => v * (table[u]?.f ?? NaN);
const fromBase = (b, u, table) => b / (table[u]?.f ?? NaN);

// 友好体积/质量显示（自动选单位）
export function fmtVol(mL) {
  if (!isFinite(mL)) return "—";
  if (mL === 0) return "0 µL";
  if (Math.abs(mL) < 1) return `${trim(mL * 1000)} µL`;
  if (Math.abs(mL) < 1000) return `${trim(mL)} mL`;
  return `${trim(mL / 1000)} L`;
}
export function fmtMass(mg) {
  if (mg == null || !isFinite(mg)) return "—";
  if (mg === 0) return "0 mg";
  if (Math.abs(mg) < 1) return `${trim(mg * 1000)} µg`;
  if (Math.abs(mg) < 1000) return `${trim(mg)} mg`;
  return `${trim(mg / 1000)} g`;
}
const trim = (n) => {
  const r = Math.round(n * 10000) / 10000;
  return String(parseFloat(r.toPrecision(6)));
};

// ---------- 浓度稀释 C1V1 = C2V2 ----------
// 返回 { ok, error, v1_mL, diluent_mL, mass_mg|null }
export function dilution({ c1, u1, c2, u2, v2, uV }) {
  const d1 = concDim(u1), d2 = concDim(u2);
  if (!d1 || !d2) return { ok: false, error: "浓度单位无效" };
  if (d1 !== d2) return { ok: false, error: "母液与目标浓度单位维度不一致（摩尔/质量体积/倍数不能混算）" };
  const C1 = toBase(+c1, u1, CONC_UNITS), C2 = toBase(+c2, u2, CONC_UNITS), V2 = toBase(+v2, uV, VOL_UNITS);
  if (!(C1 > 0)) return { ok: false, error: "母液浓度需大于 0" };
  if (!(C2 >= 0)) return { ok: false, error: "目标浓度需 ≥ 0" };
  if (!(V2 > 0)) return { ok: false, error: "终体积需大于 0" };
  if (C2 > C1) return { ok: false, error: "目标浓度高于母液浓度，无法通过稀释达到" };
  const v1 = (C2 * V2) / C1;
  const diluent = V2 - v1;
  const mass_mg = d1 === "massvol" ? C2 * V2 : null; // 摩尔/倍数无分子量不算质量
  return { ok: true, v1_mL: v1, diluent_mL: diluent, mass_mg };
}

// ---------- 多组分混合配比 ----------
// row: { name, targetMode:'conc'|'mass', targetValue, targetUnit,
//        stockMode:'solution'|'solid', stockValue, stockUnit }
// 返回 { ok, error, rows:[{...row, take_mL, take_mg, note}], filler_mL, total_mL, warnings[] }
export function mix({ rows, vFinal, uV }) {
  const Vb = toBase(+vFinal, uV, VOL_UNITS);
  if (!(Vb > 0)) return { ok: false, error: "终体积需大于 0" };
  const out = [];
  const warnings = [];
  let liquidSum = 0;
  for (const r of rows) {
    const item = { ...r, take_mL: 0, take_mg: null, note: "" };
    const tVal = +r.targetValue;
    if (!(tVal >= 0)) { item.note = "目标值无效"; out.push(item); continue; }
    if (r.targetMode === "mass") {
      const need_mg = toBase(tVal, r.targetUnit, MASS_UNITS);
      item.take_mg = need_mg;
      if (r.stockMode === "solid") { item.take_mL = 0; item.note = "固体直接称取"; }
      else {
        const sd = concDim(r.stockUnit);
        if (sd !== "massvol") { item.note = "按质量取料需质量体积浓度母液（或改用固体）"; out.push(item); continue; }
        const Cs = toBase(+r.stockValue, r.stockUnit, CONC_UNITS);
        if (!(Cs > 0)) { item.note = "母液浓度需>0"; out.push(item); continue; }
        item.take_mL = need_mg / Cs;
      }
    } else {
      const td = concDim(r.targetUnit);
      const Ct = toBase(tVal, r.targetUnit, CONC_UNITS);
      if (td === "massvol") {
        const need_mg = Ct * Vb;
        item.take_mg = need_mg;
        if (r.stockMode === "solid") { item.take_mL = 0; item.note = "固体直接称取"; }
        else {
          const sd = concDim(r.stockUnit);
          if (sd !== "massvol") { item.note = "质量体积目标需质量体积浓度母液（或改用固体）"; out.push(item); continue; }
          const Cs = toBase(+r.stockValue, r.stockUnit, CONC_UNITS);
          if (!(Cs > 0)) { item.note = "母液浓度需>0"; out.push(item); continue; }
          item.take_mL = need_mg / Cs;
        }
      } else if (td === "molar" || td === "fold") {
        if (r.stockMode === "solid") { item.note = "摩尔/倍数目标配固体需分子量，请改质量目标"; out.push(item); continue; }
        const sd = concDim(r.stockUnit);
        if (sd !== td) { item.note = "母液与目标浓度维度不一致"; out.push(item); continue; }
        const Cs = toBase(+r.stockValue, r.stockUnit, CONC_UNITS);
        if (!(Cs > 0)) { item.note = "母液浓度需>0"; out.push(item); continue; }
        if (Ct > Cs) { item.note = "目标浓度高于母液"; out.push(item); continue; }
        item.take_mL = (Ct * Vb) / Cs;
      } else { item.note = "目标单位无效"; out.push(item); continue; }
    }
    if (item.take_mL > 0) liquidSum += item.take_mL;
    out.push(item);
  }
  const filler = Vb - liquidSum;
  if (filler < -1e-9) warnings.push("各液体组分体积之和已超过终体积，请降低目标浓度/质量或增大终体积");
  return { ok: true, rows: out, filler_mL: filler, total_mL: Vb, liquid_mL: liquidSum, warnings };
}

// ---------- 导出 CSV ----------
export function mixToCSV(result, uV, fillerLabel = "补液/溶剂") {
  const head = ["组分", "目标模式", "目标值", "目标单位", "母液模式", "母液浓度", "母液单位", "取用体积", "取用质量", "备注"];
  const lines = [head.join(",")];
  for (const r of result.rows) {
    lines.push([
      csv(r.name), r.targetMode === "mass" ? "质量" : "浓度", r.targetValue, r.targetUnit,
      r.stockMode === "solid" ? "固体" : "溶液", r.stockMode === "solid" ? "" : r.stockValue, r.stockMode === "solid" ? "" : r.stockUnit,
      csv(fmtVol(r.take_mL)), csv(r.take_mg == null ? "" : fmtMass(r.take_mg)), csv(r.note || ""),
    ].join(","));
  }
  lines.push([csv(fillerLabel), "", "", "", "", "", "", csv(fmtVol(result.filler_mL)), "", csv(result.filler_mL < 0 ? "超体积!" : "")].join(","));
  lines.push([csv("终体积"), "", "", "", "", "", "", csv(fmtVol(result.total_mL)), "", ""].join(","));
  return lines.join("\r\n");
}
export function dilutionToCSV(d, { c1, u1, c2, u2, v2, uV }, solvent = "水") {
  const lines = [
    ["项目", "值"].join(","),
    ["母液浓度", `${c1} ${u1}`].join(","),
    ["目标浓度", `${c2} ${u2}`].join(","),
    ["终体积", `${v2} ${uV}`].join(","),
    ["取母液体积", csv(fmtVol(d.v1_mL))].join(","),
    [`加${solvent}`, csv(fmtVol(d.diluent_mL))].join(","),
  ];
  if (d.mass_mg != null) lines.push(["溶质质量", csv(fmtMass(d.mass_mg))].join(","));
  return lines.join("\r\n");
}
const csv = (s) => {
  const t = String(s ?? "");
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
