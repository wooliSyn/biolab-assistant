// ==================== 质粒图谱（SnapGene 式环形 / 线性大图谱） ====================
// 环形：骨架圆 + 碱基刻度 + 特征弧（按链内外分层，带箭头与沿弧标签）
//       + 外环酶切刻度（标签用阶梯避让 + 引线）+ 中心标题 + 选区弧
// 线性：双链骨架 + 标尺 + 分泳道特征箭头 + 上方酶切（旋转标签）+ 下方引物 + 选区
// 主题：所有图表色走 --map-* 变量（index.css 三主题各自定义），用 inline style 下发，
//       因为 SVG 展示属性对 var() 的支持不可靠，必须走 CSS 属性。
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleDot, Minus as MinusIcon, Scissors, MapPin, Tag } from "lucide-react";
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

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const TOOLBAR_H = 38;

export default function MapView({ plasmid, sites, mapped = [], sel, setSel, onLocate, height = 460 }) {
  const boxRef = useRef(null);
  const [w, setW] = useState(760);
  const [mode, setMode] = useState(plasmid.circular ? "circular" : "linear");
  // 位点图层三态：low=仅单/双切酶（与酶切面板默认一致，克隆最有用）→ all=全部 → off=关
  // 不跟上这个约定的话，4bp 高频切酶（AluI/TaqI/DpnI/HaeIII…）会把环外糊成一片红
  const [enzLevel, setEnzLevel] = useState("low");
  const [showPrimers, setShowPrimers] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  // 切换质粒：拓扑决定默认视图
  useEffect(() => { setMode(plasmid.circular ? "circular" : "linear"); }, [plasmid.id, plasmid.circular]);

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
  const shownSites = useMemo(
    () => (enzLevel === "off" ? [] : enzLevel === "all" ? sites : sites.filter((s) => (siteCount.get(s.name) || 0) <= 2)),
    [sites, siteCount, enzLevel]
  );
  const hiddenHighFreq = enzLevel === "low" ? sites.length - shownSites.length : 0;
  // 性能护栏：位点过多时只画刻度不画名字；极端情况整体省略（与"大序列必须折叠"同一原则）
  const enzMode = enzLevel === "off" ? "off" : shownSites.length > 400 ? "off" : shownSites.length > 90 ? "ticks" : "full";

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
        <div className="flex items-center rounded-lg border border-[var(--px-ink)] overflow-hidden">
          <button onClick={() => setMode("circular")} disabled={!plasmid.circular}
            title={plasmid.circular ? "环形图谱" : "线性序列无环形图谱"}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] transition disabled:opacity-30 disabled:cursor-default ${mode === "circular" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            <CircleDot size={12} />环形
          </button>
          <button onClick={() => setMode("linear")}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] transition ${mode === "linear" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            <MinusIcon size={12} />线性
          </button>
        </div>
        <span className="text-[10px] ml-1" style={{ color: "var(--map-faint)" }}>图层</span>
        <button onClick={() => setEnzLevel((v) => (v === "low" ? "all" : v === "all" ? "off" : "low"))}
          className={`flex items-center gap-1 px-2 py-1 text-[10px] border rounded-lg transition ${enzLevel !== "off" ? "bg-red-50 border-red-300 text-red-600" : "bg-white border-gray-200 text-gray-400 hover:border-red-200"}`}
          title={"酶切位点图层：仅单/双切 → 全部 → 关闭（点击循环）\n高频切酶（4bp 识别）位点密集，默认不画"}>
          <Scissors size={11} />位点
          <span className="px-1 rounded-full text-[9px]" style={{ background: "var(--px-ink-soft)" }}>
            {enzLevel === "low" ? "单/双切" : enzLevel === "all" ? "全部" : "关"}
          </span>
        </button>
        <button onClick={() => setShowPrimers((v) => !v)}
          className={`flex items-center gap-1 px-2 py-1 text-[10px] border rounded-lg transition ${showPrimers ? "bg-cyan-50 border-cyan-300 text-cyan-700" : "bg-white border-gray-200 text-gray-400 hover:border-cyan-200"}`}
          title="显示/隐藏引物图层">
          <MapPin size={11} />引物
        </button>
        <button onClick={() => setShowLabels((v) => !v)}
          className={`flex items-center gap-1 px-2 py-1 text-[10px] border rounded-lg transition ${showLabels ? "bg-indigo-50 border-indigo-300 text-indigo-600" : "bg-white border-gray-200 text-gray-400 hover:border-indigo-200"}`}
          title="显示/隐藏元件名称">
          <Tag size={11} />名称
        </button>
        <span className="ml-auto text-[10px] tabular-nums" style={{ color: "var(--map-dim)" }}>
          {feats.length} 元件 · {shownSites.length}/{sites.length} 位点
          {hiddenHighFreq > 0 ? `（已隐去 ${hiddenHighFreq} 个高频切点）` : ""}
          {enzMode === "ticks" ? "（密集，仅画刻度）" : enzLevel !== "off" && enzMode === "off" ? "（过多，已省略）" : ""}
        </span>
      </div>

      {/* 图谱画布 */}
      <div ref={boxRef} className="flex-1 min-h-0 overflow-auto px-2 py-1">
        {mode === "circular" ? (
          <CircularMap {...{ plasmid, feats, sites: shownSites, mapped, sel, selLen, L, svgW, H, enzMode, showPrimers, showLabels, pick }} />
        ) : (
          <LinearMap {...{ plasmid, feats, sites: shownSites, mapped, sel, selLen, L, svgW, H, enzMode, showPrimers, showLabels, pick }} />
        )}
      </div>
    </div>
  );
}

// ==================== 环形图谱 ====================
function CircularMap({ plasmid, feats, sites, mapped, sel, selLen, L, svgW, H, enzMode, showPrimers, showLabels, pick }) {
  // 半径留足外侧酶名与内侧元件名的空间；字号放大后这里必须同步缩圈，否则标签会顶到画布边
  const R = Math.max(62, Math.min(svgW / 2 - 150, H / 2 - 74));
  const cy = H / 2;
  const ang = (bp) => ((bp - 1) / L) * Math.PI * 2 - Math.PI / 2;

  // 圆心横向偏移：标签只长在有元件/位点的角度上，质粒的 MCS 之类又常常挤在一小段弧里，
  // 结果一侧糊成一片、另一侧大片空白。按左右半圆的标签数量把圆心推向空的一侧，
  // 等于把画布宽度分给真正需要的那边。只用角度算，与 cx 无关，所以能先算再定 cx。
  const labelAngles = [
    ...sites.map((x) => ang(x.pos)),
    ...feats.map((f) => { const a1 = ang(f.start); let a2 = ang(f.end + 1); if (a2 <= a1) a2 += Math.PI * 2; return (a1 + a2) / 2; }),
  ];
  const bias = labelAngles.reduce((n, a) => n + (Math.cos(a) >= 0 ? 1 : -1), 0); // 正=右侧更挤
  const MAX_SHIFT = Math.min(96, svgW * 0.12);
  const cx = svgW / 2 - Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, bias * 6));

  const pt = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const arcPath = (r, a1, a2) => {
    const [x1, y1] = pt(r, a1), [x2, y2] = pt(r, a2);
    const large = a2 - a1 > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  // 特征角度区间（环状跨原点时 a2 补 2π）
  const span = (f) => {
    const a1 = ang(f.start);
    let a2 = ang(f.end + 1);
    if (a2 <= a1) a2 += Math.PI * 2;
    const minSweep = 0.025;
    if (a2 - a1 < minSweep) a2 = a1 + minSweep;
    // 跨满整圈时起止点重合，单段 A 弧会整条消失 → 留一道缝
    const maxSweep = Math.PI * 2 - 0.03;
    if (a2 - a1 > maxSweep) a2 = a1 + maxSweep;
    return [a1, a2];
  };

  const ARC_W = 9;
  const rOf = (f) => (f.strand > 0 ? R + ARC_W + 1 : f.strand < 0 ? R - ARC_W - 1 : R);

  // ---------- 碱基刻度 ----------
  const step = niceStep(L, 10);
  const ticks = [];
  for (let bp = step; bp <= L; bp += step) ticks.push(bp);

  // ---------- 特征标签：弧够长则沿弧标注，否则进内侧阶梯 ----------
  const onArc = [], inner = [];
  if (showLabels) {
    for (const f of feats) {
      const [a1, a2] = span(f);
      const mid = (a1 + a2) / 2;
      const arcLen = (a2 - a1) * rOf(f);
      if (arcLen > Math.max(52, f.label.length * 6.6)) onArc.push({ f, mid, a1, a2 });
      else inner.push({ f, mid });
    }
  }
  // 内侧阶梯按左右半分组
  const innerR = Math.max(26, R - ARC_W - 30);
  const mkInner = (side) => {
    const picked = inner
      .filter((it) => (side === "r" ? Math.cos(it.mid) >= 0 : Math.cos(it.mid) < 0))
      .map((it) => ({ ...it, y: cy + innerR * Math.sin(it.mid) }));
    return ladder(picked, 13.5, cy - innerR, cy + innerR);
  };
  const innerR_ = mkInner("r"), innerL = mkInner("l");

  // ---------- 酶名阶梯（外侧） ----------
  const enzLabels = [];
  if (enzMode === "full") {
    const RL = R + ARC_W + 18;
    const mk = (side) => {
      const picked = sites
        .filter((s) => (side === "r" ? Math.cos(ang(s.pos)) >= 0 : Math.cos(ang(s.pos)) < 0))
        .map((s) => ({ s, a: ang(s.pos), y: cy + RL * Math.sin(ang(s.pos)) }));
      // 钳位要留出基线偏移(+3.5)和字母下沿的空间，否则最底下那条酶名会被画布切掉
      return ladder(picked, 13, 14, H - 14).map((it) => ({ ...it, side }));
    };
    enzLabels.push(...mk("r"), ...mk("l"));
  }

  return (
    <svg width={svgW} height={H} className="block select-none" style={{ maxWidth: "100%" }}>
      {/* 骨架圆 */}
      <circle cx={cx} cy={cy} r={R} fill="none" strokeWidth="3" style={{ stroke: "var(--map-bb)" }} />

      {/* 碱基刻度 */}
      {ticks.map((bp) => {
        const a = ang(bp);
        const [x1, y1] = pt(R - 3, a), [x2, y2] = pt(R - 9, a);
        const [tx, ty] = pt(R - 18, a);
        return (
          <g key={`t${bp}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1" style={{ stroke: "var(--map-faint)" }} />
            <text x={tx} y={ty + 3} fontSize="9" textAnchor="middle" style={{ fill: "var(--map-faint)", fontFamily: MONO, pointerEvents: "none" }}>{bp}</text>
          </g>
        );
      })}

      {/* 选区弧 */}
      {selLen > 0 && (() => {
        const a1 = ang(sel.a + 1);
        let a2 = ang(sel.b + 2);
        if (a2 <= a1) a2 += Math.PI * 2;
        const [bx1, by1] = pt(R - ARC_W - 6, a1), [bx2, by2] = pt(R + ARC_W + 6, a1);
        const [ex1, ey1] = pt(R - ARC_W - 6, a2), [ex2, ey2] = pt(R + ARC_W + 6, a2);
        return (
          <g style={{ pointerEvents: "none" }}>
            <path d={arcPath(R, a1, a2)} fill="none" stroke="var(--px-accent)" strokeWidth={ARC_W * 2 + 10} opacity="0.17" />
            <line x1={bx1} y1={by1} x2={bx2} y2={by2} stroke="var(--px-accent)" strokeWidth="1.5" opacity="0.8" />
            <line x1={ex1} y1={ey1} x2={ex2} y2={ey2} stroke="var(--px-accent)" strokeWidth="1.5" opacity="0.8" />
          </g>
        );
      })()}

      {/* 特征弧 + 箭头 */}
      {feats.map((f, i) => {
        const [a1, a2] = span(f);
        const r = rOf(f);
        const col = featColor(f);
        const fwd = f.strand >= 0;
        const aTip = fwd ? a2 : a1;
        const [tipX, tipY] = pt(r, aTip);
        // 箭头：沿切线方向的小三角
        const tangent = aTip + (fwd ? Math.PI / 2 : -Math.PI / 2);
        const ah = 7;
        const [bx, by] = [tipX + Math.cos(tangent) * ah, tipY + Math.sin(tangent) * ah];
        const nx = Math.cos(aTip) * (ARC_W / 2 + 1), ny = Math.sin(aTip) * (ARC_W / 2 + 1);
        return (
          <g key={`f${i}`} className="cursor-pointer" onClick={() => pick(f)}>
            <path d={arcPath(r, a1, a2)} fill="none" stroke={col} strokeWidth={ARC_W} opacity="0.88" strokeLinecap="butt">
              <title>{`${f.label} (${f.key})\n${f.start}..${f.end} ${fwd ? "→" : "←"} · ${f.end - f.start + 1} bp · 点击选中`}</title>
            </path>
            <polygon points={`${bx},${by} ${tipX - nx},${tipY - ny} ${tipX + nx},${tipY + ny}`} fill={col} style={{ pointerEvents: "none" }} />
          </g>
        );
      })}

      {/* 沿弧特征名 */}
      {onArc.map(({ f, mid }, i) => {
        const r = rOf(f);
        const [x, y] = pt(r, mid);
        const deg = (mid * 180) / Math.PI;
        const flip = Math.cos(mid) < 0 || Math.abs(deg) > 90;
        const rot = flip ? deg - 90 : deg + 90;
        return (
          <text key={`al${i}`} x={x} y={y} fontSize="10" textAnchor="middle" dominantBaseline="middle"
            transform={`rotate(${rot.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})`}
            style={{ fill: "#fff", fontWeight: 600, pointerEvents: "none" }}>{f.label.slice(0, 26)}</text>
        );
      })}

      {/* 内侧短特征名阶梯 */}
      {[...innerR_, ...innerL].map(({ f, mid, y }, i) => {
        const right = Math.cos(mid) >= 0;
        const [ax, ay] = pt(R - ARC_W - 4, mid);
        const elbowX = cx + (right ? 1 : -1) * (innerR - 6);
        const tx = elbowX + (right ? -4 : 4);
        return (
          <g key={`il${i}`} className="cursor-pointer" onClick={() => pick(f)}>
            {/* 引线用元件色承担"哪条对哪个"的关联；文字走主题前景色——
                元件的数据色（如 misc_feature 的 #64748b）是按浅底调的，
                放到莱茵暗底上几乎不可见。 */}
            <polyline points={`${ax},${ay} ${elbowX},${y} ${tx},${y}`} fill="none" strokeWidth="0.9" opacity="0.75" style={{ stroke: featColor(f) }} />
            <circle cx={tx + (right ? 3 : -3)} cy={y} r="1.7" style={{ fill: featColor(f) }} />
            <text x={tx + (right ? -3 : 3)} y={y + 3.5} fontSize="10" textAnchor={right ? "end" : "start"} style={{ fill: "var(--map-fg)" }}>
              {f.label.slice(0, 18)}
              <title>{`${f.label} · ${f.start}..${f.end}`}</title>
            </text>
          </g>
        );
      })}

      {/* 酶切刻度 */}
      {enzMode !== "off" && sites.map((s, i) => {
        const a = ang(s.pos);
        const [x1, y1] = pt(R + ARC_W + 2, a), [x2, y2] = pt(R + ARC_W + 11, a);
        return <line key={`e${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#dc2626" strokeWidth="1.3" opacity="0.85"><title>{`${s.name} @ ${s.pos}`}</title></line>;
      })}

      {/* 酶名阶梯 + 引线 */}
      {enzLabels.map(({ s, a, y, side }, i) => {
        const right = side === "r";
        const [ax, ay] = pt(R + ARC_W + 11, a);
        const elbowX = cx + (right ? 1 : -1) * (R + ARC_W + 20);
        const tx = elbowX + (right ? 3 : -3);
        return (
          <g key={`en${i}`}>
            <polyline points={`${ax},${ay} ${elbowX},${y} ${tx},${y}`} fill="none" stroke="#dc2626" strokeWidth="0.7" opacity="0.4" />
            <text x={tx + (right ? 2 : -2)} y={y + 3.5} fontSize="9.5" textAnchor={right ? "start" : "end"}
              style={{ fill: "#dc2626", fontFamily: MONO }}>{s.name} {s.pos}</text>
          </g>
        );
      })}

      {/* 引物弧 */}
      {showPrimers && mapped.filter((p) => p.hit).map((p) => {
        const a1 = ang(p.hit.pos);
        let a2 = ang(p.hit.pos + p.bindLen);
        if (a2 <= a1) a2 += Math.PI * 2;
        const fwd = p.hit.strand === "+";
        const r = fwd ? R + ARC_W * 2 + 4 : R - ARC_W * 2 - 4;
        const col = fwd ? "#0891b2" : "#7c3aed";
        return (
          <path key={p.id} d={arcPath(r, a1, a2)} fill="none" stroke={col} strokeWidth="3.5" strokeLinecap="round" opacity="0.9">
            <title>{`${p.name} · ${fwd ? "正向 →" : "反向 ←"} @ ${p.hit.pos} · 结合 ${p.bindLen} bp`}</title>
          </path>
        );
      })}

      {/* 中心标题 */}
      <text x={cx} y={cy - 5} fontSize={Math.min(21, Math.max(14, R / 6.5))} textAnchor="middle"
        style={{ fill: "var(--map-fg)", fontWeight: 700, pointerEvents: "none" }}>{plasmid.name.slice(0, 22)}</text>
      <text x={cx} y={cy + 15} fontSize="12" textAnchor="middle"
        style={{ fill: "var(--map-dim)", fontFamily: MONO, pointerEvents: "none" }}>{L} bp · {plasmid.circular ? "环状" : "线性"}</text>
      {selLen > 0 && (
        <text x={cx} y={cy + 33} fontSize="10.5" textAnchor="middle"
          style={{ fill: "var(--px-accent)", fontFamily: MONO, pointerEvents: "none" }}>选区 {sel.a + 1}–{sel.b + 1}（{selLen} bp）</text>
      )}
    </svg>
  );
}

// ==================== 线性图谱 ====================
function LinearMap({ plasmid, feats, sites, mapped, sel, selLen, L, svgW, H, enzMode, showPrimers, showLabels, pick }) {
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
          <g key={`f${i}`} className="cursor-pointer" onClick={() => pick(f)}>
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
