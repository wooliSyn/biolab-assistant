// ==================== 检查更新 ====================
// 只读 GitHub Releases 的公开接口（GET，不带任何用户数据、不需要账号），比较版本号。
// 不做应用内自动安装：那需要 tauri-plugin-updater + 发版签名密钥，等作者配好签名再接；
// 现在发现新版本就打开 Release 页面，让用户自己下载安装包。
export const REPO = "wooliSyn/biolab-assistant";
export const RELEASES_URL = `https://github.com/${REPO}/releases`;

const parts = (v) => String(v || "").replace(/^v/i, "").split(/[.+-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
export function isNewer(latest, current) {
  const a = parts(latest), b = parts(current);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

// releases/latest 只返回已发布的正式版（草稿、预发布不算）
export async function fetchLatest() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" }, signal: ctl.signal });
    if (!r.ok) throw new Error(`GitHub 返回 ${r.status}`);
    const j = await r.json();
    return { version: String(j.tag_name || "").replace(/^v/i, ""), url: j.html_url || RELEASES_URL, notes: (j.body || "").trim(), date: j.published_at || null };
  } finally {
    clearTimeout(t);
  }
}

export const CHECK_INTERVAL = 12 * 3600 * 1000; // 自动检查最多 12 小时一次
