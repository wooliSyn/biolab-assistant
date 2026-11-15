#!/usr/bin/env node
/**
 * 版本号同步 —— package.json 是唯一来源（single source of truth）
 *
 * 为什么需要它：本项目的版本号散落在
 *   package.json / src-tauri/tauri.conf.json / src-tauri/Cargo.toml
 * 三处，历史上已经漂移过（界面长期显示 v1.2.2.5，安装包却是 1.12.0）。
 * 前端侧已改为由 vite.config.js 的 define 注入 __APP_VERSION__，不再硬编码；
 * 剩下这三处配置用本脚本一次写齐。
 *
 * 用法：
 *   node sync-version.mjs            把 tauri.conf.json / Cargo.toml 对齐到 package.json
 *   node sync-version.mjs --check    只校验，不一致则非零退出（构建前闸门）
 *   node sync-version.mjs 1.13.0     先把 package.json 设为 1.13.0，再对齐其余两处
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const P_PKG = join(ROOT, "package.json");
const P_CONF = join(ROOT, "src-tauri", "tauri.conf.json");
const P_CARGO = join(ROOT, "src-tauri", "Cargo.toml");
const P_LOCK = join(ROOT, "src-tauri", "Cargo.lock");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const setTo = args.find((a) => /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(a));

const read = (p) => readFileSync(p, "utf8");
const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

// ---------- 单处替换：命中数必须恰好 1，否则宁可报错也不乱改 ----------
function replaceOne(text, re, replacer, what, file) {
  const hits = text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
  if (!hits || hits.length !== 1) fail(`${file}: 预期恰好 1 处 ${what}，实际 ${hits ? hits.length : 0} 处 —— 请手动检查，脚本不做猜测`);
  return text.replace(re, replacer);
}

// ---------- 读取 / 写入 package.json 的版本 ----------
let pkgText = read(P_PKG);
const RE_PKG = /"version"\s*:\s*"([^"]+)"/;
const pkgVer0 = (pkgText.match(RE_PKG) || [])[1];
if (!pkgVer0) fail("package.json 中找不到 version 字段");

if (setTo) {
  if (checkOnly) fail("--check 不能与指定版本号同时使用");
  pkgText = replaceOne(pkgText, RE_PKG, `"version": "${setTo}"`, "version 字段", "package.json");
  writeFileSync(P_PKG, pkgText);
}
const V = setTo || pkgVer0;

// ---------- 各目标文件的读取 / 改写规则 ----------
const targets = [
  {
    file: "src-tauri/tauri.conf.json", path: P_CONF, required: true,
    re: /"version"\s*:\s*"([^"]+)"/, what: "version 字段",
    write: (v) => `"version": "${v}"`,
  },
  {
    // 只匹配行首的 version（[package] 段），不碰 { version = "2" } 这类依赖内联写法
    file: "src-tauri/Cargo.toml", path: P_CARGO, required: true,
    re: /^version\s*=\s*"([^"]+)"/m, what: "[package] 段的 version",
    write: (v) => `version = "${v}"`,
  },
  {
    // Cargo.lock 里本地包的条目；cargo 自己也会更新，这里顺手对齐，避免 --locked 构建报错
    file: "src-tauri/Cargo.lock", path: P_LOCK, required: false,
    re: /(name = "biolab-assistant"\nversion\s*=\s*")([^"]+)(")/, what: "本地包条目", group: 2,
    write: (v) => `$1${v}$3`,
  },
];

let drift = 0;
for (const t of targets) {
  if (!existsSync(t.path)) {
    if (t.required) fail(`找不到 ${t.file}`);
    console.log(`－ ${t.file}（不存在，跳过）`);
    continue;
  }
  const text = read(t.path);
  const m = text.match(t.re);
  if (!m) fail(`${t.file}: 找不到${t.what}`);
  const cur = m[t.group || 1];
  if (cur === V) { console.log(`✓ ${t.file}  ${cur}`); continue; }
  drift++;
  if (checkOnly) { console.error(`✗ ${t.file}  ${cur}  ≠  package.json 的 ${V}`); continue; }
  writeFileSync(t.path, replaceOne(text, t.re, t.write(V), t.what, t.file));
  console.log(`→ ${t.file}  ${cur}  →  ${V}`);
}

if (checkOnly) {
  if (drift) {
    console.error(`\n版本号不一致（${drift} 处）。运行 \`npm run version:sync\` 对齐后重试。`);
    process.exit(1);
  }
  console.log(`\n版本号一致：${V}`);
} else {
  console.log(`\n版本号已统一为 ${V}（前端界面由 vite define 注入 __APP_VERSION__，无需另改）`);
}
