// ==================== 时间线：当日总览(DNA比对) + 阅读框 + 放大详情 ====================
// 总览：每3h刻度、实验排列如序列比对、不连续线段、阅读框随滚动/缩放变化(可拖拽)
// 详情：分钟级自适应刻度、秒级光标读数、悬停变深、点击看详情、右键/长按新建
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus, Minus, LocateFixed, Star, Clock, History } from "lucide-react";
import { computeSteps, colorOf, timeStr, timeStrSec, dateStr, dayStart, addDays, relativeDayLabel, pad, setDragPayload, getDragPayload, clearDragPayload } from "../lib/core";
import { FlipGrid } from "../lib/useFlip";
import HelpTip from "./HelpTip";

const GUTTER_W = 118;    // 详情区左侧泳道栏
const LANE_H = 24;       // 详情泳道高（点11：变窄）
const RULER_H = 30;      // 详情标尺高
const OV_RULER = 16;     // 总览刻度区高
const OV_LANE = 9;       // 总览泳道高
const MIN_PX = 0.15, MAX_PX = 8;

// 根据缩放选择刻度间隔（分钟），保证间隔像素>=45
function pickInterval(pxPerMin) {
  const opts = [1440, 720, 360, 240, 180, 120, 60, 30, 15, 10, 5, 2, 1];
  for (const m of opts) if (m * pxPerMin >= 45) return m;
  return 1;
}

export default function Timeline({ sessions, now, selectedDate, calJump, onOpenDetail, onInsertAt, onVisibleDateChange, onReorder }) {
  const detailRef = useRef(null);
  const ovRef = useRef(null);
  const [pxPerMin, setPxPerMin] = useState(1.2);
  const [viewStart, setViewStart] = useState(() => now);
  const [width, setWidth] = useState(760);
  const [ovWidth, setOvWidth] = useState(760);
  const [hover, setHover] = useState(null);       // {seg, x, y}
  const [cursor, setCursor] = useState(null);      // {x, ts}
  const [ctx, setCtx] = useState(null);            // {x, y, ts}
  const [dragLane, setDragLane] = useState(null);  // 拖拽中的实验 id
  const [overLane, setOverLane] = useState(null);
  const pressRef = useRef(null);
  const frameDrag = useRef(null);

  // 宽度自适应
  useEffect(() => {
    const el = detailRef.current;
    const ov = ovRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { setWidth(el.clientWidth); if (ov) setOvWidth(ov.clientWidth); });
    ro.observe(el);
    setWidth(el.clientWidth);
    if (ov) setOvWidth(ov.clientWidth);
    return () => ro.disconnect();
  }, []);

  // 日历点击跳转
  useEffect(() => {
    if (calJump == null) return;
    const target = new Date(`${selectedDate}T00:00:00`).getTime();
    setViewStart(target === dayStart(now) ? now : target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calJump]);

  // 平移时同步锚定日
  useEffect(() => {
    const day = dateStr(viewStart + 60000);
    if (day !== selectedDate) onVisibleDateChange(day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewStart]);

  const visibleMs = (width / pxPerMin) * 60000;
  const visEnd = viewStart + visibleMs;
  const xOf = useCallback((ts) => ((ts - viewStart) / 60000) * pxPerMin, [viewStart, pxPerMin]);
  const tsAt = useCallback((x) => viewStart + (x / pxPerMin) * 60000, [viewStart, pxPerMin]);

  // 滚轮：Ctrl 缩放 / 普通平移
  useEffect(() => {
    const el = detailRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - GUTTER_W;
      if (e.ctrlKey) {
        setPxPerMin((prev) => {
          const next = Math.min(MAX_PX, Math.max(MIN_PX, prev * (e.deltaY < 0 ? 1.18 : 0.85)));
          const tAnchor = viewStart + (x / prev) * 60000;
          setViewStart(tAnchor - (x / next) * 60000);
          return next;
        });
      } else {
        setViewStart((v) => v + (e.deltaY + e.deltaX) * (60000 / pxPerMin));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [pxPerMin, viewStart, width]);

  // 长按空白插入
  const startPress = (e) => {
    if (e.button !== 0) return;
    const rect = detailRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - GUTTER_W;
    pressRef.current = { x0: e.clientX, y0: e.clientY, moved: false };
    pressRef.current.timer = setTimeout(() => {
      if (pressRef.current && !pressRef.current.moved) { onInsertAt(tsAt(x)); pressRef.current = null; }
    }, 550);
  };
  const movePress = (e) => {
    if (!pressRef.current) return;
    if (Math.abs(e.clientX - pressRef.current.x0) + Math.abs(e.clientY - pressRef.current.y0) > 8) {
      clearTimeout(pressRef.current.timer); pressRef.current.moved = true;
    }
  };
  const endPress = () => { if (pressRef.current) { clearTimeout(pressRef.current.timer); pressRef.current = null; } };

  // 泳道
  const lanes = sessions
    .map((s) => ({ s, steps: computeSteps(s, now) }))
    .filter(({ s, steps }) => {
      if (s.status === "running") return true;
      return steps.some((st) => st.start != null && st.start < visEnd && (st.end || st.start) > viewStart);
    })
    .slice(0, 8);

  // ===== 总览（当日 0-24h）=====
  const ovDay = dayStart(viewStart);
  const ovX = (ts) => ((ts - ovDay) / 86400000) * ovWidth;
  const ovTicks = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const frameLeft = Math.max(0, Math.min(ovWidth, ovX(viewStart)));
  const frameRight = Math.max(frameLeft + 6, Math.min(ovWidth, ovX(visEnd)));

  // 阅读框拖拽
  const frameDown = (e) => {
    e.stopPropagation();
    const rect = ovRef.current.getBoundingClientRect();
    frameDrag.current = { offset: ((e.clientX - rect.left) / ovWidth) * 86400000 - (viewStart - ovDay) };
  };
  useEffect(() => {
    const mm = (e) => {
      if (!frameDrag.current || !ovRef.current) return;
      const rect = ovRef.current.getBoundingClientRect();
      const cursorMs = ((e.clientX - rect.left) / ovWidth) * 86400000;
      setViewStart(ovDay + cursorMs - frameDrag.current.offset);
    };
    const mu = () => { frameDrag.current = null; };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
  }, [ovWidth, ovDay]);

  // 总览点击定位
  const ovClick = (e) => {
    const rect = ovRef.current.getBoundingClientRect();
    const ms = ((e.clientX - rect.left) / ovWidth) * 86400000;
    setViewStart(ovDay + ms - visibleMs / 2);
  };

  // 详情刻度（仅可见范围）
  const interval = pickInterval(pxPerMin);
  const ticks = [];
  {
    const stepMs = interval * 60000;
    const first = Math.floor(viewStart / stepMs) * stepMs;
    for (let t = first; t <= visEnd + stepMs; t += stepMs) {
      const x = xOf(t);
      if (x < -40 || x > width + 40) continue;
      const d = new Date(t);
      const isHour = d.getMinutes() === 0;
      const isMidnight = d.getHours() === 0 && d.getMinutes() === 0;
      ticks.push({ x, isHour, isMidnight, label: interval >= 60 ? `${pad(d.getHours())}:00` : `${pad(d.getHours())}:${pad(d.getMinutes())}`, dateLabel: `${d.getMonth() + 1}/${d.getDate()}` });
    }
  }

  const tomorrow0 = addDays(dayStart(now), 1);
  const detailBodyH = RULER_H + Math.max(lanes.length, 1) * LANE_H + 10;
  const ovBodyH = OV_RULER + Math.max(lanes.length, 1) * OV_LANE + 8;

  return (
    <div className="pixel-panel overflow-hidden select-none">
      {/* 工具条 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">时间线</span>
          <span className="text-[10px] text-gray-400">{relativeDayLabel(ovDay, now)} · {dateStr(ovDay)}</span>
          <HelpTip text="上方为当日总览（拖动阅读框定位）；下方放大查看。Ctrl+滚轮缩放，滚轮平移，悬停看概要，点击看详情，右键或长按空白新建实验。" />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setPxPerMin((p) => Math.min(MAX_PX, p * 1.3))} className="p-1 rounded hover:bg-gray-100 text-gray-400" title="放大"><Plus size={13} /></button>
          <button onClick={() => setPxPerMin((p) => Math.max(MIN_PX, p / 1.3))} className="p-1 rounded hover:bg-gray-100 text-gray-400" title="缩小"><Minus size={13} /></button>
          <button onClick={() => { setViewStart(now); setPxPerMin(1.2); }} className="p-1 rounded hover:bg-gray-100 text-indigo-500" title="回到现在"><LocateFixed size={13} /></button>
        </div>
      </div>

      {/* ===== 当日总览（DNA 序列比对式） ===== */}
      <div ref={ovRef} className="relative border-b border-gray-100 bg-gray-50/60 cursor-pointer" style={{ height: ovBodyH }} onClick={ovClick}>
        {ovTicks.map((h) => (
          <div key={h} className="absolute top-0 bottom-0 border-l border-gray-200" style={{ left: (h / 24) * ovWidth }}>
            <span className="absolute top-0.5 left-1 text-[8px] text-gray-400 tabular-nums">{pad(h % 24)}</span>
          </div>
        ))}
        {lanes.map(({ s, steps }, li) => {
          const c = colorOf(s);
          const top = OV_RULER + li * OV_LANE + 2;
          return steps.map((st, si) => {
            if (st.start == null) return null;
            const endTs = st.end || st.start + 30 * 60000;
            if (endTs < ovDay || st.start > ovDay + 86400000) return null;
            const x1 = Math.max(0, ovX(st.start));
            const x2 = Math.min(ovWidth, ovX(endTs));
            const gap = si > 0 ? 1.5 : 0;
            if (x2 - x1 - gap < 1.5) return null;
            return (
              <div key={st.id}
                onClick={(e) => { e.stopPropagation(); onOpenDetail(s.id); }}
                className={`absolute rounded-full ${st.status === "active" ? c.bar : st.status === "done" ? c.bar + " opacity-40" : c.soft + " border " + c.border} hover:opacity-70 cursor-pointer`}
                style={{ left: x1 + gap, width: x2 - x1 - gap, top, height: OV_LANE - 4 }} />
            );
          });
        })}
        {/* 阅读框 */}
        <div onMouseDown={frameDown}
          className="absolute top-0 bottom-0 border-2 border-indigo-500 bg-indigo-500/10 rounded cursor-grab active:cursor-grabbing z-10"
          style={{ left: frameLeft, width: frameRight - frameLeft }}
          title="拖动阅读框定位">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-3 bg-indigo-500 rounded-full" />
        </div>
      </div>

      {/* ===== 放大详情 ===== */}
      <div ref={detailRef} className="relative overflow-hidden cursor-crosshair" style={{ height: detailBodyH }}
        onMouseDown={startPress}
        onMouseMove={(e) => { movePress(e); const r = detailRef.current.getBoundingClientRect(); const x = e.clientX - r.left - GUTTER_W; setCursor({ x, ts: tsAt(x) }); }}
        onMouseUp={endPress}
        onMouseLeave={() => { endPress(); setHover(null); setCursor(null); }}
        onContextMenu={(e) => { e.preventDefault(); const r = detailRef.current.getBoundingClientRect(); const x = e.clientX - r.left - GUTTER_W; setCtx({ x: e.clientX, y: e.clientY, ts: tsAt(x) }); }}>
        <div className="relative" style={{ width: width, height: detailBodyH }}>
          {/* 左侧泳道栏 */}
          <div className="absolute left-0 top-0 bottom-0 bg-white z-30 border-r border-gray-100" style={{ width: GUTTER_W }}>
            <div style={{ height: RULER_H }} className="border-b border-gray-100 flex items-center px-2 text-[9px] text-gray-300">实验泳道</div>
            <FlipGrid orderKey={lanes.map(({ s }) => s.id).join(",")}>
            {lanes.map(({ s }) => {
              const c = colorOf(s);
              const isOver = overLane && overLane.id === s.id && dragLane !== s.id;
              return (
                <div key={s.id} data-flip-key={s.id} draggable={!!onReorder}
                  onDragStart={(e) => { setDragLane(s.id); setDragPayload({ type: "session", id: s.id }); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", s.id); } catch { /* ignore */ } }}
                  onDragEnd={() => { setDragLane(null); setOverLane(null); clearDragPayload(); }}
                  onDragOver={(e) => {
                    if (!onReorder) return;
                    const p = getDragPayload();
                    if (!p || p.type !== "session" || p.id === s.id) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pos = e.clientY < rect.top + rect.height / 2 ? "top" : "bottom";
                    if (!overLane || overLane.id !== s.id || overLane.pos !== pos) setOverLane({ id: s.id, pos });
                    onReorder(p.id, s.id, pos === "bottom" ? "after" : "before"); // 磁贴实时换位
                  }}
                  onDragLeave={() => setOverLane((o) => (o && o.id === s.id ? null : o))}
                  onDrop={(e) => {
                    if (!onReorder) return;
                    e.preventDefault();
                    setDragLane(null); setOverLane(null); clearDragPayload();
                  }}
                  title={onReorder ? "拖拽泳道可调整实验顺序" : undefined}
                  className={`relative flex items-center gap-1.5 px-2 border-b border-gray-50 ${onReorder ? "cursor-grab active:cursor-grabbing" : ""} ${isOver ? "bg-indigo-50 ring-1 ring-inset ring-indigo-400" : ""} ${dragLane === s.id ? "opacity-40" : ""}`}
                  style={{ height: LANE_H }}>
                  {/* 点4：泳道插入提示线 */}
                  {isOver && overLane.pos === "top" && <div className="absolute left-1 right-1 -top-px h-0.5 rounded-full bg-indigo-500 z-10 pointer-events-none" style={{ boxShadow: "0 0 6px 1px rgba(99,102,241,0.6)" }} />}
                  {isOver && overLane.pos === "bottom" && <div className="absolute left-1 right-1 -bottom-px h-0.5 rounded-full bg-indigo-500 z-10 pointer-events-none" style={{ boxShadow: "0 0 6px 1px rgba(99,102,241,0.6)" }} />}
                  <span className={`w-1.5 h-1.5 rounded-full ${c.bar} flex-shrink-0`} />
                  {s.star && <Star size={9} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
                  <button onClick={() => onOpenDetail(s.id)} className="text-[10px] text-gray-600 truncate hover:text-indigo-600 text-left">{s.name}</button>
                </div>
              );
            })}
            {lanes.length === 0 && <div className="px-2 py-3 text-[10px] text-gray-300">暂无实验</div>}
            </FlipGrid>
          </div>

          {/* 时间区 */}
          <div className="absolute top-0 bottom-0" style={{ left: GUTTER_W, width: width - GUTTER_W }}>
            {tomorrow0 < visEnd && (
              <div className="absolute top-0 bottom-0 bg-indigo-50/40 pointer-events-none" style={{ left: Math.max(0, xOf(tomorrow0)), right: 0 }} />
            )}
            {ticks.map((tk, i) => (
              <div key={i} className={`absolute top-0 bottom-0 ${tk.isMidnight ? "border-l border-indigo-300" : tk.isHour ? "border-l border-gray-200" : "border-l border-gray-100"}`} style={{ left: tk.x }}>
                {tk.isMidnight ? (
                  <span className="absolute top-0.5 left-1 text-[9px] font-semibold text-indigo-500 whitespace-nowrap">{tk.dateLabel}</span>
                ) : tk.isHour ? (
                  <span className="absolute top-0.5 left-1 text-[9px] text-gray-400 tabular-nums">{tk.label}</span>
                ) : (
                  <span className="absolute top-0.5 left-1 text-[8px] text-gray-300 tabular-nums">{tk.label}</span>
                )}
              </div>
            ))}
            {lanes.map((_, i) => (
              <div key={i} className="absolute left-0 right-0 border-t border-gray-50" style={{ top: RULER_H + i * LANE_H }} />
            ))}
            {lanes.map(({ s, steps }, li) => {
              const c = colorOf(s);
              const top = RULER_H + li * LANE_H + 7;
              return steps.map((st, si) => {
                if (st.start == null) return null;
                const endTs = st.end || st.start + 30 * 60000;
                if (endTs < viewStart || st.start > visEnd) return null;
                const x1 = xOf(st.start);
                const x2 = xOf(endTs);
                const gap = si > 0 ? 2 : 0;
                const left = x1 + gap;
                const w = Math.max(x2 - x1 - gap, 6);
                const active = st.status === "active";
                const done = st.status === "done";
                const hovered = hover && hover.seg.st.id === st.id;
                // 悬停：浅色 → 深色
                const cls = hovered
                  ? `${c.bar} shadow-md`
                  : active ? `${c.bar} shadow` : done ? `${c.bar} opacity-40` : `${c.soft} border ${c.border}`;
                return (
                  <div key={st.id}
                    onMouseEnter={(e) => setHover({ seg: { s, st }, x: e.clientX, y: e.clientY })}
                    onMouseMove={(e) => setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h))}
                    onMouseLeave={() => setHover(null)}
                    onClick={(e) => { e.stopPropagation(); endPress(); onOpenDetail(s.id); }}
                    className={`absolute rounded-full cursor-pointer transition-colors duration-150 ${cls}`}
                    style={{ left, width: w, top, height: LANE_H - 14 }} />
                );
              });
            })}
            {/* 当前时间线（秒级）：时间戳置顶，避免对齐左缘时被泳道栏遮挡 */}
            {now >= viewStart && now <= visEnd && (
              <>
                <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: xOf(now) }}>
                  <div className="absolute top-4 bottom-0 w-px bg-red-500" />
                </div>
                <div className="absolute top-0.5 z-40 pointer-events-none px-1.5 py-px rounded bg-red-500 text-white text-[9px] font-bold tabular-nums whitespace-nowrap shadow"
                  style={{ left: Math.max(2, Math.min(xOf(now) - 26, width - GUTTER_W - 62)) }}>
                  {timeStrSec(now)}
                </div>
              </>
            )}
            {/* 光标读秒定位线 */}
            {cursor && cursor.x >= 0 && cursor.x <= width - GUTTER_W && (
              <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: cursor.x }}>
                <div className="tl-cursor-line absolute top-4 bottom-0 w-px bg-gray-300" />
                <div className="tl-cursor-tag absolute bottom-0.5 -left-[22px] px-1 py-px rounded bg-gray-700 text-white text-[8px] tabular-nums whitespace-nowrap">{timeStrSec(cursor.ts)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 悬停概要 */}
      {hover && createPortal(
        <div className="fixed z-50 pointer-events-none bg-gray-900/95 text-white rounded-lg px-2.5 py-1.5 text-[10px] shadow-xl max-w-[220px]" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <div className="font-semibold truncate">{hover.seg.s.name}</div>
          <div className="text-gray-300 truncate">{hover.seg.st.name}</div>
          <div className="text-gray-400 tabular-nums">{timeStr(hover.seg.st.start)}{hover.seg.st.end ? " – " + timeStr(hover.seg.st.end) : ""} · 点击查看详情</div>
        </div>,
        document.body
      )}

      {/* 右键菜单（点6：风格化） */}
      {ctx && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtx(null)} onContextMenu={(e) => { e.preventDefault(); setCtx(null); }} />
          <div className="fixed z-50 bg-[var(--px-paper)] rounded-xl shadow-2xl border-2 border-[var(--px-ink)] py-1 w-52 overflow-hidden" style={{ left: ctx.x, top: ctx.y }}>
            <div className="px-3 py-1.5 text-[9px] font-semibold tracking-widest text-gray-400 border-b border-gray-100 flex items-center gap-1"><Clock size={10} />{timeStr(ctx.ts)} · 时间线操作</div>
            <button onClick={() => { onInsertAt(ctx.ts); setCtx(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
              <Plus size={13} className="text-indigo-500" />在此时间新建实验
            </button>
            <button onClick={() => { setViewStart(now); setPxPerMin(1.2); setCtx(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
              <History size={13} className="text-gray-400" />回到现在
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
