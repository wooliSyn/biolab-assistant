// ==================== 质粒图谱（SnapGene 式环形 / 线性大图谱） ====================
// 环形：骨架圆（酶切红杠压在骨架上，悬停显示）+ 特征轨道 + 引物轨道 + 环外引线名称
// 线性：只给线性分子用（环状质粒的线性展开已并进「序列」视图顶部的条带）
// 主题：所有图表色走 --map-* 变量（index.css 三主题各自定义），用 inline style 下发，
//       因为 SVG 展示属性对 var() 的支持不可靠，必须走 CSS 属性。
import { useEffect, useMemo, useRef, useState } from "react";
import { Scissors, MapPin, Tag } from "lucide-react";
import { featColor, packLanes } from "../lib/mapstyle";

// ---------- 刻度步长：取 1/2/5×10^n 中最接近 L/10 的"整数感"步长 ----------
function niceStep(span, target = 10) {
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  for (const m of [1, 2, 5, 10]) if (raw <= m * mag) return m * mag;
  return 10 * mag;
}

// ---------- 标签阶梯避让：同侧标签按 y 排序后强制最小间距，整体不出框 ----------
function ladder(items, minGap, yMin, yMax) {
  const out = items.slice().sort((a, b) => a.y - b.y).map((it) => ({ ...it }));
  for (let i = 1; i < out.length; i++) {
    if (out[i].y - out[i - 1].y < minGap) out[i].y = out[i - 1].y + minGap;
  }
  // 底部溢出则整组上推，再夹住顶部
  const overflow = out.length ? out[out.length - 1].y - yMax : 0;
  if (overflow > 0) for (const it of out) it.y -= overflow;
  if (out.length && out[0].y < yMin) {
    const push = yMin - out[0].y;
    for (const it of out) it.y += push;
  }
  return out;
}

// 阶梯能放下的条数有限（可用高度 / 行距）。超出时按 y 均匀抽样保留，其余省略并计数，
// 以前是全部塞进去，结果标签互相压在一起谁也看不清
function ladderCap(items, minGap, yMin, yMax) {
  const cap = Math.max(1, Math.floor((yMax - yMin) / minGap) + 1);
  if (items.length <= cap) return { kept: ladder(items, minGap, yMin, yMax), dropped: 0 };
  const sorted = items.slice().sort((a, b) => a.y - b.y);
  const pick = [];
  for (let i = 0; i < cap; i++) pick.push(sorted[Math.round((i * (sorted.length - 1)) / Math.max(1, cap - 1))]);
  const uniq = [...new Set(pick)];
  return { kept: ladder(uniq, minGap, yMin, yMax), dropped: items.length - uniq.length };
}

// 识别序列有效长度（简并位 N 不算）：「6+ 切点酶」= 至少 6 个确定碱基
const siteLen = (site) => String(site || "").replace(/N/gi, "").length;

const ENZ_MODES = [
  ["u6", "单切 6+"], ["u", "单切"], ["low", "单/双切"], ["all", "全部"], ["custom", "自选"], ["off", "关闭"],
];

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const TOOLBAR_H = 38;

export default function MapView({ plasmid, sites, mapped = [], sel, setSel, onLocate, height = 460, enzPref, setEnzPref, onEditFeature }) {
  const boxRef = useRef(null);
  const [w, setW] = useState(760);
  // 环状质粒画环形；线性分子画线性。环状质粒的线性展开并进了「序列」视图（顶部条带），不再单独一个大框
  const mode = plasmid.circular ? "circular" : "linear";
  // 图谱上显示哪些酶。默认「单切 6+」（只切一次、识别位点 ≥6 bp），和 SnapGene 默认一致：
  // 克隆真正用得上的就是这些，4bp 高频切酶会把环外糊成一片红。设置由工作台保存（enzPref）
  const [localPref, setLocalPref] = useState({ mode: "u6", chosen: [] });
  const pref = enzPref || localPref;
  const setPref = setEnzPref || setLocalPref;
  const enzLevel = pref.mode;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showPrimers, setShowPrimers] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const L = plasmid.seq.length;
  const feats = useMemo(
    () => plasmid.features.filter((f) => !(f.key === "source" && f.end - f.start + 1 >= L)),
    [plasmid, L]
  );
  const selLen = sel && sel.b >= sel.a ? sel.b - sel.a + 1 : 0;

  // 按酶统计切点数，供"仅单/双切"筛选
  const siteCount = useMemo(() => {
    const m = new Map();
    for (const s of sites) m.set(s.name, (m.get(s.name) || 0) + 1);
    return m;
  }, [sites]);
  const chosenSet = useMemo(() => new Set(pref.chosen || []), [pref.chosen]);
  const passEnz = (name, site) => {
    const c = siteCount.get(name) || 0;
    switch (enzLevel) {
      case "off": return false;
      case "all": return true;
      case "custom": return chosenSet.has(name);
      case "u": return c === 1;
      case "low": return c <= 2;
      default: return c === 1 && siteLen(site) >= 6; // u6
    }
  };
  const shownSites = useMemo(() => sites.filter((s) => passEnz(s.name, s.site)), [sites, siteCount, enzLevel, chosenSet]); // eslint-disable-line react-hooks/exhaustive-deps
  const hiddenHighFreq = enzLevel !== "off" && enzLevel !== "all" ? sites.length - shownSites.length : 0;
  // 自选列表：按酶分组
  const enzGroups = useMemo(() => {
    const m = new Map();
    for (const s of sites) { if (!m.has(s.name)) m.set(s.name, { name: s.name, site: s.site, count: 0 }); m.get(s.name).count++; }
    return [...m.values()].sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));
  }, [sites]);
  // 性能护栏：位点过多时只画刻度不画名字；极端情况整体省略（与"大序列必须折叠"同一原则）
  const enzMode = enzLevel === "off" ? "off" : shownSites.length > 400 ? "off" : shownSites.length > 90 || mode === "circular" ? "ticks" : "full";

  const editF = (f) => { if (onEditFeature) onEditFeature(f); };
  // 环形图酶名不再画字（悬停看），所以位点再多也只是红杠，护栏只对线性图生效
  const pick = (f) => {
    if (setSel) setSel({ a: f.start - 1, b: f.end - 1 });
    if (onLocate) onLocate(f.start, f.end);
  };

  // 画布高度要同时扣掉工具条和滚动容器自身的 py-1（上下各 4px），
  // 否则 SVG 比可视区高 8px，底部内容（最下面那条酶名）永远在折叠线以下
  const H = Math.max(260, height - TOOLBAR_H - 10);
  const svgW = Math.max(320, w);

  return (
    <div className="pixel-panel overflow-hidden flex flex-col" style={{ height }}>
      {/* 工具条：环形/线性切换 + 图层开关 */}
      <div className="flex items-center gap-1.5 px-3 flex-wrap flex-shrink-0 border-b border-[var(--px-ink-soft)]" style={{ height: TOOLBAR_H }}>
        <span className="text-[10px]" style={{ color: "var(--map-faint)" }}>{mode === "circular" ? "环形图谱" : "线性图谱"} · 图层</span>
        <label className={`flex items-center gap-1 pl-2 pr-1 py-0.5 text-[10px] border rounded-lg ${enzLevel !== "off" ? "bg-red-50 border-red-300 text-red-600" : "bg-white border-gray-200 text-gray-400"}`}
          title={"图谱上显示哪些酶：\n单切 6+（默认）= 只切一次且识别位点 ≥6 bp，克隆最常用\n自选 = 只显示你勾选的酶"}>
          <Scissors size={11} />
          <select value={enzLevel} onChange={(e) => { const m = e.target.value; setPref({ ...pref, mode: m }); if (m === "custom") setPickerOpen(true); }}
            className="bg-transparent text-[10px] focus:outline-none cursor-pointer">
            {ENZ_MODES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <div className="relative">
          <button onClick={() => setPickerOpen((v) => !v)} className={`px-2 py-1 text-[10px] border rounded-lg ${pickerOpen ? "border-red-300 text-red-600 bg-red-50" : "border-gray-200 text-gray-500 bg-white hover:border-red-200"}`}
            title="自己挑选要在图谱上显示的酶">选酶…{enzLevel === "custom" ? `（${chosenSet.size}）` : ""}</button>
          {pickerOpen && (
            <EnzymePicker groups={enzGroups} chosen={chosenSet}
              onChange={(list) => setPref({ mode: "custom", chosen: list })}
              onClose={() => setPickerOpen(false)} />
          )}
        </div>
        <button onClick={() => setShowPrimers((v) => !v)}
          className={`flex items-center gap-1 px-2 py-1 text-[10px] border rounded-lg transition ${showPrimers ? "bg-cyan-50 border-cyan-300 text-cyan-700" : "bg-white border-gray-200 text-gray-400 hover:border-cyan-200"}`}
          title="显示/隐藏引物图层">
          <MapPin size={11} />引物
        </button>
        <button onClick={() => setShowLabels((v) => !v)}
          className={`flex items-center gap-1 px-2 py-1 text-[10px] border rounded-lg transition ${showLabels ? "bg-indigo-50 border-indigo-300 text-indigo-600" : "bg-white border-gray-200 text-gray-400 hover:border-indigo-200"}`}
          title="显示/隐藏特征与引物名称（酶名悬停红杠显示）">
          <Tag size={11} />名称
        </button>
        <span className="ml-auto text-[10px] tabular-nums" style={{ color: "var(--map-dim)" }}>
          {feats.length} 元件 · {shownSites.length}/{sites.length} 位点
          {hiddenHighFreq > 0 ? `（按「${(ENZ_MODES.find(([k]) => k === enzLevel) || [])[1]}」隐去 ${hiddenHighFreq} 个）` : ""}
          {enzMode === "ticks" && mode !== "circular" ? "（密集，仅画刻度）" : enzLevel !== "off" && enzMode === "off" ? "（过多，已省略）" : ""}
        </span>
      </div>

      {/* 图谱画布 */}
      <div ref={boxRef} className="flex-1 min-h-0 overflow-auto px-2 py-1">
        {mode === "circular" ? (
          <CircularMap {...{ plasmid, feats, sites: shownSites, mapped, sel, selLen, L, svgW, H, enzMode, showPrimers, showLabels, pick, editF }} />
        ) : (
          <LinearMap {...{ plasmid, feats, sites: shownSites, mapped, sel, selLen, L, svgW, H, enzMode, showPrimers, showLabels, pick, editF }} />
        )}
      </div>
    </div>
  );
}

// ==================== 环形图谱（SnapGene 式） ====================
// 自内向外：碱基刻度 → 黑色骨架（酶切红杠直接画在骨架上，名字悬停才显示）
//          → 特征轨道（重叠依次外移）→ 引物轨道 → 引线 + 名称（特征、引物全部标在环外）。
// 上一版把放不下的特征名塞进圆心，特征一多（慢病毒载体十几个元件）就在圆心叠成一团；
// 现在所有名称都走环外两列阶梯，放不下才省略并计数。
const PRIMER_COL = "#0e7490"; // 引物统一用青色系，和任何特征类型的颜色都不撞
function CircularMap({ plasmid, feats, sites, mapped, sel, selLen, L, svgW, H, enzMode, showPrimers, showLabels, pick, editF }) {
  const [hov, setHov] = useState(null); // 悬停提示 { x, y, lines: [] }
  const ang = (bp) => ((bp - 1) / L) * Math.PI * 2 - Math.PI / 2;
  const TAU = Math.PI * 2;

  // ---------- 按角度分道：重叠的区段依次外移一道 ----------
  const packAngular = (ranges, pad) => {
    const items = ranges.map((r, i) => ({ i, s0: r[0], e0: r[1] > r[0] ? r[1] : r[1] + 1 })).sort((a, b) => a.s0 - b.s0);
    const ends = [], lane = new Map();
    for (const it of items) {
      let li = ends.findIndex((e) => e <= it.s0 - pad);
      if (li === -1) { li = ends.length; ends.push(it.e0); } else ends[li] = it.e0;
      lane.set(it.i, li);
    }
    return { lane, count: ends.length };
  };
  const ARC_W = 10, LANE_GAP = 3, P_W = 4, P_GAP = 3;
  const fLanes = packAngular(feats.map((f) => [(f.start - 1) / L, f.end / L]), 0.004);
  const hits = showPrimers ? mapped.filter((p) => p.hit) : [];
  const pLanes = packAngular(hits.map((p) => [(p.hit.pos - 1) / L, (p.hit.pos - 1 + p.bindLen) / L]), 0.006);
  const fBand = Math.max(1, fLanes.count) * (ARC_W + LANE_GAP);
  const pBand = pLanes.count ? 4 + pLanes.count * (P_W + P_GAP) : 0;

  // 半径：两侧要给名称留 ~150px；上下给阶梯留余量
  const LABEL_ROOM = showLabels ? 150 : 24;
  const R = Math.max(56, Math.min(svgW / 2 - LABEL_ROOM - fBand - pBand - 26, H / 2 - 42 - fBand - pBand));
  const cx = svgW / 2, cy = H / 2;
  const pt = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const arcPath = (r, a1, a2) => {
    const [x1, y1] = pt(r, a1), [x2, y2] = pt(r, a2);
    const large = a2 - a1 > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const sweep = (startBp, endBpExcl) => {
    const a1 = ang(startBp);
    let a2 = ang(endBpExcl);
    if (a2 <= a1) a2 += TAU;
    if (a2 - a1 < 0.025) a2 = a1 + 0.025;
    if (a2 - a1 > TAU - 0.03) a2 = a1 + TAU - 0.03; // 跨满整圈时留一道缝，单段 A 弧才画得出来
    return [a1, a2];
  };
  const fR = (i) => R + 5 + ARC_W / 2 + (fLanes.lane.get(i) || 0) * (ARC_W + LANE_GAP);
  const F_OUT = R + 5 + fBand;
  const pR = (i) => F_OUT + 4 + P_W / 2 + (pLanes.lane.get(i) || 0) * (P_W + P_GAP);
  const R_OUT = F_OUT + pBand;

  // ---------- 碱基刻度（骨架内侧） ----------
  const step = niceStep(L, 10);
  const ticks = [];
  for (let bp = step; bp <= L; bp += step) ticks.push(bp);

  // ---------- 环外名称：特征 + 引物，左右两列阶梯 ----------
  const RL = R_OUT + 22; // 名称沿这个半径的圆排开：文字一律朝外长，永远不会压到环上
  const labels = [];
  if (showLabels) {
    feats.forEach((f, i) => {
      const [a1, a2] = sweep(f.start, f.end + 1);
      labels.push({ kind: "f", f, a: (a1 + a2) / 2, r0: fR(i) + ARC_W / 2, col: featColor(f), text: f.label.slice(0, 24) });
    });
    hits.forEach((p, i) => {
      const [a1, a2] = sweep(p.hit.pos, p.hit.pos + p.bindLen);
      const s = p.hit.pos, e = ((p.hit.pos - 1 + p.bindLen - 1) % L) + 1;
      labels.push({ kind: "p", p, a: (a1 + a2) / 2, r0: pR(i) + P_W / 2, col: PRIMER_COL, text: `${p.name.slice(0, 16)}  ${s}–${e}` });
    });
  }
  let dropped = 0;
  const placed = [];
  for (const side of ["r", "l"]) {
    const items = labels.filter((it) => (side === "r" ? Math.cos(it.a) >= 0 : Math.cos(it.a) < 0)).map((it) => ({ ...it, y: cy + RL * Math.sin(it.a) }));
    const res = ladderCap(items, 13, 12, H - 14);
    dropped += res.dropped;
    for (const it of res.kept) {
      const dy = it.y - cy;
      const dx = Math.sqrt(Math.max(0, RL * RL - dy * dy));
      placed.push({ ...it, side, x: cx + (side === "r" ? 1 : -1) * Math.max(10, dx) });
    }
  }

  const tipAt = (e, lines) => {
    const box = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!box) return;
    setHov({ x: e.clientX - box.left, y: e.clientY - box.top, lines });
  };

  return (
    <svg width={svgW} height={H} className="block select-none" style={{ maxWidth: "100%" }} onMouseLeave={() => setHov(null)}>
      {/* 碱基刻度 */}
      {ticks.map((bp) => {
        const a = ang(bp);
        const [x1, y1] = pt(R - 3, a), [x2, y2] = pt(R - 8, a);
        const [tx, ty] = pt(R - 17, a);
        return (
          <g key={`t${bp}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1" style={{ stroke: "var(--map-faint)" }} />
            <text x={tx} y={ty + 3} fontSize="9" textAnchor="middle" style={{ fill: "var(--map-faint)", fontFamily: MONO, pointerEvents: "none" }}>{bp}</text>
          </g>
        );
      })}

      {/* 选区弧 */}
      {selLen > 0 && (() => {
        const [a1, a2] = sweep(sel.a + 1, sel.b + 2);
        const r0 = R - 10, r1 = R_OUT + 4;
        const [bx1, by1] = pt(r0, a1), [bx2, by2] = pt(r1, a1);
        const [ex1, ey1] = pt(r0, a2), [ex2, ey2] = pt(r1, a2);
        return (
          <g style={{ pointerEvents: "none" }}>
            <path d={arcPath((r0 + r1) / 2, a1, a2)} fill="none" stroke="var(--px-accent)" strokeWidth={r1 - r0} opacity="0.16" />
            <line x1={bx1} y1={by1} x2={bx2} y2={by2} stroke="var(--px-accent)" strokeWidth="1.5" opacity="0.8" />
            <line x1={ex1} y1={ey1} x2={ex2} y2={ey2} stroke="var(--px-accent)" strokeWidth="1.5" opacity="0.8" />
          </g>
        );
      })()}

      {/* 骨架圆 */}
      <circle cx={cx} cy={cy} r={R} fill="none" strokeWidth="3" style={{ stroke: "var(--map-bb)" }} />

      {/* 酶切红杠：直接压在骨架上，不写名字；悬停显示酶名 + 位置 */}
      {enzMode !== "off" && sites.map((s, i) => {
        const a = ang(s.pos);
        const [x1, y1] = pt(R - 5, a), [x2, y2] = pt(R + 5, a);
        const lines = [`${s.name}  @ ${s.pos}`, s.site];
        return (
          <g key={`e${i}`} className="cursor-pointer" onMouseEnter={(e) => tipAt(e, lines)} onMouseMove={(e) => tipAt(e, lines)} onMouseLeave={() => setHov(null)}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="8" />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#dc2626" strokeWidth="1.6" style={{ pointerEvents: "none" }} />
          </g>
        );
      })}

      {/* 特征弧 + 箭头 */}
      {feats.map((f, i) => {
        const [a1, a2] = sweep(f.start, f.end + 1);
        const r = fR(i);
        const col = featColor(f);
        const fwd = f.strand >= 0;
        const aTip = fwd ? a2 : a1;
        const ah = Math.min(7, ((a2 - a1) * r) / 2);
        const aBase = aTip + (fwd ? -1 : 1) * (ah / r);
        const [tx, ty] = pt(r, aTip);
        const [o1x, o1y] = pt(r + ARC_W / 2 + 1, aBase), [i1x, i1y] = pt(r - ARC_W / 2 - 1, aBase);
        // 有方向的区段：弧画到箭头底部为止，箭头补齐到端点，端点位置就是真实起止
        const [b1, b2] = f.strand === 0 ? [a1, a2] : fwd ? [a1, aBase] : [aBase, a2];
        const lines = [`${f.label}（${f.key}）`, `${f.start}..${f.end}  ${f.strand === 0 ? "" : fwd ? "→" : "←"}  ${f.end - f.start + 1} bp`, ...(f.note ? [f.note.split("\n")[0].slice(0, 40)] : []), "点击选中 · 双击编辑"];
        return (
          <g key={`f${i}`} className="cursor-pointer" onClick={() => pick(f)} onDoubleClick={() => editF(f)}
            onMouseEnter={(e) => tipAt(e, lines)} onMouseMove={(e) => tipAt(e, lines)} onMouseLeave={() => setHov(null)}>
            {b2 > b1 + 0.001 && <path d={arcPath(r, b1, b2)} fill="none" stroke={col} strokeWidth={ARC_W} opacity="0.9" strokeLinecap="butt" />}
            {f.strand !== 0 && <polygon points={`${tx},${ty} ${o1x},${o1y} ${i1x},${i1y}`} fill={col} opacity="0.9" />}
          </g>
        );
      })}

      {/* 引物弧（特征外侧一圈，青色） */}
      {hits.map((p, i) => {
        const [a1, a2] = sweep(p.hit.pos, p.hit.pos + p.bindLen);
        const r = pR(i);
        const fwd = p.hit.strand === "+";
        const aTip = fwd ? a2 : a1;
        const [tx, ty] = pt(r, aTip);
        const tan = aTip + (fwd ? Math.PI / 2 : -Math.PI / 2);
        const [hx, hy] = [tx + Math.cos(tan) * 5, ty + Math.sin(tan) * 5];
        const nx = Math.cos(aTip) * 3.5, ny = Math.sin(aTip) * 3.5;
        const lines = [`引物 ${p.name}（${fwd ? "正向 →" : "反向 ←"}）`, `${p.hit.pos}..${p.hit.pos + p.bindLen - 1} · 结合 ${p.bindLen} bp${p.hit.mm ? ` · 错配 ${p.hit.mm}` : ""}`];
        return (
          <g key={p.id} onMouseEnter={(e) => tipAt(e, lines)} onMouseMove={(e) => tipAt(e, lines)} onMouseLeave={() => setHov(null)}>
            <path d={arcPath(r, a1, a2)} fill="none" stroke={PRIMER_COL} strokeWidth={P_W} strokeLinecap="butt" />
            <polygon points={`${hx},${hy} ${tx - nx},${ty - ny} ${tx + nx},${ty + ny}`} fill={PRIMER_COL} />
          </g>
        );
      })}

      {/* 环外名称 + 引线：径向伸出一小段，再折到名称 */}
      {placed.map((it, i) => {
        const right = it.side === "r";
        const [ax, ay] = pt(it.r0, it.a);
        const [kx, ky] = pt(Math.max(it.r0 + 4, R_OUT + 8), it.a);
        const ex = it.x + (right ? -2 : 2);
        const isP = it.kind === "p";
        return (
          <g key={`lb${i}`} className={isP ? "" : "cursor-pointer"} onClick={isP ? undefined : () => pick(it.f)} onDoubleClick={isP ? undefined : () => editF(it.f)}>
            <polyline points={`${ax},${ay} ${kx},${ky} ${ex},${it.y}`} fill="none" strokeWidth="0.9" opacity="0.8" style={{ stroke: it.col }} strokeDasharray={isP ? "2 1.5" : undefined} />
            <text x={it.x + (right ? 2 : -2)} y={it.y + 3.5} fontSize="10" textAnchor={right ? "start" : "end"}
              style={{ fill: isP ? PRIMER_COL : "var(--map-fg)", fontWeight: isP ? 600 : 500, fontFamily: isP ? MONO : undefined }}>{it.text}</text>
          </g>
        );
      })}

      {dropped > 0 && (
        <text x={svgW - 6} y={H - 6} fontSize="9" textAnchor="end" style={{ fill: "var(--map-faint)", pointerEvents: "none" }}>
          {dropped} 个名称放不下已省略（悬停区段可看）
        </text>
      )}

      {/* 中心标题 */}
      <text x={cx} y={cy - 5} fontSize={Math.min(21, Math.max(13, R / 6.5))} textAnchor="middle"
        style={{ fill: "var(--map-fg)", fontWeight: 700, pointerEvents: "none" }}>{plasmid.name.slice(0, 22)}</text>
      <text x={cx} y={cy + 14} fontSize="12" textAnchor="middle"
        style={{ fill: "var(--map-dim)", fontFamily: MONO, pointerEvents: "none" }}>{L} bp · {plasmid.circular ? "环状" : "线性"}</text>
      {selLen > 0 && (
        <text x={cx} y={cy + 31} fontSize="10.5" textAnchor="middle"
          style={{ fill: "var(--px-accent)", fontFamily: MONO, pointerEvents: "none" }}>选区 {sel.a + 1}–{sel.b + 1}（{selLen} bp）</text>
      )}

      {/* 悬停提示 */}
      {hov && (() => {
        const w = Math.max(...hov.lines.map((l) => [...l].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 10.5 : 6.3), 0))) + 14, h = hov.lines.length * 13 + 8;
        const x = Math.min(svgW - w - 4, hov.x + 12), y = Math.min(H - h - 4, hov.y + 14);
        return (
          <g style={{ pointerEvents: "none" }}>
            <rect x={x} y={y} width={w} height={h} rx="5" style={{ fill: "var(--map-tip-bg, #1e293b)" }} opacity="0.94" />
            {hov.lines.map((l, i) => (
              <text key={i} x={x + 7} y={y + 15 + i * 13} fontSize="10.5" style={{ fill: "#fff", fontWeight: i === 0 ? 700 : 400, fontFamily: i === 0 ? undefined : MONO }}>{l}</text>
            ))}
          </g>
        );
      })()}
    </svg>
  );
}

// ==================== 线性图谱 ====================
function LinearMap({ plasmid, feats, sites, mapped, sel, selLen, L, svgW, H, enzMode, showPrimers, showLabels, pick, editF }) {
  const PAD = 26;
  const innerW = Math.max(200, svgW - PAD * 2);
  const sx = (bp0) => PAD + (bp0 / L) * innerW;

  const laid = packLanes(feats.map((f) => ({ ...f, x1: sx(f.start - 1), x2: sx(f.end) })));
  const laneCount = Math.max(1, ...laid.map((f) => f.lane + 1));
  const FEAT_H = 17, FEAT_GAP = 3;

  // 自上而下：酶名区 → 特征泳道 → 骨架 → 标尺 → 引物
  const ENZ_H = enzMode === "full" ? 66 : enzMode === "ticks" ? 14 : 0;
  const featsTop = ENZ_H + 8;
  const featsH = laneCount * (FEAT_H + FEAT_GAP);
  const BB_Y = featsTop + featsH + 12;
  const RULER_Y = BB_Y + 26;
  const PRIMER_Y = RULER_Y + 24;
  const needH = PRIMER_Y + (showPrimers && mapped.some((p) => p.hit) ? 34 : 10);
  const svgH = Math.max(H, needH);

  const step = niceStep(L, Math.max(4, Math.floor(innerW / 90)));
  const ticks = [];
  for (let bp = 0; bp <= L; bp += step) ticks.push(bp);
  if (ticks[ticks.length - 1] !== L) ticks.push(L);

  return (
    <svg width={svgW} height={svgH} className="block select-none" style={{ maxWidth: "100%" }}>
      {/* 选区 */}
      {selLen > 0 && (
        <rect x={sx(sel.a)} y={featsTop - 4} width={Math.max(2, sx(sel.b + 1) - sx(sel.a))} height={RULER_Y - featsTop + 10}
          fill="var(--px-accent)" opacity="0.15" style={{ pointerEvents: "none" }} />
      )}

      {/* 酶切刻度 + 旋转酶名 */}
      {enzMode !== "off" && sites.map((s, i) => {
        const x = sx(s.pos - 1);
        return (
          <g key={`e${i}`}>
            <line x1={x} y1={ENZ_H} x2={x} y2={BB_Y} stroke="#dc2626" strokeWidth="1" opacity="0.45" />
            {enzMode === "full" && (
              <text x={x} y={ENZ_H - 4} fontSize="9" textAnchor="start"
                transform={`rotate(-60 ${x.toFixed(2)} ${ENZ_H - 4})`}
                style={{ fill: "#dc2626", fontFamily: MONO }}>{s.name} {s.pos}</text>
            )}
            <title>{`${s.name} @ ${s.pos}`}</title>
          </g>
        );
      })}

      {/* 特征箭头 */}
      {laid.map((f, i) => {
        const y = featsTop + f.lane * (FEAT_H + FEAT_GAP);
        const wid = Math.max(f.x2 - f.x1, 3);
        const col = featColor(f);
        const dir = f.strand >= 0 ? 1 : -1;
        const tipX = dir > 0 ? f.x1 + wid : f.x1;
        const ah = Math.min(8, wid / 2);
        return (
          <g key={`f${i}`} className="cursor-pointer" onClick={() => pick(f)} onDoubleClick={() => editF && editF(f)}>
            <rect x={f.x1} y={y} width={wid} height={FEAT_H} rx={2} fill={col} opacity="0.88">
              <title>{`${f.label} (${f.key})\n${f.start}..${f.end} ${dir > 0 ? "→" : "←"} · ${f.end - f.start + 1} bp · 点击选中`}</title>
            </rect>
            <polygon points={`${tipX + dir * ah},${y + FEAT_H / 2} ${tipX},${y} ${tipX},${y + FEAT_H}`} fill={col} style={{ pointerEvents: "none" }} />
            {showLabels && wid > Math.max(50, f.label.length * 6.6) && (
              <text x={f.x1 + wid / 2} y={y + FEAT_H - 5} fontSize="10" textAnchor="middle"
                style={{ fill: "#fff", fontWeight: 600, pointerEvents: "none" }}>{f.label.slice(0, Math.floor(wid / 6.6))}</text>
            )}
          </g>
        );
      })}

      {/* 双链骨架 */}
      <line x1={PAD} y1={BB_Y} x2={PAD + innerW} y2={BB_Y} strokeWidth="2.5" style={{ stroke: "var(--map-bb)" }} />
      <line x1={PAD} y1={BB_Y + 7} x2={PAD + innerW} y2={BB_Y + 7} strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6" style={{ stroke: "var(--map-bb)" }} />
      <text x={PAD - 20} y={BB_Y + 3} fontSize="8" style={{ fill: "var(--map-dim)" }}>5′</text>
      <text x={PAD + innerW + 4} y={BB_Y + 3} fontSize="8" style={{ fill: "var(--map-dim)" }}>3′</text>
      <text x={PAD - 20} y={BB_Y + 11} fontSize="8" style={{ fill: "var(--map-faint)" }}>3′</text>
      <text x={PAD + innerW + 4} y={BB_Y + 11} fontSize="8" style={{ fill: "var(--map-faint)" }}>5′</text>

      {/* 标尺 */}
      {ticks.map((bp, i) => {
        const x = sx(Math.min(bp, L));
        return (
          <g key={`r${i}`}>
            <line x1={x} y1={RULER_Y - 6} x2={x} y2={RULER_Y} strokeWidth="1" style={{ stroke: "var(--map-faint)" }} />
            <text x={x} y={RULER_Y + 11} fontSize="9.5" textAnchor="middle"
              style={{ fill: "var(--map-dim)", fontFamily: MONO }}>{bp === 0 ? 1 : bp}</text>
          </g>
        );
      })}

      {/* 引物箭头 */}
      {showPrimers && mapped.filter((p) => p.hit).map((p, i) => {
        const x1 = sx(p.hit.pos - 1), x2 = sx(p.hit.pos - 1 + p.bindLen);
        const fwd = p.hit.strand === "+";
        const y = PRIMER_Y + (i % 2) * 14;
        const col = fwd ? "#0891b2" : "#7c3aed";
        const dir = fwd ? 1 : -1;
        const tip = fwd ? x2 : x1;
        return (
          <g key={p.id}>
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={col} strokeWidth="3.5" strokeLinecap="round">
              <title>{`${p.name} · ${fwd ? "正向 →" : "反向 ←"} @ ${p.hit.pos} · 结合 ${p.bindLen} bp`}</title>
            </line>
            <polygon points={`${tip + dir * 6},${y} ${tip},${y - 4} ${tip},${y + 4}`} fill={col} />
            <text x={(x1 + x2) / 2} y={y - 6} fontSize="9" textAnchor="middle" style={{ fill: col }}>{p.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ==================== 自选酶：勾选要在图谱上显示的酶 ====================
function EnzymePicker({ groups, chosen, onChange, onClose }) {
  const [q, setQ] = useState("");
  const shown = groups.filter((g) => !q.trim() || g.name.toLowerCase().includes(q.trim().toLowerCase()) || g.site.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (n) => { const s = new Set(chosen); if (s.has(n)) s.delete(n); else s.add(n); onChange([...s]); };
  const preset = (fn) => onChange(groups.filter(fn).map((g) => g.name));
  return (
    <>
      <div className="fixed inset-0 z-[45]" onClick={onClose} />
      <div className="absolute left-0 top-full mt-1 z-[46] w-64 pixel-panel shadow-2xl p-2.5">
        <div className="flex items-center gap-1 mb-1.5">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜酶名 / 识别序列"
            className="flex-1 px-2 py-1 text-[11px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-red-200" />
        </div>
        <div className="flex flex-wrap gap-1 mb-1.5 text-[10px]">
          <button onClick={() => preset((g) => g.count === 1 && siteLen(g.site) >= 6)} className="px-1.5 py-0.5 rounded border border-gray-200 hover:border-red-300">单切 6+</button>
          <button onClick={() => preset((g) => g.count === 1)} className="px-1.5 py-0.5 rounded border border-gray-200 hover:border-red-300">全部单切</button>
          <button onClick={() => onChange([])} className="px-1.5 py-0.5 rounded border border-gray-200 hover:border-red-300">清空</button>
          <span className="ml-auto text-gray-400 self-center tabular-nums">已选 {chosen.size}</span>
        </div>
        <div className="max-h-64 overflow-y-auto -mx-1">
          {shown.length === 0 && <div className="py-4 text-center text-[11px] text-gray-400">没有匹配的酶</div>}
          {shown.map((g) => (
            <label key={g.name} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer text-[11px]">
              <input type="checkbox" checked={chosen.has(g.name)} onChange={() => toggle(g.name)} className="accent-red-500" />
              <span className="font-medium text-red-600 w-16 truncate">{g.name}</span>
              <span className="font-mono text-[10px] text-gray-400 flex-1 truncate">{g.site}</span>
              <span className={`text-[9px] px-1 rounded-full tabular-nums ${g.count === 1 ? "bg-emerald-100 text-emerald-700" : g.count === 2 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>{g.count}</span>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
