// ==================== FLIP 动画 Hook（点1：磁贴式拖拽换位动画） ====================
// 用法：const ref = useFlip(orderKey);
//   <div ref={ref}> 的子元素需带 data-flip-key 属性。
// 原理：First-Last-Invert-Play —— 记录上一次各子元素位置，
// 排序变化后先反向位移，再过渡回新位置，实现 Windows 磁贴式平滑换位。
import { useRef, useLayoutEffect } from "react";

export default function useFlip(dep) {
  const ref = useRef(null);
  const posRef = useRef(new Map());

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const old = posRef.current;
    const next = new Map();
    Array.from(el.children).forEach((child) => {
      const key = child.dataset && child.dataset.flipKey;
      if (!key) return;
      const r = child.getBoundingClientRect();
      next.set(key, { x: r.left, y: r.top });
      const o = old.get(key);
      // 被拿起的卡片由 useLongPressDrag 跟着光标走，这里不能再给它做让位动画
      if (o && !child.classList.contains("lpd-dragging") && !child.querySelector(".lpd-dragging")) {
        const dx = o.x - r.left;
        const dy = o.y - r.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          const origTransform = child.style.transform || "";
          const origTransition = child.style.transition || "";
          // 反向位移 → 强制回流 → 过渡归位（归位时恢复原有 transform，如便利贴的旋转）
          child.style.transition = "none";
          child.style.transform = `translate(${dx}px, ${dy}px)`;
          void child.offsetWidth;
          child.style.transition = "transform 0.32s cubic-bezier(0.22,1,0.36,1)";
          child.style.transform = origTransform;
          child.addEventListener("transitionend", function te() {
            child.style.transition = origTransition;
            child.removeEventListener("transitionend", te);
          }, { once: true });
        }
      }
    });
    posRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);

  return ref;
}

// 便捷容器：子元素带 data-flip-key 即获得磁贴换位动画
export function FlipGrid({ orderKey, className, children, style }) {
  const ref = useFlip(orderKey);
  return <div ref={ref} className={className} style={style}>{children}</div>;
}
