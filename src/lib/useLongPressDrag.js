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
//
// 防抖动 / 防误操作：
// - 换位后「锁住」刚换过的目标，指针离开它之前不再对它换位。条目高矮不一时
//   （工具箱卡片、配方），换完指针常常还压在刚换过来的那张上，不锁就会来回抽搐。
// - 激活时清掉已选中的文字，拖动期间拦截 selectstart / dragstart（长按的 300ms 里
//   浏览器已经开始了「按下即选字」，光靠 user-select:none 拦不住）。
// - 指针贴近可滚动容器的上下边缘时自动滚动，才能拖到当前看不见的位置。
// - 条目外层可加 data-drag-scope：只在同一个 scope 里找目标（同一页有两组共用 id 的条目时用）。
import { useCallback, useEffect, useRef, useState } from "react";

export function useLongPressDrag(reorder, { delay = 300, tolerance = 8, axis = "y" } = {}) {
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null); // { id, pos }
  const s = useRef(null);
  const reorderRef = useRef(reorder);
  reorderRef.current = reorder;

  const stop = useCallback(() => {
    if (s.current && s.current.timer) clearTimeout(s.current.timer);
    if (s.current && s.current.raf) cancelAnimationFrame(s.current.raf);
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
    const el = e.currentTarget;
    const timer = setTimeout(() => {
      if (!s.current) return;
      s.current.active = true;
      s.current.lx = x; s.current.ly = y;
      s.current.scroller = scrollParentOf(el);
      try { window.getSelection()?.removeAllRanges(); } catch { /* ignore */ }
      setDragId(id);
      document.body.classList.add("lpd-active");
      try { if (navigator.vibrate) navigator.vibrate(12); } catch { /* ignore */ }
    }, delay);
    s.current = { id, x, y, el, active: false, timer, scope: el && el.closest ? el.closest("[data-drag-scope]") : null };
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
      // 指针移动方向（指数平滑，过滤单帧抖动）。用来判断「往前放 / 往后放」是不是用户真想要的
      if (st.px != null) {
        st.vx = (st.vx || 0) * 0.6 + (e.clientX - st.px) * 0.4;
        st.vy = (st.vy || 0) * 0.6 + (e.clientY - st.py) * 0.4;
      }
      st.px = e.clientX; st.py = e.clientY;
      autoScroll(st);
      const now = performance.now();
      // 温和换位：节流（≥160ms 一次）+ 位移门槛（自上次换位指针须移动 ≥5px），
      // 避免静止指针下条目流动引起的反复抖动（鬼畜）
      if (st.lastSwap && now - st.lastSwap < 160) return;
      if (st.lx != null && Math.hypot(e.clientX - st.lx, e.clientY - st.ly) < 5) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      let item = el && el.closest ? el.closest("[data-drag-id]") : null;
      if (item && st.scope && !st.scope.contains(item)) item = null;
      const oid = item ? item.getAttribute("data-drag-id") : null;
      // 离开被锁的目标才解锁
      if (st.lock && oid !== st.lock) st.lock = null;
      if (!oid || oid === st.id) { setOver(null); return; }
      if (oid === st.lock) return;
      const r = item.getBoundingClientRect();
      let after;
      if (axis === "x") after = e.clientX > r.left + r.width / 2;
      else if (axis === "y") after = e.clientY > r.top + r.height / 2;
      // 网格：拖到哪张上就占它的位置（原来在它前面 → 放到它后面，反之放前面）。
      // 以前按对角线判前后，两列网格里竖直往下拖会跑到上一行的右边。
      else after = !!(st.el && st.el.isConnected && (st.el.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING));
      const pos = after ? "after" : "before";
      // 方向闸门：往后放必须是指针在往后（下 / 右）走，往前放必须在往前（上 / 左）走。
      // 条目高矮不一时，换一次位会改变布局（网格整行被撑高），指针没动、底下却换成了另一张，
      // 不加这道闸门就会立刻反向换回去，来回抽搐。
      const dir = axis === "x" ? (st.vx || 0) : axis === "y" ? (st.vy || 0) : (st.vx || 0) + 2 * (st.vy || 0);
      if (pos === "after" ? dir <= 0.3 : dir >= -0.3) return;
      // 同目标同方向不重复换位
      if (st.lastOid === oid && st.lastPos === pos) return;
      setOver({ id: oid, pos });
      reorderRef.current(st.id, oid, pos);
      st.lastSwap = now; st.lx = e.clientX; st.ly = e.clientY; st.lastOid = oid; st.lastPos = pos;
      st.lock = oid;
    };
    const blockWhileDragging = (e) => { if (s.current && s.current.active) e.preventDefault(); };
    const up = () => stop();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    document.addEventListener("selectstart", blockWhileDragging);
    document.addEventListener("dragstart", blockWhileDragging);
    return () => {
      document.removeEventListener("selectstart", blockWhileDragging);
      document.removeEventListener("dragstart", blockWhileDragging);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [axis, tolerance, stop]);

  return { dragId, over, onPointerDown, stop };
}

// 最近的可纵向滚动祖先（找不到就用页面本身）
function scrollParentOf(el) {
  for (let n = el && el.parentElement; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) return n;
  }
  return document.scrollingElement || document.documentElement;
}

// 指针贴近滚动容器上下 40px 内时持续滚动，越靠边越快；离开边缘或松手即停
function autoScroll(st) {
  const box = st.scroller;
  if (!box) return;
  const r = box === document.scrollingElement || box === document.documentElement
    ? { top: 0, bottom: window.innerHeight } : box.getBoundingClientRect();
  const EDGE = 40;
  const d = st.py < r.top + EDGE ? -(r.top + EDGE - st.py) : st.py > r.bottom - EDGE ? st.py - (r.bottom - EDGE) : 0;
  st.scrollV = Math.max(-EDGE, Math.min(EDGE, d)) / 2.5;
  if (!st.scrollV || st.raf) return;
  const step = () => {
    if (!st.active || !st.scrollV) { st.raf = 0; return; }
    box.scrollTop += st.scrollV;
    st.raf = requestAnimationFrame(step);
  };
  st.raf = requestAnimationFrame(step);
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