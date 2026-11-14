// ==================== 核心工具库 ====================
import {
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Cloudy,
} from "lucide-react";

export const genId = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

// ---------- 全局拖拽载荷（点14） ----------
// WebView2 中 dataTransfer.getData 对自定义类型可能取不到值，
// 用模块级变量在 dragstart/drop 之间可靠传递被拖拽对象。
let _dragPayload = null;
export function setDragPayload(v) { _dragPayload = v; }
export function getDragPayload() { return _dragPayload; }
export function clearDragPayload() { _dragPayload = null; }

// ---------- 全局风格化提示 / 确认（点6） ----------
// App.jsx 注册渲染器；任意模块可调用 toast() / askConfirm() 取代原生 alert/confirm
let _toastHandler = null;
let _confirmHandler = null;
export function registerToast(fn) { _toastHandler = fn; }
export function registerConfirm(fn) { _confirmHandler = fn; }
// toast(msg, type="info"|"success"|"error")
export function toast(msg, type = "info") {
  if (_toastHandler) _toastHandler(msg, type);
  else console.log(`[${type}] ${msg}`);
}
// askConfirm({ title, message, okText, danger }) => Promise<boolean>
export function askConfirm(opts) {
  if (_confirmHandler) return _confirmHandler(opts);
  return Promise.resolve(window.confirm(opts.message || opts.title || "确认？"));
}

export const pad = (n) => String(n).padStart(2, "0");

export const dateStr = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const timeStr = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const timeStrSec = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const dayStart = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const addDays = (ts, n) => {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
};

export const fmtCountdown = (ms) => {
  const neg = ms < 0;
  ms = Math.abs(ms);
  const h = Math.floor(ms / 3600000),
    m = Math.floor((ms % 3600000) / 60000),
    s = Math.floor((ms % 60000) / 1000);
  const core = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return neg ? `-${core}` : core;
};

export const fmtDur = (min) => {
  if (min == null || min <= 0) return "待确认";
  if (min < 1) return `${Math.round(min * 60)}秒`;
  if (min < 60) {
    const sec = Math.round((min % 1) * 60);
    return sec > 0 ? `${Math.floor(min)}分${sec}秒` : `${Math.floor(min)}分钟`;
  }
  const h = Math.floor(min / 60),
    m = Math.round(min % 60);
  return m > 0 ? `${h}小时${m}分` : `${h}小时`;
};

// ---------- 相对日期标注（明天/后天/下周四） ----------
const WK = ["日", "一", "二", "三", "四", "五", "六"];
export const weekdayOf = (ts) => WK[new Date(ts).getDay()];

export function relativeDayLabel(ts, now = Date.now()) {
  const a = dayStart(ts), b = dayStart(now);
  const diff = Math.round((a - b) / 86400000);
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === 2) return "后天";
  if (diff === -1) return "昨天";
  if (diff === -2) return "前天";
  if (diff > 2 && diff < 7) return `周${weekdayOf(ts)}`;
  if (diff >= 7 && diff < 14) return `下${weekdayOf(ts)}`;
  return "";
}

// ---------- 启动问候语（更人性化：每个时段多条文案，按日期稳定选取） ----------
export function greeting(now = Date.now()) {
  const dt = new Date(now);
  const h = dt.getHours();
  // 用「年月日」做种子，让同一天内问候语稳定不变，隔天换一句
  const seed = dt.getFullYear() * 372 + (dt.getMonth() + 1) * 31 + dt.getDate();
  const pick = (arr) => arr[seed % arr.length];
  let band;
  if (h < 5) band = { icon: "🌙", arr: ["夜深了，实验再重要，身体更重要", "这个点还在忙，记得抽空喝口水", "夜猫子模式，别太勉强自己"] };
  else if (h < 9) band = { icon: "🌅", arr: ["早上好，新的一天从清晰的计划开始", "早安，今天也稳稳地推进吧", "早上好，先想好今天最重要的那件事"] };
  else if (h < 12) band = { icon: "☀️", arr: ["上午好，保持专注，实验顺利", "上午状态正好，抓紧推进关键步骤", "上午好，一步一步来，别急"] };
  else if (h < 14) band = { icon: "🍚", arr: ["中午好，记得吃饭，稍作休整", "饭点到了，先填饱肚子再继续", "中午好，休息一下是为了走更远"] };
  else if (h < 18) band = { icon: "🧪", arr: ["下午好，继续推进今天的实验", "下午好，保持节奏，稳步向前", "下午茶时间，给自己一点能量"] };
  else if (h < 22) band = { icon: "🌆", arr: ["晚上好，收尾工作别忘了记录数据", "晚上好，今天辛苦了，记得存档", "夜幕降临，把今天的成果整理好吧"] };
  else band = { icon: "🌙", arr: ["夜深了，早点休息，明天继续", "这么晚了，收尾后就早点睡吧", "夜深了，好好休息，明天再战"] };
  return { text: pick(band.arr), icon: band.icon };
}

// ---------- 天气 ----------
const WMO = {
  0: ["晴", Sun], 1: ["大部晴", Sun], 2: ["多云", Cloudy], 3: ["阴", Cloud],
  45: ["雾", CloudFog], 48: ["雾凇", CloudFog],
  51: ["毛毛雨", CloudRain], 53: ["毛毛雨", CloudRain], 55: ["毛毛雨", CloudRain],
  61: ["小雨", CloudRain], 63: ["中雨", CloudRain], 65: ["大雨", CloudRain],
  71: ["小雪", CloudSnow], 73: ["中雪", CloudSnow], 75: ["大雪", CloudSnow],
  80: ["阵雨", CloudRain], 81: ["阵雨", CloudRain], 82: ["强阵雨", CloudRain],
  95: ["雷暴", CloudLightning], 96: ["雷暴", CloudLightning], 99: ["雷暴", CloudLightning],
};
export const weatherInfo = (code) => WMO[code] || ["—", Cloud];

// 多源定位 + 天气（提高成功率）
export async function fetchLocationWeather() {
  const geoSources = [
    async () => {
      const g = await fetch("https://ipapi.co/json/").then((r) => r.json());
      return { city: g.city || g.region || "", lat: g.latitude, lon: g.longitude };
    },
    async () => {
      const g = await fetch("http://ip-api.com/json/?fields=city,lat,lon").then((r) => r.json());
      return { city: g.city || "", lat: g.lat, lon: g.lon };
    },
  ];
  let geo = null;
  for (const src of geoSources) {
    try { geo = await src(); if (geo && geo.lat != null) break; } catch { /* 尝试下一个 */ }
  }
  if (!geo || geo.lat == null) return { location: "", weather: null };
  try {
    const w = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current_weather=true`
    ).then((r) => r.json());
    return {
      location: geo.city,
      weather: { temp: Math.round(w.current_weather.temperature), code: w.current_weather.weathercode },
    };
  } catch {
    return { location: geo.city, weather: null };
  }
}

// ---------- 会话配色（可由用户自选，存 session.color hex） ----------
export const SESSION_COLORS = [
  { bar: "bg-indigo-500", soft: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-600", hex: "#6366f1" },
  { bar: "bg-emerald-500", soft: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600", hex: "#10b981" },
  { bar: "bg-amber-500", soft: "bg-amber-50", border: "border-amber-200", text: "text-amber-600", hex: "#f59e0b" },
  { bar: "bg-rose-500", soft: "bg-rose-50", border: "border-rose-200", text: "text-rose-600", hex: "#f43f5e" },
  { bar: "bg-cyan-500", soft: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-600", hex: "#06b6d4" },
  { bar: "bg-violet-500", soft: "bg-violet-50", border: "border-violet-200", text: "text-violet-600", hex: "#8b5cf6" },
  { bar: "bg-fuchsia-500", soft: "bg-fuchsia-50", border: "border-fuchsia-200", text: "text-fuchsia-600", hex: "#d946ef" },
  { bar: "bg-orange-500", soft: "bg-orange-50", border: "border-orange-200", text: "text-orange-600", hex: "#f97316" },
];
// colorOf(session | id)：优先使用会话自定义颜色，否则按 id 哈希分配
export const colorOf = (s) => {
  if (s && typeof s === "object") {
    if (s.color) {
      const hit = SESSION_COLORS.find((c) => c.hex === s.color);
      if (hit) return hit;
    }
    s = s.id || "";
  }
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SESSION_COLORS[h % SESSION_COLORS.length];
};

// ---------- 步骤时间推算 ----------
export function computeSteps(session, now) {
  let cursor = session.startedAt;
  return session.steps.map((st, i) => {
    let start, end;
    if (st.status === "done") {
      start = st.startedAt;
      end = st.confirmedAt || start + (st.durationMin || 0) * 60000;
      cursor = end;
    } else if (st.status === "active") {
      start = st.startedAt;
      end = st.durationMin > 0 ? start + st.durationMin * 60000 : null;
      cursor = end || now;
    } else if (st.status === "skipped") {
      start = cursor; end = cursor;
    } else {
      start = cursor;
      end = st.durationMin > 0 ? start + st.durationMin * 60000 : null;
      cursor = end || start;
    }
    return { ...st, index: i, start, end };
  });
}

// ---------- 实验记录按天导出（跨天记录在前一天，后一天时间标注+1） ----------
export function exportRecordsByDay(sessions) {
  // 收集所有有实验的日期
  const byDay = {};
  sessions.forEach((s) => {
    const steps = computeSteps(s, Date.now());
    // 实验归属起始日（跨天实验整体记在开始日）
    const day = dateStr(s.startedAt);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push({ s, steps });
  });

  const days = Object.keys(byDay).sort();
  let md = `# BioLab 实验记录导出\n\n> 导出时间：${new Date().toLocaleString("zh-CN")}\n> 跨天实验记录在开始日，次日步骤时间已标注 +1 天。\n\n`;
  days.forEach((day) => {
    md += `---\n\n## ${day}（${relativeDayLabel(new Date(day + "T00:00:00").getTime())}）\n\n`;
    byDay[day].forEach(({ s, steps }) => {
      const startDay = dayStart(s.startedAt);
      md += `### ${s.name}\n`;
      md += `- 状态：${s.status === "running" ? "进行中" : s.status === "completed" ? "已完成" : s.status}\n`;
      md += `- 开始：${dateStr(s.startedAt)} ${timeStr(s.startedAt)}\n\n`;
      md += `| # | 步骤 | 时间 | 时长 | 地点 | 状态 |\n|---|------|------|------|------|------|\n`;
      steps.forEach((st, i) => {
        // 跨天标注：步骤所在日相对实验开始日 +N
        let t = st.start ? timeStr(st.start) : "—";
        if (st.start) {
          const dayOffset = Math.round((dayStart(st.start) - startDay) / 86400000);
          if (dayOffset > 0) t = `${t} (+${dayOffset}天)`;
        }
        const status = st.status === "done" ? "✅完成" : st.status === "active" ? "▶进行中" : st.status === "skipped" ? "⏭跳过" : "⏳待开始";
        md += `| ${i + 1} | ${st.name} | ${t} | ${fmtDur(st.durationMin)} | ${st.location || "—"} | ${status} |\n`;
      });
      md += `\n`;
      if (s.notes) md += `**备注：** ${s.notes}\n\n`;
    });
  });
  return md;
}

export function downloadText(filename, text, mime = "text/markdown") {
  const blob = new Blob([text], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
