// ==================== BioLab 实验助手 · 主应用 ====================
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import {
  FlaskConical, Clock, Calendar, Plus, X, Minimize2, MapPin, HelpCircle, Minus,
  ListChecks, FileText, Database, Dna, ChevronLeft, ChevronRight, Download,
  StickyNote, ChevronDown, ChevronUp, NotebookPen, Settings, HardDrive, BellRing, ShieldCheck, History, Timer,
} from "lucide-react";
import {
  genId, dateStr, timeStr, timeStrSec, weekdayOf, relativeDayLabel, greeting, weatherInfo,
  fetchLocationWeather, computeSteps, exportRecordsByDay, downloadText,
  registerToast, registerConfirm, toast, askConfirm,
  setDragPayload, getDragPayload, clearDragPayload,
} from "./lib/core";
import { FlipGrid } from "./lib/useFlip";
import { DEFAULT_TEMPLATES } from "./lib/templates";
import Timeline from "./components/Timeline";
import SessionCard from "./components/SessionCard";
import Sidebar from "./components/Sidebar";
import NoteEditor from "./components/NoteEditor";
import Datasets from "./components/Datasets";
const Cloning = lazy(() => import("./components/Cloning"));
import ToolsView from "./components/ToolsView";
import Onboarding from "./components/Onboarding";
import MiniMode from "./components/MiniMode";
import SessionDetail from "./components/SessionDetail";
import HelpTip from "./components/HelpTip";
import LegalDialog from "./components/LegalDialog";
import Portal from "./components/Portal";
import { ToastStack, ConfirmDialog } from "./components/Feedback";
import Recipes, { DEFAULT_RECIPES } from "./components/Recipes";
import { Modal, TemplatePicker, SetupDialog, TemplateEditor, DataDialog, DataStartDialog } from "./components/Dialogs";
import { useLongPressDrag } from "./lib/useLongPressDrag";

const appWindow = getCurrentWindow();

// 桌面顶部标签栏与移动底部导航栏共用的标签定义（图标复用顶部已导入组件）
const TAB_DEFS = [
  { k: "today", i: ListChecks, l: "今日实验" },
  { k: "templates", i: FileText, l: "方案库" },
  { k: "recipes", i: NotebookPen, l: "配方" },
  { k: "datasets", i: Database, l: "数据集" },
  { k: "cloning", i: Dna, l: "质粒工作台" },
  { k: "tools", i: Timer, l: "工具箱" },
];

async function loadData(key, fallback) {
  try { const d = await invoke("load_data", { key }); return d ? JSON.parse(d) : fallback; } catch { return fallback; }
}
async function saveData(key, value) {
  try { await invoke("save_data", { key, value: JSON.stringify(value) }); } catch (e) { console.error(e); }
}
// 批量加载（单次 IPC 往返，加速启动；失败时返回空对象由调用方走默认值）
async function loadMany(keys) {
  try { return await invoke("load_many", { keys }); } catch { return {}; }
}
// 原生保存对话框导出文本（WebView2 会拦截浏览器式 anchor 下载，改走 Rust rfd）
async function saveTextViaDialog(defaultName, content, title = "保存文件") {
  try { return await invoke("save_text_file", { title, defaultName, content }); }
  catch (e) { toast("保存失败：" + e, "error"); return null; }
}
// 应用内提示音（三声短鸣）
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.28, 0.56].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = 920;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.24);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.26);
    });
  } catch { /* audio unavailable */ }
}
const FONT_ZOOM = { sm: 0.85, md: 1, lg: 1.18 };

// ==================== 启动动画（高级感 splash：双环旋转 + 粒子 + 流光标题 + 进度条） ====================
const SPLASH_MSGS = ["正在唤醒实验台", "加载本地数据", "校准移液器", "预热培养箱", "铺好琼脂糖凝胶", "准备就绪"];
const SPLASH_THEMES = {
  flat: { bg: "radial-gradient(120% 92% at 50% 28%, #1c2544 0%, #11162c 46%, #070a16 100%)", ring: "rgba(129,140,248,0.95)", ring2: "rgba(34,211,238,0.8)", halo: "rgba(99,102,241,0.30)", halo2: "rgba(56,189,248,0.10)", particle: ["rgba(129,140,248,0.8)", "rgba(103,232,249,0.75)"], grid: "rgba(129,140,248,0.05)", grid2: "rgba(34,211,238,0.035)", shimmer: "linear-gradient(100deg, #c7d2fe 15%, #ffffff 38%, #a5f3fc 50%, #ffffff 62%, #c7d2fe 85%)", logo: "from-indigo-500 to-indigo-700", sub: "text-indigo-300/85", bar: "linear-gradient(90deg, transparent, #818cf8 35%, #67e8f9 65%, transparent)" },
  rhine: { bg: "radial-gradient(120% 92% at 50% 28%, #0f1a12 0%, #0a100e 46%, #040806 100%)", ring: "rgba(57,255,142,0.95)", ring2: "rgba(255,45,85,0.8)", halo: "rgba(57,255,142,0.25)", halo2: "rgba(255,45,85,0.10)", particle: ["rgba(57,255,142,0.8)", "rgba(255,92,122,0.75)"], grid: "rgba(57,255,142,0.06)", grid2: "rgba(255,45,85,0.04)", shimmer: "linear-gradient(100deg, #39ff8e 15%, #ffffff 38%, #ff5c7a 50%, #ffffff 62%, #39ff8e 85%)", logo: "from-emerald-500 to-emerald-700", sub: "text-emerald-300/85", bar: "linear-gradient(90deg, transparent, #39ff8e 35%, #ff5c7a 65%, transparent)" },
  pixel: { bg: "radial-gradient(120% 92% at 50% 28%, #1a2744 0%, #111a30 46%, #080c18 100%)", ring: "rgba(96,165,250,0.95)", ring2: "rgba(251,191,36,0.8)", halo: "rgba(96,165,250,0.28)", halo2: "rgba(251,191,36,0.10)", particle: ["rgba(96,165,250,0.8)", "rgba(251,191,36,0.75)"], grid: "rgba(96,165,250,0.05)", grid2: "rgba(251,191,36,0.035)", shimmer: "linear-gradient(100deg, #93c5fd 15%, #ffffff 38%, #fcd34d 50%, #ffffff 62%, #93c5fd 85%)", logo: "from-blue-500 to-blue-700", sub: "text-blue-300/85", bar: "linear-gradient(90deg, transparent, #60a5fa 35%, #fbbf24 65%, transparent)" },
};
function SplashScreen({ fading, theme }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const T = SPLASH_THEMES[theme] || SPLASH_THEMES.flat;
  useEffect(() => {
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % SPLASH_MSGS.length), 700);
    return () => clearInterval(t);
  }, []);
  const ringMask = "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))";
  return (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-all duration-[680ms] ease-out ${fading ? "opacity-0 scale-105 pointer-events-none" : "opacity-100"}`}
      style={{ background: T.bg, filter: fading ? "blur(6px)" : "none" }}>
      {/* 科技网格背景 */}
      <div className="absolute inset-0 opacity-[0.5]" style={{
        backgroundImage:
          `repeating-linear-gradient(60deg, ${T.grid} 0 1px, transparent 1px 30px),` +
          `repeating-linear-gradient(-60deg, ${T.grid} 0 1px, transparent 1px 30px),` +
          `repeating-linear-gradient(0deg, ${T.grid2} 0 1px, transparent 1px 30px)`,
      }} />
      {/* 中央光晕（呼吸） */}
      <div className="absolute w-[620px] h-[620px] rounded-full splash-halo" style={{ background: `radial-gradient(circle, ${T.halo} 0%, ${T.halo2} 42%, transparent 68%)` }} />
      {/* 上升粒子 */}
      {[...Array(18)].map((_, i) => (
        <span key={i} className="absolute rounded-full splash-rise-p"
          style={{
            width: 2 + (i % 3) * 2, height: 2 + (i % 3) * 2,
            left: `${(i * 53 + 7) % 100}%`, bottom: "-4%",
            background: T.particle[i % 2],
            boxShadow: `0 0 8px ${T.particle[i % 2]}`,
            animationDelay: `${(i % 9) * 0.5}s`, animationDuration: `${5 + (i % 5)}s`,
          }} />
      ))}

      {/* Logo + 双旋转环 */}
      <div className="relative w-44 h-44 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full splash-ring" style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${T.ring} 42deg, transparent 96deg, transparent 190deg, ${T.ring2} 246deg, transparent 300deg)`,
          WebkitMask: ringMask, mask: ringMask,
        }} />
        <div className="absolute inset-4 rounded-full splash-ring-rev" style={{
          background: `conic-gradient(from 120deg, transparent 0deg, rgba(255,255,255,0.5) 30deg, transparent 70deg, transparent 210deg, ${T.ring} 260deg, transparent 300deg)`,
          WebkitMask: ringMask, mask: ringMask, opacity: 0.7,
        }} />
        <div className={`relative w-24 h-24 rounded-3xl bg-gradient-to-br ${T.logo} border border-white/20 shadow-[0_0_64px_rgba(99,102,241,0.5)] flex items-center justify-center overflow-hidden splash-wobble`}>
          <FlaskConical size={46} className="text-white relative z-10" />
          {[0, 1, 2].map((i) => (
            <span key={i} className="absolute bottom-2 rounded-full bg-white/55 splash-bubble"
              style={{ width: 7 + i * 3, height: 7 + i * 3, left: `${30 + i * 18}%`, animationDelay: `${i * 0.5}s` }} />
          ))}
          <span className="absolute bottom-0 left-0 right-0 h-7 bg-white/30 splash-liquid" />
        </div>
      </div>

      {/* 标题（流光扫过） */}
      <div className="mt-8 text-center splash-rise">
        <div className="text-3xl font-black tracking-[0.28em]" style={{ background: T.shimmer, backgroundSize: "200% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent", animation: "splashShimmer 2.6s linear infinite", filter: "drop-shadow(0 0 18px rgba(129,140,248,0.45))" }}>BioLab</div>
        <div className={`mt-2 text-[12px] tracking-[0.5em] ${T.sub}`}>实 验 助 手</div>
      </div>

      {/* 进度条（不定长扫动） */}
      <div className="mt-8 w-56 h-1 rounded-full bg-white/10 overflow-hidden splash-rise" style={{ animationDelay: "0.2s" }}>
        <div className="h-full w-2/5 rounded-full splash-progress" style={{ background: T.bar }} />
      </div>
      <div className={`mt-3.5 text-[11px] tracking-widest splash-rise ${T.sub}`} style={{ animationDelay: "0.3s" }}>{SPLASH_MSGS[msgIdx]}…</div>

      <div className="absolute bottom-6 text-[10px] text-white/30 tracking-wider">BioLab 实验助手 · YunPlover</div>
    </div>
  );
}

// ==================== 莱茵主题背景光效层（水晶霓虹：网格 + 光球 + 光束 + 天际线 + 粒子） ====================
const RHINE_PARTS = [...Array(26)].map((_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 1.5 + (i % 3) * 1.6,
  delay: (i % 13) * 0.7,
  dur: 9 + (i % 7) * 2.2,
  cyan: i % 3 === 0,
}));
const RHINE_SKY = [
  [0, 60, 90], [55, 40, 130], [90, 70, 70], [150, 35, 150], [180, 55, 100], [230, 45, 120],
  [270, 80, 60], [340, 40, 140], [375, 60, 95], [430, 50, 115], [475, 38, 155], [508, 66, 80],
  [660, 40, 145], [695, 70, 75], [758, 46, 120], [800, 60, 90], [852, 38, 150], [886, 54, 105],
  [935, 64, 70], [992, 42, 135], [1030, 58, 95], [1082, 48, 120], [1126, 74, 80],
];
function RhineFX() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* 翠绿弯曲透视网格（底部，赛博蒸汽感） */}
      <div className="absolute inset-x-0 bottom-0 h-[55%] rhine-grid" />
      {/* 水平扫描网格（全屏缓慢滚动） */}
      <div className="absolute inset-0 rhine-grid-h opacity-40" />
      {/* 漂移霓虹光球（红 + 绿 + 青） */}
      <div className="absolute -top-32 -right-24 w-[540px] h-[540px] rounded-full rhine-orb" style={{ background: "radial-gradient(circle, rgba(255,45,85,0.20), transparent 62%)" }} />
      <div className="absolute -bottom-44 -left-28 w-[580px] h-[580px] rounded-full rhine-orb2" style={{ background: "radial-gradient(circle, rgba(57,255,142,0.14), transparent 60%)" }} />
      <div className="absolute top-1/3 left-1/2 w-[400px] h-[400px] rounded-full rhine-orb" style={{ background: "radial-gradient(circle, rgba(125,211,252,0.10), transparent 58%)", animationDelay: "-6s" }} />
      {/* 斜向流光扫描 */}
      <div className="absolute inset-0 rhine-beam" />
      {/* 水平扫描线（CRT 蒸汽感） */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 2px, rgba(57,255,142,0.4) 2px 3px)" }} />
      {/* 底部霓虹天际线 + 六边形穹顶 */}
      <svg className="absolute bottom-0 left-0 w-full" height="190" viewBox="0 0 1200 190" preserveAspectRatio="none" style={{ opacity: 0.45 }}>
        {RHINE_SKY.map(([x, w, h], i) => (
          <rect key={i} x={x} y={190 - h} width={w - 5} height={h} fill={i % 3 === 0 ? "rgba(57,255,142,0.05)" : "rgba(255,51,85,0.05)"} stroke={i % 3 === 0 ? "rgba(57,255,142,0.4)" : "rgba(255,51,85,0.35)"} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <path d="M536 190 A64 64 0 0 1 664 190" fill="rgba(57,255,142,0.04)" stroke="rgba(57,255,142,0.5)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <line x1="600" y1="126" x2="600" y2="96" stroke="rgba(57,255,142,0.6)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <circle cx="600" cy="92" r="3" fill="rgba(57,255,142,0.9)" />
      </svg>
      {/* 上升粒子（红/绿/青三色） */}
      {RHINE_PARTS.map((p, i) => (
        <span key={i} className="absolute rounded-full rhine-part"
          style={{
            left: `${p.left}%`, bottom: "-3%", width: p.size, height: p.size,
            background: p.cyan ? "#7dd3fc" : i % 2 === 0 ? "#39ff8e" : "#ff5c7a",
            boxShadow: `0 0 ${p.size * 3}px ${p.cyan ? "rgba(125,211,252,0.9)" : i % 2 === 0 ? "rgba(57,255,142,0.9)" : "rgba(255,92,122,0.9)"}`,
            animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
          }} />
      ))}
    </div>
  );
}

// ==================== 质粒工作台懒加载 fallback：空心环动画（点4） ====================
function CloningLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 cloning-fade-up">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full cloning-ring-spin">
          <circle cx="60" cy="60" r="48" fill="none" stroke="var(--px-ink)" strokeWidth="1.5" opacity="0.35" />
          <circle cx="60" cy="60" r="48" fill="none" stroke="var(--px-accent)" strokeWidth="3"
            strokeLinecap="round" strokeDasharray="300" className="cloning-ring-draw" />
          <circle cx="60" cy="12" r="3.5" fill="var(--px-accent)" className="cloning-ring-pulse" />
        </svg>
      </div>
      <div className="mt-6 text-sm font-medium text-gray-600 px-title">从一个质粒或一段序列开始</div>
      <div className="mt-2 text-[11px] text-gray-400">正在加载质粒工作台…</div>
    </div>
  );
}

export default function App() {
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [sessions, setSessions] = useState([]);
  const [dayNotes, setDayNotes] = useState({});
  const [stickies, setStickies] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [attendance, setAttendance] = useState({ records: {}, firstDay: null });
  const [recipes, setRecipes] = useState(DEFAULT_RECIPES);
  const [loaded, setLoaded] = useState(false);
  const bootStart = useRef(Date.now());
  const [splashFading, setSplashFading] = useState(false);
  const [splashGone, setSplashGone] = useState(true);
  const [now, setNow] = useState(Date.now());

  const [activeTab, setActiveTab] = useState("today");
  const [miniMode, setMiniMode] = useState(false);
  const [calOpen, setCalOpen] = useState(true);
  const [calExpanded, setCalExpanded] = useState(false);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selectedDate, setSelectedDate] = useState(dateStr(Date.now()));
  const [calJump, setCalJump] = useState(0);

  const [setup, setSetup] = useState(null);
  const [editor, setEditor] = useState(null);
  const [picker, setPicker] = useState(false);
  const [insertTs, setInsertTs] = useState(null);
  const [expandedSession, setExpandedSession] = useState(null);
  const [detailSession, setDetailSession] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [dataChoice, setDataChoice] = useState(false); // 首次运行：数据起点选择

  const [location, setLocation] = useState("");
  const [weather, setWeather] = useState(null);

  // 主题 / 字号设置（默认像素风 + 中等字号）
  const [settings, setSettings] = useState({ theme: "pixel", fontScale: "md" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [skipExtWarn, setSkipExtWarn] = useState(false);
  const [closeAsk, setCloseAsk] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [confirmDlg, setConfirmDlg] = useState(null);

  // 注册全局风格化提示 / 确认（点6）
  useEffect(() => {
    registerToast((msg, type) => {
      const id = genId();
      setToasts((p) => [...p.slice(-3), { id, msg, type }]);
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3200);
    });
    registerConfirm((opts) => new Promise((res) => setConfirmDlg({ opts, res })));
  }, []);

  // 加载持久化数据（分两阶段：关键数据先加载→立即渲染；其余延迟加载）
  useEffect(() => {
    (async () => {
      // Phase 1: 关键路径（决定首屏渲染）
      const map1 = await loadMany(["templates", "sessions", "settings", "onboarded"]);
      const get1 = (k, fb) => { const v = map1[k]; if (v == null) return fb; try { return JSON.parse(v); } catch { return fb; } };
      const t = get1("templates", null), s = get1("sessions", []),
        set = get1("settings", null), ob = get1("onboarded", false);
      if (t && t.length) {
        const ids = new Set(t.map((x) => x.id));
        const added = DEFAULT_TEMPLATES.filter((d) => !ids.has(d.id));
        setTemplates([...t, ...added]);
      }
      if (set && set.theme) setSettings({ theme: set.theme, fontScale: set.fontScale || "md" });
      if (set && set.historyMode) setCalExpanded(true);
      setSessions(s);
      setLoaded(true); // 首屏可渲染
      if (!ob) {
        loadData("dataChoiceDone", false).then((done) => {
          if (done) setOnboarding("welcome");
          else setDataChoice(true);
        });
      }
      // 通知权限（不阻塞渲染）
      try { if (!(await isPermissionGranted())) await requestPermission(); } catch { /* ignore */ }

      // Phase 2: 延迟数据（首屏渲染后异步填充）
      const map2 = await loadMany(["dayNotes", "stickies", "datasets", "recipes", "skipExtWarn", "attendance"]);
      const get2 = (k, fb) => { const v = map2[k]; if (v == null) return fb; try { return JSON.parse(v); } catch { return fb; } };
      const n = get2("dayNotes", {}), st = get2("stickies", []), ds = get2("datasets", []),
        rc = get2("recipes", null), sew = get2("skipExtWarn", false), att = get2("attendance", null);
      if (rc && rc.length) setRecipes(rc);
      setSkipExtWarn(!!sew);
      if (att && att.records) setAttendance(att);
      setDayNotes(n); setStickies(st); setDatasets(ds);
    })();
  }, []);

  // 应用主题 / 字号
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("theme-pixel", settings.theme === "pixel");
    el.classList.toggle("theme-rhine", settings.theme === "rhine");
    el.classList.toggle("theme-flat", settings.theme !== "pixel" && settings.theme !== "rhine");
    el.style.setProperty("--app-zoom", FONT_ZOOM[settings.fontScale] ?? 1);
  }, [settings]);
  useEffect(() => { if (loaded) saveData("settings", settings); }, [settings, loaded]);
  useEffect(() => { if (loaded) saveData("settings", { ...settings, historyMode: calExpanded }); }, [calExpanded, loaded]);
  useEffect(() => { if (loaded) saveData("skipExtWarn", skipExtWarn); }, [skipExtWarn, loaded]);

  // 应用内到点提醒（横幅 + 提示音；系统通知由 Rust 端发送）
  const pushAlert = useCallback((title, body) => {
    const id = genId();
    setAlerts((p) => [...p.slice(-3), { id, title, body, ts: Date.now() }]);
    setTimeout(() => setAlerts((p) => p.filter((a) => a.id !== id)), 20000);
    beep();
  }, []);

  // 时钟 + 到点提醒（系统通知 + 任务栏闪烁 + 应用内横幅）
  useEffect(() => {
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setSessions((prev) => {
        let changed = false;
        const next = prev.map((s) => {
          if (s.status !== "running" || s.hosting) return s;
          const st = s.steps[s.currentStepIndex];
          if (st && st.status === "active" && st.durationMin > 0 && !st.notified) {
            if (st.startedAt + st.durationMin * 60000 - t <= 0) {
              changed = true;
              invoke("send_notification", { title: "BioLab · 步骤到时", body: `${s.name}：${st.name} 时间到，请确认进入下一步` }).catch(() => {});
              invoke("request_attention").catch(() => {}); // 闪烁任务栏，防最小化遗漏
              pushAlert("步骤到时", `${s.name}：「${st.name}」时间到，请确认进入下一步`);
              const steps = [...s.steps]; steps[s.currentStepIndex] = { ...st, notified: true };
              return { ...s, steps };
            }
          }
          return s;
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pushAlert]);

  // 天气 / 定位
  useEffect(() => {
    fetchLocationWeather().then(({ location, weather }) => {
      setLocation(location); setWeather(weather);
    });
  }, []);

  // 持久化
  useEffect(() => { if (loaded) saveData("templates", templates); }, [templates, loaded]);
  useEffect(() => { if (loaded) saveData("sessions", sessions); }, [sessions, loaded]);
  useEffect(() => { if (loaded) saveData("dayNotes", dayNotes); }, [dayNotes, loaded]);
  useEffect(() => { if (loaded) saveData("stickies", stickies); }, [stickies, loaded]);
  useEffect(() => { if (loaded) saveData("attendance", attendance); }, [attendance, loaded]);

  // 点5：第一次使用提醒打卡功能（仅一次）
  useEffect(() => {
    if (!loaded || attendance.firstDay) return;
    loadData("attReminded", false).then((r) => {
      if (!r) {
        toast("小提示：右侧栏「打卡 · 工时」可记录上下班与工时，记得每天打卡～", "info");
        saveData("attReminded", true);
      }
    });
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (loaded) saveData("datasets", datasets); }, [datasets, loaded]);
  useEffect(() => { if (loaded) saveData("recipes", recipes); }, [recipes, loaded]);

  // ==================== 会话操作 ====================
  const createSession = (cfg) => {
    const start = cfg.startTime;
    const ri = Math.max(0, Math.min(cfg.resumeIdx || 0, cfg.steps.length - 1));
    const nowTs = Date.now();
    const steps = cfg.steps.map((st, i) => {
      if (i < ri) return { ...st, status: "skipped", startedAt: null, confirmedAt: null, notified: true };
      if (i === ri) return { ...st, status: "active", startedAt: ri > 0 ? nowTs : start, confirmedAt: null, notified: false };
      return { ...st, status: "pending", startedAt: null, confirmedAt: null, notified: false };
    });
    // 跨天标记：总时长跨过午夜（熬夜跨天）或含次日重排等待步骤，均视为跨天实验
    const totalMin = cfg.steps.reduce((a, st) => a + (st.durationMin || 0), 0);
    const endTs = start + totalMin * 60000;
    const overnight = dateStr(endTs) !== dateStr(start) || cfg.expectedDays > 1;
    const session = { id: genId(), templateId: cfg.templateId, name: cfg.name, createdAt: nowTs, startedAt: start, currentStepIndex: ri, status: "running", hosting: cfg.hosting, steps, notes: cfg.notes || "", materials: cfg.materials || "", expectedDays: cfg.expectedDays || 1, overnight };
    setSessions((p) => [session, ...p]);
    setSetup(null); setPicker(false); setInsertTs(null); setActiveTab("today"); setCalExpanded(false);
  };

  const confirmStep = (sid) => setSessions((prev) => prev.map((s) => {
    if (s.id !== sid) return s;
    const steps = [...s.steps]; const i = s.currentStepIndex;
    steps[i] = { ...steps[i], status: "done", confirmedAt: Date.now() };
    let ni = i + 1;
    while (ni < steps.length && steps[ni].status === "skipped") ni++;
    if (ni >= steps.length) return { ...s, steps, status: "completed", completedAt: Date.now() };
    steps[ni] = { ...steps[ni], status: "active", startedAt: Date.now(), notified: false };
    return { ...s, steps, currentStepIndex: ni };
  }));

  const skipStep = (sid) => setSessions((prev) => prev.map((s) => {
    if (s.id !== sid) return s;
    const steps = [...s.steps]; const i = s.currentStepIndex;
    steps[i] = { ...steps[i], status: "skipped" };
    let ni = i + 1;
    while (ni < steps.length && steps[ni].status === "skipped") ni++;
    if (ni >= steps.length) return { ...s, steps, status: "completed", completedAt: Date.now() };
    steps[ni] = { ...steps[ni], status: "active", startedAt: Date.now(), notified: false };
    return { ...s, steps, currentStepIndex: ni };
  }));

  const toggleHosting = (sid) => setSessions((prev) => prev.map((s) => (s.id === sid ? { ...s, hosting: !s.hosting } : s)));
  const adjustActive = (sid, delta) => setSessions((prev) => prev.map((s) => {
    if (s.id !== sid) return s;
    const steps = [...s.steps]; const st = steps[s.currentStepIndex];
    const newDur = Math.max(0, (st.durationMin || 0) + delta);
    const stillFuture = st.startedAt + newDur * 60000 - Date.now() > 0;
    steps[s.currentStepIndex] = { ...st, durationMin: newDur, notified: stillFuture ? false : st.notified };
    return { ...s, steps };
  }));
  const deleteSession = (sid) => setSessions((prev) => prev.filter((s) => s.id !== sid));
  // 自定义会话颜色 / 重点标记
  const setSessionColor = (sid, hex) => setSessions((prev) => prev.map((s) => (s.id === sid ? { ...s, color: hex } : s)));
  const toggleStar = (sid) => setSessions((prev) => prev.map((s) => (s.id === sid ? { ...s, star: !s.star } : s)));
  // 点击时间线节点：该实验置顶显示 + 展开卡片 + 打开详情
  // 置顶仅在同状态分组内进行（进行中 → 进行中分组顶部；已完成 → 已完成分组顶部）
  const bringToTop = (sid) => setSessions((prev) => {
    const t = prev.find((s) => s.id === sid);
    if (!t) return prev;
    const rest = prev.filter((s) => s.id !== sid);
    const idx = rest.findIndex((s) => s.status === t.status);
    if (idx === -1) return [t, ...rest];
    const c = [...rest];
    c.splice(idx, 0, t);
    return c;
  });
  const onTimelineSelect = (sid) => { bringToTop(sid); setExpandedSession(sid); setActiveTab("today"); setDetailSession(sid); };
  // 点11：点击时间线泳道色块仅置顶 + 展开记录，不弹完整详情
  const onTimelineLane = (sid) => { bringToTop(sid); setExpandedSession(sid); setActiveTab("today"); };

  // ==================== 模板操作 ====================
  const saveTemplate = (tpl) => {
    setTemplates((prev) => {
      const i = prev.findIndex((t) => t.id === tpl.id);
      if (i === -1) return [...prev, tpl];
      const c = [...prev]; c[i] = tpl; return c;
    });
    setEditor(null);
  };
  const deleteTemplate = (id) => setTemplates((prev) => prev.filter((t) => t.id !== id));
  const duplicateTemplate = (tpl) => setEditor({ ...JSON.parse(JSON.stringify(tpl)), id: genId(), name: tpl.name + " (副本)" });
  const exportTemplate = (tpl) => {
    const blob = JSON.stringify({ _biolab: "template", version: 1, ...tpl }, null, 2);
    saveTextViaDialog(`${tpl.name}.biolab.json`, blob, "导出方案");
  };
  const importTemplate = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data.name || !Array.isArray(data.steps)) { toast("文件格式不正确：缺少 name 或 steps", "error"); return; }
        saveTemplate({ id: genId(), name: data.name, category: data.category || "导入", protocol: data.protocol || "", steps: data.steps.map((s) => ({ id: genId(), ...s })) });
        toast(`已导入方案「${data.name}」`, "success");
      } catch { toast("无法解析 JSON 文件", "error"); }
    };
    input.click();
  };

  // ==================== 拖拽排序（点1：磁贴式 —— dragover 实时换位 + FLIP 动画） ====================
  // 实验卡片：把 dragId 插入到 overId 的前/后（pos="before"|"after"，默认 before）
  const reorderSessions = (dragId, overId, pos) => {
    if (!dragId || dragId === overId) return;
    setSessions((prev) => {
      const from = prev.findIndex((s) => s.id === dragId);
      const to = prev.findIndex((s) => s.id === overId);
      if (from === -1 || to === -1) return prev;
      let idx = to + (pos === "after" ? 1 : 0);
      if (from < to) idx -= 1; // 移除后目标左移
      if (from === idx) return prev; // 已在目标位（dragover 频繁调用时避免空渲染）
      const c = [...prev]; const [it] = c.splice(from, 1); c.splice(idx, 0, it);
      return c;
    });
  };
  // 方案卡片：同分类内换位 / 跨分类拖入（自动改用目标分类）；pos="before"|"after"
  const reorderTemplates = (dragId, overId, pos) => {
    if (!dragId || dragId === overId) return;
    setTemplates((prev) => {
      const from = prev.findIndex((t) => t.id === dragId);
      const to = prev.findIndex((t) => t.id === overId);
      if (from === -1 || to === -1) return prev;
      const c = [...prev]; const [it] = c.splice(from, 1);
      const target = c.find((t) => t.id === overId);
      const moved = target && (target.category || "未分类") !== (it.category || "未分类")
        ? { ...it, category: target.category || "" } : it;
      let idx = to + (pos === "after" ? 1 : 0);
      if (pos == null) idx = to + (from < to ? 1 : 0);
      if (from < to) idx -= 1;
      if (from === idx) return prev; // 已在目标位
      c.splice(idx, 0, moved);
      return c;
    });
  };
  // 从备份恢复全部数据（覆盖当前）
  const restoreBackup = (bk) => {
    if (Array.isArray(bk.templates) && bk.templates.length) setTemplates(bk.templates);
    if (Array.isArray(bk.sessions)) setSessions(bk.sessions);
    if (bk.dayNotes && typeof bk.dayNotes === "object") setDayNotes(bk.dayNotes);
    if (Array.isArray(bk.stickies)) setStickies(bk.stickies);
    if (Array.isArray(bk.datasets)) setDatasets(bk.datasets);
    if (Array.isArray(bk.recipes) && bk.recipes.length) setRecipes(bk.recipes);
  };

  // ==================== 首次运行：数据起点选择 ====================
  const finishDataChoice = () => { saveData("dataChoiceDone", true); setDataChoice(false); setOnboarding("welcome"); };
  const onDataKeep = () => finishDataChoice();
  const onDataImport = (bk) => { restoreBackup(bk); finishDataChoice(); toast("已导入先前数据", "success"); };
  const onDataFresh = async () => {
    try { await invoke("clear_all_data"); } catch { /* ignore */ }
    // 重置为内置默认（不刷新页面，避免再次触发首跑选择）
    setSessions([]); setTemplates(DEFAULT_TEMPLATES); setRecipes(DEFAULT_RECIPES);
    setDatasets([]); setDayNotes({}); setStickies([]); setAttendance({ records: {}, firstDay: null });
    finishDataChoice();
    toast("已全新初始化，内置示例方案与配方就绪", "success");
  };

  // ==================== 窗口控制 ====================
  const startDrag = (e) => { if (e.target.closest("button")) return; appWindow.startDragging(); };
  const toggleMini = () => { const m = !miniMode; setMiniMode(m); invoke("set_mini_mode", { mini: m }).catch(() => {}); };

  // 日历点击 → 跳转时间线
  const onJumpDate = (ds) => { setSelectedDate(ds); setCalJump((v) => v + 1); };
  // 时间线长按插入
  const onInsertAt = (ts) => { setInsertTs(ts); setPicker(true); };
  // 时间线点击会话 → 展开对应卡片
  const onSelectSession = (id) => { setExpandedSession(id); setActiveTab("today"); };
  // 色块/卡片点击 → 打开步骤详情弹窗
  const onOpenDetail = (id) => setDetailSession(id);

  const runningSessions = sessions.filter((s) => s.status === "running");
  const g = greeting(now);
  const WK = weekdayOf(now);

  // ==================== MINI 视图 ====================
  if (miniMode) {
    return <MiniMode {...{ runningSessions, now, confirmStep, toggleMini, startDrag, closeWindow: () => invoke("close_window") }} />;
  }

  const daySessions = sessions.filter((s) => dateStr(s.startedAt) === selectedDate || (s.status === "running" && (() => {
    const end = s.completedAt || (s.startedAt + s.steps.reduce((a, st) => a + (st.durationMin || 0), 0) * 60000);
    return s.startedAt <= new Date(`${selectedDate}T23:59:59`).getTime() && end >= new Date(`${selectedDate}T00:00:00`).getTime();
  })()));

  return (
    <div className="flex flex-col bg-[var(--px-bg)] pixel-checker overflow-hidden" style={{ height: "calc(100vh / var(--app-zoom, 1))" }}>
      {/* 启动动画（点1）：数据加载完成前显示 */}
      {!splashGone && <SplashScreen fading={splashFading} theme={settings.theme} />}
      {/* 莱茵主题：水晶霓虹背景光效层（置于所有内容之下） */}
      {settings.theme === "rhine" && <RhineFX />}
      {/* ===== 页首：BioLab + 时钟/天气 ===== */}
      <header onMouseDown={startDrag} className="relative z-[60] flex items-center justify-between px-4 py-2 bg-white border-b-2 border-[var(--px-ink)] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-600 border-2 border-[var(--px-ink)] shadow-sm rounded-lg flex items-center justify-center"><FlaskConical size={14} className="text-white" /></div>
          <div className="text-sm font-bold text-gray-800 px-title">BioLab</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 text-[11px] text-gray-500">
            <span className="flex items-center gap-1 tabular-nums font-bold text-base text-indigo-600"><Clock size={14} />{timeStrSec(now)}</span>
            {location && <span className="flex items-center gap-0.5"><MapPin size={11} />{location}</span>}
            {weather && <span className="flex items-center gap-0.5">{(() => { const [, I] = weatherInfo(weather.code); return <><I size={12} />{weather.temp}°C</>; })()}</span>}
          </div>
          <div className="flex items-center gap-1">
            <div className="relative flex items-center" onMouseDown={(e) => e.stopPropagation()}>
              <button onClick={() => setSettingsOpen((v) => !v)} className="p-1 rounded-md border-2 border-transparent hover:border-[var(--px-ink)] text-gray-400" title="外观与数据设置"><Settings size={13} /></button>
              {settingsOpen && createPortal(
                <>
                  <div className="fixed inset-0 z-[65]" onClick={() => setSettingsOpen(false)} />
                  <div className="fixed right-4 top-14 z-[70] w-60 pixel-panel p-3 space-y-3 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
                    <div>
                      <div className="text-[10px] font-medium text-gray-400 mb-1.5">主题</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[["flat", "极简风"], ["pixel", "像素风"], ["rhine", "莱茵"]].map(([k, l]) => (
                          <button key={k} onClick={() => setSettings((p) => ({ ...p, theme: k }))}
                            className={`py-1.5 text-[11px] border-2 rounded-lg ${settings.theme === k ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium text-gray-400 mb-1.5">整体字号</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[["sm", "小"], ["md", "中"], ["lg", "大"]].map(([k, l]) => (
                          <button key={k} onClick={() => setSettings((p) => ({ ...p, fontScale: k }))}
                            className={`py-1.5 border-2 rounded-lg ${settings.fontScale === k ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"}`}
                            style={{ fontSize: k === "sm" ? 10 : k === "lg" ? 13 : 11 }}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => { setSettingsOpen(false); setDataOpen(true); }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-gray-600 border-2 border-gray-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600">
                      <HardDrive size={12} />数据管理（备份 / 清空）
                    </button>
                    <button onClick={() => { setSettingsOpen(false); setLegalOpen(true); }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-gray-600 border-2 border-gray-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600">
                      <ShieldCheck size={12} />隐私政策与服务条款
                    </button>
                  </div>
                </>,
                document.body
              )}
            </div>
            <button onClick={() => setOnboarding("manual")} className="p-1 rounded-md border-2 border-transparent hover:border-[var(--px-ink)] text-gray-400" title="使用手册"><HelpCircle size={13} /></button>
            <button onClick={toggleMini} className="p-1 rounded-md border-2 border-transparent hover:border-[var(--px-ink)] text-gray-400" title="Mini 模式"><Minimize2 size={13} /></button>
            <button onClick={() => invoke("minimize_window")} className="p-1 rounded-md border-2 border-transparent hover:border-[var(--px-ink)] text-gray-400" title="最小化"><Minus size={13} /></button>
            <button onClick={() => setCloseAsk(true)} className="p-1 rounded-md border-2 border-transparent hover:border-red-500 text-gray-400 hover:text-red-500" title="最小化或退出"><X size={13} /></button>
          </div>
        </div>
      </header>

      {/* ===== 应用内到点提醒横幅 ===== */}
      {alerts.length > 0 && (
        <div className="fixed top-12 right-4 z-[70] w-80 space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className="pixel-panel border-l-4 border-l-amber-500 p-3 flex items-start gap-2">
              <BellRing size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-gray-800">{a.title}</div>
                <div className="text-[11px] text-gray-600 mt-0.5">{a.body}</div>
              </div>
              <button onClick={() => setAlerts((p) => p.filter((x) => x.id !== a.id))} className="text-gray-300 hover:text-gray-500"><X size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {/* ===== 左侧主面板 ===== */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 标签栏（桌面顶部导航） */}
          <div className="px-4 pt-3 flex items-center justify-between flex-shrink-0">
            <div className="flex gap-1 bg-white p-1 pixel-inset">
              {TAB_DEFS.map(({ k, i: I, l }) => (
                <button key={k} onClick={() => setActiveTab(k)} className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium border-2 rounded-md transition-colors ${activeTab === k ? "bg-indigo-600 text-white border-[var(--px-ink)] shadow-sm" : "text-gray-600 border-transparent hover:bg-gray-100"}`}>
                  <I size={13} />{l}
                  {k === "today" && runningSessions.length > 0 && <span className={`ml-0.5 text-[9px] px-1 rounded-full ${activeTab === k ? "bg-white/25" : "bg-indigo-100 text-indigo-600"}`}>{runningSessions.length}</span>}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {activeTab === "today" && (
                <button onClick={() => setCalExpanded((v) => !v)} className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${calExpanded ? "bg-indigo-600 text-white border-[var(--px-ink)] shadow-sm" : "text-gray-500 hover:bg-white border-transparent hover:border-gray-100"}`} title="历史模式：按天查看当日实验详情">
                  <History size={13} />历史模式
                </button>
              )}
              <button onClick={() => saveTextViaDialog(`实验记录_${dateStr(now)}.md`, exportRecordsByDay(sessions), "导出实验记录")} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-white rounded-lg border border-transparent hover:border-gray-100" title="按天导出实验记录">
                <Download size={13} />导出记录
              </button>
              <button onClick={() => setCalOpen((v) => !v)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-white rounded-lg border border-transparent hover:border-gray-100">
                <Calendar size={13} />日历{calOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {activeTab === "today" && !calExpanded && (
              <>
                <TodayView {...{ now, g, WK, sessions, runningSessions, selectedDate, calJump, setPicker, confirmStep, skipStep, toggleHosting, adjustActive, deleteSession, setSessionColor, toggleStar, reorderSessions, expandedSession, setExpandedSession, onSelectSession, onOpenDetail, onTimelineSelect, onInsertAt, onVisibleDateChange: setSelectedDate, dayNotes, setDayNotes, skipExtWarn, setSkipExtWarn }} />
              </>
            )}
            {activeTab === "today" && calExpanded && (
              <DayDetail {...{ now, selectedDate, calJump, sessions, daySessions, setPicker, confirmStep, skipStep, toggleHosting, adjustActive, deleteSession, setSessionColor, toggleStar, reorderSessions, expandedSession, setExpandedSession, onSelectSession, onOpenDetail, onTimelineSelect, onTimelineLane, onInsertAt, onVisibleDateChange: setSelectedDate }} />
            )}
            {activeTab === "templates" && (
              <TemplatesView {...{ templates, setEditor, deleteTemplate, duplicateTemplate, exportTemplate, importTemplate, reorderTemplates }} />
            )}
            {activeTab === "recipes" && <Recipes recipes={recipes} setRecipes={setRecipes} />}
            {activeTab === "datasets" && <Datasets {...{ datasets, setDatasets, sessions, now, deleteSession, onOpenDetail }} importSessions={(arr) => setSessions((p) => { const ids = new Set(p.map((x) => x.id)); return [...p, ...arr.filter((s) => !ids.has(s.id))]; })} />}
            {activeTab === "cloning" && (
              <Suspense fallback={<CloningLoading />}>
                <Cloning />
              </Suspense>
            )}
            {activeTab === "tools" && <ToolsView />}
          </div>
        </div>

        {/* ===== 右侧栏 ===== */}
        {calOpen && (
          <Sidebar {...{ calMonth, setCalMonth, selectedDate, setSelectedDate, sessions, notes: stickies, setNotes: setStickies, calExpanded, setCalExpanded, now, onJumpDate, onOpenDetail, attendance, setAttendance, theme: settings.theme }} />
        )}
      </div>

      {picker && <TemplatePicker {...{ templates, setPicker, setSetup, setEditor, insertTs }} />}
      {setup && <SetupDialog {...{ setup, setSetup, createSession, recipes }} now={now} firstDay={attendance.firstDay} />}
      {editor && <TemplateEditor {...{ editor, setEditor, saveTemplate }} />}
      {detailSession && <SessionDetail session={sessions.find((s) => s.id === detailSession)} now={now} datasets={datasets} onClose={() => setDetailSession(null)} />}
      {dataOpen && <DataDialog onClose={() => setDataOpen(false)} data={{ templates, sessions, dayNotes, stickies, datasets, recipes }} onRestore={restoreBackup} />}
      {legalOpen && <LegalDialog onClose={() => setLegalOpen(false)} />}
      {closeAsk && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setCloseAsk(false)}>
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-bold text-gray-800 mb-1">关闭窗口</div>
            <p className="text-[11.5px] text-gray-500 leading-relaxed mb-4">您希望最小化到系统托盘继续后台运行，还是直接退出程序？</p>
            <div className="space-y-2">
              <button onClick={() => { setCloseAsk(false); invoke("close_window"); }}
                className="w-full py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">最小化到托盘（推荐）</button>
              <button onClick={() => { setCloseAsk(false); invoke("quit_app"); }}
                className="w-full py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">退出程序</button>
              <button onClick={() => setCloseAsk(false)}
                className="w-full py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
            </div>
            <div className="text-center text-[9px] text-gray-300 mt-3">BioLab · v1.2.2.5 · YunPlover</div>
          </div>
        </div>
      )}
      {dataChoice && <DataStartDialog onKeep={onDataKeep} onImport={onDataImport} onFresh={onDataFresh} />}
      {onboarding && <Onboarding mode={onboarding} onClose={() => { setOnboarding(null); saveData("onboarded", true); }} />}
      <ToastStack toasts={toasts} dismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
      <ConfirmDialog conf={confirmDlg} onDone={() => setConfirmDlg(null)} />
    </div>
  );
}

// ==================== 今日视图（问候 + 时间线 + 实验卡片 + 当日备注） ====================
function TodayView({ now, g, WK, runningSessions, selectedDate, calJump, setPicker, confirmStep, skipStep, toggleHosting, adjustActive, deleteSession, setSessionColor, toggleStar, reorderSessions, expandedSession, setExpandedSession, onSelectSession, onOpenDetail, onTimelineSelect, onInsertAt, onVisibleDateChange, dayNotes, setDayNotes, skipExtWarn, setSkipExtWarn }) {
  const d = new Date(now);
  const { dragId, onPointerDown } = useLongPressDrag(reorderSessions, { axis: "y" });
  // 当日备注：默认收起，若该日已有备注内容则自动展开；切换日期时重新同步
  const [noteOpen, setNoteOpen] = useState(!!(dayNotes[selectedDate] || "").trim());
  useEffect(() => { setNoteOpen(!!(dayNotes[selectedDate] || "").trim()); }, [selectedDate]);
  return (
    <div className="space-y-3.5">
      {/* 问候横幅：纯色 + 棋盘装饰 */}
      <div className="greeting-banner bg-indigo-600 border-2 border-[var(--px-ink)] shadow-lg rounded-xl px-5 py-4 text-white relative overflow-hidden">
        <div className="absolute -right-6 -top-8 w-32 h-32 bg-white/10 pixel-checker" />
        <div className="absolute right-14 -bottom-10 w-24 h-24 bg-white/10" />
        <div className="flex items-center justify-between relative">
          <div>
            <div className="text-lg font-bold flex items-center gap-2 px-title">{g.icon} {g.text}</div>
            <div className="text-[11px] text-white/90 mt-0.5">
              {d.getMonth() + 1}月{d.getDate()}日 周{WK} · {relativeDayLabel(now)} · {runningSessions.length} 个实验进行中
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold tabular-nums tracking-tight">{timeStrSec(now)}</div>
            <div className="text-[10px] text-white/75 mt-0.5">{selectedDate} · {relativeDayLabel(new Date(`${selectedDate}T12:00:00`).getTime(), now)}</div>
          </div>
        </div>
      </div>

      {/* 时间线（总览 + 阅读框 + 放大详情）：点节点 → 该实验置顶并看详情 */}
      <Timeline sessions={runningSessions} now={now} selectedDate={selectedDate} calJump={calJump}
        onOpenDetail={onTimelineSelect} onInsertAt={onInsertAt} onVisibleDateChange={onVisibleDateChange} onReorder={reorderSessions} />

      {/* 实验列表：标题栏常驻「新建实验」 */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-600 flex items-center gap-1">
          进行中的实验
          {runningSessions.length > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">{runningSessions.length}</span>}
          <HelpTip className="bg-indigo-100 rounded-full" text="点卡片标题展开步骤记录；点「详情」查看每步起止与完成情况；随时可再新建实验" />
        </div>
        <button onClick={() => setPicker(true)} className="pixel-btn flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-indigo-600">
          <Plus size={12} />新建实验
        </button>
      </div>

      {runningSessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-10 text-center">
          <FlaskConical size={26} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">暂无进行中的实验</p>
          <button onClick={() => setPicker(true)} className="mt-2 text-xs text-indigo-600 hover:underline">从方案库选择一个实验开始 →</button>
        </div>
      ) : (
        <FlipGrid orderKey={runningSessions.map((s) => s.id).join(",")} className="space-y-3">
          {runningSessions.map((s, idx) => (
            <div key={s.id} data-flip-key={s.id} data-drag-id={s.id}
              onPointerDown={(e) => onPointerDown(e, s.id)}
              className={dragId === s.id ? "lpd-dragging" : ""}>
              <SessionCard {...{ s, now, confirmStep, skipStep, toggleHosting, adjustActive, deleteSession, setSessionColor, toggleStar, reorderSessions, expanded: expandedSession === s.id, toggle: () => setExpandedSession(expandedSession === s.id ? null : s.id), onOpenDetail }}
                onMoveUp={() => { if (idx > 0) reorderSessions(s.id, runningSessions[idx - 1].id, "before"); }}
                onMoveDown={() => { if (idx < runningSessions.length - 1) reorderSessions(s.id, runningSessions[idx + 1].id, "after"); }} />
            </div>
          ))}
        </FlipGrid>
      )}

      {/* 当日备注（默认收起、有内容自动展开；默认预览，编辑时代码+渲染双栏） */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button onClick={() => setNoteOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition">
          <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
            <StickyNote size={13} className="text-amber-500" />当日备注 · {selectedDate}
            <HelpTip text="默认预览渲染；点「编辑」左右双栏同时显示代码与渲染。支持 LaTeX 公式，按日期自动保存" />
          </span>
          {noteOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>
        {noteOpen && (
          <div className="px-4 pb-3">
            <NoteEditor value={dayNotes[selectedDate] || ""} onChange={(v) => setDayNotes((p) => ({ ...p, [selectedDate]: v }))} rows={4} splitView />
          </div>
        )}
      </div>

      {/* 传送门：顶刊 + 清北图书馆入口（点4） */}
      <Portal skipWarn={skipExtWarn} setSkipWarn={setSkipExtWarn} />

      {/* 版本号与作者（点4） */}
      <div className="text-center text-[10px] text-gray-300 pb-1">BioLab 实验助手 · v1.2.2.5 · YunPlover</div>
    </div>
  );
}

// ==================== 日历展开 → 当日详情模式 ====================
function DayDetail({ now, selectedDate, calJump, sessions, daySessions, setPicker, confirmStep, skipStep, toggleHosting, adjustActive, deleteSession, setSessionColor, toggleStar, reorderSessions, expandedSession, setExpandedSession, onSelectSession, onOpenDetail, onTimelineSelect, onTimelineLane, onInsertAt, onVisibleDateChange }) {
  const ts = new Date(`${selectedDate}T00:00:00`).getTime();
  const { dragId, onPointerDown } = useLongPressDrag(reorderSessions, { axis: "y" });
  // 点13：进行中的实验始终在已完成之上；选中/展开后视图定位到该实验所在分组
  const running = daySessions.filter((s) => s.status === "running");
  const completed = daySessions.filter((s) => s.status !== "running");
  useEffect(() => {
    if (!expandedSession) return;
    const el = document.getElementById(`sess-${expandedSession}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [expandedSession]);
  const cardProps = (s, list, idx) => ({ s, now, confirmStep, skipStep, toggleHosting, adjustActive, deleteSession, setSessionColor, toggleStar, reorderSessions, expanded: expandedSession === s.id, toggle: () => setExpandedSession(expandedSession === s.id ? null : s.id), onOpenDetail, onMoveUp: () => { if (idx > 0) reorderSessions(s.id, list[idx - 1].id, "before"); }, onMoveDown: () => { if (idx < list.length - 1) reorderSessions(s.id, list[idx + 1].id, "after"); } });
  return (
    <div className="space-y-3.5">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold text-gray-800">
            {new Date(ts).getMonth() + 1}月{new Date(ts).getDate()}日
            <span className="text-base font-normal text-gray-400 ml-2">周{weekdayOf(ts)}</span>
            <span className="text-sm font-normal text-indigo-600 ml-2">{relativeDayLabel(ts, now)}</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">{daySessions.length} 个实验 · 当日详情
            <HelpTip text="右键时间线可在指定时间新建实验；长按空白处快速插入" /></div>
        </div>
        <button onClick={() => setPicker(true)} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"><Plus size={14} />新建实验</button>
      </div>

      <Timeline sessions={daySessions} now={now} selectedDate={selectedDate} calJump={calJump}
        onOpenDetail={onTimelineLane} onInsertAt={onInsertAt} onVisibleDateChange={onVisibleDateChange} onReorder={reorderSessions} />

      {daySessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-400">当日无实验安排</div>
      ) : (
        <div className="space-y-3">
          {running.length > 0 && (
            <div className="space-y-3">
              <div className="text-[10px] font-semibold text-blue-500 flex items-center gap-1">▶ 进行中（{running.length}）</div>
              <FlipGrid orderKey={running.map((s) => s.id).join(",")} className="space-y-3">
                {running.map((s, idx) => (
                  <div key={s.id} id={`sess-${s.id}`} data-flip-key={s.id} data-drag-id={s.id}
                    onPointerDown={(e) => onPointerDown(e, s.id)} className={dragId === s.id ? "lpd-dragging" : ""}><SessionCard {...cardProps(s, running, idx)} /></div>
                ))}
              </FlipGrid>
            </div>
          )}
          {completed.length > 0 && (
            <div className="space-y-3">
              <div className="text-[10px] font-semibold text-green-600 flex items-center gap-1 pt-1">✓ 已完成（{completed.length}）</div>
              <FlipGrid orderKey={completed.map((s) => s.id).join(",")} className="space-y-3">
                {completed.map((s, idx) => (
                  <div key={s.id} id={`sess-${s.id}`} data-flip-key={s.id} data-drag-id={s.id}
                    onPointerDown={(e) => onPointerDown(e, s.id)} className={dragId === s.id ? "lpd-dragging" : ""}><SessionCard {...cardProps(s, completed, idx)} /></div>
                ))}
              </FlipGrid>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== 方案库视图（专注方案管理；拖拽换位 / 跨分类移动） ====================
function TemplatesView({ templates, setEditor, deleteTemplate, duplicateTemplate, exportTemplate, importTemplate, reorderTemplates }) {
  const cats = [...new Set(templates.map((t) => t.category || "未分类"))];
  const { dragId, onPointerDown } = useLongPressDrag(reorderTemplates, { axis: "auto" });
  const swapTemplate = (id, dir) => {
    const idx = templates.findIndex((t) => t.id === id);
    const target = idx + dir;
    if (target < 0 || target >= templates.length) return;
    reorderTemplates(templates[idx].id, templates[target].id, dir > 0 ? "after" : "before");
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700 flex items-center gap-1">方案库 <span className="text-gray-400 font-normal">({templates.length})</span>
          <HelpTip text="✎ 编辑、⧉ 复制、⤓ 导出为 JSON 备份；支持导入 .biolab.json；用箭头按钮调整顺序" /></div>
        <div className="flex gap-1.5">
          <button onClick={importTemplate} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-white">导入</button>
          <button onClick={() => setEditor({ id: genId(), name: "", category: "", protocol: "", steps: [] })} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"><Plus size={13} />新建方案</button>
        </div>
      </div>
      {cats.map((cat) => (
        <div key={cat}>
          <div className="text-[11px] font-medium text-gray-400 mb-1.5">{cat}</div>
          <FlipGrid orderKey={templates.filter((t) => (t.category || "未分类") === cat).map((t) => t.id).join(",")} className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {templates.filter((t) => (t.category || "未分类") === cat).map((t) => {
              const totalMin = t.steps.reduce((a, s) => a + (s.durationMin || 0), 0);
              return (
                <div key={t.id} data-flip-key={t.id} data-drag-id={t.id}
                  onPointerDown={(e) => onPointerDown(e, t.id)}
                  className={`relative bg-white rounded-xl border p-3 transition-all hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5 border-gray-100 ${dragId === t.id ? "lpd-dragging" : ""}`}>
                  <div className="text-sm font-medium text-gray-800 truncate">{t.name}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{t.steps.length} 步 · 约 {fmtDurLocal(totalMin)}{t.protocol ? " · 含 protocol" : " · 无 protocol"}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.steps.slice(0, 3).map((s, i) => <span key={i} className="text-[9px] px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded border border-gray-100 truncate max-w-[120px]">{s.name}</span>)}
                    {t.steps.length > 3 && <span className="text-[9px] text-gray-400">+{t.steps.length - 3}</span>}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-2.5 pt-2 border-t border-gray-50">
                    <button onClick={() => swapTemplate(t.id, -1)} className="p-1.5 text-gray-400 hover:text-indigo-500 rounded-md hover:bg-gray-50" title="前移">◀</button>
                    <button onClick={() => swapTemplate(t.id, 1)} className="p-1.5 text-gray-400 hover:text-indigo-500 rounded-md hover:bg-gray-50" title="后移">▶</button>
                    <button onClick={() => setEditor(JSON.parse(JSON.stringify(t)))} className="p-1.5 text-gray-400 hover:text-indigo-500 rounded-md hover:bg-gray-50" title="编辑">✎</button>
                    <button onClick={() => duplicateTemplate(t)} className="p-1.5 text-gray-400 hover:text-indigo-500 rounded-md hover:bg-gray-50" title="复制">⧉</button>
                    <button onClick={() => exportTemplate(t)} className="p-1.5 text-gray-400 hover:text-indigo-500 rounded-md hover:bg-gray-50" title="导出">⤓</button>
                    <button onClick={() => { askConfirm({ title: "删除方案", message: `确定删除方案「${t.name}」？此操作不可撤销。`, okText: "删除" }).then((ok) => { if (ok) deleteTemplate(t.id); }); }} className="p-1.5 text-gray-400 hover:text-red-400 rounded-md hover:bg-gray-50" title="删除">🗑</button>
                  </div>
                </div>
              );
            })}
          </FlipGrid>
        </div>
      ))}
    </div>
  );
}
function fmtDurLocal(min) {
  if (min == null || min <= 0) return "待确认";
  if (min < 1) return `${Math.round(min * 60)}秒`;
  if (min < 60) { const sec = Math.round((min % 1) * 60); return sec > 0 ? `${Math.floor(min)}分${sec}秒` : `${Math.floor(min)}分钟`; }
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m > 0 ? `${h}小时${m}分` : `${h}小时`;
}
