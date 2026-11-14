// ==================== 长按磁贴拖拽（点2：磁力贴式长按选中 → 拖拽实时换位） ====================
// 桌面鼠标优先，兼顾触控。长按 delay 毫秒激活拖拽；激活前移动超过 tolerance 视为滚动/点击，自动取消。
// 激活后指针扫过其它条目即实时换位（配合 FlipGrid 的 FLIP 动画，呈现 Windows 磁贴式平滑让位）。
//
// 用法：
//   const { dragId, over, onPointerDown } = useLongPressDrag(reorder, { axis: "auto" });
//   <div data-drag-id={item.id} onPointerDown={(e) => onPointerDown(e, item.id)}
//        className={dragId === item.id ? "lpd-dragging" : ""}>…</div>
//   reorder(fromId, toId, pos="before"|"after") 由列表自行实现（ splice 换位）。
//
// axis: "y" 纵向列表按上下判前后；"x" 横向按左右；"auto" 网格综合左右+上下。
import { useCallback, useEffect, useRef, useState } from "react";

export function useLongPressDrag(reorder, { delay = 300, tolerance = 8, axis = "y" } = {}) {
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null); // { id, pos }
  const s = useRef(null);
  const reorderRef = useRef(reorder);
  reorderRef.current = reorder;

  const stop = useCallback(() => {
    if (s.current && s.current.timer) clearTimeout(s.current.timer);
    s.current = null;
    setDragId(null);
    setOver(null);
    document.body.classList.remove("lpd-active");
  }, []);

  const onPointerDown = useCallback((e, id) => {
    if (e.button !== undefined && e.button !== 0) return;
    // 交互元素内部不触发拖拽（输入框/按钮/链接/可编辑区/显式排除）
    if (e.target.closest && e.target.closest("input,textarea,select,button,a,[contenteditable=true],[data-no-drag]")) return;
    if (s.current && s.current.timer) clearTimeout(s.current.timer);
    const x = e.clientX, y = e.clientY;
    const timer = setTimeout(() => {
      if (!s.current) return;
      s.current.active = true;
      s.current.lx = x; s.current.ly = y;
      setDragId(id);
      document.body.classList.add("lpd-active");
      try { if (navigator.vibrate) navigator.vibrate(12); } catch { /* ignore */ }
    }, delay);
    s.current = { id, x, y, active: false, timer };
  }, [delay]);

  useEffect(() => {
    const move = (e) => {
      const st = s.current;
      if (!st) return;
      if (!st.active) {
        // 激活前：明显位移 → 取消（让位给滚动/普通点击）
        if (Math.hypot(e.clientX - st.x, e.clientY - st.y) > tolerance) {
          clearTimeout(st.timer);
          s.current = null;
        }
        return;
      }
      if (e.cancelable) e.preventDefault();
      const now = performance.now();
      // 温和换位：节流（≥160ms 一次）+ 位移门槛（自上次换位指针须移动 ≥5px），
      // 避免静止指针下条目流动引起的反复抖动（鬼畜）
      if (st.lastSwap && now - st.lastSwap < 160) return;
      if (st.lx != null && Math.hypot(e.clientX - st.lx, e.clientY - st.ly) < 5) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const item = el && el.closest ? el.closest("[data-drag-id]") : null;
      const oid = item ? item.getAttribute("data-drag-id") : null;
      if (!oid || oid === st.id) { setOver(null); return; }
      const r = item.getBoundingClientRect();
      let after;
      if (axis === "x") after = e.clientX > r.left + r.width / 2;
      else if (axis === "y") after = e.clientY > r.top + r.height / 2;
      else after = ((e.clientX - r.left) / Math.max(1, r.width) + (e.clientY - r.top) / Math.max(1, r.height)) > 1;
      const pos = after ? "after" : "before";
      // 同目标同方向不重复换位
      if (st.lastOid === oid && st.lastPos === pos) return;
      setOver({ id: oid, pos });
      reorderRef.current(st.id, oid, pos);
      st.lastSwap = now; st.lx = e.clientX; st.ly = e.clientY; st.lastOid = oid; st.lastPos = pos;
    };
    const up = () => stop();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [axis, tolerance, stop]);

  return { dragId, over, onPointerDown, stop };
}

// 通用 splice 换位（供各列表复用）：把 fromId 移到 toId 的前/后
export function arrayReorder(list, fromId, toId, pos = "before", idOf = (x) => x.id) {
  if (!fromId || fromId === toId) return list;
  const from = list.findIndex((x) => idOf(x) === fromId);
  const to = list.findIndex((x) => idOf(x) === toId);
  if (from === -1 || to === -1) return list;
  let idx = to + (pos === "after" ? 1 : 0);
  if (from < to) idx -= 1;
  if (from === idx) return list;
  const c = [...list];
  const [it] = c.splice(from, 1);
  c.splice(idx, 0, it);
  return c;
}