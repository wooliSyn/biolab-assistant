// ==================== 实验室配方 · 便利贴墙视图 ====================
// 原版界面（纯色便利贴 + 硬阴影 + 微旋转，表格直接编辑，长按拖动换位），
// 作为配方页的第二种视图保留，和「列表」视图在工具栏里切换。数据与列表视图完全共用。
import { useState } from "react";
import { Plus, Trash2, Copy, Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { genId, askConfirm } from "../lib/core";
import { recipeRow } from "../lib/recipes";
import { FlipGrid } from "../lib/useFlip";
import { useLongPressDrag } from "../lib/useLongPressDrag";
import HelpTip from "./HelpTip";

// 便利贴纯色（非渐变）；color 字段与列表视图共用同一个下标
const NOTE_COLORS = ["#FDE68A", "#BBF7D0", "#BFDBFE", "#FBCFE8", "#FED7AA", "#DDD6FE"];
const ROT = [-1.3, 0.9, -0.7, 1.2, -0.5, 0.8];

export default function RecipeWall({ recipes, setRecipes }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("全部");

  const tags = ["全部", ...new Set(recipes.map((r) => r.tag || "未分类"))];
  const shown = recipes.filter((r) =>
    (tag === "全部" || (r.tag || "未分类") === tag) &&
    (!q.trim() || (r.name + r.tag + r.tips + r.rows.map((x) => x.name + x.amount).join(" ")).toLowerCase().includes(q.toLowerCase()))
  );

  const addRecipe = () => setRecipes((p) => [
    { id: genId(), name: "新配方", tag: "自定义", volume: "", color: p.length % NOTE_COLORS.length, rows: [recipeRow("", "", "")], tips: "" },
    ...p,
  ]);
  const update = (id, patch) => setRecipes((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id) => setRecipes((p) => p.filter((r) => r.id !== id));
  const duplicate = (r) => setRecipes((p) => [
    { ...JSON.parse(JSON.stringify(r)), id: genId(), name: r.name + " (副本)", rows: r.rows.map((x) => ({ ...x, id: genId() })) },
    ...p,
  ]);
  // 便利贴拖拽换位（点1：磁贴式实时换位，pos="before"|"after"）
  const reorder = (fromId, toId, pos) => {
    if (!fromId || fromId === toId) return;
    setRecipes((p) => {
      const from = p.findIndex((r) => r.id === fromId);
      const to = p.findIndex((r) => r.id === toId);
      if (from === -1 || to === -1) return p;
      let idx = to + (pos === "after" ? 1 : 0);
      if (from < to) idx -= 1;
      if (from === idx) return p; // 已在目标位
      const c = [...p]; const [it] = c.splice(from, 1); c.splice(idx, 0, it);
      return c;
    });
  };
  // 点2：长按磁贴拖拽（长按选中 → 拖动实时换位，FLIP 动画让位）
  const { dragId, over, onPointerDown } = useLongPressDrag(reorder, { axis: "auto" });
  const upRow = (id, ri, patch) => setRecipes((p) => p.map((r) => r.id === id ? { ...r, rows: r.rows.map((x, j) => (j === ri ? { ...x, ...patch } : x)) } : r));
  const rmRow = (id, ri) => setRecipes((p) => p.map((r) => r.id === id ? { ...r, rows: r.rows.filter((_, j) => j !== ri) } : r));
  const addRow = (id) => setRecipes((p) => p.map((r) => r.id === id ? { ...r, rows: [...r.rows, recipeRow("", "", "")] } : r));
  // 点5：按钮调换顺序（与拖拽换位互补）
  const move = (id, dir) => {
    setRecipes((p) => {
      const i = p.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const a = [...p]; [a[i], a[j]] = [a[j], a[i]]; return a;
    });
  };

  return (
    <div className="space-y-3.5">
      {/* 工具行 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-semibold text-gray-700 flex items-center gap-1">
          配方墙 <span className="text-gray-400 font-normal">({recipes.length})</span>
          <HelpTip text="点击任意单元格直接修改；「+成分」加行，行尾 × 删行；每张便利贴可改体积/备注，悬停可复制或删除" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="relative flex-1 sm:flex-none">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索成分 / 配方…"
              className="pl-7 pr-2 py-2 sm:py-1.5 w-full sm:w-44 text-sm sm:text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
          <button onClick={addRecipe} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"><Plus size={13} />新便利贴</button>
        </div>
      </div>

      {/* 分类筛选 */}
      <div className="flex items-center gap-1 flex-wrap">
        {tags.map((t) => (
          <button key={t} onClick={() => setTag(t)}
            className={`px-2.5 py-1 text-[11px] rounded-full border transition ${tag === t ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* 便利贴墙 */}
      {shown.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">没有匹配的配方</div>
      ) : (
        <FlipGrid orderKey={shown.map((r) => r.id).join(",")} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-6 items-start pt-1">
          {shown.map((r, i) => {
            const bg = NOTE_COLORS[r.color % NOTE_COLORS.length];
            const isOver = over && over.id === r.id && dragId !== r.id;
            return (
              <div key={r.id} data-flip-key={r.id} data-drag-id={r.id}
                onPointerDown={(e) => onPointerDown(e, r.id)}
                title="长按便利贴可拖拽换位"
                className={`recipe-note group relative rounded-sm px-3.5 pt-4 pb-3 transition-transform duration-200 hover:rotate-0 hover:-translate-y-0.5 ${isOver ? "ring-2 ring-indigo-400 rotate-0" : ""} ${dragId === r.id ? "lpd-dragging" : ""}`}
                style={{ backgroundColor: bg, transform: dragId === r.id ? "rotate(0deg)" : `rotate(${ROT[i % ROT.length]}deg)`, boxShadow: "3px 4px 0 rgba(0,0,0,.12)" }}>
                {/* 点4：插入提示线（网格布局用左/右边界线） */}
                {isOver && over.pos === "before" && <div className="absolute top-1 bottom-1 -left-1.5 w-[3px] rounded-full bg-indigo-500 z-10 pointer-events-none" style={{ boxShadow: "0 0 8px 2px rgba(99,102,241,0.5)" }} />}
                {isOver && over.pos === "after" && <div className="absolute top-1 bottom-1 -right-1.5 w-[3px] rounded-full bg-indigo-500 z-10 pointer-events-none" style={{ boxShadow: "0 0 8px 2px rgba(99,102,241,0.5)" }} />}
                {/* 顶部胶带（视觉把手） */}
                <div
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-4 rotate-[-2deg] bg-white/50 border border-white/60 pointer-events-none" style={{ backdropFilter: "blur(1px)" }} />

                {/* 悬停操作：顺序 + 复制 + 删除 */}
                <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => move(r.id, -1)} title="上移" className="p-1 rounded bg-black/5 hover:bg-black/15 text-gray-700 disabled:opacity-30" disabled={recipes.findIndex((x) => x.id === r.id) === 0}><ChevronUp size={11} /></button>
                  <button onClick={() => move(r.id, 1)} title="下移" className="p-1 rounded bg-black/5 hover:bg-black/15 text-gray-700 disabled:opacity-30" disabled={recipes.findIndex((x) => x.id === r.id) === recipes.length - 1}><ChevronDown size={11} /></button>
                  <button onClick={() => duplicate(r)} title="复制" className="p-1 rounded bg-black/5 hover:bg-black/15 text-gray-700"><Copy size={11} /></button>
                  <button onClick={() => { askConfirm({ title: "撕掉便利贴", message: `确定撕掉「${r.name}」？`, okText: "撕掉" }).then((ok) => { if (ok) remove(r.id); }); }} title="删除" className="p-1 rounded bg-black/5 hover:bg-red-500 hover:text-white text-gray-700"><Trash2 size={11} /></button>
                </div>

                {/* 标题 */}
                <input value={r.name} onChange={(e) => update(r.id, { name: e.target.value })}
                  className="w-full bg-transparent text-sm font-bold text-gray-800 placeholder-gray-500 focus:outline-none border-b border-transparent focus:border-black/20 pr-12"
                  placeholder="配方名称" />
                <div className="flex items-center gap-1.5 mt-1.5">
                  {/* 分类选择按钮（下拉） */}
                  <select value={tags.slice(1).includes(r.tag) ? r.tag : ""} onChange={(e) => update(r.id, { tag: e.target.value })}
                    className="w-20 bg-white/40 text-[10px] text-gray-700 px-1 py-0.5 rounded-sm border border-black/10 focus:outline-none focus:border-black/30 cursor-pointer">
                    <option value="">分类</option>
                    {tags.filter((t) => t !== "全部").map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                  <input value={r.tag || ""} onChange={(e) => update(r.id, { tag: e.target.value })} placeholder="分类"
                    className="w-14 bg-white/40 text-[10px] text-gray-700 px-1.5 py-0.5 rounded-sm border border-black/10 focus:outline-none focus:border-black/30" />
                  <span className="text-[10px] text-gray-600">配制体积</span>
                  <input value={r.volume || ""} onChange={(e) => update(r.id, { volume: e.target.value })} placeholder="1 L"
                    className="w-16 bg-white/40 text-[10px] text-gray-700 px-1.5 py-0.5 rounded-sm border border-black/10 focus:outline-none focus:border-black/30" />
                  {/* 换色 */}
                  <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    {NOTE_COLORS.map((cc, ci) => (
                      <button key={ci} onClick={() => update(r.id, { color: ci })} title="换颜色"
                        className="w-3 h-3 rounded-full border border-black/20 hover:scale-125 transition" style={{ backgroundColor: cc }} />
                    ))}
                  </div>
                </div>

                {/* 成分表格 */}
                <table className="w-full mt-2.5 border-collapse">
                  <thead>
                    <tr className="text-[9px] text-gray-600 border-b border-black/25">
                      <th className="text-left font-semibold py-0.5 w-[46%]">成分</th>
                      <th className="text-left font-semibold py-0.5 w-[26%]">用量 / 浓度</th>
                      <th className="text-left font-semibold py-0.5">备注</th>
                      <th className="w-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {r.rows.map((rw, ri) => (
                      <tr key={rw.id} className="border-b border-black/10 group/row">
                        <td className="py-0.5 pr-1">
                          <input value={rw.name} onChange={(e) => upRow(r.id, ri, { name: e.target.value })} placeholder="成分"
                            className="w-full bg-transparent text-[11px] text-gray-800 focus:outline-none focus:bg-white/50 rounded-sm px-1 py-0.5" />
                        </td>
                        <td className="py-0.5 pr-1">
                          <input value={rw.amount} onChange={(e) => upRow(r.id, ri, { amount: e.target.value })} placeholder="—"
                            className="w-full bg-transparent text-[11px] text-gray-800 tabular-nums focus:outline-none focus:bg-white/50 rounded-sm px-1 py-0.5" />
                        </td>
                        <td className="py-0.5 pr-1">
                          <input value={rw.note} onChange={(e) => upRow(r.id, ri, { note: e.target.value })} placeholder=""
                            className="w-full bg-transparent text-[10px] text-gray-600 focus:outline-none focus:bg-white/50 rounded-sm px-1 py-0.5" />
                        </td>
                        <td className="text-center">
                          <button onClick={() => rmRow(r.id, ri)} title="删除该行"
                            className="opacity-0 group-hover/row:opacity-100 text-gray-500 hover:text-red-600 transition"><X size={11} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => addRow(r.id)} className="mt-1 flex items-center gap-0.5 text-[10px] text-gray-600 hover:text-gray-900 transition">
                  <Plus size={11} />成分
                </button>

                {/* 备注 */}
                <textarea value={r.tips || ""} onChange={(e) => update(r.id, { tips: e.target.value })} rows={2}
                  placeholder="要点 / 保存条件 / 灭菌方式…"
                  className="mt-1.5 w-full bg-white/35 border border-black/10 rounded-sm text-[10px] leading-relaxed text-gray-700 px-2 py-1 resize-none focus:outline-none focus:border-black/30" />
              </div>
            );
          })}
        </FlipGrid>
      )}
    </div>
  );
}
