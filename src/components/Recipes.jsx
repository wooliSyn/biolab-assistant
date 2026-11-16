// ==================== 实验室配方 · 列表 + 详情 ====================
// 原来是「便利贴墙」：每张都是常驻编辑态的整张表，一屏只能看 4 个，找配方全靠滚。
// 默认改成桌面应用常见的主从布局：左边搜索 / 分类 / 列表（长按拖动排序），右边编辑选中的那一个；
// 原版便利贴墙作为第二种视图保留在 RecipeWall.jsx。
import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Copy, Search, X, FlaskRound } from "lucide-react";
import { genId, askConfirm } from "../lib/core";
import { RECIPE_COLORS, recipeRow } from "../lib/recipes";
import { useLongPressDrag } from "../lib/useLongPressDrag";
import HelpTip from "./HelpTip";
import RecipeWall from "./RecipeWall";

const colorOf = (r) => RECIPE_COLORS[(r.color ?? 0) % RECIPE_COLORS.length];

// 配方页入口：view = "list"（列表 + 详情，默认）| "wall"（原版便利贴墙），切换按钮在工具栏
export default function Recipes({ recipes, setRecipes, view }) {
  if (view === "wall") return <RecipeWall recipes={recipes} setRecipes={setRecipes} />;
  return <RecipeList recipes={recipes} setRecipes={setRecipes} />;
}

function RecipeList({ recipes, setRecipes }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("全部");
  const [selId, setSelId] = useState(() => recipes[0]?.id ?? null);

  const tags = useMemo(() => ["全部", ...new Set(recipes.map((r) => r.tag || "未分类"))], [recipes]);
  const shown = recipes.filter((r) =>
    (tag === "全部" || (r.tag || "未分类") === tag) &&
    (!q.trim() || (r.name + (r.tag || "") + (r.tips || "") + r.rows.map((x) => x.name + x.amount).join(" ")).toLowerCase().includes(q.toLowerCase()))
  );
  const sel = recipes.find((r) => r.id === selId) || null;
  // 筛选后选中项不在列表里了，就选列表第一个，避免右边显示一个左边看不到的配方
  useEffect(() => {
    if (shown.length && !shown.some((r) => r.id === selId)) setSelId(shown[0].id);
  }, [q, tag]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (id, patch) => setRecipes((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRecipe = () => {
    const id = genId();
    setRecipes((p) => [{ id, name: "新配方", tag: tag !== "全部" ? tag : "自定义", volume: "", color: p.length % RECIPE_COLORS.length, rows: [recipeRow("", "", "")], tips: "" }, ...p]);
    setQ(""); setSelId(id);
  };
  const duplicate = (r) => {
    const id = genId();
    setRecipes((p) => {
      const i = p.findIndex((x) => x.id === r.id);
      const c = [...p];
      c.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(r)), id, name: r.name + " (副本)", rows: r.rows.map((x) => ({ ...x, id: genId() })) });
      return c;
    });
    setSelId(id);
  };
  const remove = (r) => askConfirm({ title: "删除配方", message: `确定删除「${r.name}」？此操作不可撤销。`, okText: "删除" }).then((ok) => {
    if (!ok) return;
    const i = shown.findIndex((x) => x.id === r.id);
    const next = shown[i + 1] || shown[i - 1];
    setRecipes((p) => p.filter((x) => x.id !== r.id));
    setSelId(next ? next.id : null);
  });
  const reorder = (fromId, toId, pos) => {
    if (!fromId || fromId === toId) return;
    setRecipes((p) => {
      const from = p.findIndex((r) => r.id === fromId);
      const to = p.findIndex((r) => r.id === toId);
      if (from === -1 || to === -1) return p;
      let idx = to + (pos === "after" ? 1 : 0);
      if (from < to) idx -= 1;
      if (from === idx) return p;
      const c = [...p]; const [it] = c.splice(from, 1); c.splice(idx, 0, it);
      return c;
    });
  };
  const { dragId, over, onPointerDown } = useLongPressDrag(reorder, { axis: "y" });
  const upRow = (ri, patch) => update(sel.id, { rows: sel.rows.map((x, j) => (j === ri ? { ...x, ...patch } : x)) });
  const rmRow = (ri) => update(sel.id, { rows: sel.rows.filter((_, j) => j !== ri) });
  const addRow = () => update(sel.id, { rows: [...sel.rows, recipeRow("", "", "")] });

  // 列表键盘导航：↑/↓ 切换选中
  const onListKey = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = shown.findIndex((r) => r.id === selId);
    const n = shown[Math.max(0, Math.min(shown.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
    if (n) { setSelId(n.id); document.getElementById(`rcp-${n.id}`)?.scrollIntoView({ block: "nearest" }); }
  };

  const field = "bg-white border border-gray-200 rounded-md px-2 py-1 text-[12px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300";

  return (
    <div className="h-full min-h-[420px] flex gap-4">
      {/* ===== 左：搜索 + 分类 + 列表 ===== */}
      <div className="w-[248px] flex-shrink-0 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-2.5 space-y-2 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索配方或成分"
                className="w-full pl-7 pr-6 py-1.5 text-[12px] border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              {q && <button onClick={() => setQ("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={12} /></button>}
            </div>
            <button onClick={addRecipe} className="p-1.5 rounded-md text-white bg-indigo-600 hover:bg-indigo-700" title="新建配方"><Plus size={14} /></button>
          </div>
          <select value={tag} onChange={(e) => setTag(e.target.value)} className="w-full text-[12px] text-gray-600 border border-gray-200 rounded-md px-1.5 py-1 bg-white focus:outline-none">
            {tags.map((t) => <option key={t} value={t}>{t === "全部" ? `全部分类（${recipes.length}）` : `${t}（${recipes.filter((r) => (r.tag || "未分类") === t).length}）`}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto py-1 outline-none" tabIndex={0} onKeyDown={onListKey} role="listbox" aria-label="配方列表">
          {shown.length === 0 && <div className="px-3 py-8 text-center text-[12px] text-gray-400">没有匹配的配方</div>}
          {shown.map((r) => {
            const on = r.id === selId;
            const isOver = over && over.id === r.id && dragId !== r.id;
            return (
              <div key={r.id} id={`rcp-${r.id}`} data-drag-id={r.id} role="option" aria-selected={on}
                onPointerDown={(e) => onPointerDown(e, r.id)} onClick={() => setSelId(r.id)}
                className={`relative mx-1.5 px-2.5 py-1.5 rounded-md cursor-default select-none flex items-center gap-2.5 ${on ? "bg-indigo-600 text-white" : "hover:bg-gray-50"} ${dragId === r.id ? "lpd-dragging" : ""}`}>
                {isOver && <div className={`absolute left-2 right-2 h-[2px] rounded-full bg-indigo-500 ${over.pos === "before" ? "-top-px" : "-bottom-px"}`} />}
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorOf(r), boxShadow: on ? "0 0 0 1.5px rgba(255,255,255,.8)" : "none" }} />
                <div className="min-w-0 flex-1">
                  <div className={`text-[12.5px] truncate ${on ? "font-semibold" : "text-gray-800"}`}>{r.name || "未命名配方"}</div>
                  <div className={`text-[10.5px] truncate ${on ? "text-white/75" : "text-gray-400"}`}>{r.tag || "未分类"}{r.volume ? ` · ${r.volume}` : ""} · {r.rows.length} 种成分</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-3 py-1.5 border-t border-gray-100 text-[10px] text-gray-300 text-center">↑↓ 切换 · 长按拖动排序</div>
      </div>

      {/* ===== 右：详情编辑 ===== */}
      {!sel ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-gray-300 text-center">
          <FlaskRound size={28} className="text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">{recipes.length ? "在左侧选择一个配方" : "还没有配方"}</p>
          <button onClick={addRecipe} className="mt-2 text-xs text-indigo-600 hover:underline">新建配方 →</button>
        </div>
      ) : (
        <div className="flex-1 min-w-0 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="h-1 flex-shrink-0" style={{ background: colorOf(sel) }} />
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex items-start gap-3">
              <input value={sel.name} onChange={(e) => update(sel.id, { name: e.target.value })} placeholder="配方名称"
                className="flex-1 min-w-0 text-[18px] font-semibold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-300 focus:outline-none py-0.5" />
              <div className="flex items-center gap-0.5 flex-shrink-0 pt-1">
                <button onClick={() => duplicate(sel)} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="复制一份"><Copy size={14} /></button>
                <button onClick={() => remove(sel)} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50" title="删除"><Trash2 size={14} /></button>
              </div>
            </div>

            <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-3 gap-y-2 mt-3 max-w-[520px]">
              <label className="text-[11.5px] text-gray-400">分类</label>
              <input list="recipe-tags" value={sel.tag || ""} onChange={(e) => update(sel.id, { tag: e.target.value })} placeholder="如：缓冲液" className={field} />
              <label className="text-[11.5px] text-gray-400">配制体积</label>
              <input value={sel.volume || ""} onChange={(e) => update(sel.id, { volume: e.target.value })} placeholder="如：1 L" className={field} />
              <label className="text-[11.5px] text-gray-400">颜色</label>
              <div className="flex gap-1.5 col-span-3">
                {RECIPE_COLORS.map((c, ci) => (
                  <button key={c} onClick={() => update(sel.id, { color: ci })} title="标记颜色"
                    className={`w-4 h-4 rounded-full transition ${(sel.color ?? 0) % RECIPE_COLORS.length === ci ? "ring-2 ring-offset-1 ring-gray-400" : "hover:scale-110"}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <datalist id="recipe-tags">{tags.slice(1).map((t) => <option key={t} value={t} />)}</datalist>

            <div className="mt-5 flex items-center gap-1 text-[12px] font-semibold text-gray-600">成分
              <HelpTip text="单元格直接改；行尾 × 删除该行；回车跳到下一行" /></div>
            <table className="w-full mt-1.5 border-collapse text-[12.5px]">
              <thead>
                <tr className="text-[11px] text-gray-400 border-b border-gray-200">
                  <th className="text-left font-medium py-1.5 w-8">#</th>
                  <th className="text-left font-medium py-1.5 w-[44%]">成分</th>
                  <th className="text-left font-medium py-1.5 w-[22%]">用量 / 浓度</th>
                  <th className="text-left font-medium py-1.5">备注</th>
                  <th className="w-7" />
                </tr>
              </thead>
              <tbody>
                {sel.rows.map((rw, ri) => (
                  <tr key={rw.id} className="border-b border-gray-100 group/row hover:bg-gray-50">
                    <td className="py-0.5 text-[11px] text-gray-300 tabular-nums">{ri + 1}</td>
                    {[["name", "成分", "text-gray-800"], ["amount", "—", "text-gray-800 tabular-nums"], ["note", "", "text-gray-500"]].map(([k, ph, cls]) => (
                      <td key={k} className="py-0.5 pr-1.5">
                        <input value={rw[k] || ""} onChange={(e) => upRow(ri, { [k]: e.target.value })} placeholder={ph}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (ri === sel.rows.length - 1) addRow(); setTimeout(() => document.querySelector(`[data-rcell="${ri + 1}-${k}"]`)?.focus(), 0); } }}
                          data-rcell={`${ri}-${k}`}
                          className={`w-full bg-transparent px-1.5 py-1 rounded focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 ${cls}`} />
                      </td>
                    ))}
                    <td className="text-center">
                      <button onClick={() => rmRow(ri)} title="删除该行" className="opacity-0 group-hover/row:opacity-100 p-1 text-gray-400 hover:text-red-500"><X size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={addRow} className="mt-1.5 flex items-center gap-1 px-1.5 py-1 text-[11.5px] text-indigo-600 rounded hover:bg-indigo-50"><Plus size={12} />添加成分</button>

            <div className="mt-5 text-[12px] font-semibold text-gray-600">要点</div>
            <textarea value={sel.tips || ""} onChange={(e) => update(sel.id, { tips: e.target.value })} rows={3}
              placeholder="保存条件 / 灭菌方式 / 注意事项…"
              className="mt-1.5 w-full text-[12.5px] leading-relaxed text-gray-700 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" />
          </div>
        </div>
      )}
    </div>
  );
}
