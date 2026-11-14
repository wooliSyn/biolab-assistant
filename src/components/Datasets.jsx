// ==================== 原始数据集视图 ====================
// 登记数据 + 导入实验记录附件（存储到本地，点击用系统查看器打开）+ 关联实验（可跳转）+ 数据处理提醒
import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Database, Plus, Trash2, Bell, CheckCircle2, Paperclip, FlaskConical, ImagePlus, Link2, ExternalLink, FolderOpen, Upload } from "lucide-react";
import { dateStr, timeStr, colorOf, relativeDayLabel, askConfirm, toast } from "../lib/core";
import { FlipGrid } from "../lib/useFlip";
import { useLongPressDrag, arrayReorder } from "../lib/useLongPressDrag";

const MAX_SAVE = 25 * 1024 * 1024; // 超过则只记录元信息，不落盘

// 读取文件并落盘存储（返回本地路径，供系统查看器打开）
async function readFiles(fileList) {
  const out = [];
  for (const f of [...fileList]) {
    const base = { id: Math.random().toString(36).slice(2, 9), name: f.name, size: f.size, type: f.type || "", at: Date.now() };
    if (f.size <= MAX_SAVE) {
      try {
        const buf = await f.arrayBuffer();
        const path = await invoke("save_attachment", { name: f.name, bytes: Array.from(new Uint8Array(buf)) });
        out.push({ ...base, path });
      } catch { out.push(base); }
    } else out.push(base); // 过大：仅元信息
  }
  return out;
}
const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const extOf = (n) => (n.split(".").pop() || "").toUpperCase();

export default function Datasets({ datasets, setDatasets, sessions, now, deleteSession, onOpenDetail, importSessions }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", date: dateStr(now), note: "", remindProcess: true, sessionId: "" });
  const [formFiles, setFormFiles] = useState([]);
  const addFileRef = useRef({});

  // 点2：长按磁贴拖拽排序（数据集为登记顺序，非时间排序，支持手动换位）
  const reorder = (fromId, toId, pos) => setDatasets((p) => arrayReorder(p, fromId, toId, pos));
  const { dragId, onPointerDown } = useLongPressDrag(reorder, { axis: "y" });

  // 导入数据集（JSON 数组文件）
  const importDatasets = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      try {
        const arr = JSON.parse(await f.text());
        const items = Array.isArray(arr) ? arr : arr.datasets || [];
        if (!items.length) { toast("文件中未找到有效数据集条目", "error"); return; }
        const valid = items.filter((d) => d.name || d.id);
        setDatasets((p) => [...valid.map((d) => ({ ...d, id: d.id || Math.random().toString(36).slice(2, 9) })), ...p]);
        toast(`已导入 ${valid.length} 条数据集记录`);
      } catch { toast("文件格式错误，需为 JSON 数组", "error"); }
    };
    input.click();
  };

  // 导入实验历史（JSON 数组文件）
  const importHistory = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      try {
        const arr = JSON.parse(await f.text());
        const items = Array.isArray(arr) ? arr : arr.sessions || [];
        if (!items.length) { toast("文件中未找到有效实验记录", "error"); return; }
        const valid = items.filter((s) => s.name && s.steps);
        if (importSessions) importSessions(valid);
        toast(`已导入 ${valid.length} 条实验记录`);
      } catch { toast("文件格式错误，需为 JSON 数组", "error"); }
    };
    input.click();
  };

  // 从已完成/进行中的实验自动汇总"何时做了什么"
  const history = sessions
    .slice()
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((s) => ({
      id: s.id, name: s.name, at: s.startedAt,
      status: s.status, c: colorOf(s),
      done: s.steps.filter((st) => st.status === "done").length, total: s.steps.length,
    }));

  // 表单日期对应的当日实验（供关联）
  const daySessions = sessions.filter((s) => {
    const sd = dateStr(s.startedAt);
    if (sd === form.date) return true;
    const end = s.completedAt || (s.startedAt + s.steps.reduce((a, st) => a + (st.durationMin || 0), 0) * 60000);
    return s.startedAt <= new Date(`${form.date}T23:59:59`).getTime() && end >= new Date(`${form.date}T00:00:00`).getTime();
  });

  const addDataset = () => {
    if (!form.name.trim()) return;
    setDatasets((p) => [{
      id: Math.random().toString(36).slice(2, 9), ...form,
      sessionId: form.sessionId || null, files: formFiles,
      createdAt: Date.now(), processed: false,
    }, ...p]);
    setForm({ name: "", date: dateStr(now), note: "", remindProcess: true, sessionId: "" });
    setFormFiles([]);
    setAdding(false);
  };

  // 事后为某数据集追加附件
  const attachTo = async (id, fileList) => {
    const files = await readFiles(fileList);
    if (!files.length) return;
    setDatasets((p) => p.map((d) => (d.id === id ? { ...d, files: [...(d.files || []), ...files] } : d)));
  };

  const openFile = (f) => { if (f.path) invoke("open_file", { path: f.path }).catch(() => {}); };
  const revealFile = (f) => { if (f.path) invoke("reveal_file", { path: f.path }).catch((e) => toast(String(e || "无法定位文件"), "error")); };
  const pendingProcess = datasets.filter((d) => d.remindProcess && !d.processed);
  const sessionOf = (sid) => sessions.find((s) => s.id === sid);
  // 关联实验显示名（同名实验用日期+时间区分）
  const sessionLabel = (sid) => {
    const s = sessionOf(sid);
    return s ? `${s.name}（${dateStr(s.startedAt)} ${timeStr(s.startedAt)}）` : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Database size={15} className="text-indigo-500" />原始数据集 <span className="text-gray-400 font-normal">({datasets.length})</span></div>
        <div className="flex items-center gap-1.5">
          <button onClick={importDatasets} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50" title="从 JSON 文件导入数据集记录"><Upload size={13} />导入</button>
          <button onClick={() => setAdding((v) => !v)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-white bg-indigo-500 rounded-lg hover:bg-indigo-600"><Plus size={13} />登记数据</button>
        </div>
      </div>

      {/* 源文件保管提醒（点8） */}
      <div className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
        <FolderOpen size={11} className="text-indigo-400 flex-shrink-0" />
        附件已复制存储到本地；点击文件名可直接打开，点击 <FolderOpen size={10} className="inline text-indigo-400" /> 可定位到存储位置。原始数据请务必另行妥善保管备份。
      </div>

      {/* 数据处理提醒 */}
      {pendingProcess.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <div className="text-[11px] font-semibold text-amber-700 flex items-center gap-1 mb-1"><Bell size={12} />待处理数据提醒</div>
          <div className="space-y-1">
            {pendingProcess.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-[11px] text-amber-800">
                <span className="truncate">{d.name}（{d.date} 采集）— 记得及时处理/备份</span>
                <button onClick={() => setDatasets((p) => p.map((x) => (x.id === d.id ? { ...x, processed: true } : x)))} className="flex items-center gap-0.5 text-amber-600 hover:text-green-600 flex-shrink-0"><CheckCircle2 size={12} />标记已处理</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 手动登记 */}
      {adding && (
        <div className="bg-white border border-indigo-100 rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="数据名称（如：TAR-ivt 测序数据）" className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value, sessionId: "" }))} className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
          <input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="备注（存放位置、文件名…）" className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1 text-[11px] text-gray-500"><Link2 size={11} />关联实验</label>
            <select value={form.sessionId} onChange={(e) => setForm((p) => ({ ...p, sessionId: e.target.value }))}
              className="px-2 py-1 border border-gray-200 rounded-lg text-[11px] bg-white focus:outline-none max-w-[300px]">
              <option value="">（不关联）</option>
              {(daySessions.length ? daySessions : sessions).map((s) => (
                <option key={s.id} value={s.id}>{dateStr(s.startedAt)} {timeStr(s.startedAt)} · {s.name}</option>
              ))}
            </select>
            {daySessions.length > 0 && <span className="text-[10px] text-gray-300">已优先列出 {form.date} 当日的实验</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1 px-2 py-1 text-[11px] text-indigo-600 border border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50 cursor-pointer">
              <ImagePlus size={12} />导入记录文件（tif / 图片…）
              <input type="file" multiple className="hidden" accept=".tif,.tiff,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.pdf,.csv,.txt"
                onChange={async (e) => { const fs = await readFiles(e.target.files || []); setFormFiles((p) => [...p, ...fs]); e.target.value = ""; }} />
            </label>
            {formFiles.map((f) => (
              <span key={f.id} className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">
                <Paperclip size={10} />
                {f.name.length > 18 ? f.name.slice(0, 15) + "…" : f.name}
                <button onClick={() => setFormFiles((p) => p.filter((x) => x.id !== f.id))} className="text-gray-300 hover:text-red-400"><X0 size={10} /></button>
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
              <input type="checkbox" checked={form.remindProcess} onChange={(e) => setForm((p) => ({ ...p, remindProcess: e.target.checked }))} className="accent-amber-500" />提醒我处理这份数据</label>
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="px-3 py-1 text-gray-500 text-[11px] rounded-md hover:bg-gray-100">取消</button>
              <button onClick={addDataset} className="px-3 py-1 bg-indigo-500 text-white text-[11px] rounded-md hover:bg-indigo-600">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 已登记数据 */}
      {datasets.length > 0 && (
        <FlipGrid orderKey={datasets.map((d) => d.id).join(",")} className="space-y-1.5">
          {datasets.map((d) => (
            <div key={d.id} data-flip-key={d.id} data-drag-id={d.id}
              onPointerDown={(e) => onPointerDown(e, d.id)}
              className={`bg-white rounded-xl border border-gray-100 px-3 py-2.5 hover:shadow-sm hover:-translate-y-0.5 transition group ${dragId === d.id ? "lpd-dragging" : ""}`}>
              <div className="flex items-center gap-2.5">
                <Paperclip size={14} className={d.processed ? "text-green-500" : "text-amber-500"} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700 truncate">{d.name}</div>
                  <div className="text-[10px] text-gray-400 flex items-center gap-1 flex-wrap">
                    <span>{d.date} · {d.note || "无备注"} {d.processed ? "· 已处理" : d.remindProcess ? "· 待处理" : ""}</span>
                    {d.sessionId && sessionLabel(d.sessionId) && (
                      <button onClick={() => onOpenDetail && onOpenDetail(d.sessionId)}
                        className="inline-flex items-center gap-0.5 text-indigo-500 hover:underline" title="跳转到关联的实验记录">
                        <Link2 size={9} />关联：{sessionLabel(d.sessionId)}<ExternalLink size={8} />
                      </button>
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-0.5 text-[10px] text-indigo-500 hover:underline cursor-pointer flex-shrink-0" title="事后补充实验记录文件">
                  <ImagePlus size={11} />补充记录
                  <input ref={(el) => { addFileRef.current[d.id] = el; }} type="file" multiple className="hidden"
                    accept=".tif,.tiff,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.pdf,.csv,.txt"
                    onChange={async (e) => { await attachTo(d.id, e.target.files || []); e.target.value = ""; }} />
                </label>
                {!d.processed && d.remindProcess && (
                  <button onClick={() => setDatasets((p) => p.map((x) => (x.id === d.id ? { ...x, processed: true } : x)))} className="text-[10px] text-green-600 hover:underline flex-shrink-0">已处理</button>
                )}
                <button onClick={() => setDatasets((p) => p.filter((x) => x.id !== d.id))} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition"><Trash2 size={12} /></button>
              </div>
              {/* 附件列表（电子邮件式：不渲染缩略图，点击用系统查看器打开） */}
              {(d.files || []).length > 0 && (
                <div className="space-y-1 mt-2 pl-6">
                  {d.files.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 text-[11px] group/f">
                      <span className="text-[8px] px-1 py-px rounded bg-gray-100 text-gray-400 border border-gray-200 flex-shrink-0">{extOf(f.name)}</span>
                      <button onClick={() => openFile(f)} disabled={!f.path}
                        className="text-indigo-600 hover:underline truncate disabled:text-gray-400 disabled:no-underline disabled:cursor-default"
                        title={f.path ? `${fmtSize(f.size)} · 点击用系统查看器打开 · 请妥善保管源文件` : `${fmtSize(f.size)} · 文件过大未存储，仅保留元信息`}>
                        {f.name}
                      </button>
                      <button onClick={() => revealFile(f)} disabled={!f.path}
                        className="p-0.5 text-gray-300 hover:text-indigo-500 disabled:opacity-30 disabled:cursor-default transition flex-shrink-0"
                        title={f.path ? "打开到源文件所在位置（请保管好源文件）" : "未存储，无法定位"}>
                        <FolderOpen size={12} />
                      </button>
                      <span className="text-gray-300 flex-shrink-0">{fmtSize(f.size)}</span>
                      <button onClick={() => setDatasets((p) => p.map((x) => (x.id === d.id ? { ...x, files: (x.files || []).filter((y) => y.id !== f.id) } : x)))}
                        className="opacity-0 group-hover/f:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition flex-shrink-0"><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </FlipGrid>
      )}

      {/* 实验历史（何时做了什么；可点开查看 / 删除以便测试） */}
      <div>
        <div className="text-[11px] font-semibold text-gray-500 mb-1.5 flex items-center gap-1"><FlaskConical size={12} />实验历史 <span className="text-gray-300 font-normal">（点击查看 · 可删除）</span>
          <button onClick={importHistory} className="ml-auto flex items-center gap-0.5 text-[10px] text-indigo-500 hover:underline" title="从 JSON 文件导入实验记录"><Upload size={10} />导入历史</button>
        </div>
        {history.length === 0 ? (
          <div className="text-[11px] text-gray-300 text-center py-6">还没有实验记录</div>
        ) : (
          <div className="space-y-1">
            {history.map((h) => (
              <div key={h.id} onClick={() => onOpenDetail && onOpenDetail(h.id)}
                className="flex items-center gap-2 bg-white/70 rounded-lg px-3 py-2 border border-gray-100 hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5 transition cursor-pointer group"
                title="点击查看该实验的步骤详情">
                <span className={`w-1.5 h-1.5 rounded-full ${h.c.bar} flex-shrink-0`} />
                <span className="text-xs text-gray-700 truncate flex-1 group-hover:text-indigo-600 transition">{h.name}</span>
                <span className="text-[10px] text-gray-400 tabular-nums">{dateStr(h.at)} {timeStr(h.at)}</span>
                <span className="text-[10px] text-gray-300">{relativeDayLabel(h.at, now)}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${h.status === "running" ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"}`}>
                  {h.status === "running" ? `${h.done}/${h.total}` : "完成"}
                </span>
                <button onClick={(e) => { e.stopPropagation(); askConfirm({ title: "删除实验记录", message: `确定删除实验记录「${h.name}」？此操作不可撤销。`, okText: "删除" }).then((ok) => { if (ok) deleteSession(h.id); }); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition" title="删除该实验记录"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 小 X 图标（避免与 lucide X 冲突的轻量内联）
function X0({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
