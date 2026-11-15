// ==================== 传送门链接目录 ====================
// 单独成模块的原因：组件和 fetch-portal-icons.mjs 抓图标脚本共用同一份清单，
// 新增入口只改这里，图标脚本自动跟上，不会出现"加了链接忘了抓图标"。
// 纯数据，不含 JSX，Node 可直接 import。

export const JOURNALS = [
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
export const DATABASES = [
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
export const PRIMER_TOOLS = [
  { name: "Primer3", short: "P3", url: "https://primer3.ut.ee", bg: "#2563eb", tip: "经典引物设计引擎" },
  { name: "Primer-BLAST", short: "PB", url: "https://www.ncbi.nlm.nih.gov/tools/primer-blast/", bg: "#1c5aa0", tip: "NCBI 引物设计 + 特异性比对" },
  { name: "IDT OligoAnalyzer", short: "IDT", url: "https://www.idtdna.com/calc/analyzer", bg: "#00847d", tip: "寡核苷酸 Tm / 二聚体 / 发夹分析" },
  { name: "NEB Tm Calculator", short: "NEB", url: "https://tmcalculator.neb.com", bg: "#b5121b", tip: "NEB 退火温度计算" },
  { name: "Benchling", short: "BL", url: "https://www.benchling.com", bg: "#0ea5e9", tip: "云端克隆 / 引物 / 序列设计" },
  { name: "SnapGene", short: "SG", url: "https://www.snapgene.com", bg: "#6d28d9", tip: "分子克隆与引物设计（商业）" },
];

// 数据分析渠道（点4）
export const DATA_ANALYSIS = [
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
export const LITERATURE = [
  { name: "Connected Papers", short: "CP", url: "https://www.connectedpapers.com", bg: "#2563eb", tip: "文献关联图谱，找相似/前后工作" },
  { name: "Semantic Scholar", short: "SS", url: "https://www.semanticscholar.org", bg: "#1c5aa0", tip: "AI 学术搜索 + 引用意图" },
  { name: "Research Rabbit", short: "RR", url: "https://www.researchrabbit.ai", bg: "#6d28d9", tip: "文献发现与追踪（免费）" },
  { name: "scite", short: "SC", url: "https://scite.ai", bg: "#0ea5e9", tip: "智能引用，看结论被支持/反驳" },
  { name: "Zotero", short: "ZT", url: "https://www.zotero.org", bg: "#b5121b", tip: "文献管理 + 浏览器抓取插件" },
  { name: "Scholarcy", short: "SY", url: "https://www.scholarcy.com", bg: "#00847d", tip: "论文速读 / 摘要卡片插件" },
];

// AI+ 结构与科研工具（点4）
export const AI_TOOLS = [
  { name: "Biomni", short: "BI", url: "https://biomni.stanford.edu", bg: "#c8102e", tip: "★ 斯坦福通用生物医学 AI 智能体（强烈推荐，真的很好用）" },
  { name: "RF3 (RoseTTAFold3)", short: "RF3", url: "https://github.com/RosettaCommons/foundry", bg: "#6d28d9", tip: "蛋白 / 核酸复合物结构预测（RosettaCommons Foundry）" },
  { name: "RhoFold", short: "RH", url: "https://github.com/ml4bio/RhoFold", bg: "#c05a3c", tip: "RNA 三维结构预测（语言模型，Nature Methods）" },
  { name: "AlphaFold3", short: "AF3", url: "https://alphafoldserver.com", bg: "#0f6caf", tip: "全分子结构预测服务器" },
  { name: "ESMFold", short: "ESM", url: "https://esmatlas.com", bg: "#00847d", tip: "蛋白语言模型快速结构预测" },
  { name: "RFdiffusion", short: "RFD", url: "https://github.com/RosettaCommons/RFdiffusion", bg: "#8d4da1", tip: "扩散模型蛋白从头设计" },
];

// 全部内置入口（抓图标脚本遍历用）
export const ALL_LINKS = [...JOURNALS, ...DATABASES, ...PRIMER_TOOLS, ...DATA_ANALYSIS, ...LITERATURE, ...AI_TOOLS];

// 图标文件名：优先用名称的 ASCII 片段，纯中文名则退回域名
// （文件名不用中文，避免跨平台编码差异——macOS 的 NFD 与 Windows 的 NFC 不一致）
export const slugOf = (p) => {
  const ascii = (p.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (ascii) return ascii;
  try {
    return new URL(p.url).hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/g, "-");
  } catch { return "link"; }
};
