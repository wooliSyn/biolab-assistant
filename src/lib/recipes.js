// 内置配方（首跑 / 全新安装时载入）。从 Recipes.jsx 挪出来：
// 组件文件混入非组件导出会让 Vite 的 Fast Refresh 整个失效（见 CLAUDE.md 坑 2）。
import { genId } from "./core";

// 便利色（列表色点 / 详情页色条）
export const RECIPE_COLORS = ["#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#F97316", "#8B5CF6"];

export const recipeRow = (name, amount, note = "") => ({ id: genId(), name, amount, note });

export const DEFAULT_RECIPES = [
  {
    id: "r-lb", name: "LB 液体培养基", tag: "培养基", volume: "1 L", color: 0,
    rows: [
      recipeRow("胰蛋白胨 Tryptone", "10 g"), recipeRow("酵母提取物 Yeast Extract", "5 g"),
      recipeRow("NaCl", "10 g"), recipeRow("NaOH 调 pH", "至 7.0"), recipeRow("ddH₂O 定容", "1 L"),
    ],
    tips: "121°C 高压灭菌 20 min；室温保存。",
  },
  {
    id: "r-lbagar", name: "LB 固体培养基", tag: "培养基", volume: "1 L", color: 0,
    rows: [
      recipeRow("胰蛋白胨 Tryptone", "10 g"), recipeRow("酵母提取物 Yeast Extract", "5 g"),
      recipeRow("NaCl", "10 g"), recipeRow("琼脂 Agar", "15 g"), recipeRow("NaOH 调 pH", "至 7.0"),
    ],
    tips: "灭菌后冷却至约 55°C 再加抗生素，倒板。",
  },
  {
    id: "r-tae", name: "TAE 电泳缓冲液 (50×)", tag: "电泳", volume: "1 L", color: 2,
    rows: [
      recipeRow("Tris base", "242 g"), recipeRow("冰醋酸", "57.1 mL"),
      recipeRow("0.5 M EDTA (pH 8.0)", "100 mL"), recipeRow("ddH₂O 定容", "1 L"),
    ],
    tips: "工作液 1×；RNA 电泳建议用新鲜配制。",
  },
  {
    id: "r-tbe", name: "TBE 电泳缓冲液 (10×)", tag: "电泳", volume: "1 L", color: 2,
    rows: [
      recipeRow("Tris base", "108 g"), recipeRow("硼酸 Boric acid", "55 g"),
      recipeRow("0.5 M EDTA (pH 8.0)", "40 mL"), recipeRow("ddH₂O 定容", "1 L"),
    ],
    tips: "PAGE 胶常用 1× TBE；硼酸易析出，4°C 勿久存。",
  },
  {
    id: "r-pbs", name: "PBS 磷酸盐缓冲液 (1×)", tag: "缓冲液", volume: "1 L", color: 1,
    rows: [
      recipeRow("NaCl", "8.0 g"), recipeRow("KCl", "0.2 g"),
      recipeRow("Na₂HPO₄", "1.44 g"), recipeRow("KH₂PO₄", "0.24 g"), recipeRow("HCl 调 pH", "至 7.4"),
    ],
    tips: "定容后调 pH，灭菌；4°C 保存。",
  },
  {
    id: "r-amp", name: "氨苄青霉素 Amp (1000×)", tag: "抗生素", volume: "10 mL", color: 3,
    rows: [
      recipeRow("Ampicillin 钠盐", "1 g"), recipeRow("ddH₂O 定容", "10 mL"),
    ],
    tips: "0.22 μm 过滤除菌，分装，-20°C 保存；工作浓度 100 μg/mL。",
  },
  {
    id: "r-iptg", name: "IPTG (1 M)", tag: "诱导", volume: "10 mL", color: 3,
    rows: [
      recipeRow("IPTG", "2.38 g"), recipeRow("ddH₂O 定容", "10 mL"),
    ],
    tips: "过滤除菌，分装，-20°C；工作浓度 0.1–1 mM。",
  },
  {
    id: "r-xgal", name: "X-gal (20 mg/mL)", tag: "筛选", volume: "10 mL", color: 4,
    rows: [
      recipeRow("X-gal", "200 mg"), recipeRow("DMF 或 ddH₂O 定容", "10 mL"),
    ],
    tips: "避光，-20°C 保存；蓝白斑筛选 40 μL/板。",
  },
  {
    id: "r-depc", name: "DEPC 处理水", tag: "RNA 专用", volume: "1 L", color: 5,
    rows: [
      recipeRow("DEPC", "1 mL"), recipeRow("ddH₂O", "1 L"),
    ],
    tips: "通风橱操作！搅拌过夜后高压灭菌除去 DEPC。",
  },
  {
    id: "r-rnastore", name: "RNA 保存缓冲液", tag: "RNA 专用", volume: "10 mL", color: 5,
    rows: [
      recipeRow("Tris-HCl (pH 7.5)", "10 mM"), recipeRow("EDTA", "1 mM"),
      recipeRow("DTT", "0.1 mM"), recipeRow("RNase 抑制剂", "可选"),
    ],
    tips: "用 DEPC 水配制；RNA 长期保存建议 -80°C 乙醇沉淀。",
  },
  {
    id: "r-tbs", name: "TBS 缓冲液 (10×)", tag: "缓冲液", volume: "1 L", color: 1,
    rows: [
      recipeRow("Tris base", "24.2 g"), recipeRow("NaCl", "80 g"), recipeRow("KCl", "2 g"),
      recipeRow("HCl 调 pH", "至 7.4"), recipeRow("ddH₂O 定容", "1 L"),
    ],
    tips: "稀释 10 倍为 1× 工作液；pH 随温度漂移，室温调 pH；高压灭菌或过滤除菌，室温保存。",
  },
  {
    id: "r-tbst", name: "TBST 洗涤液 (1×)", tag: "缓冲液", volume: "1 L", color: 1,
    rows: [
      recipeRow("TBS (10×)", "100 mL"), recipeRow("Tween-20", "1 mL"), recipeRow("ddH₂O 定容", "1 L"),
    ],
    tips: "Western 洗膜用；Tween-20 粘稠，剪口枪头慢吸，充分混匀；现配现用效果最佳。",
  },
  {
    id: "r-ssc", name: "SSC 缓冲液 (20×)", tag: "缓冲液", volume: "1 L", color: 1,
    rows: [
      recipeRow("NaCl", "175.3 g"), recipeRow("柠檬酸钠", "88.2 g"),
      recipeRow("HCl 调 pH", "至 7.0"), recipeRow("ddH₂O 定容", "1 L"),
    ],
    tips: "核酸杂交/洗膜用，按需稀释至 2×/0.5×/0.1×；高压灭菌，室温保存。",
  },
  {
    id: "r-hyb", name: "核酸杂交缓冲液", tag: "RNA 专用", volume: "50 mL", color: 5,
    rows: [
      recipeRow("20× SSC", "12.5 mL", "终浓度 5×"), recipeRow("50× Denhardt's", "5 mL", "终浓度 5×"),
      recipeRow("10% SDS", "2.5 mL", "终浓度 0.5%"), recipeRow("鲑精 DNA (10 mg/mL)", "0.5 mL", "煮沸 5 min 冰浴骤冷"),
      recipeRow("甲酰胺 (可选)", "25 mL", "终浓度 50%，降低杂交温度"), recipeRow("ddH₂O 定容", "50 mL"),
    ],
    tips: "鲑精 DNA 封闭非特异结合；含甲酰胺 42°C 杂交，不含则 65–68°C；RNA (Northern) 杂交全程 RNase-free。",
  },
  {
    id: "r-dmem", name: "DMEM 完全培养基", tag: "培养基", volume: "≈550 mL", color: 0,
    rows: [
      recipeRow("DMEM 基础培养基", "500 mL"), recipeRow("FBS 胎牛血清", "50 mL", "终浓度 10%"),
      recipeRow("青霉素-链霉素 (100×)", "5 mL", "终浓度 1%"), recipeRow("L-谷氨酰胺", "适量", "终浓度 2 mM"),
    ],
    tips: "细胞培养用；FBS 4°C 过夜解冻，必要时 56°C 30 min 灭活；4°C 避光保存，2–4 周内用完，用前 37°C 预热。",
  },
  {
    id: "r-freeze", name: "细胞冻存液", tag: "培养基", volume: "10 mL", color: 0,
    rows: [
      recipeRow("完全培养基", "7 mL", "70%"), recipeRow("FBS 胎牛血清", "2 mL", "20%"),
      recipeRow("DMSO", "1 mL", "10%"),
    ],
    tips: "现配现用，4°C 预冷；DMSO 最后加、轻柔混匀；细胞密度 1–5×10⁶/mL，程序降温 -80°C 过夜后转液氮。",
  },
  {
    id: "r-ripa", name: "RIPA 裂解液", tag: "缓冲液", volume: "50 mL", color: 1,
    rows: [
      recipeRow("1 M Tris-HCl (pH 7.4)", "2.5 mL", "终浓度 50 mM"), recipeRow("5 M NaCl", "1.5 mL", "终浓度 150 mM"),
      recipeRow("NP-40", "0.5 mL", "终浓度 1%"), recipeRow("脱氧胆酸钠", "0.25 g", "终浓度 0.5%"),
      recipeRow("10% SDS", "0.5 mL", "终浓度 0.1%"), recipeRow("0.5 M EDTA (pH 8.0)", "0.1 mL", "终浓度 1 mM"),
      recipeRow("ddH₂O 定容", "50 mL"),
    ],
    tips: "蛋白提取用；用前新鲜加蛋白酶抑制剂 (如 PMSF 1 mM)，全程冰上操作；4°C 保存，低温 SDS 析出时温热溶解。",
  },
  {
    id: "r-sdsload", name: "5× SDS 蛋白上样缓冲液", tag: "电泳", volume: "10 mL", color: 2,
    rows: [
      recipeRow("1 M Tris-HCl (pH 6.8)", "2.5 mL", "终浓度 250 mM"), recipeRow("SDS", "1 g", "终浓度 10%"),
      recipeRow("甘油", "5 mL", "终浓度 50%"), recipeRow("β-巯基乙醇", "0.5 mL", "终浓度 5%"),
      recipeRow("溴酚蓝", "50 mg", "终浓度 0.5%"), recipeRow("ddH₂O 定容", "10 mL"),
    ],
    tips: "β-巯基乙醇有毒易挥发，通风橱操作；分装 -20°C 保存；样品按 1:4 混合，95–100°C 变性 5–10 min。",
  },
  {
    id: "r-cbbstain", name: "考马斯亮蓝染色液", tag: "电泳", volume: "1 L", color: 2,
    rows: [
      recipeRow("考马斯亮蓝 R-250", "1 g", "0.1%"), recipeRow("甲醇", "400 mL", "40%"),
      recipeRow("冰醋酸", "100 mL", "10%"), recipeRow("ddH₂O 定容", "1 L"),
    ],
    tips: "蛋白胶染色用；染料先溶于甲醇再加乙酸和水；室温摇床染色 30–60 min，通风橱操作。",
  },
  {
    id: "r-cbbdestain", name: "考马斯脱色液", tag: "电泳", volume: "1 L", color: 2,
    rows: [
      recipeRow("甲醇", "400 mL", "40%"), recipeRow("冰醋酸", "100 mL", "10%"),
      recipeRow("ddH₂O 定容", "1 L"),
    ],
    tips: "摇床脱色，多次换液至背景透明、条带清晰；可加滤纸吸附染料加速，脱色液可回收复用。",
  },
  {
    id: "r-block", name: "封闭液 (5% 脱脂奶粉)", tag: "缓冲液", volume: "100 mL", color: 1,
    rows: [
      recipeRow("脱脂奶粉", "5 g"), recipeRow("TBST 定容", "100 mL"),
    ],
    tips: "Western 封闭用，现配现用、充分溶解；室温封闭 1 h；磷酸化蛋白检测改用 5% BSA (奶粉酪蛋白干扰)。",
  },
  {
    id: "r-transfer", name: "10× 转膜缓冲液 (Tris-甘氨酸)", tag: "电泳", volume: "1 L", color: 2,
    rows: [
      recipeRow("Tris base", "30.3 g"), recipeRow("甘氨酸", "144 g"), recipeRow("ddH₂O 定容", "1 L"),
    ],
    tips: "1× 工作液：100 mL 10× + 200 mL 甲醇 + 700 mL ddH₂O (甲醇终浓度 20%)；勿调 pH；甲醇促进蛋白与膜结合。",
  },
];
