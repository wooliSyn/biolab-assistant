// ==================== 传送门：顶刊 + 清北图书馆 + 科研数据库 + 自定义入口 ====================
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExternalLink, Database, Plus, X, Dna, BarChart3, BookOpen, Sparkles, Search, BookMarked } from "lucide-react";
import { JOURNALS, DATABASES, PRIMER_TOOLS, DATA_ANALYSIS, LITERATURE, AI_TOOLS, slugOf } from "../lib/portalLinks";

// 真实站点图标：构建期由 fetch-portal-icons.mjs 抓好放进 assets，这里按文件名(slug)索引。
// 用 glob 而不是手写索引表，是为了让"抓到几个就显示几个"——没抓到的条目自动回退字母徽章，
// 不会因为缺文件而报错，也不必在加链接时同步维护两处。
const ICON_FILES = import.meta.glob("../assets/portal-icons/*.{png,ico,svg,jpg,jpeg,webp,gif}", {
  eager: true, query: "?url", import: "default",
});
const ICONS = Object.fromEntries(
  Object.entries(ICON_FILES).map(([path, url]) => [path.split("/").pop().replace(/\.[^.]+$/, ""), url])
);
const iconOf = (p) => ICONS[slugOf(p)] || null;

// 图标磁贴：有真实图标就用，抓取失败或加载失败则回退到原来的字母徽章
function LinkTile({ p }) {
  const [broken, setBroken] = useState(false);
  const [wide, setWide] = useState(false);
  const src = broken ? null : iconOf(p);
  const base = "w-[52px] h-[52px] flex items-center justify-center rounded-xl shadow-sm group-hover:scale-105 group-hover:shadow-md transition-transform";
  if (!src) {
    return <span className={`${base} text-white font-bold text-[14px]`} style={{ backgroundColor: p.bg }}>{p.short}</span>;
  }
  // 浅色底板固定不随主题变化：站点图标多为深色线条、按浅底设计，放在暗色主题上会糊成一团
  return (
    <span className={`${base} overflow-hidden border`} style={{ background: "#f7f8fa", borderColor: "rgba(0,0,0,0.08)" }}>
      {/* 期刊给的多是横向刊名字标（Nature / PNAS / THE LANCET 这类，宽高比常到 5:1 以上），
          按方形图标的尺寸缩放会糊成一道杂线。加载后量一下真实宽高比：
          宽的占满整格宽度，方的仍按原尺寸居中，避免把 16px 的 favicon 硬拉大导致模糊。
          字标不需要读得清，能认出来就够了——名称本来就印在下面一行。 */}
      <img src={src} alt="" draggable={false} loading="lazy"
        onError={() => setBroken(true)}
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
          if (w && h && w / h > 1.7) setWide(true);
        }}
        className={wide ? "w-[46px] h-auto" : "w-8 h-8 object-contain"} />
    </span>
  );
}

// 自定义入口备选色板（按名称哈希取色）
const CUSTOM_COLORS = ["#0ea5e9", "#14b8a6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6366f1", "#ef4444"];
const colorOf = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CUSTOM_COLORS[h % CUSTOM_COLORS.length];
};
// 归一化 URL：无协议则补 https://
const normUrl = (u) => {
  const t = (u || "").trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};
// 缩写：中文取首字，英文取前 3 字母
const shortOf = (name) => {
  const t = (name || "").trim();
  if (!t) return "?";
  return /[\u4e00-\u9fa5]/.test(t[0]) ? t.slice(0, 1) : t.slice(0, 3).toUpperCase();
};

async function loadData(key, fallback) {
  try { const d = await invoke("load_data", { key }); return d ? JSON.parse(d) : fallback; } catch { return fallback; }
}
// 保存失败只提示一次：在非 Tauri 环境（例如用浏览器调试界面）每次保存都会抛，
// 原来逐次 console.error 会把控制台刷满，真正的报错反而被淹没。
let _saveWarned = false;
async function saveData(key, value) {
  try { await invoke("save_data", { key, value: JSON.stringify(value) }); }
  catch (e) {
    if (!_saveWarned) { _saveWarned = true; console.warn("本地存储不可用，本次会话的改动不会被保存：", e); }
  }
}

export default function Portal({ skipWarn, setSkipWarn }) {
  const [pending, setPending] = useState(null); // 待确认的外部链接
  const [dontAsk, setDontAsk] = useState(false);
  const [custom, setCustom] = useState([]);      // 用户自定义入口
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);   // 展开新增表单
  const [cName, setCName] = useState("");
  const [cUrl, setCUrl] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const d = await loadData("portalCustom", []);
      if (Array.isArray(d)) setCustom(d);
      setLoaded(true);
    })();
  }, []);
  useEffect(() => { if (loaded) saveData("portalCustom", custom); }, [custom, loaded]);

  const open = (p) => {
    if (skipWarn) { invoke("open_file", { path: p.url }); return; }
    setDontAsk(false);
    setPending(p);
  };
  const confirm = () => {
    if (dontAsk) setSkipWarn(true);
    invoke("open_file", { path: pending.url });
    setPending(null);
  };

  const addCustom = () => {
    const name = cName.trim();
    const url = normUrl(cUrl);
    if (!name || !url) return;
    setCustom((p) => [...p, { name, url, short: shortOf(name), bg: colorOf(name) }]);
    setCName(""); setCUrl(""); setAdding(false);
  };
  const removeCustom = (idx) => setCustom((p) => p.filter((_, i) => i !== idx));

  const renderRow = (list) => (
    <div className="flex flex-wrap gap-2">
      {list.map((p) => (
        <button key={p.name} onClick={() => open(p)}
          className="group flex flex-col items-center gap-1 w-16"
          title={p.tip ? `${p.name} · ${p.tip}` : p.url}>
          <LinkTile p={p} />
          <span className="text-[9px] text-gray-500 truncate w-full text-center group-hover:text-indigo-600">{p.name}</span>
        </button>
      ))}
    </div>
  );

  // 搜索：名称 / 简介 / 网址都能搜，分组里没有命中就整组隐藏
  const ql = q.trim().toLowerCase();
  const hit = (p) => !ql || `${p.name} ${p.tip || ""} ${p.url}`.toLowerCase().includes(ql);
  const SECTIONS = [
    ["期刊与图书馆", "顶刊 / 高校图书馆", BookMarked, "text-indigo-500", JOURNALS],
    ["科研数据库", "结构 / 序列 / 文献 / 质粒", Database, "text-emerald-600", DATABASES],
    ["引物设计", "设计 / Tm / 特异性", Dna, "text-cyan-600", PRIMER_TOOLS],
    ["数据分析", "NGS / 基因组 / 富集", BarChart3, "text-sky-600", DATA_ANALYSIS],
    ["文献阅读", "发现 / 管理 / 速读插件", BookOpen, "text-amber-600", LITERATURE],
    ["AI+ 科研", "结构预测 / 智能体（Biomni 强烈推荐）", Sparkles, "text-rose-600", AI_TOOLS],
  ];
  const visible = SECTIONS.map(([t, d, I, c, list]) => [t, d, I, c, list.filter(hit)]).filter((x) => x[4].length);
  const customShown = custom.map((p, idx) => [p, idx]).filter(([p]) => hit(p));

  return (
    <div className="space-y-3">
      <div className="relative max-w-[320px]">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索网站，如 BLAST、Addgene、Tm…"
          className="w-full pl-8 pr-7 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        {q && <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={12} /></button>}
      </div>
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      {visible.length === 0 && customShown.length === 0 && <div className="py-8 text-center text-[12px] text-gray-400">没有匹配「{q}」的网站</div>}
      {visible.map(([t, d, I, c, list], i) => (
        <div key={t} className={i ? "mt-3.5" : ""}>
          <div className="text-[11.5px] font-semibold text-gray-600 mb-2 flex items-center gap-1.5"><I size={12} className={c} />{t} <span className="text-gray-300 font-normal">· {d}</span></div>
          {renderRow(list)}
        </div>
      ))}

      {/* 自定义入口 */}
      <div className="text-[11.5px] font-semibold text-gray-600 mt-3.5 mb-2 flex items-center gap-1.5">
        <Plus size={12} className="text-sky-500" />自定义入口
        <span className="text-gray-300 font-normal">· 添加常用网页</span>
        <button onClick={() => setAdding((v) => !v)}
          className="ml-auto flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-md border border-gray-200 text-gray-500 hover:border-sky-300 hover:text-sky-600 bg-white transition">
          <Plus size={11} />添加
        </button>
      </div>

      {adding && (
        <div className="mb-2 p-2 rounded-lg border border-sky-100 bg-sky-50/50 space-y-1.5">
          <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="名称（如：实验室主页）"
            className="w-full text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-200 bg-white" />
          <input value={cUrl} onChange={(e) => setCUrl(e.target.value)} placeholder="网址（如：www.example.com）"
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            className="w-full text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-200 bg-white font-mono" />
          <div className="flex gap-1.5">
            <button onClick={addCustom} disabled={!cName.trim() || !cUrl.trim()}
              className="flex-1 py-1.5 text-[11px] bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-40 transition">保存入口</button>
            <button onClick={() => { setAdding(false); setCName(""); setCUrl(""); }}
              className="px-3 py-1.5 text-[11px] border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition">取消</button>
          </div>
        </div>
      )}

      {custom.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {customShown.map(([p, idx]) => (
            <div key={`${p.name}-${idx}`} className="group relative flex flex-col items-center gap-1 w-16">
              <button onClick={() => open(p)} className="flex flex-col items-center gap-1 w-full" title={p.url}>
                <LinkTile p={p} />
                <span className="text-[9px] text-gray-500 truncate w-full text-center group-hover:text-sky-600">{p.name}</span>
              </button>
              <button onClick={() => removeCustom(idx)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                title="删除该入口" style={{ display: "flex" }}><X size={10} /></button>
            </div>
          ))}
        </div>
      ) : (
        !adding && <div className="text-[10px] text-gray-300 py-1">还没有自定义入口，点右上角「添加」加入常用网页</div>
      )}

      {/* 外部链接确认 */}
      {pending && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setPending(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2"><ExternalLink size={16} className="text-indigo-500" />即将进入外部网页</div>
            <p className="text-[12px] text-gray-500 leading-relaxed">您正在打开「{pending.name}」：<br /><span className="font-mono text-[11px] text-indigo-600 break-all">{pending.url}</span><br />将在系统默认浏览器中打开，适用该网站自身的隐私政策。</p>
            <label className="flex items-center gap-1.5 mt-3 text-[11px] text-gray-500 cursor-pointer">
              <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} className="accent-indigo-500" />不再提示（以后直接打开）
            </label>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setPending(null)} className="flex-1 py-2 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={confirm} className="flex-1 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">继续打开</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
