// ==================== 平台抽象层（P0 移动地基） ====================
// 统一封装「桌面 / 移动」差异能力：通知、震动、步骤预排、文件保存、设备标识。
// 组件只调用本模块接口，不直接 invoke，从而让同一套组件两端通用。
//
// 桌面：走既有 Tauri IPC（main.rs 的 commands）。
// 移动：优先走 Web/原生能力；尚未接线的原生插件以 TODO 标注并优雅降级。
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// ---------- 平台检测 ----------
// 真机移动 WebView 的 userAgent 含 android/iphone；Tauri mobile 也会注入平台信息。
export function detectMobile() {
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent || "";
    if (/android|iphone|ipad|ipod|mobile/i.test(ua)) return true;
  }
  try {
    const p = window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.platform;
    if (p && /android|ios/.test(String(p))) return true;
  } catch { /* ignore */ }
  return false;
}

// 响应式 hook：真机移动恒为 true；桌面端窗口窄于 768px 时也视为移动（便于预览调试）。
export function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => detectMobile() || (typeof window !== "undefined" && window.innerWidth < 768)
  );
  useEffect(() => {
    if (detectMobile()) { setMobile(true); return; }
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setMobile(e.matches);
    setMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

// 是否为移动端（非响应式，模块加载时判定一次；供非组件代码使用）
export const IS_MOBILE = detectMobile();

// ---------- 设备标识（跨端同步用，稳定持久） ----------
let _deviceId = null;
export async function getDeviceId() {
  if (_deviceId) return _deviceId;
  try {
    const stored = await invoke("load_data", { key: "device_id" });
    if (stored) { _deviceId = JSON.parse(stored); return _deviceId; }
  } catch { /* 首次或桌面旧版无此 key */ }
  // 生成：平台前缀 + 随机串，便于一眼区分来源设备
  const prefix = IS_MOBILE ? (detectMobile() ? "mobile" : "mobile") : "desktop";
  _deviceId = `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  try { await invoke("save_data", { key: "device_id", value: JSON.stringify(_deviceId) }); } catch { /* ignore */ }
  return _deviceId;
}

// ---------- 通知 ----------
// 桌面：Rust send_notification（插件 + PowerShell Toast 兜底 + 任务栏闪烁）。
// 移动：优先 Web Notification；原生本地通知插件接线后替换此处。
export async function notify(title, body) {
  if (IS_MOBILE) {
    // TODO(P2): 接入 Tauri 移动本地通知插件（支持后台/锁屏）。
    try {
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification(title, { body });
          return;
        }
        if (Notification.permission !== "denied") {
          const ok = await Notification.requestPermission();
          if (ok === "granted") { new Notification(title, { body }); return; }
        }
      }
    } catch { /* ignore */ }
    return;
  }
  try { await invoke("send_notification", { title, body }); } catch { /* ignore */ }
}

// ---------- 震动 ----------
// 移动：navigator.vibrate；桌面：无硬件，转为任务栏闪烁（request_attention）。
export function vibrate(pattern = 200) {
  if (IS_MOBILE) {
    try { navigator.vibrate && navigator.vibrate(pattern); } catch { /* ignore */ }
    return;
  }
  try { invoke("request_attention"); } catch { /* ignore */ }
}

// ---------- 步骤到点提醒预排（移动端后台计时核心） ----------
// 桌面：返回 false，表示沿用 App.jsx 既有 setInterval 实时检查机制。
// 移动：实验启动时一次性把所有步骤结束时间预排为系统本地通知，
//       即使 App 被杀，系统到点仍推送。原生插件接线后实现真正预排。
// 入参 steps 需含 { id, name, end }（end 为绝对时间戳 ms）。
export async function scheduleStepAlerts(session, steps) {
  if (!IS_MOBILE) return false;
  // TODO(P2): 调用原生插件批量预排本地通知。
  // 形如：plugin.schedule(steps.filter(s=>s.end).map(s=>({ id:s.id, at:s.end,
  //        title:session.name, body:`「${s.name}」到时了` })))
  console.info("[platform] scheduleStepAlerts stub", session && session.name, (steps || []).length);
  return true;
}

// 取消指定步骤的预排通知（用户确认/跳过后调用）。
export async function cancelStepAlerts(ids) {
  if (!IS_MOBILE) return;
  // TODO(P2): plugin.cancel(ids)
  console.info("[platform] cancelStepAlerts stub", ids);
}

// ---------- 文本文件保存 ----------
// 桌面：原生「另存为」对话框（rfd）。移动：Web 分享/下载降级。
export async function saveTextFile(defaultName, content, title = "保存文件") {
  if (IS_MOBILE) {
    // TODO(P1): 接入移动文件系统/分享插件。先用浏览器下载降级。
    try {
      const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = defaultName; a.click();
      URL.revokeObjectURL(url);
      return defaultName;
    } catch { return null; }
  }
  try { return await invoke("save_text_file", { title, defaultName, content }); }
  catch { return null; }
}
