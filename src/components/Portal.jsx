// ==================== 传送门：顶刊 + 清北图书馆 + 科研数据库 + 自定义入口 ====================
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExternalLink, Link2, Database, Plus, X, Dna, BarChart3, BookOpen, Sparkles } from "lucide-react";

const JOURNALS = [
  { name: "Nature", short: "N", url: "https://www.nature.com", bg: "#c8102e" },
  { name: "Science", short: "S", url: "https://www.science.org", bg: "#b5121b" },
  { name: "Cell", short: "C", url: "https://www.cell.com", bg: "#0072c6" },
  { name: "NEJM", short: "NE", url: "https://www.nejm.org", bg: "#a51c30" },
  { name: "The Lancet", short: "L", url: "https://www.thelancet.com", bg: "#004b87" },
  { name: "PNAS", short: "PN", url: "https://www.pnas.org", bg: "#005a8c" },
  { name: "清华图书馆", short: "THU", url: "https://lib.tsinghua.edu.cn", bg: "#660874" },
  { name: "北大图书馆", short: "PKU", url: "https://www.lib.pku.edu.cn", bg: "#8e0000" },
];

// 科研数据库（点10）：结构 / 序列 / 文献 / 质粒
const DATABASES = [
  { name: "RCSB PDB", short: "PDB", url: "https://www.rcsb.org", bg: "#0f6caf", tip: "蛋白质/核酸三维结构库" },
  { name: "NCBI", short: "NCBI", url: "https://www.ncbi.nlm.nih.gov", bg: "#1c5aa0", tip: "GenBank / BLAST / Gene 综合中心" },
  { name: "PubMed", short: "PM", url: "https://pubmed.ncbi.nlm.nih.gov", bg: "#326598", tip: "生物医学文献检索" },
  { name: "UniProt", short: "UP", url: "https://www.uniprot.org", bg: "#8d4da1", tip: "蛋白质序列与功能注释" },
  { name: "Addgene", short: "AG", url: "https://www.addgene.org", bg: "#00847d", tip: "质粒载体库" },
  { name: "RNAcentral", short: "RNA", url: "https://rnacentral.org", bg: "#c05a3c", tip: "非编码 RNA 序列整合库" },
  { name: "NDB", short: "NDB", url: "https://ndbserver.rutgers.edu", bg: "#5b7f3b", tip: "核酸结构数据库" },
  { name: "PDB-Dev", short: "DEV", url: "https://pdb-dev.wwpdb.org", bg: "#7a6a53", tip: "整合/混合结构模型库" },
];

// 引物设计（点4）
const PRIMER_TOOLS = [
  { name: "Primer3", short: "P3", url: "https://primer3.ut.ee", bg: "#2563eb", tip: "经典引物设计引擎" },
  { name: "Primer-BLAST", short: "PB", url: "https://www.ncbi.nlm.nih.gov/tools/primer-blast/", bg: "#1c5aa0", tip: "NCBI 引物设计 + 特异性比对" },
  { name: "IDT OligoAnalyzer", short: "IDT", url: "https://www.idtdna.com/calc/analyzer", bg: "#00847d", tip: "寡核苷酸 Tm / 二聚体 / 发夹分析" },
  { name: "NEB Tm Calculator", short: "NEB", url: "https://tmcalculator.neb.com", bg: "#b5121b", tip: "NEB 退火温度计算" },
  { name: "Benchling", short: "BL", url: "https://www.benchling.com", bg: "#0ea5e9", tip: "云端克隆 / 引物 / 序列设计" },
  { name: "SnapGene", short: "SG", url: "https://www.snapgene.com", bg: "#6d28d9", tip: "分子克隆与引物设计（商业）" },
];

// 数据分析渠道（点4）
const DATA_ANALYSIS = [
  { name: "Galaxy", short: "GX", url: "https://usegalaxy.org", bg: "#2563eb", tip: "免费在线 NGS 分析平台" },
  { name: "UCSC Browser", short: "UC", url: "https://genome.ucsc.edu", bg: "#8e0000", tip: "基因组浏览器" },
  { name: "Ensembl", short: "EN", url: "https://www.ensembl.org", bg: "#005a8c", tip: "基因组注释与比较" },
  { name: "BLAST", short: "BL", url: "https://blast.ncbi.nlm.nih.gov", bg: "#1c5aa0", tip: "序列相似性比对" },
  { name: "GEO", short: "GEO", url: "https://www.ncbi.nlm.nih.gov/geo/", bg: "#326598", tip: "基因表达 / 芯片 / 测序数据库" },
  { name: "SRA", short: "SRA", url: "https://www.ncbi.nlm.nih.gov/sra", bg: "#1c5aa0", tip: "原始测序数据归档" },
  { name: "STRING", short: "ST", url: "https://string-db.org", bg: "#00847d", tip: "蛋白相互作用网络" },
  { name: "DAVID", short: "DV", url: "https://david.ncifcrf.gov", bg: "#5b7f3b", tip: "基因功能富集分析" },
];

// 文献阅读与插件（点4）
const LITERATURE = [
  { name: "Connected Papers", short: "CP", url: "https://www.connectedpapers.com", bg: "#2563eb", tip: "文献关联图谱，找相似/前后工作" },
  { name: "Semantic Scholar", short: "SS", url: "https://www.semanticscholar.org", bg: "#1c5aa0", tip: "AI 学术搜索 + 引用意图" },
  { name: "Research Rabbit", short: "RR", url: "https://www.researchrabbit.ai", bg: "#6d28d9", tip: "文献发现与追踪（免费）" },
  { name: "scite", short: "SC", url: "https://scite.ai", bg: "#0ea5e9", tip: "智能引用，看结论被支持/反驳" },
  { name: "Zotero", short: "ZT", url: "https://www.zotero.org", bg: "#b5121b", tip: "文献管理 + 浏览器抓取插件" },
  { name: "Scholarcy", short: "SY", url: "https://www.scholarcy.com", bg: "#00847d", tip: "论文速读 / 摘要卡片插件" },
];

// AI+ 结构与科研工具（点4）
const AI_TOOLS = [
  { name: "Biomni", short: "BI", url: "https://biomni.stanford.edu", bg: "#c8102e", tip: "★ 斯坦福通用生物医学 AI 智能体（强烈推荐，真的很好用）" },
  { name: "RF3 (RoseTTAFold3)", short: "RF3", url: "https://github.com/RosettaCommons/foundry", bg: "#6d28d9", tip: "蛋白 / 核酸复合物结构预测（RosettaCommons Foundry）" },
  { name: "RhoFold", short: "RH", url: "https://github.com/ml4bio/RhoFold", bg: "#c05a3c", tip: "RNA 三维结构预测（语言模型，Nature Methods）" },
  { name: "AlphaFold3", short: "AF3", url: "https://alphafoldserver.com", bg: "#0f6caf", tip: "全分子结构预测服务器" },
  { name: "ESMFold", short: "ESM", url: "https://esmatlas.com", bg: "#00847d", tip: "蛋白语言模型快速结构预测" },
  { name: "RFdiffusion", short: "RFD", url: "https://github.com/RosettaCommons/RFdiffusion", bg: "#8d4da1", tip: "扩散模型蛋白从头设计" },
];

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
async function saveData(key, value) {
  try { await invoke("save_data", { key, value: JSON.stringify(value) }); } catch (e) { console.error(e); }
}

export default function Portal({ skipWarn, setSkipWarn }) {
  const [pending, setPending] = useState(null); // 待确认的外部链接
  const [dontAsk, setDontAsk] = useState(false);
  const [custom, setCustom] = useState([]);      // 用户自定义入口
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);   // 展开新增表单
  const [cName, setCName] = useState("");
  const [cUrl, setCUrl] = useState("");

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
          className="group flex flex-col items-center gap-1 w-14"
          title={p.tip ? `${p.name} · ${p.tip}` : p.url}>
          <span className="w-11 h-11 flex items-center justify-center rounded-xl text-white font-bold text-[13px] shadow-sm group-hover:scale-105 group-hover:shadow-md transition-transform"
            style={{ backgroundColor: p.bg }}>{p.short}</span>
          <span className="text-[9px] text-gray-500 truncate w-full text-center group-hover:text-indigo-600">{p.name}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5">
      <div className="text-[11px] font-semibold text-gray-500 mb-2 flex items-center gap-1"><Link2 size={12} className="text-indigo-500" />传送门 <span className="text-gray-300 font-normal">· 顶刊 / 数据库 / 引物 / 分析 / 文献 / AI+</span></div>
      {renderRow(JOURNALS)}
      <div className="text-[11px] font-semibold text-gray-500 mt-3 mb-2 flex items-center gap-1"><Database size={12} className="text-emerald-600" />科研数据库 <span className="text-gray-300 font-normal">· 结构 / 序列 / 文献 / 质粒</span></div>
      {renderRow(DATABASES)}
      <div className="text-[11px] font-semibold text-gray-500 mt-3 mb-2 flex items-center gap-1"><Dna size={12} className="text-cyan-600" />引物设计 <span className="text-gray-300 font-normal">· 设计 / Tm / 特异性</span></div>
      {renderRow(PRIMER_TOOLS)}
      <div className="text-[11px] font-semibold text-gray-500 mt-3 mb-2 flex items-center gap-1"><BarChart3 size={12} className="text-sky-600" />数据分析 <span className="text-gray-300 font-normal">· NGS / 基因组 / 富集</span></div>
      {renderRow(DATA_ANALYSIS)}
      <div className="text-[11px] font-semibold text-gray-500 mt-3 mb-2 flex items-center gap-1"><BookOpen size={12} className="text-amber-600" />文献阅读 <span className="text-gray-300 font-normal">· 发现 / 管理 / 速读插件</span></div>
      {renderRow(LITERATURE)}
      <div className="text-[11px] font-semibold text-gray-500 mt-3 mb-2 flex items-center gap-1"><Sparkles size={12} className="text-rose-600" />AI+ 科研 <span className="text-gray-300 font-normal">· 结构预测 / 智能体（Biomni 强烈推荐）</span></div>
      {renderRow(AI_TOOLS)}

      {/* 自定义入口 */}
      <div className="text-[11px] font-semibold text-gray-500 mt-3 mb-2 flex items-center gap-1">
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
          {custom.map((p, idx) => (
            <div key={`${p.name}-${idx}`} className="group relative flex flex-col items-center gap-1 w-14">
              <button onClick={() => open(p)} className="flex flex-col items-center gap-1 w-full" title={p.url}>
                <span className="w-11 h-11 flex items-center justify-center rounded-xl text-white font-bold text-[13px] shadow-sm group-hover:scale-105 group-hover:shadow-md transition-transform"
                  style={{ backgroundColor: p.bg }}>{p.short}</span>
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
  );
}
