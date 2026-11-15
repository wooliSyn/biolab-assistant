// ==================== 质粒工作台（SnapGene 风格） ====================
// 序列视图：5'→3' 正链 + 可开关反义链 · 特征着色 · 字符级选区(bp 计数/Ctrl+C/V/选区跟随滚动)
// 引物系统：选区建引物(正/反向) · Tag 融合(不完全配对) · 图谱标注 · 详情弹窗(Tm/配对/产物)
// 酶切：环形小卡片 + 仅列出当前质粒检测到的位点
// 比对：Needleman-Wunsch 全局比对（支持插入/缺失 gap），完整线性单链展示
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { Dna, Upload, ClipboardPaste, FlaskConical, Scissors, MapPin, Plus, Trash2, X, GitCompare, Copy, Pencil, Check, Eye, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Search, Crosshair, Layers, CircleDot } from "lucide-react";
import HelpTip from "./HelpTip";
import { revComp, complement, cleanSeq, gid, analyzePrimer, primerTm, translate, TAGS, LINKER, tagById, nwAlign, fastAlign, alignBest, alignToReference } from "../lib/bio";
import MapView from "./PlasmidMap";
import { featColor, packLanes } from "../lib/mapstyle";
import { useLongPressDrag, arrayReorder } from "../lib/useLongPressDrag";
import { FlipGrid } from "../lib/useFlip";

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

// ---------- 限制酶数据库（识别序列，5'→3'） ----------
const ENZYME_DB = [
  ["EcoRI", "GAATTC"], ["BamHI", "GGATCC"], ["HindIII", "AAGCTT"], ["NotI", "GCGGCCGC"],
  ["XhoI", "CTCGAG"], ["NdeI", "CATATG"], ["NcoI", "CCATGG"], ["SalI", "GTCGAC"],
  ["PstI", "CTGCAG"], ["SacI", "GAGCTC"], ["KpnI", "GGTACC"], ["SmaI", "CCCGGG"],
  ["EcoRV", "GATATC"], ["ClaI", "ATCGAT"], ["XbaI", "TCTAGA"], ["SpeI", "ACTAGT"],
  ["ApaI", "GGGCCC"], ["BglII", "AGATCT"], ["MluI", "ACGCGT"], ["NheI", "GCTAGC"],
  ["ScaI", "AGTACT"], ["SphI", "GCATGC"], ["StuI", "AGGCCT"], ["PvuII", "CAGCTG"],
  ["AflII", "CTTAAG"], ["AgeI", "ACCGGT"], ["AvrII", "CCTAGG"], ["NarI", "GGCGCC"],
  ["PciI", "ACATGT"], ["PacI", "TTAATTAA"], ["SwaI", "ATTTAAAT"], ["FseI", "GGCCGGCC"],
  ["AscI", "GGCGCGCC"], ["BsiWI", "CGTACG"], ["BspEI", "TCCGGA"], ["BsrGI", "TGTACA"],
  ["DraI", "TTTAAA"], ["HpaI", "GTTAAC"], ["NruI", "TCGCGA"], ["PmeI", "GTTTAAAC"],
  ["SnaBI", "TACGTA"], ["SspI", "AATATT"], ["AatII", "GACGTC"], ["BclI", "TGATCA"],
  ["BstBI", "TTCGAA"], ["DpnI", "GATC"], ["TaqI", "TCGA"], ["HaeIII", "GGCC"],
  ["AluI", "AGCT"], ["BsaI", "GGTCTC"], ["BbsI", "GAAGAC"], ["SapI", "GCTCTTC"],
  ["MfeI", "CAATTG"], ["PflFI", "GACNNNGTC"], ["BstXI", "CCANNNNNNTGG"],
];

// ---------- 切割方式数据库（点5：[topCut, botCut] = 正链坐标上的切割位点） ----------
// topCut<botCut → 5′突出；topCut>botCut → 3′突出；相等 → 平末端
const CUT_MAP = {
  EcoRI: [1, 5], BamHI: [1, 5], HindIII: [1, 5], XhoI: [1, 5], NcoI: [1, 5], SalI: [1, 5],
  XbaI: [1, 5], SpeI: [1, 5], BglII: [1, 5], MluI: [1, 5], NheI: [1, 5], AflII: [1, 5],
  AgeI: [1, 5], AvrII: [1, 5], PciI: [1, 5], BsiWI: [1, 5], BsrGI: [1, 5], BclI: [1, 5],
  MfeI: [1, 5], BspEI: [1, 5],
  NdeI: [2, 4], ClaI: [2, 4], BstBI: [2, 4],
  NotI: [2, 6], NarI: [2, 6], AscI: [2, 6],
  PstI: [5, 1], SacI: [5, 1], KpnI: [5, 1], ApaI: [5, 1], SphI: [5, 1], AatII: [5, 1],
  PacI: [5, 3],
  SmaI: [3, 3], EcoRV: [3, 3], ScaI: [3, 3], StuI: [3, 3], PvuII: [3, 3], DraI: [3, 3],
  HpaI: [3, 3], NruI: [3, 3], SnaBI: [3, 3], SspI: [3, 3],
  SwaI: [4, 4], FseI: [4, 4], PmeI: [4, 4],
  HaeIII: [2, 2], AluI: [2, 2],
  TaqI: [1, 3], DpnI: [1, 3],
  BsaI: [7, 11], BbsI: [8, 12], SapI: [8, 11],
  PflFI: [4, 5], BstXI: [8, 4],
};
// 生成 SnapGene 风格的双链切割示意（5′→3′ 正链 + 3′→5′ 反义链，↓/↑ 为切割位点）
function cleavageInfo(name, site) {
  const cut = CUT_MAP[name];
  if (!cut) return null;
  const [tc, bc] = cut;
  const clean = site.replace(/N/g, "N");
  const dispLen = Math.max(tc, bc, clean.length);
  const topChars = clean.split("");
  while (topChars.length < dispLen) topChars.push("N");
  const botChars = topChars.map((c) => complement(c));
  const top = topChars.map((c, i) => c + (i + 1 === tc ? "↓" : "")).join("");
  const bot = botChars.map((c, i) => c + (i + 1 === bc ? "↑" : "")).join("");
  let overhang, overhangLen;
  if (tc === bc) { overhang = "平末端"; overhangLen = 0; }
  else if (tc < bc) { overhang = "5′ 突出"; overhangLen = bc - tc; }
  else { overhang = "3′ 突出"; overhangLen = tc - bc; }
  return { top, bot, overhang, overhangLen };
}

// ---------- GenBank 解析 ----------
function parseLoc(loc) {
  const comp = /complement\(/.test(loc);
  const inner = loc.replace(/complement\(|join\(|order\(|[()]/g, "");
  const parts = inner.split(",").map((p) => {
    const m = p.match(/(\d+)(?:\.\.(\d+))?/);
    return m ? { start: +m[1], end: m[2] ? +m[2] : +m[1] } : null;
  }).filter(Boolean);
  if (!parts.length) return null;
  return { start: Math.min(...parts.map((p) => p.start)), end: Math.max(...parts.map((p) => p.end)), strand: comp ? -1 : 1 };
}

function parseGenBank(text) {
  const lines = text.split(/\r?\n/);
  let name = "质粒", circular = true;
  const locus = lines.find((l) => /^LOCUS\s/.test(l));
  if (locus) {
    const tok = locus.trim().split(/\s+/);
    if (tok[1]) name = tok[1];
    circular = /circular/i.test(locus);
  }
  const features = [];
  const fi = lines.findIndex((l) => /^FEATURES\s/.test(l));
  const oi = lines.findIndex((l) => /^ORIGIN\s*$|^ORIGIN\s*\d*/.test(l) && !/FEATURES/.test(l));
  if (fi !== -1) {
    const end = oi === -1 ? lines.length : oi;
    let cur = null;
    for (let i = fi + 1; i < end; i++) {
      const line = lines[i];
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith("/")) {
        if (!cur) continue;
        const eq = t.indexOf("=");
        const k = eq === -1 ? t.slice(1) : t.slice(1, eq);
        let v = eq === -1 ? true : t.slice(eq + 1);
        if (typeof v === "string" && v.startsWith('"') && !(v.length > 1 && v.endsWith('"'))) {
          v = v.slice(1);
          while (i + 1 < end) {
            i++;
            const nt = lines[i].trim();
            if (nt.endsWith('"')) { v = (v + " " + nt).trim().slice(0, -1); break; }
            v += " " + nt;
          }
        } else if (typeof v === "string") v = v.replace(/^"|"$/g, "");
        cur.quals[k] = cur.quals[k] ? `${cur.quals[k]} ${v}` : v;
        continue;
      }
      if (cur && /^[0-9.,()<>=!^]+$/.test(t)) { cur.loc += t; continue; }
      const fm = line.match(/^\s+(\S+)\s+(\S.*)$/);
      if (fm) { cur = { key: fm[1], loc: fm[2].trim(), quals: {} }; features.push(cur); }
    }
  }
  let seq = "";
  if (oi !== -1) {
    for (let i = oi + 1; i < lines.length && !/^\/\//.test(lines[i]); i++) seq += lines[i].replace(/[^A-Za-z]/g, "");
  }
  seq = seq.toUpperCase();
  const parsed = features.map((f) => {
    const r = parseLoc(f.loc);
    if (!r) return null;
    const label = f.quals.label || f.quals.gene || (typeof f.quals.product === "string" ? f.quals.product : "") || f.key;
    return { key: f.key, label: String(label).slice(0, 48), start: r.start, end: Math.min(r.end, seq.length || r.end), strand: r.strand };
  }).filter(Boolean);
  return { name, circular, seq, features: parsed };
}

// ---------- SnapGene .dna 解析（二进制分包格式） ----------
function parseFeaturesXml(xml) {
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const feats = [];
    doc.querySelectorAll("Feature, feature").forEach((f) => {
      const name = f.getAttribute("name") || f.getAttribute("type") || "feature";
      const type = f.getAttribute("type") || "misc_feature";
      // 方向：SnapGene 用 directionality（1=正 2=反 3=双向），GenBank 用 direction（right/left）
      const dirNum = f.getAttribute("directionality");
      const dirWord = (f.getAttribute("direction") || "").toLowerCase();
      let strand = 1;
      if (dirNum != null) strand = dirNum === "2" ? -1 : dirNum === "3" ? 0 : 1;
      else if (dirWord === "left" || dirWord === "reverse") strand = -1;
      else if (dirWord === "both" || dirWord === "bidirectional") strand = 0;
      // 区段：SnapGene 用 range="a-b"，GenBank 用 start/end
      const segs = [...f.querySelectorAll("Segment, segment")];
      let start = Infinity, end = -Infinity;
      segs.forEach((sg) => {
        const range = sg.getAttribute("range");
        if (range) {
          const m = String(range).match(/(\d+)\s*[-–]\s*(\d+)/);
          if (m) { start = Math.min(start, +m[1]); end = Math.max(end, +m[2]); }
        } else {
          const s = sg.getAttribute("start"), e = sg.getAttribute("end");
          if (s != null && !isNaN(+s)) start = Math.min(start, +s);
          if (e != null && !isNaN(+e)) end = Math.max(end, +e);
        }
      });
      if (!isFinite(start) || !isFinite(end) || end < start) return;
      // SnapGene 的 range 已是 1 基坐标；GenBank 的 start/end 为 0 基，统一按 +1 处理
      const isOneBased = segs.some((sg) => sg.getAttribute("range"));
      feats.push({ key: type, label: String(name).slice(0, 48), start: isOneBased ? start : start + 1, end, strand });
    });
    return feats;
  } catch { return []; }
}

function parseSnapGene(buf, fallbackName) {
  const b = new Uint8Array(buf);
  if (b.length < 16) return null;
  const dv = new DataView(buf);
  const decodeXml = (body) => {
    try {
      if (body.length > 2 && body[0] === 0x3c && body[1] === 0x00) return new TextDecoder("utf-16le").decode(body);
      return new TextDecoder("utf-8").decode(body);
    } catch { return new TextDecoder().decode(body); }
  };
  const readBody = (body) => {
    const flags = body[0];
    let s = "";
    for (let i = 1; i < body.length; i++) s += String.fromCharCode(body[i]);
    return { circular: !!(flags & 0x02), seq: cleanSeq(s) };
  };
  const tryWalk = (headSize, bodySize) => {
    let off = headSize === 2 ? 3 + dv.getUint16(1, false) : 5 + dv.getUint32(1, false);
    const hdr = 1 + bodySize;
    let seq = "", circular = true, features = [], name = null;
    while (off + hdr <= b.length) {
      const type = b[off];
      const len = bodySize === 2 ? dv.getUint16(off + 1, false) : dv.getUint32(off + 1, false);
      if (len > b.length || off + hdr + len > b.length) break;
      const body = b.subarray(off + hdr, off + hdr + len);
      if (type === 0x00 && body.length > 1) {
        const r = readBody(body);
        if (r.seq.length > seq.length) { seq = r.seq; circular = r.circular; }
      } else if (type === 0x0a) {
        // 0x0a = Features XML（SnapGene）
        const f = parseFeaturesXml(decodeXml(body));
        if (f.length > features.length) features = f;
        const m = decodeXml(body).match(/<name>([^<]+)<\/name>/i);
        if (m && !name) name = m[1].trim();
      } else if (type === 0x06) {
        // 0x06 = Notes XML（SnapGene），有时含 name
        const m = decodeXml(body).match(/<name>([^<]+)<\/name>/i);
        if (m && !name) name = m[1].trim();
      }
      off += hdr + len;
    }
    return { seq, circular, features, name };
  };
  let best = null;
  for (const [h, bs] of [[2, 4], [2, 2], [4, 4], [4, 2]]) {
    const r = tryWalk(h, bs);
    if (r.seq && (!best || r.seq.length > best.seq.length)) best = r;
  }
  if (!best || !best.seq) {
    let seq = "", circular = true;
    for (let i = 0; i + 40 < b.length; i++) {
      if (b[i] !== 0x00) continue;
      let s = "", j = i + 2;
      while (j < b.length) {
        const c = String.fromCharCode(b[j]).toUpperCase();
        if ("ATGCN".includes(c)) { s += c; j++; } else break;
      }
      if (s.length > seq.length && s.length > 40) { seq = s; circular = !!(b[i + 1] & 0x02); }
    }
    let features = [], name = null;
    const allXml = decodeXml(b);
    const featXml = allXml.match(/<Features[\s\S]*?<\/Features>|<features[\s\S]*?<\/features>/);
    if (featXml) features = parseFeaturesXml(featXml[0]);
    const nm = allXml.match(/<name>([^<]+)<\/name>/i);
    if (nm) name = nm[1].trim();
    if (seq) best = { seq, circular, features, name };
  }
  if (!best || !best.seq) return null;
  const features = best.features.map((f) => ({ ...f, end: Math.min(f.end, best.seq.length) }));
  return { name: best.name || fallbackName || "质粒", circular: best.circular, seq: best.seq, features };
}

// ---------- 输入识别 ----------
function parseInput(text, fileName) {
  const t = text.trim();
  if (/^LOCUS\s/m.test(t)) return [parseGenBank(t)];
  if (/^>/.test(t)) {
    const chunks = t.split(/(?=^>)/m).map((c) => c.trim()).filter(Boolean);
    return chunks.map((c) => {
      const lines = c.split(/\r?\n/);
      const nm = lines[0].slice(1).trim().split(/\s+/)[0] || fileName || "质粒";
      return { name: nm, circular: false, seq: cleanSeq(lines.slice(1).join("")), features: [] };
    }).filter((r) => r.seq.length);
  }
  const seq = cleanSeq(t);
  if (seq.length > 20 && /^[ATGCN]+$/.test(seq)) return [{ name: fileName || "序列", circular: false, seq, features: [] }];
  return [];
}

// ---------- 酶切扫描（环状首尾拼接；简并码 N 通配） ----------
function scanEnzymes(seq, circular) {
  if (!seq) return [];
  const hay = circular ? seq + seq : seq;
  const out = [], seen = new Set();
  for (const [n, site] of ENZYME_DB) {
    const re = new RegExp(site.replace(/N/g, "[ATGC]"), "g");
    for (const s of [re, new RegExp(revComp(site).replace(/N/g, "[ATGC]"), "g")]) {
      let m;
      while ((m = s.exec(hay)) !== null) {
        if (m.index >= seq.length) break;
        const k = `${n}:${m.index}`;
        if (!seen.has(k)) { seen.add(k); out.push({ name: n, pos: m.index + 1, site }); }
        if (m.index === s.lastIndex) s.lastIndex++;
      }
    }
  }
  return out.sort((a, b) => a.pos - b.pos);
}

// ---------- 引物结合区定位（支持 5'/3' Tag 悬挂 → 仅用结合区匹配） ----------
function primerBinding(p) {
  const tag = p.tagId ? tagById(p.tagId) : null;
  const over = (tag ? tag.seq.length : 0) + (p.linker ? LINKER.seq.length : 0);
  const bindLen = Math.max(6, (p.bindLen || (p.seq.length - over)) || p.seq.length);
  const bind = p.tagPos === "3" ? p.seq.slice(0, bindLen) : p.seq.slice(p.seq.length - bindLen);
  return { bind, bindLen, overLen: p.seq.length - bind.length };
}
// 滑动窗口最小错配比对：返回错配数最少（Hamming 距离）的起点。支持定点突变引物（中间若干碱基不配对）。
function bestAlign(hay, needle) {
  const n = needle.length;
  let bestPos = -1, bestMM = n + 1;
  for (let i = 0; i + n <= hay.length; i++) {
    let mm = 0;
    for (let j = 0; j < n; j++) {
      if (hay[i + j] !== needle[j] && ++mm >= bestMM) break; // 提前剪枝
    }
    if (mm < bestMM) { bestMM = mm; bestPos = i; if (mm === 0) break; }
  }
  return { pos: bestPos, mm: bestMM };
}
function mapPrimer(seq, primer, circular) {
  const { bind, bindLen, overLen } = primerBinding(primer);
  const b = cleanSeq(bind).toUpperCase().replace(/N/g, "");
  if (!seq || b.length < 6) return { hit: null, bindLen, overLen };
  const hay = (circular ? seq + seq.slice(0, b.length - 1) : seq).toUpperCase();
  // 错配容忍阈值：随结合区长短自适应，允许定点突变的少数中间错配
  const maxMM = Math.max(1, Math.floor(b.length * 0.18));
  const fwd = bestAlign(hay, b);
  const rev = bestAlign(hay, revComp(b));
  const a = rev.mm < fwd.mm ? rev : fwd;
  const strand = rev.mm < fwd.mm ? "−" : "+";
  if (a.pos !== -1 && a.mm <= maxMM && a.pos < seq.length) {
    return { hit: { pos: a.pos + 1, strand, mm: a.mm }, bindLen, overLen };
  }
  return { hit: null, bindLen, overLen };
}
// 配对与产物：正向(+) 与 反向(−) 之间，产物 = 正向下游端到反向结合末端（含两引物互补区）
function findPair(p, all) {
  if (!p.hit) return null;
  let best = null;
  for (const q of all) {
    if (q.id === p.id || !q.hit || q.hit.strand === p.hit.strand) continue;
    if (p.hit.strand === "+") {
      const end = q.hit.pos + q.bindLen - 1;
      if (end > p.hit.pos && end - p.hit.pos < 20000 && (!best || end < best.end)) best = { q, start: p.hit.pos, end, full: end - p.hit.pos + 1 + p.overLen + q.overLen };
    } else {
      const end = p.hit.pos + p.bindLen - 1;
      if (end > q.hit.pos && end - q.hit.pos < 20000 && (!best || end < best.end)) best = { q, start: q.hit.pos, end, full: end - q.hit.pos + 1 + p.overLen + q.overLen };
    }
  }
  return best;
}

// ---------- 特征配色 / 泳道排布：见 lib/mapstyle.js，供图谱与序列条带共用 ----------

// ---------- 示例质粒 ----------
const CDS_DEMO =
  "ATGGCTAGCAAGGAGTACGGCATCGAGTGGATCCTCAATGGCGGCATGCGCGGCAATGACGTGGTCAAGTTCGGCGAGGACATCAACGAGCTGGTGGTGAAGGGCACCGTGGTCTTCGACGGCAACGTGATCAAGGAGCTGACCGGCGTGGTGGAGTACGGCAAGCTGACCATCGAGTTCGACCTGCTGACCGGCGTGAAGTAA";
const AMP_DEMO =
  "ATGAGTATTCAACATTTCCGTGTCGCCCTTATTCCCTTTTTTGCGGCATTTTGCCTTCCTGTTTTTGCTCACCCAGAAACGCTGGTGAAAGTAAAAGATGCTGAAGATCAGTTGGGTGCACGAGTGGGTTACATCGAACTGGATCTCAACAGCGGTAAGATCCTTGAGAGTTTTCGCCCCGAAGAACGTTTTCCAATGATGAGCACTTTTAAAGTTCTGCTATGTG";
const ORI_DEMO =
  "GCGGTGGCGCGGGCCTGATGCGGTATTTTCTCCTTACGCATCTGTGCGGTATTTCACACCGCATATGGTGCACTCTCAGTACAATCTGCTCTGATGCCGCATAGTTAAGCCAGCCCCGACACCCGCCAACACCCGCTGACGCGCCCTGACGGGCTTGTCTGCTCCCGGCATCCGCTTACAGACAAGCTGTGACCGTCTCCGGGAGCTGCATGTGTCAGAGGTTTTCACCGTCATCACCGAAACGCGCGAG";
function buildDemo() {
  const blocks = [
    { key: "promoter", label: "T7 启动子", seq: "TAATACGACTCACTATAGGGAGA" },
    { key: "misc_feature", label: "RBS 核糖体结合位点", seq: "AGGAGATATACAT" },
    { key: "CDS", label: "目的基因 CDS (示例)", seq: CDS_DEMO },
    { key: "terminator", label: "T7 终止子", seq: "GCTAGTTATTGCTCAGCGG" },
    { key: "misc_feature", label: "MCS 多克隆位点", seq: "GAATTCGAGCTCGGTACCCGGGGATCCTCTAGAGTCGACCTGCAGGCATGCAAGCTT" },
    { key: "CDS", label: "AmpR 氨苄抗性 (片段)", seq: AMP_DEMO },
    { key: "rep_origin", label: "ColE1 复制起点 (片段)", seq: ORI_DEMO },
  ];
  let cum = 0;
  const features = blocks.map((b) => {
    const f = { key: b.key, label: b.label, start: cum + 1, end: cum + b.seq.length, strand: 1 };
    cum += b.seq.length;
    return f;
  });
  const seq = blocks.map((b) => b.seq).join("");
  features.unshift({ key: "source", label: "pDemo-1 载体骨架", start: 1, end: seq.length, strand: 1 });
  return { id: gid(), name: "pDemo-1", circular: true, seq, features };
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const DEFAULT_BP_ROW = 80; // 每行 80 bp 定义为 100% 缩放

// ---------- 视图分页定义（SnapGene 式：一次只渲染一个视图，占满可用高度） ----------
const VIEW_DEFS = [
  { k: "map", i: CircleDot, l: "图谱" },
  { k: "seq", i: Dna, l: "序列" },
  { k: "enz", i: Scissors, l: "酶切" },
  { k: "feat", i: Layers, l: "元件" },
  { k: "primer", i: MapPin, l: "引物" },
  { k: "align", i: GitCompare, l: "比对" },
];

// ==================== 序列面板（SnapGene 风格核心） ====================
function SequencePanel({ plasmid, sites, mapped, sel, setSel, onPrimerClick, onBuildPrimer, onPasteOpen, toast, focusReq, height }) {
  const L = plasmid.seq.length;
  const seq = plasmid.seq;
  const contRef = useRef(null);
  const wrapRef = useRef(null);
  const seqLeftRef = useRef(null);
  const anchorRef = useRef(null);
  const [charW, setCharW] = useState(7.8);
  const [rowH, setRowH] = useState(34);
  const [showAnti, setShowAnti] = useState(true);
  const [stripW, setStripW] = useState(800);
  // 缩放：bpPerRow 控制每行显示多少碱基（越少=越放大），fontSize 自适应填满宽度
  const [bpPerRow, setBpPerRow] = useState(DEFAULT_BP_ROW);
  const [showORF, setShowORF] = useState(false);
  const [frame, setFrame] = useState(0);
  const [tip, setTip] = useState(null);
  const stripBoxRef = useRef(null);
  const ROW_BP = bpPerRow;
  // 字号根据容器宽度和每行碱基数计算（填满一行）
  const contWidth = Math.max(200, stripW - 80); // 减去行号列宽
  // 等宽字体字形宽 ≈ ratio×字号；用实测比自适应，使 ROW_BP 个碱基恰好铺满 contWidth
  const ratioRef = useRef(0.6);
  const fontSize = Math.max(8, Math.min(30, Math.floor((contWidth / ROW_BP) / ratioRef.current)));
  const LS = 0;
  const zoomPct = Math.round((DEFAULT_BP_ROW / bpPerRow) * 100);

  useEffect(() => {
    const cv = document.createElement("canvas");
    const ctx = cv.getContext("2d");
    ctx.font = `${fontSize}px ${MONO}`;
    const w = ctx.measureText("A").width;
    if (fontSize > 0 && w > 0) ratioRef.current = w / fontSize; // 记录实测字形宽比 → 下次渲染精确铺满
    setCharW(w + LS); // 字间距计入字符宽度 → 选区定位与双链对齐一致
  }, [fontSize, LS]);
  useEffect(() => {
    const el = contRef.current?.querySelector(".seqrow .seqcells");
    if (el) setRowH(el.getBoundingClientRect().height);
  }, [showAnti, showORF, bpPerRow, L]);
  useEffect(() => {
    const el = contRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setStripW(el.clientWidth));
    ro.observe(el);
    setStripW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // 切换质粒：回到顶部。选区由上层按 activeId 统一清空——这里不碰，
  // 否则从图谱/列表选中区段再切到序列视图时，刚选好的区段会被挂载清掉。
  const prevPid = useRef(plasmid.id);
  useEffect(() => {
    if (prevPid.current === plasmid.id) return;
    prevPid.current = plasmid.id;
    if (contRef.current) contRef.current.scrollTop = 0;
  }, [plasmid.id]);

  const feats = useMemo(() => plasmid.features.filter((f) => !(f.key === "source" && f.end - f.start + 1 >= L)), [plasmid, L]);
  const rows = Math.ceil(L / ROW_BP);
  // 点3：阅读框 = 正链按所选框翻译；行高随字号缩放，保证正/反链逐字符对齐
  const aaSeq = useMemo(() => (showORF ? translate(seq, frame) : ""), [seq, frame, showORF]);
  const lineH = Math.round(fontSize * 1.4);
  const orfH = Math.round(fontSize * 1.15);

  // ---------- 字符级选择（点5/5.1：选区随滚动移动，边缘自动滚动） ----------
  const posFromEvent = (e) => {
    const sl = seqLeftRef.current;
    const cont = contRef.current;
    if (!sl || !cont) return null;
    const slr = sl.getBoundingClientRect();
    // 通过实际 DOM 行元素定位行号（各行高度可能因注释行而不一致）
    const rowEls = cont.querySelectorAll(".seqrow");
    let r = -1;
    for (let i = 0; i < rowEls.length; i++) {
      const rect = rowEls[i].getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY < rect.bottom) { r = i; break; }
    }
    if (r === -1) {
      const first = rowEls[0]?.getBoundingClientRect();
      const last = rowEls[rowEls.length - 1]?.getBoundingClientRect();
      if (first && e.clientY < first.top) r = 0;
      else if (last && e.clientY >= last.top) r = rowEls.length - 1;
      else return null;
    }
    r = Math.max(0, Math.min(rows - 1, r));
    const rowLen = Math.min(ROW_BP, L - r * ROW_BP);
    let c = Math.round((e.clientX - slr.left) / charW);
    c = Math.max(0, Math.min(rowLen, c));
    return r * ROW_BP + c;
  };
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    const p = posFromEvent(e);
    if (p == null) return;
    e.preventDefault();
    anchorRef.current = p;
    setSel({ a: p, b: Math.max(0, p - 1) }); // 空选区起点
    const mm = (ev) => {
      // 边缘自动滚动（点5.1：序列随选择框移动）
      const cont = contRef.current;
      if (cont) {
        const cr = cont.getBoundingClientRect();
        if (ev.clientY < cr.top + 34) cont.scrollTop -= 14;
        else if (ev.clientY > cr.bottom - 34) cont.scrollTop += 14;
      }
      const q = posFromEvent(ev);
      if (q == null) return;
      const a = Math.min(anchorRef.current, q), b = Math.max(anchorRef.current, q);
      setSel((s) => (s && s.a === a && s.b === b ? s : { a, b: Math.max(a, b - 0) }));
    };
    const mu = () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
      setSel((s) => {
        if (!s) return s;
        if (s.b < s.a) return { a: s.a, b: s.a }; // 单击 → 1 bp
        return s;
      });
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
  };

  // ---------- Ctrl+C / Ctrl+V（点5） ----------
  useEffect(() => {
    const onKey = async (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = (document.activeElement?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key.toLowerCase() === "c" && sel && sel.b >= sel.a) {
        const sub = seq.slice(sel.a, sel.b + 1);
        try { await navigator.clipboard.writeText(sub); toast(`已复制 ${sub.length} bp（${sel.a + 1}–${sel.b + 1}）`, "success"); } catch { toast("复制失败：剪贴板不可用", "error"); }
      } else if (e.key.toLowerCase() === "v") {
        let text = "";
        try { text = await navigator.clipboard.readText(); } catch { /* 无权限则打开空粘贴框 */ }
        onPasteOpen(text);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, seq, onPasteOpen]);

  const selLen = sel && sel.b >= sel.a ? sel.b - sel.a + 1 : 0;
  const scrollToBp = (bp) => {
    const cont = contRef.current;
    if (!cont) return;
    const rh = rowH || 34;
    cont.scrollTo({ top: Math.max(0, Math.floor(bp / ROW_BP) * rh - cont.clientHeight / 3), behavior: "smooth" });
  };
  // 点3a/3b：外部定位请求（酶切位点 / 元件列表）→ 选中区段 + 滚动到位
  useEffect(() => {
    if (!focusReq) return;
    setSel({ a: focusReq.a, b: focusReq.b });
    scrollToBp(focusReq.a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusReq]);

  // ---------- 特征条带（SVG：特征箭头 + 酶切刻度 + 引物箭头 + 选区） ----------
  const sx = (bp0) => (bp0 / L) * stripW;
  const stripFeats = packLanes(feats.map((f) => ({ ...f, x1: sx(f.start - 1), x2: sx(f.end) })));
  const featLaneCount = Math.max(1, ...stripFeats.map((f) => f.lane + 1));
  const FEAT_H = 14, FEAT_GAP = 2, STRAND_Y = featLaneCount * (FEAT_H + FEAT_GAP) + 8;
  const stripH = STRAND_Y + 26;

  // ---------- 行渲染 ----------
  const rowEls = [];
  for (let r = 0; r < rows; r++) {
    const rs = r * ROW_BP;
    const re = Math.min(L, rs + ROW_BP);
    const chunk = seq.slice(rs, re);
    // 分段：特征边界 + 选区边界（引物不再染碱基，改在注释行以紫色条带呈现，避免遮挡选区）
    const bounds = new Set([0, re - rs]);
    for (const f of feats) {
      const s = f.start - 1 - rs, e2 = f.end - rs;
      if (s > 0 && s < re - rs) bounds.add(s);
      if (e2 > 0 && e2 < re - rs) bounds.add(e2);
    }
    if (sel && sel.b >= sel.a) {
      const s = sel.a - rs, e2 = sel.b + 1 - rs;
      if (s > 0 && s < re - rs) bounds.add(s);
      if (e2 > 0 && e2 < re - rs) bounds.add(e2);
    }
    const bs = [...bounds].sort((a, b) => a - b);
    const segs = [];
    for (let i = 0; i < bs.length - 1; i++) {
      const s0 = bs[i], s1 = bs[i + 1];
      if (s1 <= s0) continue;
      const pos = rs + s0;
      let feat = null;
      for (const f of feats) if (pos >= f.start - 1 && pos < f.end) feat = f;
      const selected = sel && sel.b >= sel.a && rs + s1 - 1 >= sel.a && pos <= sel.b;
      segs.push({ t: chunk.slice(s0, s1), c: feat ? featColor(feat) : "#374151", s: selected, title: feat ? feat.label : null });
    }
    const antiSel = sel && sel.b >= sel.a && re - 1 >= sel.a && rs <= sel.b;
    // 点3：阅读框单元格 —— 每个氨基酸占 3 个核苷酸宽度，居中于其密码子之下
    let orfCells = null;
    if (showORF) {
      const gs0 = frame + 3 * Math.max(0, Math.ceil((rs - frame) / 3));
      orfCells = [];
      for (let gs = gs0; gs + 3 <= re; gs += 3) orfCells.push({ aa: aaSeq[(gs - frame) / 3] || "?", col: gs - rs });
    }
    rowEls.push(
      <div key={r} className="seqrow flex items-start">
        <div className="w-14 flex-shrink-0 text-right pr-2 pt-px text-[10px] tabular-nums text-gray-300 select-none">{rs + 1}</div>
        <div className="seqcells flex-1 min-w-0">
          <div className="whitespace-nowrap cursor-text" style={{ lineHeight: `${lineH}px` }}>
            {segs.map((sg, i) => (
              <span key={i} title={sg.title || undefined}
                style={{ color: sg.c, backgroundColor: sg.s ? "#c7d2fe" : "transparent", borderRadius: sg.s ? 2 : 0, fontFamily: MONO, fontSize, letterSpacing: LS }}>{sg.t}</span>
            ))}
          </div>
          {showORF && orfCells && orfCells.length > 0 && (
            <div className="whitespace-nowrap select-none" style={{ lineHeight: `${orfH}px` }}>
              <span style={{ display: "inline-block", width: orfCells[0].col * charW }} />
              {orfCells.map((c, i) => (
                <span key={i} style={{ display: "inline-block", width: 3 * charW, textAlign: "center", fontFamily: MONO, fontSize: Math.max(9, fontSize - 3) }}
                  className={c.aa === "M" ? "font-bold text-emerald-600" : c.aa === "*" ? "font-bold text-red-500" : "font-medium text-amber-600"}>{c.aa}</span>
              ))}
            </div>
          )}
          {showAnti && (
            <div className={`whitespace-nowrap cursor-text ${antiSel ? "bg-indigo-100 rounded-sm" : ""}`}
              style={{ fontFamily: MONO, fontSize, letterSpacing: LS, lineHeight: `${lineH}px` }}>
              {segs.map((sg, i) => (
                <span key={i} style={{ color: sg.c, opacity: 0.7 }}>{complement(sg.t)}</span>
              ))}
            </div>
          )}
          {/* 酶切位点 + 引物结合条（行间注释：引物以紫色条带精确覆盖结合区，不染碱基、不遮挡选区） */}
          {(() => {
            const rowSites = sites.filter((s) => s.pos - 1 >= rs && s.pos - 1 < re);
            const rowPrimers = mapped.filter((p) => p.hit && p.hit.pos - 1 < re && p.hit.pos - 1 + p.bindLen > rs);
            if (!rowSites.length && !rowPrimers.length) return null;
            const sitesLane = rowSites.length ? 11 : 0;
            const laneH = sitesLane + (rowPrimers.length ? 21 : 0);
            return (
              <div className="relative select-none overflow-visible" style={{ height: laneH }}>
                {rowSites.map((s, i) => {
                  const col = s.pos - 1 - rs;
                  const show = (e) => setTip({ s, cx: e.clientX, cy: e.clientY });
                  return <span key={`e${i}`} className="absolute text-[8px] text-red-500 font-bold whitespace-nowrap cursor-pointer" style={{ left: col * charW, top: 0 }}
                    onMouseEnter={show} onMouseMove={show} onMouseLeave={() => setTip(null)} onClick={show}
                    title={`${s.name} · 识别 ${s.site} @ ${s.pos}`}>▲{s.name}</span>;
                })}
                {rowPrimers.map((p, i) => {
                  const segStart = Math.max(p.hit.pos - 1, rs);
                  const segEnd = Math.min(p.hit.pos - 1 + p.bindLen, re);
                  const startCol = segStart - rs;
                  const widthPx = Math.max(charW, (segEnd - segStart) * charW);
                  const isFwd = p.hit.strand === "+";
                  const bindSeq = p.seq && p.seq.length <= 30 ? p.seq : ((p.seq || "").slice(0, 30) + "…");
                  const showName = p.hit.pos - 1 >= rs; // 名称仅标注在结合起始所在行，避免跨行重复
                  return (
                    <span key={`p${i}`} className="absolute cursor-pointer" style={{ left: startCol * charW, top: sitesLane, width: widthPx }}
                      onClick={(e) => { e.stopPropagation(); onPrimerClick(p.id); }}
                      title={`${p.name} @ ${p.hit.pos}（${isFwd ? "正向 →" : "反向 ←"}）· 结合 ${p.bindLen}bp${p.hit.mm ? ` · 错配 ${p.hit.mm}（定点突变）` : ""}\n${bindSeq}\n点击查看详情`}>
                      <span className="block rounded-full" style={{ height: 6, background: isFwd ? "linear-gradient(90deg,#8b5cf6,#c4b5fd)" : "linear-gradient(90deg,#c4b5fd,#8b5cf6)", boxShadow: "0 0 6px rgba(139,92,246,.5)" }} />
                      {showName && (
                        <span className="block text-center text-[8px] font-semibold whitespace-nowrap leading-none mt-0.5" style={{ color: "#7c3aed" }}>
                          {isFwd ? "→" : "←"}{p.name} @{p.hit.pos}
                          {p.hit.mm > 0 && <b style={{ color: "#ea580c" }}> ⚠{p.hit.mm}</b>}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  return (
    <div className="pixel-panel overflow-hidden flex flex-col" style={height ? { height } : undefined}>
      {/* 头部：名称 + 工具 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 flex-wrap flex-shrink-0">
        <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5"><Dna size={13} className="text-indigo-600" />{plasmid.name}
          <span className="text-[10px] font-normal text-gray-400 tabular-nums">{L} bp · {plasmid.circular ? "环状" : "线性"}</span>
        </span>
        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {/* 点3：阅读框开关 + 框选择 */}
          <button onClick={() => setShowORF((v) => !v)}
            className={`px-3 py-2 md:px-2 md:py-1 text-[11px] md:text-[10px] border rounded-lg transition ${showORF ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-white border-gray-200 text-gray-500 hover:border-amber-200"}`}
            title="显示/隐藏正链翻译（阅读框）">阅读框 {showORF ? "开" : "关"}</button>
          {showORF && (
            <div className="flex items-center rounded-lg border border-amber-200 overflow-hidden">
              {[0, 1, 2].map((f) => (
                <button key={f} onClick={() => setFrame(f)}
                  className={`px-2.5 py-2 md:px-1.5 md:py-1 text-[11px] md:text-[10px] tabular-nums ${frame === f ? "bg-amber-500 text-white" : "bg-white text-amber-700 hover:bg-amber-50"}`}
                  title={`阅读框 +${f + 1}`}>+{f + 1}</button>
              ))}
            </div>
          )}
          <button onClick={() => setShowAnti((v) => !v)}
            className={`px-3 py-2 md:px-2 md:py-1 text-[11px] md:text-[10px] border rounded-lg transition ${showAnti ? "bg-indigo-50 border-indigo-300 text-indigo-600" : "bg-white border-gray-200 text-gray-500 hover:border-indigo-200"}`}
            title="显示/隐藏反义链（3'→5' 互补链）">反义链 {showAnti ? "开" : "关"}</button>
          {/* 放大缩小（改变每行碱基数） */}
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setBpPerRow((v) => Math.min(120, v + 10))} className="px-2.5 py-2 md:px-1.5 md:py-1 text-gray-500 hover:bg-gray-50" title="缩小（每行更多碱基）"><ZoomOut size={14} /></button>
            <span className="px-1 text-[10px] tabular-nums text-gray-400 w-9 text-center">{zoomPct}%</span>
            <button onClick={() => setBpPerRow((v) => Math.max(15, v - 10))} className="px-2.5 py-2 md:px-1.5 md:py-1 text-gray-500 hover:bg-gray-50" title="放大（每行更少碱基）"><ZoomIn size={14} /></button>
          </div>
          {selLen > 0 && (
            <button onClick={onBuildPrimer} className="px-3 py-2 md:px-2 md:py-1 text-[11px] md:text-[10px] bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 flex items-center gap-1" title="以选中区段为结合区新建引物">
              <Plus size={11} />新建引物
            </button>
          )}
        </div>
      </div>

      {/* 特征/酶切/引物 条带（点6/8：图谱标注，点击定位；点5：酶切悬停提示） */}
      <div ref={stripBoxRef} className="px-3 pt-2 relative flex-shrink-0">
        <svg width={stripW - 24} height={stripH} className="block select-none" style={{ maxWidth: "100%" }}>
          {/* 特征箭头 */}
          {stripFeats.map((f, i) => {
            const y = f.lane * (FEAT_H + FEAT_GAP);
            const w = Math.max(f.x2 - f.x1, 3);
            const col = featColor(f);
            const dir = f.strand >= 0 ? 1 : -1;
            const tipX = dir > 0 ? f.x1 + w : f.x1;
            const baseX = dir > 0 ? f.x1 : f.x1 + w;
            const ah = Math.min(7, w / 2);
            return (
              <g key={i} className="cursor-pointer" onClick={() => { setSel({ a: f.start - 1, b: f.end - 1 }); scrollToBp(f.start - 1); }}>
                <rect x={f.x1} y={y} width={w} height={FEAT_H} rx={2} fill={col} opacity={0.85}>
                  <title>{`${f.label} (${f.key})\n${f.start}..${f.end} ${f.strand >= 0 ? "→" : "←"} · ${f.end - f.start + 1} bp · 点击选中`}</title>
                </rect>
                <polygon points={`${tipX + dir * ah},${y + FEAT_H / 2} ${tipX},${y} ${tipX},${y + FEAT_H}`} fill={col} />
                {w > 46 && <text x={f.x1 + w / 2} y={y + FEAT_H - 3.5} fontSize="9" fill="#fff" textAnchor="middle" style={{ pointerEvents: "none" }}>{f.label.slice(0, Math.floor(w / 6))}</text>}
              </g>
            );
          })}
          {/* 主链 5'→3' / 3'→5'（点7） */}
          <line x1={0} y1={STRAND_Y + 4} x2={stripW - 24} y2={STRAND_Y + 4} stroke="#334155" strokeWidth="2" />
          <line x1={0} y1={STRAND_Y + 12} x2={stripW - 24} y2={STRAND_Y + 12} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2" />
          <text x={0} y={STRAND_Y - 1} fontSize="8" fill="#64748b">5′</text>
          <text x={stripW - 38} y={STRAND_Y - 1} fontSize="8" fill="#64748b">3′</text>
          <text x={0} y={STRAND_Y + 22} fontSize="8" fill="#94a3b8">3′</text>
          <text x={stripW - 38} y={STRAND_Y + 22} fontSize="8" fill="#94a3b8">5′</text>
          {/* 酶切刻度（点5：悬停显示识别序列与切割方式） */}
          {sites.map((s, i) => {
            const x = sx(s.pos - 1);
            const show = (e) => setTip({ s, cx: e.clientX, cy: e.clientY });
            return (
              <g key={`e${i}`} className="cursor-pointer" onMouseEnter={show} onMouseMove={show} onMouseLeave={() => setTip(null)} onClick={show}>
                <line x1={x} y1={STRAND_Y - 2} x2={x} y2={STRAND_Y + 18} stroke="transparent" strokeWidth="9" />
                <line x1={x} y1={STRAND_Y} x2={x} y2={STRAND_Y + 16} stroke="#dc2626" strokeWidth="1.5" style={{ pointerEvents: "none" }} />
                {sites.length <= 14 && <text x={x} y={STRAND_Y + 24} fontSize="7.5" fill="#b91c1c" textAnchor="middle" style={{ pointerEvents: "none" }}>{s.name}</text>}
              </g>
            );
          })}
          {/* 引物箭头（点8：正向在上链→，反向在下链←） */}
          {mapped.filter((p) => p.hit).map((p) => {
            const x1 = sx(p.hit.pos - 1), x2 = sx(p.hit.pos - 1 + p.bindLen);
            const fwd = p.hit.strand === "+";
            const y = fwd ? STRAND_Y + 4 : STRAND_Y + 12;
            const col = fwd ? "#0891b2" : "#7c3aed";
            const dir = fwd ? 1 : -1;
            const tip = fwd ? x2 : x1;
            return (
              <g key={p.id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onPrimerClick(p.id); }}>
                <line x1={x1} y1={y} x2={x2} y2={y} stroke={col} strokeWidth="4" strokeLinecap="round">
                  <title>{`${p.name} · ${p.hit.strand === "+" ? "正向" : "反向"} @ ${p.hit.pos}${p.hit.mm ? ` · 错配 ${p.hit.mm}（定点突变）` : ""} · 点击查看详情`}</title>
                </line>
                <polygon points={`${tip + dir * 6},${y} ${tip},${y - 4} ${tip},${y + 4}`} fill={col} />
              </g>
            );
          })}
          {/* 选区指示 */}
          {selLen > 0 && (
            <rect x={sx(sel.a)} y={0} width={Math.max(2, sx(sel.b + 1) - sx(sel.a))} height={stripH} fill="#6366f1" opacity={0.14} style={{ pointerEvents: "none" }} />
          )}
        </svg>
        {/* 点5：酶切位点悬停/点击提示（SnapGene 风格：识别序列 + 切割方式）—— Portal 到 body，fixed 定位 */}
        {tip && createPortal((() => {
          const ci = cleavageInfo(tip.s.name, tip.s.site);
          const count = sites.filter((x) => x.name === tip.s.name).length;
          const TW = 240;
          const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
          const left = Math.max(6, Math.min(tip.cx - TW / 2, vw - TW - 6));
          const hl = (str, cls) => str.split(/([↓↑])/).map((p, i) =>
            p === "↓" || p === "↑" ? <span key={i} className="text-yellow-300 font-bold">{p}</span> : <span key={i} className={cls}>{p}</span>);
          return (
            <div className="fixed z-[90] pointer-events-none bg-slate-800 text-white rounded-xl shadow-xl px-3 py-2.5"
              style={{ left, top: tip.cy + 16, width: TW }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Scissors size={12} className="text-red-400" />
                <span className="text-[12px] font-bold">{tip.s.name}</span>
                <span className="text-[10px] text-slate-300 tabular-nums">@ {tip.s.pos}</span>
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-200 tabular-nums">{count} 个位点</span>
              </div>
              {ci ? (
                <>
                  <div className="font-mono text-[11px] leading-[17px] bg-slate-900/70 rounded-lg px-2 py-1.5 whitespace-nowrap overflow-hidden">
                    <div><span className="text-slate-500">5′ </span>{hl(ci.top, "text-emerald-300")}<span className="text-slate-500"> 3′</span></div>
                    <div><span className="text-slate-500">3′ </span>{hl(ci.bot, "text-sky-300")}<span className="text-slate-500"> 5′</span></div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-[9px]">
                    <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300">{ci.overhang}{ci.overhangLen ? ` · ${ci.overhangLen} nt` : ""}</span>
                    <span className="text-slate-400 tabular-nums">识别 {tip.s.site.length} bp</span>
                  </div>
                </>
              ) : (
                <div className="font-mono text-[11px] text-slate-300 bg-slate-900/70 rounded-lg px-2 py-1.5">{tip.s.site}
                  <div className="text-[9px] text-slate-500 mt-0.5" style={{ fontFamily: "inherit" }}>切割方式未收录</div>
                </div>
              )}
            </div>
          );
        })(), document.body)}
      </div>

      {/* 选区信息条（固定高度，不切换内容避免抖动） */}
      <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] border-t border-gray-50 bg-gray-50/50 h-[30px] flex-shrink-0">
        {selLen > 0 && (
          <>
            <span className="text-indigo-600 font-medium tabular-nums">选区 {sel.a + 1} – {sel.b + 1}</span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold tabular-nums">{selLen} bp</span>
            <button onClick={async () => { try { await navigator.clipboard.writeText(seq.slice(sel.a, sel.b + 1)); toast(`已复制 ${selLen} bp`, "success"); } catch { toast("复制失败", "error"); } }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 border border-gray-200 rounded text-gray-600 hover:border-indigo-300 hover:text-indigo-600 bg-white"><Copy size={10} />复制</button>
            <button onClick={onBuildPrimer} className="flex items-center gap-0.5 px-1.5 py-0.5 border border-cyan-200 rounded text-cyan-700 hover:bg-cyan-50 bg-white"><Plus size={10} />引物</button>
          </>
        )}
        <span className={`${selLen > 0 ? "ml-auto" : ""} text-gray-400`}>{selLen > 0 ? "" : "拖动选择区段 · Ctrl+C 复制 · Ctrl+V 粘贴"}</span>
        <span className={`${selLen > 0 ? "" : "ml-auto"} text-gray-300 tabular-nums`}>{rows} 行 · {ROW_BP} bp/行</span>
      </div>

      {/* 序列主体（Ctrl+滚轮缩放；分页视图下占满可用高度，独立滚动） */}
      <div ref={contRef} className={`seq-paper overflow-y-auto px-3 py-2 bg-white ${height ? "flex-1 min-h-0" : ""}`}
        style={height ? undefined : { maxHeight: rowH ? Math.round(rowH * 4) + 30 : 200 }}
        onMouseDown={onMouseDown}
        onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); setBpPerRow((v) => Math.max(15, Math.min(120, v + (e.deltaY > 0 ? 5 : -5)))); } }}>
        <div ref={wrapRef}>
          <div className="flex items-start">
            <div className="w-14 flex-shrink-0" />
            <div ref={seqLeftRef} className="text-[8px] text-gray-300 select-none mb-0.5">5′→3′ 正链{showAnti ? " ／ 下方为 3′→5′ 反义链" : ""}</div>
          </div>
          {rowEls}
        </div>
      </div>
    </div>
  );
}

// ==================== 酶切面板（点3a：SnapGene 式按酶分组 + 切点频率筛选） ====================
// 说明：扫描算法对全部常用酶逐位点检测（含环状跨原点、简并码、双链），结果与独立实现核对无误。
// 此前“看起来比真实多得多”是因为把 4bp 高频切酶（AluI/TaqI/DpnI/HaeIII 等）的几十个位点全部平铺。
// 现按酶分组 + 默认仅显示单切/双切酶（克隆最有用的），高频切酶归入“多切”按需展开。
function EnzymePanel({ sites, hiddenEnzymes, toggleEnzyme, onLocate }) {
  const [freq, setFreq] = useState("low"); // low=≤2(默认) single=1 double=2 high=≥3 all=全部
  const [q, setQ] = useState("");

  // 按酶分组
  const groups = useMemo(() => {
    const m = new Map();
    for (const s of sites) {
      if (!m.has(s.name)) m.set(s.name, { name: s.name, site: s.site, positions: [] });
      m.get(s.name).positions.push(s.pos);
    }
    const arr = [...m.values()].map((g) => ({ ...g, count: g.positions.length }));
    arr.sort((a, b) => a.count - b.count || a.positions[0] - b.positions[0]);
    return arr;
  }, [sites]);

  const passFreq = (c) => freq === "all" ? true : freq === "single" ? c === 1 : freq === "double" ? c === 2 : freq === "high" ? c >= 3 : c <= 2;
  const shown = groups.filter((g) => passFreq(g.count) && (!q.trim() || g.name.toLowerCase().includes(q.trim().toLowerCase()) || g.site.toLowerCase().includes(q.trim().toLowerCase())));
  const singleCount = groups.filter((g) => g.count === 1).length;
  const doubleCount = groups.filter((g) => g.count === 2).length;

  const FREQ_TABS = [["low", `单/双切 (${singleCount + doubleCount})`], ["single", `单切 (${singleCount})`], ["double", `双切 (${doubleCount})`], ["high", `多切 (${groups.filter((g) => g.count >= 3).length})`], ["all", `全部 (${groups.length})`]];

  return (
    <div className="pixel-panel p-3">
      <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><Scissors size={13} className="text-red-500" />酶切位点
        <HelpTip text="扫描全部常用限制酶（含简并酶与环状跨原点）。默认仅显示单切/双切酶——克隆最有用；4bp 高频切酶（AluI/TaqI/DpnI/HaeIII 等）归入「多切」按需展开。点击位点数字可跳转到序列对应位置；勾选控制该酶在图谱上的显隐。" />
        <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{groups.length} 种酶 · {sites.length} 位点</span>
      </div>

      {/* 频率筛选 + 搜索 */}
      <div className="flex items-center gap-1 flex-wrap mb-2">
        {FREQ_TABS.map(([k, l]) => (
          <button key={k} onClick={() => setFreq(k)}
            className={`px-2 py-0.5 text-[10px] rounded-md border transition ${freq === k ? "bg-red-500 text-white border-red-600" : "bg-white text-gray-500 border-gray-200 hover:border-red-300"}`}>{l}</button>
        ))}
        <div className="relative ml-auto">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜酶名 / 识别序列"
            className="pl-6 pr-2 py-0.5 w-36 text-[10px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-red-200" />
        </div>
      </div>

      <div className="min-w-0">
          {shown.length === 0 ? (
            <div className="text-[11px] text-gray-400 py-6 text-center">{sites.length === 0 ? "当前质粒未检测到常用酶切位点" : "无符合筛选条件的酶"}</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-gray-400 border-b-2 border-gray-200">
                  <th className="w-5 py-1" title="在图谱中显示/隐藏"><Eye size={11} className="inline" /></th>
                  <th className="text-left py-1 pr-2 font-medium">酶</th>
                  <th className="text-left py-1 pr-2 font-medium">识别序列</th>
                  <th className="text-center py-1 pr-2 font-medium">切点</th>
                  <th className="text-left py-1 font-medium">位置（点击定位）</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((g) => {
                  const shownEnz = !hiddenEnzymes.includes(g.name);
                  const ci = cleavageInfo(g.name, g.site);
                  return (
                    <tr key={g.name} className={`border-b border-gray-100 hover:bg-red-50/40 align-top ${shownEnz ? "" : "opacity-40"}`}>
                      <td className="py-1"><input type="checkbox" checked={shownEnz} onChange={() => toggleEnzyme(g.name)} className="accent-red-500" title={shownEnz ? "点击隐藏" : "点击显示"} /></td>
                      <td className="py-1 pr-2 font-medium text-red-600 whitespace-nowrap">{g.name}</td>
                      <td className="py-1 pr-2 font-mono text-gray-500 whitespace-nowrap">{g.site}{ci && <span className="ml-1 text-[8px] text-gray-400">{ci.overhang}</span>}</td>
                      <td className="py-1 pr-2 text-center">
                        <span className={`inline-block min-w-[18px] px-1 rounded-full text-[9px] font-bold tabular-nums ${g.count === 1 ? "bg-emerald-100 text-emerald-700" : g.count === 2 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>{g.count}</span>
                      </td>
                      <td className="py-1">
                        <span className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                          {g.positions.slice(0, 12).map((p) => (
                            <button key={p} onClick={() => onLocate && onLocate(p)} className="tabular-nums text-indigo-600 hover:underline hover:text-indigo-800" title={`跳转到 ${p} bp`}>{p}</button>
                          ))}
                          {g.positions.length > 12 && <span className="text-gray-400 text-[9px]">+{g.positions.length - 12}</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>
      {freq === "low" && groups.some((g) => g.count >= 3) && (
        <div className="mt-2 text-[9px] text-gray-400 flex items-center gap-1">
          <Crosshair size={10} />已隐藏 {groups.filter((g) => g.count >= 3).length} 种高频切酶（多为 4bp 识别，位点密集）；切到「多切」或「全部」查看。
        </div>
      )}
    </div>
  );
}

// ==================== 元件面板（点3b：特征列表 + 搜索/类型筛选 + 点击定位联动） ====================
function FeaturePanel({ plasmid, sel, onLocate }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("全部");
  const L = plasmid.seq.length;
  const feats = useMemo(() => plasmid.features.filter((f) => !(f.key === "source" && f.end - f.start + 1 >= L)), [plasmid, L]);
  const types = ["全部", ...new Set(feats.map((f) => f.key))];
  const shown = feats.filter((f) =>
    (type === "全部" || f.key === type) &&
    (!q.trim() || (f.label + f.key).toLowerCase().includes(q.trim().toLowerCase()))
  );
  const isSel = (f) => sel && sel.b >= sel.a && sel.a === f.start - 1 && sel.b === f.end - 1;
  return (
    <div className="pixel-panel p-3">
      <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><Layers size={13} className="text-indigo-500" />元件注释
        <HelpTip text="列出当前质粒的全部特征元件（基因/CDS/启动子/复制起点等）。点击行选中并跳转到序列对应区段；支持按类型筛选与名称搜索。颜色与序列视图、图谱一致。" />
        <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{feats.length} 个元件</span>
      </div>
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="px-2 py-0.5 text-[10px] border border-gray-200 rounded-md bg-white focus:outline-none">
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="relative flex-1 min-w-[120px]">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索元件名称…"
            className="w-full pl-6 pr-2 py-0.5 text-[10px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-200" />
        </div>
      </div>
      <div>
        {shown.length === 0 ? (
          <div className="text-[11px] text-gray-400 py-6 text-center">{feats.length === 0 ? "该质粒无元件注释（导入 GenBank/.dna 可携带注释）" : "无匹配元件"}</div>
        ) : (
          <div className="space-y-1">
            {shown.map((f, i) => {
              const col = featColor(f);
              const len = f.end - f.start + 1;
              const selected = isSel(f);
              return (
                <button key={i} onClick={() => onLocate && onLocate(f.start, f.end)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left transition ${selected ? "border-indigo-400 bg-indigo-50" : "border-gray-100 hover:border-indigo-200 hover:bg-gray-50"}`}
                  title={`点击选中 ${f.start}..${f.end} 并跳转`}>
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: col }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] font-medium text-gray-700 truncate">{f.label}</span>
                    <span className="block text-[9px] text-gray-400 tabular-nums">{f.key} · {f.start}..{f.end} · {len} bp · {f.strand >= 0 ? "→ 正向" : "← 反向"}</span>
                  </span>
                  <Crosshair size={12} className="text-gray-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== 引物面板（点8/9：列表 + 详情入口） ====================
function PrimerPanel({ mapped, onPrimerClick, onRemove }) {
  return (
    <div className="pixel-panel p-3">
      <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><MapPin size={13} className="text-cyan-600" />引物
        <HelpTip text="在序列视图选择区段后点「新建引物」：支持正/反向、Tag 融合（不完全配对）、GGGGS 连接肽；点击行查看详情（Tm / 配对 / 产物 / 可编辑序列）" />
      </div>
      <div>
        {mapped.length === 0 ? (
          <div className="text-[11px] text-gray-400 py-6 text-center">暂无引物 —— 在序列视图选择区段即可新建</div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-white">
              <tr className="text-gray-400 border-b-2 border-gray-200">
                <th className="text-left py-1 pr-2 font-medium">名称</th>
                <th className="text-left py-1 pr-2 font-medium">长度</th>
                <th className="text-left py-1 pr-2 font-medium">Tm</th>
                <th className="text-left py-1 pr-2 font-medium">位置</th>
                <th className="text-left py-1 pr-2 font-medium">Tag</th>
                <th className="w-4" />
              </tr>
            </thead>
            <tbody>
              {mapped.map((p) => (
                <tr key={p.id} onClick={() => onPrimerClick(p.id)} className="border-b border-gray-100 hover:bg-cyan-50/40 cursor-pointer">
                  <td className="py-1 pr-2 font-medium text-cyan-700">{p.name}{p.tagId && <span className="ml-1 text-[8px] px-1 rounded bg-orange-100 text-orange-600 align-middle" title="5' 悬挂区不与模板配对（用于加标签 / 同源重组）">不完全配对</span>}</td>
                  <td className="py-1 pr-2 tabular-nums text-gray-500">{p.info ? `${p.info.len} nt` : "—"}</td>
                  <td className="py-1 pr-2 tabular-nums text-gray-500">{p.info ? `${p.info.tm.toFixed(1)}°C` : "—"}</td>
                  <td className="py-1 pr-2 text-gray-600">{p.hit ? <>{`${p.hit.pos} (${p.hit.strand})`}{p.hit.mm > 0 && <span className="ml-1 text-[8px] px-1 rounded bg-orange-100 text-orange-600 align-middle" title="结合区存在错配（定点突变引物）">错配{p.hit.mm}</span>}</> : <span className="text-gray-300">未匹配</span>}</td>
                  <td className="py-1 pr-2 text-gray-500">{p.tagId ? (tagById(p.tagId)?.name || p.tagId) : "—"}</td>
                  <td><button onClick={(e) => { e.stopPropagation(); onRemove(p.id); }} className="p-0.5 text-gray-300 hover:text-red-400"><Trash2 size={11} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ==================== 引物详情弹窗（点9：名称/Tm/配对/产物/可编辑序列） ====================
function PrimerDetail({ primer, mapped, onSave, onDelete, onClose }) {
  const [name, setName] = useState(primer.name);
  const [seq, setSeq] = useState(primer.seq);
  const info = analyzePrimer(seq);
  const pair = findPair(primer, mapped);
  const tag = primer.tagId ? tagById(primer.tagId) : null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-[fadeIn_.18s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Pencil size={14} className="text-cyan-600" />引物详情</span>
          <button onClick={onClose} className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-14 flex-shrink-0">名称</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-cyan-200" />
            {primer.tagId && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600" title={`${tag?.name} · 悬挂区 ${primer.seq.length - primerBinding(primer).bindLen} nt 不与模板配对`}>不完全配对</span>}
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {[["长度", info ? `${info.len} nt` : "—"], ["Tm (NN法)", info ? `${info.tm.toFixed(1)}°C` : "—"], ["GC%", info ? info.gc.toFixed(0) : "—"], ["结合区", `${primer.bindLen || (info ? info.len : 0)} nt`]].map(([l, v]) => (
              <div key={l} className="bg-gray-50 rounded-lg py-1.5"><div className="text-[11px] font-bold text-gray-700 tabular-nums">{v}</div><div className="text-[9px] text-gray-400">{l}</div></div>
            ))}
          </div>
          <div className="text-[10px] text-gray-500 bg-cyan-50 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
            <span>定位：{primer.hit ? `${primer.hit.pos} · ${primer.hit.strand === "+" ? "正链 →" : "负链 ←"}${primer.hit.mm ? ` · 错配 ${primer.hit.mm}（定点突变）` : ""}` : "未在当前质粒上匹配"}</span>
            {tag && <span>Tag：{tag.name}{primer.linker ? " + GGGGS" : ""}</span>}
          </div>
          {pair ? (
            <div className="text-[10px] text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5">
              配对引物 <b>{pair.q.name}</b> · 互补区产物 <b className="tabular-nums">{pair.end - pair.start + 1} bp</b>
              {pair.full > pair.end - pair.start + 1 && <> · 含 5′ 悬挂共 <b className="tabular-nums">{pair.full} bp</b></>}
            </div>
          ) : (
            <div className="text-[10px] text-gray-400 bg-gray-50 rounded-lg px-2.5 py-1.5">未找到反向配对引物（产物长度需一对正/反向引物）</div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400">序列 5′→3′（可编辑）</span>
              <span className="text-[10px] tabular-nums text-gray-400">{cleanSeq(seq).length} nt</span>
            </div>
            <textarea value={seq} onChange={(e) => setSeq(e.target.value)} rows={3} spellCheck={false}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-cyan-200" />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button onClick={() => onDelete(primer.id)} className="px-3 py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-1"><Trash2 size={12} />删除</button>
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50">取消</button>
          <button onClick={() => onSave(primer.id, { name: name.trim() || primer.name, seq: cleanSeq(seq) || primer.seq })}
            disabled={!cleanSeq(seq)} className="flex-1 py-2 bg-cyan-600 text-white text-xs font-medium rounded-lg hover:bg-cyan-700 disabled:opacity-40 flex items-center justify-center gap-1"><Check size={12} />保存</button>
        </div>
      </div>
    </div>
  );
}

// ==================== 新建引物弹窗（点8/12：选区 → 正/反向 + Tag + 连接肽） ====================
function PrimerBuilder({ plasmid, sel, primers, onAdd, onClose }) {
  const bindRaw = plasmid.seq.slice(sel.a, sel.b + 1);
  const [name, setName] = useState(() => `${plasmid.name}-${primers.length + 1}`);
  const [dir, setDir] = useState("fwd");
  const [tagId, setTagId] = useState("");
  const [tagPos, setTagPos] = useState("5");
  const [linker, setLinker] = useState(false);
  const tag = tagId ? tagById(tagId) : null;
  const bind = dir === "fwd" ? bindRaw : revComp(bindRaw);
  const over5 = tagPos === "5" && tag ? tag.seq + (linker ? LINKER.seq : "") : "";
  const over3 = tagPos === "3" && tag ? (linker ? LINKER.seq : "") + tag.seq : "";
  const finalSeq = over5 + bind + over3;
  const info = analyzePrimer(finalSeq);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-[fadeIn_.18s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Plus size={14} className="text-cyan-600" />新建引物
            <span className="text-[10px] font-normal text-gray-400 tabular-nums">选区 {sel.a + 1}–{sel.b + 1} · {bindRaw.length} bp</span>
          </span>
          <button onClick={onClose} className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-14 flex-shrink-0">名称</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-cyan-200" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-400 w-14 flex-shrink-0">方向</span>
            {[["fwd", "正向（与选区同链 5′→3′）"], ["rev", "反向（自动取反向互补）"]].map(([k, l]) => (
              <button key={k} onClick={() => setDir(k)} className={`px-2 py-1 text-[10px] border rounded-lg transition ${dir === k ? "bg-cyan-600 text-white border-cyan-700" : "bg-white text-gray-600 border-gray-200 hover:border-cyan-300"}`}>{l}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-400 w-14 flex-shrink-0">Tag</span>
            <select value={tagId} onChange={(e) => setTagId(e.target.value)} className="px-2 py-1 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-cyan-200 bg-white">
              <option value="">无 Tag</option>
              {TAGS.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.note}</option>)}
            </select>
            {tag && (
              <>
                {[["5", "加在 5′ 端（序列前）"], ["3", "加在 3′ 端（序列后）"]].map(([k, l]) => (
                  <button key={k} onClick={() => setTagPos(k)} className={`px-2 py-1 text-[10px] border rounded-lg transition ${tagPos === k ? "bg-orange-500 text-white border-orange-600" : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"}`}>{l}</button>
                ))}
                <button onClick={() => setLinker((v) => !v)} className={`px-2 py-1 text-[10px] border rounded-lg transition ${linker ? "bg-emerald-500 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"}`}>GGGGS 连接肽</button>
              </>
            )}
          </div>
          {tag && <div className="text-[10px] text-orange-600 bg-orange-50 rounded-lg px-2.5 py-1.5">Tag 区（{over5.length + over3.length} nt）为 5′/3′ 悬挂，不与模板配对 —— 用于加标签或同源重组臂。</div>}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400">引物序列 5′→3′</span>
              <span className="text-[10px] tabular-nums text-gray-400">{finalSeq.length} nt · Tm {info ? info.tm.toFixed(1) : "—"}°C · GC {info ? info.gc.toFixed(0) : "—"}%</span>
            </div>
            <div className="px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] font-mono break-all leading-relaxed bg-gray-50">
              {over5 && <span className="text-orange-600" title="Tag/连接肽悬挂区">{over5}</span>}
              <span className="text-gray-800" title="模板结合区">{bind}</span>
              {over3 && <span className="text-orange-600" title="Tag/连接肽悬挂区">{over3}</span>}
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50">取消</button>
          <button onClick={() => onAdd({ id: gid(), name: name.trim() || "引物", seq: finalSeq, bindLen: bind.length, tagId: tagId || null, tagPos, linker: !!tag && linker })}
            className="flex-1 py-2 bg-cyan-600 text-white text-xs font-medium rounded-lg hover:bg-cyan-700 flex items-center justify-center gap-1"><Plus size={12} />添加引物</button>
        </div>
      </div>
    </div>
  );
}

// ---------- 分段渲染比对行（将连续同样式字符合并为单个 span，避免上万 DOM 节点白屏） ----------
function AlnRow({ label, seq, other, labelCls, diffCls, matchCls, gapCls }) {
  const chunks = useMemo(() => {
    const out = [];
    let cls = null, start = 0;
    for (let i = 0; i <= seq.length; i++) {
      let c;
      if (i < seq.length) {
        const ch = seq[i], o = other[i];
        c = ch === "-" ? gapCls : ch !== o ? diffCls : matchCls;
      }
      if (i === seq.length || c !== cls) {
        if (i > start) out.push({ t: seq.slice(start, i), c: cls });
        cls = c; start = i;
      }
    }
    return out;
  }, [seq, other, diffCls, matchCls, gapCls]);
  return (
    <div className="font-mono text-[10px] leading-[16px] whitespace-pre-wrap break-all">
      <span className={`select-none mr-1 ${labelCls}`}>{label}</span>
      {chunks.map((ck, i) => <span key={i} className={ck.c}>{ck.t}</span>)}
    </div>
  );
}

// ---------- fastAlign 分段渲染（match=灰色整块 / aligned=逐段着色 / var=色块标注） ----------
function AlnSegments({ segments }) {
  if (!segments || !segments.length) return null;
  const refParts = [], qryParts = [];
  let rk = 0, qk = 0;
  for (const seg of segments) {
    if (seg.type === "match") {
      const s = seg.seq;
      if (s.length > 60) {
        // 长保守块折叠：首尾各10bp + 中间标注
        const head = s.slice(0, 10), tail = s.slice(-10);
        const mid = `══${s.length - 20}bp══`;
        refParts.push(<span key={`r${rk++}`}><span className="text-gray-600">{head}</span><span className="text-emerald-500 text-[9px]">{mid}</span><span className="text-gray-600">{tail}</span></span>);
        qryParts.push(<span key={`q${qk++}`}><span className="text-gray-600">{head}</span><span className="text-emerald-500 text-[9px]">{mid}</span><span className="text-gray-600">{tail}</span></span>);
      } else {
        refParts.push(<span key={`r${rk++}`} className="text-gray-600">{s}</span>);
        qryParts.push(<span key={`q${qk++}`} className="text-gray-600">{s}</span>);
      }
    } else if (seg.type === "aligned") {
      // 分段着色（合并连续同样式）
      const { alnRef, alnQry } = seg;
      const rChunks = [], qChunks = [];
      let rc = null, rs = 0, qc = null, qs = 0;
      for (let i = 0; i <= alnRef.length; i++) {
        let rcls, qcls;
        if (i < alnRef.length) {
          const rch = alnRef[i], qch = alnQry[i];
          rcls = rch === "-" ? "text-gray-300" : rch !== qch ? "bg-red-100 text-red-700 font-bold rounded-sm" : "text-gray-600";
          qcls = qch === "-" ? "text-gray-300" : qch !== rch ? "bg-red-500 text-white font-bold rounded-sm" : "text-gray-600";
        }
        if (i === alnRef.length || rcls !== rc) { if (i > rs) rChunks.push({ t: alnRef.slice(rs, i), c: rc }); rc = rcls; rs = i; }
        if (i === alnRef.length || qcls !== qc) { if (i > qs) qChunks.push({ t: alnQry.slice(qs, i), c: qc }); qc = qcls; qs = i; }
      }
      refParts.push(<span key={`r${rk++}`}>{rChunks.map((c, i) => <span key={i} className={c.c}>{c.t}</span>)}</span>);
      qryParts.push(<span key={`q${qk++}`}>{qChunks.map((c, i) => <span key={i} className={c.c}>{c.t}</span>)}</span>);
    } else {
      // var 大块：色块 + 长度标注
      const rLen = seg.ref.length, qLen = seg.qry.length;
      refParts.push(<span key={`r${rk++}`} className="bg-amber-100 text-amber-700 rounded-sm px-0.5 text-[9px]">▨{rLen}bp</span>);
      qryParts.push(<span key={`q${qk++}`} className="bg-amber-100 text-amber-700 rounded-sm px-0.5 text-[9px]">▨{qLen}bp</span>);
    }
  }
  return (
    <>
      <div className="font-mono text-[10px] leading-[16px] whitespace-pre-wrap break-all">
        <span className="select-none mr-1 text-indigo-600 font-bold">REF</span>
        {refParts}
      </div>
      <div className="font-mono text-[10px] leading-[16px] whitespace-pre-wrap break-all">
        <span className="select-none mr-1 text-gray-400">QRY</span>
        {qryParts}
      </div>
    </>
  );
}

// ==================== 比对面板（点3c：到当前质粒 / 独立输入 / 质粒间；自动双向） ====================
function AlignPanel({ refPlasmid, queries, plasmids, activeId, setActiveId, alignIds, toggleAlign, removePlasmid, onImportAlign }) {
  const [mode, setMode] = useState("toRef"); // "toRef" | "input" | "plasmid"
  const [toRefText, setToRefText] = useState("");
  const [toRefResults, setToRefResults] = useState([]);
  const [alignInput, setAlignInput] = useState("");
  const [parsedInput, setParsedInput] = useState([]);
  const [refIdx, setRefIdx] = useState(0);
  const [alnResults, setAlnResults] = useState([]);
  const [plasmidAlns, setPlasmidAlns] = useState([]);

  // 解析 FASTA 或多行纯序列（≥6bp，支持短片段）
  const parseSeqs = (text) => {
    const t = text.trim();
    if (!t) return [];
    const seqs = [];
    if (/^>/.test(t)) {
      t.split(/(?=^>)/m).forEach((chunk) => {
        const lines = chunk.trim().split(/\r?\n/);
        const name = lines[0].slice(1).trim().split(/\s+/)[0] || `seq-${seqs.length + 1}`;
        const s = cleanSeq(lines.slice(1).join(""));
        if (s.length >= 6) seqs.push({ name, seq: s });
      });
    } else {
      t.split(/\r?\n/).forEach((line, i) => {
        const s = cleanSeq(line);
        if (s.length >= 6) seqs.push({ name: `seq-${i + 1}`, seq: s });
      });
    }
    return seqs;
  };

  const mkResult = (refSeq, q) => {
    const r = alignBest(refSeq, q.seq);
    return { q, segments: r.segments, identity: r.identity * 100, gaps: r.gaps, strand: r.strand };
  };

  // 「到当前质粒」：每条输入序列比对到主选质粒（自动双向 + 裁剪悬垂端 + 定位区间）
  const runToRef = () => {
    if (!refPlasmid) return;
    const seqs = parseSeqs(toRefText);
    setToRefResults(seqs.map((q) => {
      const r = alignToReference(refPlasmid.seq, q.seq);
      return { q, segments: r.segments, identity: r.identity * 100, gaps: r.gaps, strand: r.strand, refStart: r.refStart, refEnd: r.refEnd };
    }));
  };
  // 「独立输入」：选定参照后逐条比对
  const handleInputAlign = () => {
    const seqs = parseSeqs(alignInput);
    setParsedInput(seqs);
    if (seqs.length < 2) { setAlnResults([]); return; }
    const ri = Math.min(refIdx, seqs.length - 1);
    setAlnResults(seqs.filter((_, i) => i !== ri).map((q) => mkResult(seqs[ri].seq, q)));
  };
  // 「质粒间」：主选为参照，副选逐条比对
  const runPlasmidAlign = () => {
    if (!refPlasmid || queries.length === 0) return;
    setPlasmidAlns(queries.map((q) => mkResult(refPlasmid.seq, q)));
  };

  const idBadge = (id) => `text-[9px] px-1.5 py-0.5 rounded-full tabular-nums ${id >= 95 ? "bg-emerald-100 text-emerald-700" : id >= 80 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`;
  const ResultCard = ({ r, refLen }) => (
    <div className="border border-gray-100 rounded-xl p-2.5 overflow-x-auto">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-[11px] font-medium text-gray-700">{r.q.name}</span>
        <span className="text-[9px] text-gray-400 tabular-nums">{r.q.seq.length} bp{refLen != null ? ` · Δ${r.q.seq.length - refLen >= 0 ? "+" : ""}${r.q.seq.length - refLen}` : ""}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${r.strand === "−" ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500"}`} title={r.strand === "−" ? "自动以反向互补方向比对（一致度更高）" : "正向比对"}>{r.strand === "−" ? "↺ 反向互补" : "→ 正向"}</span>
        {r.refStart != null && r.refEnd > r.refStart && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 tabular-nums" title="读段在参照上的定位区间">定位 {r.refStart + 1}..{r.refEnd}</span>}
        <span className={idBadge(r.identity)}>{r.identity.toFixed(1)}% 一致</span>
        {r.gaps > 0 && <span className="text-[9px] text-amber-600 tabular-nums">{r.gaps} gap</span>}
      </div>
      <div className="bg-indigo-50/60 rounded-lg px-1.5 py-1">
        <AlnSegments segments={r.segments} />
      </div>
    </div>
  );

  const MODES = [["toRef", "到当前质粒"], ["input", "独立输入"], ["plasmid", "质粒间比对"]];

  return (
    <div className="pixel-panel p-3">
      <div className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1"><GitCompare size={13} className="text-emerald-600" />序列比对
        <HelpTip text="「到当前质粒」：粘贴 Sanger 读段/序列，逐条比对到主选质粒（自动判定正向/反向互补）；「独立输入」：粘贴多条 FASTA/序列并指定参照；「质粒间」：勾选已加载质粒比对。红色=错配，灰色=保守，琥珀=大片段变异。计算均由按钮触发。" />
      </div>

      <div className="flex gap-1 mb-2">
        {MODES.map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)}
            className={`px-2.5 py-1 text-[10px] border rounded-lg transition ${mode === k ? "bg-emerald-600 text-white border-emerald-700" : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"}`}>{l}</button>
        ))}
      </div>

      {/* 到当前质粒（参考比对） */}
      {mode === "toRef" && (
        !refPlasmid ? (
          <div className="text-[10px] text-gray-300 py-3 text-center">请先在上方读取质粒，再粘贴读段比对到该质粒</div>
        ) : (
          <div className="space-y-2.5">
            <div className="text-[10px] text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5">参照（主选）：<b className="text-indigo-600">{refPlasmid.name}</b> · {refPlasmid.seq.length} bp · {refPlasmid.circular ? "环状" : "线性"}</div>
            <div>
              <div className="text-[10px] text-gray-400 mb-1">粘贴读段 / 序列（FASTA 可多条，或每行一条纯序列；自动取反向互补中更优方向）</div>
              <textarea value={toRefText} onChange={(e) => setToRefText(e.target.value)} rows={4}
                placeholder={">read1\nATGCGATCG...\n>read2\nATGCGATCG..."}
                className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-[11px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              <div className="flex gap-2 mt-1.5">
                <button onClick={runToRef} disabled={!toRefText.trim()} className="px-3 py-1.5 text-[11px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40">比对到 {refPlasmid.name}</button>
                <button onClick={() => { setToRefText(""); setToRefResults([]); }} className="px-3 py-1.5 text-[11px] border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">清空</button>
              </div>
            </div>
            {toRefResults.length > 0 && (
              <div className="space-y-3">
                <div className="text-[10px] text-gray-500">{toRefResults.length} 条读段已比对到 {refPlasmid.name}</div>
                {toRefResults.map((r, i) => <ResultCard key={i} r={r} refLen={refPlasmid.seq.length} />)}
              </div>
            )}
          </div>
        )
      )}

      {/* 独立输入（多序列，参照可选） */}
      {mode === "input" && (
        <div className="space-y-2.5">
          <div>
            <div className="text-[10px] text-gray-400 mb-1">粘贴序列（FASTA 格式或多行纯序列）</div>
            <textarea value={alignInput} onChange={(e) => setAlignInput(e.target.value)} rows={5}
              placeholder={">reference\nATGCGATCG...\n>sample1\nATGCGATCG..."}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-[11px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            <div className="flex gap-2 mt-1.5 items-center flex-wrap">
              <button onClick={handleInputAlign} disabled={!alignInput.trim()} className="px-3 py-1.5 text-[11px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40">开始比对</button>
              <button onClick={() => { setAlignInput(""); setParsedInput([]); setAlnResults([]); setRefIdx(0); }} className="px-3 py-1.5 text-[11px] border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">清空</button>
              {parsedInput.length >= 2 && (
                <label className="flex items-center gap-1 text-[10px] text-gray-500 ml-auto">参照
                  <select value={Math.min(refIdx, parsedInput.length - 1)} onChange={(e) => setRefIdx(+e.target.value)}
                    className="px-1.5 py-0.5 border border-gray-200 rounded-md text-[10px] bg-white focus:outline-none">
                    {parsedInput.map((s, i) => <option key={i} value={i}>{s.name} ({s.seq.length}bp)</option>)}
                  </select>
                  <span className="text-gray-300">改参照后请重新比对</span>
                </label>
              )}
            </div>
          </div>
          {alnResults.length > 0 && (
            <div className="space-y-3">
              <div className="text-[10px] text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5">参照：<b>{parsedInput[Math.min(refIdx, parsedInput.length - 1)]?.name}</b> · {alnResults.length} 条比对序列</div>
              {alnResults.map((r, i) => <ResultCard key={i} r={r} refLen={parsedInput[Math.min(refIdx, parsedInput.length - 1)]?.seq.length} />)}
            </div>
          )}
          {parsedInput.length > 0 && parsedInput.length < 2 && alnResults.length === 0 && (
            <div className="text-[10px] text-gray-400 py-3 text-center">至少需要 2 条序列才能比对</div>
          )}
        </div>
      )}

      {/* 质粒间比对 */}
      {mode === "plasmid" && (
        <>
          {!refPlasmid ? (
            <div className="text-[10px] text-gray-300 py-3 text-center">请先在上方读取质粒</div>
          ) : (<>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] text-gray-400">导入质粒文件作为副选参与比对（不影响主选）</span>
              <label className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer flex-shrink-0">
                <Upload size={11} />导入质粒
                <input type="file" multiple accept=".gb,.gbk,.gbff,.fasta,.fa,.fna,.txt,.seq,.dna" className="hidden"
                  onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length && onImportAlign) onImportAlign(fs); }} />
              </label>
            </div>
            <div className="border border-gray-100 rounded-xl p-2 mb-2.5 space-y-0.5 max-h-44 overflow-y-auto">
              {plasmids.map((p) => {
                const isRef = p.id === activeId;
                const checked = alignIds.includes(p.id);
                return (
                  <div key={p.id} className={`flex items-center gap-2 px-2 py-1 rounded-lg ${isRef ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
                    <input type="checkbox" className="accent-emerald-500 w-3 h-3 shrink-0" disabled={isRef} checked={!isRef && checked}
                      onChange={() => toggleAlign(p.id)} title={isRef ? "主选质粒默认参与比对" : "勾选为副选，参与比对"} />
                    <button onClick={() => !isRef && setActiveId(p.id)}
                      className={`flex-1 text-left text-[11px] truncate ${isRef ? "font-bold text-indigo-700" : "text-gray-600 hover:text-gray-900"}`}
                      title="点击设为主选（参照）">{p.name}</button>
                    <span className="text-[9px] text-gray-400 tabular-nums shrink-0">{p.seq.length} bp</span>
                    {isRef && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500 text-white shrink-0">主选</span>}
                    {!isRef && checked && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">副选</span>}
                    <button onClick={() => removePlasmid(p.id)} className="text-gray-300 hover:text-red-500 shrink-0" title="移除该质粒"><Trash2 size={12} /></button>
                  </div>
                );
              })}
              {plasmids.length === 0 && <div className="text-[10px] text-gray-300 py-1 px-2">暂无质粒</div>}
            </div>
            <div className="text-[10px] text-gray-400 mb-2">参照：<b className="text-indigo-600">{refPlasmid.name}</b> · {refPlasmid.seq.length} bp{queries.length > 0 ? ` · 副选 ${queries.length} 个` : ""}</div>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={runPlasmidAlign} disabled={queries.length === 0}
                className="px-3 py-1.5 text-[11px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-default">开始比对</button>
              {plasmidAlns.length > 0 && <span className="text-[9px] text-gray-400">已完成 {plasmidAlns.length} 组比对</span>}
            </div>
            <div className="space-y-3">
              {plasmidAlns.map((r) => <ResultCard key={r.q.id} r={r} refLen={refPlasmid.seq.length} />)}
              {queries.length === 0 && <div className="text-[10px] text-gray-300 py-2 text-center">勾选副选质粒开始比对</div>}
            </div>
          </>)}
        </>
      )}
    </div>
  );
}

// ==================== 质粒窗口条（点2：长按拖拽调序 + ▲▼ + × 关闭） ====================
function PlasmidTab({ p, active, isFirst, isLast, onSelect, onClose, onMoveLeft, onMoveRight, dragId, onPointerDown }) {
  return (
    <div onClick={onSelect} data-drag-id={p.id} data-flip-key={p.id}
      onPointerDown={(e) => onPointerDown && onPointerDown(e, p.id)}
      title={`${p.name} · ${p.seq.length} bp · ${p.circular ? "环状" : "线性"}${active ? "（主选）" : "　点击设为主选"}`}
      className={`group flex items-center gap-1.5 px-2.5 py-1.5 border rounded-t-lg cursor-pointer select-none whitespace-nowrap flex-shrink-0 transition-colors
        ${active
          ? "bg-[var(--px-paper)] border-[var(--px-ink)] border-b-[var(--px-paper)] -mb-px relative z-10"
          : "bg-black/[0.03] border-transparent hover:bg-black/[0.06]"}
        ${dragId === p.id ? "lpd-dragging" : ""}`}>
      {/* 拓扑标记：环状画圈，线性画线 */}
      <svg width="11" height="11" viewBox="0 0 12 12" className="flex-shrink-0">
        {p.circular
          ? <circle cx="6" cy="6" r="4" fill="none" strokeWidth="1.8" style={{ stroke: active ? "var(--px-accent)" : "var(--map-dim)" }} />
          : <line x1="1.5" y1="6" x2="10.5" y2="6" strokeWidth="1.8" strokeLinecap="round" style={{ stroke: active ? "var(--px-accent)" : "var(--map-dim)" }} />}
      </svg>
      <span className={`text-[11px] max-w-[150px] truncate ${active ? "font-bold" : "font-medium"}`}
        style={{ color: active ? "var(--px-accent)" : "var(--map-dim)" }}>{p.name}</span>
      <span className="text-[9px] tabular-nums flex-shrink-0" style={{ color: "var(--map-faint)" }}>{p.seq.length}bp</span>
      {active && (
        <span className="flex items-center flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onMoveLeft && onMoveLeft(); }} disabled={isFirst}
            className="p-0.5 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-default" style={{ color: "var(--map-faint)" }}
            title="左移（也可长按标签拖拽调序）"><ChevronLeft size={11} /></button>
          <button onClick={(e) => { e.stopPropagation(); onMoveRight && onMoveRight(); }} disabled={isLast}
            className="p-0.5 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-default" style={{ color: "var(--map-faint)" }}
            title="右移（也可长按标签拖拽调序）"><ChevronRight size={11} /></button>
        </span>
      )}
      <button onClick={(e) => { e.stopPropagation(); onClose(); }}
        className={`p-0.5 rounded flex-shrink-0 transition-opacity hover:text-red-500 ${active ? "opacity-60" : "opacity-0 group-hover:opacity-60"}`}
        style={{ color: "var(--map-dim)" }} title="关闭该质粒"><X size={11} /></button>
    </div>
  );
}

// ==================== 底部状态栏（SnapGene 式：长度 / 拓扑 / 选区 / GC / Tm） ====================
function StatusBar({ plasmid, sel, featCount, siteCount, primerCount, onGotoSeq, onBuildPrimer }) {
  const selLen = sel && sel.b >= sel.a ? sel.b - sel.a + 1 : 0;
  // GC 为 O(n) 扫描，按选区缓存；Tm 仅对引物尺度（≤120 bp）计算，长选区的 Tm 无生物学意义
  const stat = useMemo(() => {
    if (!plasmid || !selLen) return null;
    const sub = plasmid.seq.slice(sel.a, sel.b + 1);
    const gc = sub.length ? ((sub.match(/[GC]/g) || []).length / sub.length) * 100 : 0;
    return { gc, tm: sub.length <= 120 ? primerTm(sub) : null };
  }, [plasmid, sel, selLen]);

  const CHIP = "px-1.5 py-0.5 rounded border bg-white flex items-center gap-0.5 hover:border-indigo-300 hover:text-indigo-600";
  return (
    <div className="flex items-center gap-2.5 flex-wrap px-3 py-1 mt-2 pixel-inset bg-white text-[10px] flex-shrink-0 min-h-[28px]">
      <span className="font-semibold" style={{ color: "var(--map-fg)" }}>{plasmid.name}</span>
      <span className="tabular-nums" style={{ color: "var(--map-dim)" }}>{plasmid.seq.length} bp</span>
      <span className="px-1.5 py-0.5 rounded-full text-[9px]"
        style={{ background: "var(--px-ink-soft)", color: "var(--map-dim)" }}>{plasmid.circular ? "环状" : "线性"}</span>
      <span style={{ color: "var(--map-faint)" }}>│</span>
      {selLen > 0 ? (
        <>
          <span className="tabular-nums font-medium" style={{ color: "var(--px-accent)" }}>选区 {sel.a + 1}–{sel.b + 1}</span>
          <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold tabular-nums">{selLen} bp</span>
          <span className="tabular-nums" style={{ color: "var(--map-dim)" }}>GC {stat.gc.toFixed(1)}%</span>
          {stat.tm != null && <span className="tabular-nums" style={{ color: "var(--map-dim)" }}>Tm {stat.tm.toFixed(1)}°C</span>}
          <button onClick={onGotoSeq} className={CHIP} style={{ borderColor: "var(--px-ink)", color: "var(--map-dim)" }}
            title="跳到序列视图并定位该区段"><Crosshair size={10} />序列定位</button>
          <button onClick={onBuildPrimer} className={CHIP} style={{ borderColor: "var(--px-ink)", color: "var(--map-dim)" }}
            title="以该区段为结合区新建引物"><Plus size={10} />引物</button>
        </>
      ) : (
        <span style={{ color: "var(--map-dim)" }}>未选择区段 · 序列视图拖选，或在图谱 / 列表中点击元件</span>
      )}
      <span className="ml-auto tabular-nums" style={{ color: "var(--map-faint)" }}>{featCount} 元件 · {siteCount} 位点 · {primerCount} 引物</span>
    </div>
  );
}

// ==================== 引导页（点4：空心环动画 + 四种入口） ====================
function CloningEntry({ onFiles, onPaste, onFragment, onDemo }) {
  const fileRef = useRef(null);
  const opts = [
    { k: "file", icon: Upload, title: "质粒文件输入", desc: "GenBank / FASTA / SnapGene .dna，可多选", act: () => fileRef.current && fileRef.current.click() },
    { k: "paste", icon: ClipboardPaste, title: "粘贴序列", desc: "GenBank 全文 / FASTA / 纯 ATGC 序列", act: onPaste },
    { k: "fragment", icon: Dna, title: "片段输入", desc: "命名一段线性短片段（插入子 / 引物二聚体等）", act: onFragment },
    { k: "demo", icon: FlaskConical, title: "示例质粒", desc: "打开 pDemo-1 演示载体（含元件 / 酶切 / 引物）", act: onDemo },
  ];
  return (
    <div className="flex flex-col items-center justify-center py-12 cloning-fade-up">
      <input ref={fileRef} type="file" multiple accept=".gb,.gbk,.gbff,.fasta,.fa,.fna,.txt,.seq,.dna" className="hidden"
        onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) onFiles(fs); }} />
      {/* 空心环动画 */}
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full cloning-ring-spin">
          <circle cx="60" cy="60" r="48" fill="none" stroke="var(--px-ink)" strokeWidth="1.5" opacity="0.35" />
          <circle cx="60" cy="60" r="48" fill="none" stroke="var(--px-accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray="300" className="cloning-ring-draw" />
          <circle cx="60" cy="12" r="3.5" fill="var(--px-accent)" className="cloning-ring-pulse" />
          <circle cx="60" cy="60" r="30" fill="none" stroke="var(--px-accent)" strokeWidth="1" opacity="0.25" strokeDasharray="4 4" />
        </svg>
      </div>
      <div className="mt-6 text-base font-semibold text-gray-700 px-title">从一个质粒或一段序列开始</div>
      <div className="mt-1.5 text-[11px] text-gray-400">选择下方任一方式进入质粒工作台</div>
      <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {opts.map((o, i) => (
          <button key={o.k} onClick={o.act}
            className="pixel-panel flex items-start gap-3 p-4 text-left hover:-translate-y-0.5 transition-transform cloning-fade-up"
            style={{ animationDelay: `${0.08 * i}s` }}>
            <span className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <o.icon size={17} className="text-indigo-600" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-800">{o.title}</span>
              <span className="block text-[11px] text-gray-400 mt-0.5 leading-relaxed">{o.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ==================== 片段输入弹窗（点3c/4：命名线性短片段） ====================
function FragmentDialog({ onAdd, onClose }) {
  const [name, setName] = useState("片段 1");
  const [seq, setSeq] = useState("");
  const cleaned = cleanSeq(seq);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-[fadeIn_.18s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Dna size={14} className="text-indigo-600" />片段输入</span>
          <button onClick={onClose} className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-14 flex-shrink-0">名称</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400">序列（自动去除空格 / 数字 / 换行，转大写）</span>
              <span className="text-[10px] tabular-nums text-gray-400">{cleaned.length} bp · 线性</span>
            </div>
            <textarea value={seq} onChange={(e) => setSeq(e.target.value)} rows={5} spellCheck={false}
              placeholder="粘贴或输入 ATGC 序列（可含空格/数字/换行，≥6 bp）"
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-[11px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
          <div className="text-[10px] text-gray-400 bg-gray-50 rounded-lg px-2.5 py-1.5">片段按线性序列处理；如需环状质粒请用「质粒文件输入」或「粘贴序列」（GenBank 可标注环状）。</div>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50">取消</button>
          <button onClick={() => onAdd({ name: name.trim() || "片段", seq: cleaned })} disabled={cleaned.length < 6}
            className="flex-1 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center gap-1"><Plus size={12} />载入片段</button>
        </div>
      </div>
    </div>
  );
}

// ==================== 主组件 ====================
// 模块级缓存：质粒页懒加载组件每次切入会重挂载，用缓存即时恢复状态，避免空态引导页闪现（点2修复）
let _cloneCache = null;

export default function Cloning() {
  const [plasmids, setPlasmids] = useState(() => _cloneCache?.plasmids || []);
  const [activeId, setActiveId] = useState(() => _cloneCache?.activeId || null);
  const [alignIds, setAlignIds] = useState(() => _cloneCache?.alignIds || []);
  // 点7：引物按质粒存储 { [plasmidId]: [primer, ...] }，随当前质粒切换
  const [primersByPlasmid, setPrimersByPlasmid] = useState(() => _cloneCache?.primersByPlasmid || {});
  // 点6：酶切位点显示开关（存酶名，未列出的默认显示）
  const [hiddenEnzymes, setHiddenEnzymes] = useState([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [fileDrag, setFileDrag] = useState(false); // 拖拽文件进入工作区的高亮态
  const [loaded, setLoaded] = useState(() => !!_cloneCache);
  const [sel, setSel] = useState(null);          // 序列选区 {a, b}（0基含端点）
  const [builderOpen, setBuilderOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [toastFn, setToastFn] = useState(null);
  const [focusReq, setFocusReq] = useState(null);   // 点3a/3b：酶切/元件定位请求 {a,b,ts}
  const [fragmentOpen, setFragmentOpen] = useState(false); // 点4：片段输入弹窗
  const [view, setView] = useState("map");                 // 视图分页：map/seq/enz/feat/primer/align

  // 轻量 toast（复用全局总线）
  useEffect(() => { import("../lib/core").then((m) => setToastFn(() => m.toast)); }, []);
  const toast = (t, k) => toastFn && toastFn(t, k);

  useEffect(() => {
    // 已有缓存（切回页面）→ 状态已即时恢复，直接就绪，无闪现
    if (_cloneCache) { setLoaded(true); return; }
    // 首次挂载：异步恢复历史会话；若无保存则保持空态 → 显示引导页（空心环 + 四入口）
    loadData("cloning", null).then((d) => {
      if (d && Array.isArray(d.plasmids) && d.plasmids.length) {
        const list = d.plasmids;
        setPlasmids(list);
        const act = d.activeId && list.some((p) => p.id === d.activeId) ? d.activeId : list[0]?.id;
        setActiveId(act);
        if (d.primersByPlasmid && typeof d.primersByPlasmid === "object") setPrimersByPlasmid(d.primersByPlasmid);
        else if (Array.isArray(d.primers) && d.primers.length && act) setPrimersByPlasmid({ [act]: d.primers });
        if (Array.isArray(d.alignIds)) setAlignIds(d.alignIds);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (loaded) {
      const snap = { plasmids, activeId, primersByPlasmid, alignIds };
      _cloneCache = snap;
      saveData("cloning", snap);
    }
  }, [plasmids, activeId, primersByPlasmid, alignIds, loaded]);

  const plasmid = plasmids.find((p) => p.id === activeId) || null;
  const sites = useMemo(() => scanEnzymes(plasmid?.seq || "", plasmid?.circular), [plasmid]);
  // 点7：当前质粒的引物
  const primers = (activeId && primersByPlasmid[activeId]) || [];
  const setPrimers = (updater) => {
    if (!activeId) return;
    setPrimersByPlasmid((prev) => ({ ...prev, [activeId]: updater(prev[activeId] || []) }));
  };
  const mapped = useMemo(() =>
    primers.map((p) => {
      const { hit, bindLen, overLen } = plasmid ? mapPrimer(plasmid.seq, p, plasmid.circular) : { hit: null, bindLen: p.bindLen || p.seq.length, overLen: 0 };
      return { ...p, hit, bindLen, overLen, info: analyzePrimer(p.seq) };
    }), [primers, plasmid]);
  // 点6：线性图谱只显示未隐藏的酶切位点
  const visibleSites = useMemo(() => sites.filter((s) => !hiddenEnzymes.includes(s.name)), [sites, hiddenEnzymes]);
  const toggleEnzyme = (name) => setHiddenEnzymes((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);
  // 点8.1：主选 = 当前质粒；副选 = 勾选的其他质粒
  const queries = alignIds.map((id) => plasmids.find((p) => p.id === id)).filter((p) => p && p.id !== activeId);

  // 质粒文档标签长按拖拽调序（横向）
  const reorderPlasmids = (fromId, toId, pos) => setPlasmids((p) => arrayReorder(p, fromId, toId, pos));
  const { dragId: plasmidDragId, onPointerDown: plasmidPointerDown } = useLongPressDrag(reorderPlasmids, { axis: "x" });

  // 定位回调（1基坐标）→ 记下目标区段，序列视图挂载/收到请求时滚动到位
  const focusAt = useCallback((bp, end) => {
    const a = Math.max(0, bp - 1);
    const b = Math.max(a, (end || bp) - 1);
    setFocusReq({ a, b, ts: Date.now() });
  }, []);
  // 酶切 / 元件列表点击 → 选中并切到序列视图（SnapGene 式列表→序列联动）；
  // 图谱内点击元件只选中、留在图谱，避免视图被抢走
  const locateAndShow = useCallback((bp, end) => { focusAt(bp, end); setView("seq"); }, [focusAt]);

  // 点4：示例质粒（附演示引物）
  const loadDemo = () => {
    const demo = buildDemo();
    setPlasmids((prev) => [...prev, demo]);
    setActiveId(demo.id);
    setPrimersByPlasmid((prev) => ({
      ...prev,
      [demo.id]: [
        { id: "pf", name: "T7-F", seq: "TAATACGACTCACTATAGGG" },
        { id: "pr", name: "T7-R", seq: "GCTAGTTATTGCTCAGCGG" },
      ],
    }));
    toast(`已打开示例质粒「${demo.name}」(${demo.seq.length} bp，环状，${demo.features.length} 注释)`);
  };

  // 点3c/4：片段输入 → 线性短片段
  const addFragment = ({ name, seq }) => {
    if (!seq || seq.length < 6) return;
    const frag = { id: gid(), name, circular: false, seq, features: [] };
    setPlasmids((prev) => [...prev, frag]);
    setActiveId(frag.id);
    setFragmentOpen(false);
    toast(`已载入片段「${name}」(${seq.length} bp，线性)`);
  };

  const addPlasmids = (list) => {
    if (!list.length) return;
    const withIds = list.map((p) => ({ ...p, id: p.id || gid() }));
    setPlasmids((prev) => [...prev, ...withIds]);
    setActiveId(withIds[withIds.length - 1].id);
    toast(`已读取 ${withIds.map((p) => `「${p.name}」(${p.seq.length} bp${p.circular ? "，环状" : ""}，${p.features.length} 注释)`).join("、")}`);
  };

  const parseFiles = async (files) => {
    const out = [];
    let failed = 0;
    for (const f of files) {
      const base = f.name.replace(/\.[^.]+$/, "");
      if (/\.dna$/i.test(f.name)) {
        try {
          const buf = await f.arrayBuffer();
          const r = parseSnapGene(buf, base);
          if (r) { out.push(r); continue; }
        } catch { /* fallthrough */ }
        failed++;
        continue;
      }
      const text = await f.text();
      const rs = parseInput(text, base);
      if (rs.length) out.push(...rs); else failed++;
    }
    return { out, failed };
  };

  const handleFiles = async (files) => {
    if (!files.length) return;
    const { out, failed } = await parseFiles(files);
    addPlasmids(out);
    if (failed) toast(`${failed} 个文件无法识别（支持 .gb/.gbk/.gbff/.fasta/.txt/.dna）`, "error");
  };

  // 比对卡片独立导入：加入质粒并自动勾选为副选，但不改变主选（与工作台「读取质粒」分开）
  const handleAlignFiles = async (files) => {
    if (!files.length) return;
    const { out, failed } = await parseFiles(files);
    if (out.length) {
      const withIds = out.map((p) => ({ ...p, id: p.id || gid() }));
      setPlasmids((prev) => [...prev, ...withIds]);
      setAlignIds((prev) => [...new Set([...prev, ...withIds.map((p) => p.id)])]);
      toast(`已为比对导入 ${withIds.map((p) => `「${p.name}」(${p.seq.length} bp${p.circular ? "，环状" : ""})`).join("、")}`);
    }
    if (failed) toast(`${failed} 个文件无法识别（支持 .gb/.gbk/.gbff/.fasta/.txt/.dna）`, "error");
  };

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    await handleFiles(files);
  };

  const applyPaste = () => {
    const rs = parseInput(pasteText, "粘贴序列");
    if (rs.length) { addPlasmids(rs); setPasteOpen(false); setPasteText(""); }
    else toast("无法识别粘贴内容：支持 GenBank、FASTA（可多条）或纯 ATGC 序列", "error");
  };

  const removePlasmid = (id) => {
    setPlasmids((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (activeId === id) setActiveId(next[0]?.id || null);
      return next;
    });
    setAlignIds((prev) => prev.filter((x) => x !== id));
    setPrimersByPlasmid((prev) => { const { [id]: _drop, ...rest } = prev; return rest; });
  };
  const movePlasmid = (id, dir) => {
    setPlasmids((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const a = [...prev];
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  };
  const toggleAlign = (id) => setAlignIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const detailPrimer = detailId ? mapped.find((p) => p.id === detailId) : null;

  // 切换主选质粒：清空选区与定位请求（旧坐标对新质粒无意义）
  useEffect(() => { setSel(null); setFocusReq(null); }, [activeId]);

  // 视图区可用高度：实测容器高度下发给图谱/序列视图，避免靠累加 chrome 高度猜数
  const hasPlasmids = plasmids.length > 0;
  const bodyRef = useRef(null);
  const [bodyH, setBodyH] = useState(430);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setBodyH(Math.max(240, el.clientHeight));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [hasPlasmids]);

  return (
    <div className="relative h-full"
      onDragOver={(e) => { if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (!fileDrag) setFileDrag(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setFileDrag(false); }}
      onDrop={(e) => { const fs = [...(e.dataTransfer?.files || [])]; if (fs.length) { e.preventDefault(); setFileDrag(false); handleFiles(fs); } }}>
      {fileDrag && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-500/10 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 text-sm font-bold text-indigo-500"><Upload size={16} />松开以读取质粒文件（.gb / .fasta / .dna）</div>
        </div>
      )}

      {!hasPlasmids ? (
        /* 空态引导页（空心环 + 四入口），选择后进入质粒操作台 */
        <CloningEntry onFiles={handleFiles} onPaste={() => setPasteOpen(true)} onFragment={() => setFragmentOpen(true)} onDemo={loadDemo} />
      ) : (
        /* 工作台：工具条 → 质粒文档标签 → 视图分页 → 视图内容（占满高度）→ 状态栏 */
        <div className="flex flex-col h-full" style={{ minHeight: 430 }}>
          {/* 质粒文档标签 + 入口按钮合并成一行。
              原先这里是「标题+按钮工具条」「常驻提示横幅」「标签行」三条横带，
              内容区被压到窗口一半以下；提示横幅还因为从不清空而永久占位（已改走 toast）。
              标题也去掉了——主导航上已经高亮着「质粒工作台」，重复一次没有信息量。 */}
          <div className="flex items-end gap-2 flex-shrink-0 border-b border-[var(--px-ink)]">
            <FlipGrid orderKey={plasmids.map((p) => p.id).join(",")}
              className="flex items-end gap-0.5 px-1 flex-1 min-w-0 overflow-x-auto overflow-y-hidden">
              {plasmids.map((p, i) => (
                <PlasmidTab key={p.id} p={p} active={p.id === activeId} isFirst={i === 0} isLast={i === plasmids.length - 1}
                  onSelect={() => setActiveId(p.id)} onClose={() => removePlasmid(p.id)}
                  onMoveLeft={() => movePlasmid(p.id, -1)} onMoveRight={() => movePlasmid(p.id, 1)}
                  dragId={plasmidDragId} onPointerDown={plasmidPointerDown} />
              ))}
            </FlipGrid>
            <div className="flex items-center gap-1 flex-shrink-0 pb-1 pr-1">
              <label className="pixel-btn flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-indigo-600 cursor-pointer"
                title="读取质粒文件（可多选，支持 .gb / .gbk / .fasta / .dna）">
                <Upload size={12} />读取
                <input type="file" multiple accept=".gb,.gbk,.gbff,.fasta,.fa,.fna,.txt,.seq,.dna" className="hidden" onChange={onFiles} />
              </label>
              <button onClick={() => setPasteOpen(true)} title="粘贴 GenBank / FASTA / 纯序列"
                className="pixel-btn flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-white text-gray-700"><ClipboardPaste size={12} />粘贴</button>
              <button onClick={() => setFragmentOpen(true)} title="手动输入线性片段"
                className="pixel-btn flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-white text-gray-700"><Dna size={12} />片段</button>
              <button onClick={loadDemo} title="载入示例质粒 pDemo-1"
                className="pixel-btn flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-white text-gray-700"><FlaskConical size={12} />示例</button>
              <HelpTip text="上排标签是已打开的质粒，点击切换主选、长按拖拽或 ◀▶ 调序、× 关闭；下排是视图分页（图谱 / 序列 / 酶切 / 元件 / 引物 / 比对）。在序列上拖选区段即可新建引物；酶切与元件列表点击可跳到序列对应位置。" />
            </div>
          </div>

          {/* 视图分页 */}
          <div className="flex items-center gap-1 mt-2 flex-shrink-0 overflow-x-auto">
            {VIEW_DEFS.map(({ k, i: I, l }) => {
              const badge = k === "enz" ? new Set(sites.map((x) => x.name)).size
                : k === "feat" ? plasmid?.features.filter((f) => !(f.key === "source" && f.end - f.start + 1 >= plasmid.seq.length)).length
                : k === "primer" ? mapped.length
                : k === "align" ? queries.length : 0;
              return (
                <button key={k} onClick={() => setView(k)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border rounded-lg whitespace-nowrap flex-shrink-0 transition-colors
                    ${view === k ? "bg-indigo-600 text-white border-[var(--px-ink)] shadow-sm" : "bg-white border-[var(--px-ink)] text-gray-600 hover:text-indigo-600"}`}>
                  <I size={12} />{l}
                  {badge > 0 && <span className={`text-[9px] px-1 rounded-full tabular-nums ${view === k ? "bg-white/25" : "bg-indigo-100 text-indigo-600"}`}>{badge}</span>}
                </button>
              );
            })}
          </div>

          {/* 视图内容 */}
          <div ref={bodyRef} className="flex-1 min-h-0 mt-2 overflow-hidden">
            {!plasmid ? (
              <div className="pixel-panel h-full flex flex-col items-center justify-center">
                <Dna size={28} className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">尚未选择质粒</p>
                <p className="text-[11px] text-gray-300 mt-1">点击上方质粒标签设为主选，或读取新质粒</p>
              </div>
            ) : view === "map" ? (
              <MapView plasmid={plasmid} sites={visibleSites} mapped={mapped} sel={sel} setSel={setSel} onLocate={focusAt} height={bodyH} />
            ) : view === "seq" ? (
              <SequencePanel plasmid={plasmid} sites={visibleSites} mapped={mapped} sel={sel} setSel={setSel}
                onPrimerClick={(id) => setDetailId(id)}
                onBuildPrimer={() => setBuilderOpen(true)}
                onPasteOpen={(text) => { setPasteText(text || ""); setPasteOpen(true); }}
                toast={toast} focusReq={focusReq} height={bodyH} />
            ) : (
              <div className="h-full overflow-y-auto pr-0.5">
                {view === "enz" && <EnzymePanel sites={sites} hiddenEnzymes={hiddenEnzymes} toggleEnzyme={toggleEnzyme} onLocate={locateAndShow} />}
                {view === "feat" && <FeaturePanel plasmid={plasmid} sel={sel} onLocate={locateAndShow} />}
                {view === "primer" && <PrimerPanel mapped={mapped} onPrimerClick={(id) => setDetailId(id)} onRemove={(id) => setPrimers((prev) => prev.filter((x) => x.id !== id))} />}
                {view === "align" && (
                  <AlignPanel refPlasmid={plasmid} queries={queries} plasmids={plasmids} activeId={activeId}
                    setActiveId={setActiveId} alignIds={alignIds} toggleAlign={toggleAlign} removePlasmid={removePlasmid} onImportAlign={handleAlignFiles} />
                )}
              </div>
            )}
          </div>

          {/* 状态栏 */}
          {plasmid && (
            <StatusBar plasmid={plasmid} sel={sel}
              featCount={plasmid.features.filter((f) => !(f.key === "source" && f.end - f.start + 1 >= plasmid.seq.length)).length}
              siteCount={sites.length} primerCount={mapped.length}
              onGotoSeq={() => { if (sel && sel.b >= sel.a) focusAt(sel.a + 1, sel.b + 1); setView("seq"); }}
              onBuildPrimer={() => setBuilderOpen(true)} />
          )}
        </div>
      )}

      {/* 引物详情弹窗 */}
      {detailPrimer && (
        <PrimerDetail primer={detailPrimer} mapped={mapped}
          onSave={(id, patch) => { setPrimers((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x))); setDetailId(null); }}
          onDelete={(id) => { setPrimers((prev) => prev.filter((x) => x.id !== id)); setDetailId(null); }}
          onClose={() => setDetailId(null)} />
      )}

      {/* 新建引物弹窗 */}
      {builderOpen && plasmid && sel && sel.b >= sel.a && (
        <PrimerBuilder plasmid={plasmid} sel={sel} primers={primers}
          onAdd={(p) => { setPrimers((prev) => [...prev, p]); setBuilderOpen(false); toast(`已添加引物「${p.name}」`, "success"); }}
          onClose={() => setBuilderOpen(false)} />
      )}

      {/* 片段输入弹窗（点3c/4） */}
      {fragmentOpen && <FragmentDialog onAdd={addFragment} onClose={() => setFragmentOpen(false)} />}

      {/* 粘贴导入弹窗 */}
      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={() => setPasteOpen(false)}>
          <div className="pixel-panel shadow-2xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">粘贴序列</h3>
              <button onClick={() => setPasteOpen(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
            </div>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={8}
              placeholder={"支持：\n· GenBank 全文（LOCUS 开头）\n· FASTA（> 开头，可一次粘贴多条）\n· 纯 ATGC 序列"}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-[11px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setPasteOpen(false)} className="flex-1 py-2 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={applyPaste} disabled={!pasteText.trim()} className="flex-1 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40">读取</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
