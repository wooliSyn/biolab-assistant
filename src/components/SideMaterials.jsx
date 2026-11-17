// ==================== 侧边栏：进行中实验的物料清单 ====================
// 实验开始后，方案里的物料清单显示在右侧今日面板顶部：逐项点「确定」核对，× 关掉（只隐藏这张清单，不删内容）。
// 勾选状态和实验卡片上的「物品」清单是同一份数据（session.matChecked），两边任一处勾选都同步。
import { useContext } from "react";
import { Package, Check, X } from "lucide-react";
import { SessionActions, splitLines } from "../lib/sessionActions";
import { colorOf } from "../lib/core";

export default function SideMaterials({ sessions }) {
  const act = useContext(SessionActions);
  if (!act) return null;
  const list = sessions.filter((s) => s.status === "running" && !s.matHidden && splitLines(s.materials).length > 0);
  if (!list.length) return null;
  return (
    <div className="px-3 py-2.5 border-b border-gray-100 space-y-2.5 max-h-[40%] overflow-y-auto flex-shrink-0">
      {list.map((s) => {
        const items = splitLines(s.materials);
        const checked = s.matChecked || {};
        const done = items.filter((m) => checked[m]).length;
        const all = done === items.length;
        const set = (patch) => act.updateSession(s.id, (x) => ({ matChecked: { ...(x.matChecked || {}), ...patch } }));
        return (
          <div key={s.id} className={`rounded-lg border px-2 py-1.5 ${all ? "border-emerald-200 bg-emerald-50/60" : "border-gray-200 bg-white"}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Package size={12} className={all ? "text-emerald-600" : "text-gray-400"} />
              <span className={`w-1.5 h-1.5 rounded-full ${colorOf(s).bar}`} />
              <span className="flex-1 min-w-0 text-[11px] font-semibold text-gray-700 truncate" title={s.name}>物料 · {s.name}</span>
              <span className={`text-[10px] tabular-nums ${all ? "text-emerald-600 font-semibold" : "text-gray-400"}`}>{done}/{items.length}</span>
              <button onClick={() => act.updateSession(s.id, { matHidden: true })} className="p-0.5 rounded text-gray-300 hover:text-gray-600" title="关掉这张清单（实验卡片上的「物品」里仍可查看）"><X size={12} /></button>
            </div>
            {all ? (
              <div className="text-[10.5px] text-emerald-700 flex items-center gap-1 py-0.5"><Check size={11} />已全部确认，可以开始了</div>
            ) : (
              <div className="space-y-0.5">
                {items.map((m) => (
                  <div key={m} className="flex items-center gap-1.5">
                    <span className={`flex-1 min-w-0 text-[11px] truncate ${checked[m] ? "line-through text-gray-400" : "text-gray-700"}`} title={m}>{m}</span>
                    {checked[m] ? (
                      <button onClick={() => set({ [m]: false })} className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded text-emerald-600 hover:bg-emerald-50" title="点一下撤销"><Check size={10} />已完成</button>
                    ) : (
                      <button onClick={() => set({ [m]: true })} className="px-1.5 py-0.5 text-[10px] rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50">确定</button>
                    )}
                  </div>
                ))}
                {items.length > 1 && (
                  <button onClick={() => set(Object.fromEntries(items.map((m) => [m, true])))} className="w-full mt-1 py-0.5 text-[10px] text-indigo-500 hover:underline">全部确定</button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
