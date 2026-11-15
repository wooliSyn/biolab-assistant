#!/usr/bin/env node
/**
 * 抓取传送门各站点的真实图标 → src/assets/portal-icons/
 *
 * 为什么要手动跑一次，而不是运行时去取：
 * 本应用坚持离线可用、且条款承诺「数据不出设备」。运行时拉取第三方 favicon 既会在断网时
 * 变成空白，也等于把用户收藏了哪些站点告诉了那些站点。所以图标在构建前一次性抓好、打包进去，
 * 应用运行期间不向任何第三方发请求。
 *
 * 用法：
 *   node fetch-portal-icons.mjs            # 只抓缺失的
 *   node fetch-portal-icons.mjs --force    # 全部重抓
 *
 * 清单来自 src/lib/portalLinks.js，新增入口后重跑即可。抓不到的条目会在界面上
 * 自动回退到原来的字母徽章，不会留空。
 */
import { writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_LINKS, slugOf } from "./src/lib/portalLinks.js";

if (typeof fetch !== "function") {
  console.error("✗ 需要 Node 18 以上（用到内置 fetch）。当前：" + process.version);
  process.exit(1);
}

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "src", "assets", "portal-icons");
const FORCE = process.argv.includes("--force");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const EXT = {
  "image/png": "png", "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico",
  "image/svg+xml": "svg", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
};

async function grab(url, timeout = 12000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ac.signal, redirect: "follow", headers: { "User-Agent": UA, Accept: "*/*" } });
    if (!r.ok) return null;
    return r;
  } catch { return null; } finally { clearTimeout(t); }
}

// 从首页 HTML 里挑图标：按 sizes 取最大，apple-touch-icon 通常分辨率最高、优先
function candidatesFromHtml(html, pageUrl) {
  const out = [];
  const re = /<link\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const rel = (/\brel\s*=\s*["']([^"']+)["']/i.exec(tag) || [])[1];
    const href = (/\bhref\s*=\s*["']([^"']+)["']/i.exec(tag) || [])[1];
    if (!rel || !href) continue;
    const r = rel.toLowerCase();
    if (!/\b(icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed|mask-icon)\b/.test(r)) continue;
    const sizes = (/\bsizes\s*=\s*["']([^"']+)["']/i.exec(tag) || [])[1] || "";
    const px = Math.max(0, ...sizes.split(/\s+/).map((s) => parseInt(s, 10) || 0));
    let abs;
    try { abs = new URL(href, pageUrl).href; } catch { continue; }
    // 打分：显式尺寸优先，其次 apple-touch-icon，svg 视为足够大
    const score = px || (/apple-touch/.test(r) ? 180 : /svg/.test(abs) ? 256 : 32);
    out.push({ url: abs, score });
  }
  return out.sort((a, b) => b.score - a.score).map((x) => x.url);
}

async function fetchOne(link) {
  const slug = slugOf(link);
  const tried = [];
  let origin;
  try { origin = new URL(link.url).origin; } catch { return { slug, ok: false, why: "URL 无效" }; }

  // 1) 读首页找 <link rel=icon>
  const page = await grab(link.url);
  if (page) {
    const ct = (page.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("html")) {
      try { tried.push(...candidatesFromHtml(await page.text(), page.url || link.url)); } catch { /* 忽略解析失败 */ }
    }
  }
  // 2) 兜底：根目录 favicon.ico
  tried.push(`${origin}/favicon.ico`);

  for (const u of tried.slice(0, 6)) {
    const r = await grab(u);
    if (!r) continue;
    const ct = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    let ext = EXT[ct];
    if (!ext) {
      const mm = /\.(png|ico|svg|jpg|jpeg|webp|gif)(?:$|\?)/i.exec(u);
      ext = mm ? mm[1].toLowerCase().replace("jpeg", "jpg") : null;
    }
    if (!ext) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 70) continue;           // 几十字节的多半是占位/错误页
    if (buf.slice(0, 15).toString("utf8").toLowerCase().includes("<!doctype")) continue; // 拿到 HTML 了
    await writeFile(join(OUT, `${slug}.${ext}`), buf);
    return { slug, ok: true, bytes: buf.length, ext, from: u };
  }
  return { slug, ok: false, why: "未找到可用图标" };
}

await mkdir(OUT, { recursive: true });
const existing = new Set((await readdir(OUT).catch(() => [])).map((f) => f.replace(/\.[^.]+$/, "")));

console.log(`传送门图标：共 ${ALL_LINKS.length} 个入口，输出到 src/assets/portal-icons/\n`);
let got = 0, skipped = 0, failed = [];
for (const link of ALL_LINKS) {
  const slug = slugOf(link);
  if (!FORCE && existing.has(slug)) { skipped++; continue; }
  if (FORCE) {
    for (const f of (await readdir(OUT).catch(() => []))) {
      if (f.replace(/\.[^.]+$/, "") === slug) await unlink(join(OUT, f)).catch(() => {});
    }
  }
  const r = await fetchOne(link);
  if (r.ok) { got++; console.log(`  ✓ ${link.name.padEnd(22)} ${slug}.${r.ext}  ${(r.bytes / 1024).toFixed(1)}KB`); }
  else { failed.push(link.name); console.log(`  ✗ ${link.name.padEnd(22)} ${r.why}`); }
}

console.log(`\n新抓 ${got} 个${skipped ? `，跳过已有 ${skipped} 个` : ""}${failed.length ? `，失败 ${failed.length} 个：${failed.join("、")}` : ""}`);
if (failed.length) console.log("失败的条目会在界面上自动回退到字母徽章，不影响使用。");
