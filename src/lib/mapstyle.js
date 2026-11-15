// ==================== 图谱 / 序列条带的呈现层工具 ====================
// 放在 lib 而不是组件文件里，是为了让 PlasmidMap.jsx 只导出组件本身：
// vite-plugin-react 的 Fast Refresh 要求模块的导出全是 React 组件，
// 混入常量和普通函数会让每次改动退化成整模块重载（开发时热更新明显变慢）。
// 这里只放"怎么画"的东西；"算什么"属于 bio.js。

// ---------- 元件配色 ----------
export const FEAT_COLORS = {
  CDS: "#4f46e5", gene: "#6366f1", mRNA: "#6366f1",
  promoter: "#059669", enhancer: "#059669",
  terminator: "#dc2626", rep_origin: "#d97706",
  primer_binding: "#0891b2", misc_feature: "#64748b", source: "#94a3b8",
};

// 未知 key 时按标签猜抗性基因，否则落到中性灰
export const featColor = (f) =>
  FEAT_COLORS[f.key] || (/amp|kan|tet|cam|抗性|resist/i.test(f.label) ? "#db2777" : "#64748b");

// ---------- 贪心泳道排布：重叠的区段依次下沉到新泳道 ----------
// items 需带 x1/x2（像素坐标），返回值附加 lane 序号
export function packLanes(items) {
  const ends = [];
  return items.map((it) => {
    let li = ends.findIndex((e) => e < it.x1 - 4);
    if (li === -1) { li = ends.length; ends.push(it.x2); } else ends[li] = it.x2;
    return { ...it, lane: li };
  });
}
