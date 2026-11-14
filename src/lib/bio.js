// ==================== 生物信息学工具库（点7/8/12） ====================
// 序列基础操作 · 近邻法 Tm · 常用 Tag · 锚点式局部块比对（简化 Mauve/MUMmer）

export const COMP = { A: "T", T: "A", G: "C", C: "G", N: "N" };
export const revComp = (s) => s.toUpperCase().split("").reverse().map((c) => COMP[c] || "N").join("");
export const complement = (s) => s.toUpperCase().split("").map((c) => COMP[c] || "N").join("");
export const cleanSeq = (s) => String(s).toUpperCase().replace(/[^ATGCN]/g, "");
export const gid = () => Math.random().toString(36).slice(2, 10);

// ---------- 近邻法 Tm（SantaLucia 1998 统一 ΔH/ΔS + Owczarzy 盐校正） ----------
const NN_DH = { AA: -7.9, TT: -7.9, AT: -7.2, TA: -7.2, CA: -8.5, TG: -8.5, GT: -8.4, AC: -8.4, CT: -7.8, AG: -7.8, GA: -8.2, TC: -8.2, CG: -10.6, GC: -9.8, GG: -8.0, CC: -8.0 };
const NN_DS = { AA: -22.2, TT: -22.2, AT: -20.4, TA: -21.3, CA: -22.7, TG: -22.7, GT: -22.4, AC: -22.4, CT: -21.0, AG: -21.0, GA: -22.2, TC: -22.2, CG: -27.2, GC: -24.4, GG: -19.9, CC: -19.9 };

export function primerTm(seq, dnaNm = 250, saltMm = 50) {
  const s = cleanSeq(seq).replace(/N/g, "");
  if (!s.length) return null;
  if (s.length < 14) {
    const A = (s.match(/A/g) || []).length, T = (s.match(/T/g) || []).length;
    const G = (s.match(/G/g) || []).length, C = (s.match(/C/g) || []).length;
    return 2 * (A + T) + 4 * (G + C);
  }
  let dH = 0.1, dS = -2.8; // 起始项
  for (let i = 0; i < s.length - 1; i++) {
    const d = s[i] + s[i + 1];
    dH += NN_DH[d] != null ? NN_DH[d] : -8;
    dS += NN_DS[d] != null ? NN_DS[d] : -22;
  }
  const R = 1.987;
  const ct = (dnaNm * 1e-9) / 4;
  const tmC = (dH * 1000) / (dS + R * Math.log(ct)) - 273.15;
  const salt = saltMm / 1000;
  return tmC + 16.6 * Math.log10(salt / (1 + 0.7 * salt));
}

export function analyzePrimer(seq) {
  const s = cleanSeq(seq).replace(/N/g, "");
  if (!s.length) return null;
  const G = (s.match(/G/g) || []).length, C = (s.match(/C/g) || []).length;
  return { len: s.length, gc: ((G + C) / s.length) * 100, tm: primerTm(s) };
}

// ---------- 密码子表与翻译 ----------
export const CODON = {
  TTT: "F", TTC: "F", TTA: "L", TTG: "L", CTT: "L", CTC: "L", CTA: "L", CTG: "L",
  ATT: "I", ATC: "I", ATA: "I", ATG: "M", GTT: "V", GTC: "V", GTA: "V", GTG: "V",
  TCT: "S", TCC: "S", TCA: "S", TCG: "S", CCT: "P", CCC: "P", CCA: "P", CCG: "P",
  ACT: "T", ACC: "T", ACA: "T", ACG: "T", GCT: "A", GCC: "A", GCA: "A", GCG: "A",
  TAT: "Y", TAC: "Y", TAA: "*", TAG: "*", CAT: "H", CAC: "H", CAA: "Q", CAG: "Q",
  AAT: "N", AAC: "N", AAA: "K", AAG: "K", GAT: "D", GAC: "D", GAA: "E", GAG: "E",
  TGT: "C", TGC: "C", TGA: "*", TGG: "W", CGT: "R", CGC: "R", CGA: "R", CGG: "R",
  AGT: "S", AGC: "S", AGA: "R", AGG: "R", GGT: "G", GGC: "G", GGA: "G", GGG: "G",
};
export function translate(seq, frame = 0) {
  const s = cleanSeq(seq);
  const out = [];
  for (let i = frame; i + 3 <= s.length; i += 3) out.push(CODON[s.slice(i, i + 3)] || "?");
  return out.join("");
}

// ---------- 常用 Tag（点12：构建引物时加在序列前/后；5' 悬挂 → 不完全配对） ----------
export const LINKER = { id: "ggggs", name: "GGGGS 连接肽", seq: "GGTGGCGGCGGCAGC" };
export const TAGS = [
  { id: "his6", name: "His₆", seq: "CACCACCACCACCAC", note: "6×组氨酸 · 镍柱纯化" },
  { id: "flag", name: "FLAG", seq: "GATTACAAGGATGACGACGATAAG", note: "FLAG 标签 · 抗 FLAG 抗体" },
  { id: "ha", name: "HA", seq: "TACCCATACGACGTTCCAGATTACGCT", note: "HA 标签 · 流感血凝素表位" },
  { id: "myc", name: "Myc", seq: "GAGCAGAAGCTGATCTCAGAGGAGGATCTG", note: "Myc 标签 · c-Myc 表位" },
  { id: "strep", name: "Strep-II", seq: "TGGAGCCATCCGAGTTTGAAAAT", note: "Strep-tag II · Strep-Tactin" },
  { id: "v5", name: "V5", seq: "GGTAAGCCTATCCCTAACCCTCTCCTCGGTCTCGATTCTACG", note: "V5 标签 · SV5 表位" },
  { id: "t7", name: "T7", seq: "GGATCCATGACTGGATGGATGGATGG", note: "T7 标签 · MASMTGGQQMGR" },
];
export const tagById = (id) => TAGS.find((t) => t.id === id) || null;

// ---------- 锚点式局部块比对（点7：简化 Mauve / MUMmer 思路） ----------
// 1) ref 建 k-mer 索引 → 2) query 扫描并延伸为最大精确匹配锚点(≥minAnchor)
// 3) LIS 链化保持共线性 → 4) 锚点=保守块(对齐)，锚点之间=可变区(红色，不做单碱基对齐)
function lisChain(items) {
  const n = items.length;
  if (!n) return [];
  const tailVal = [], tailIdx = [], prev = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const x = items[i].rStart;
    let lo = 0, hi = tailVal.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (tailVal[m] < x) lo = m + 1; else hi = m; }
    if (lo === tailVal.length) { tailVal.push(x); tailIdx.push(i); } else { tailVal[lo] = x; tailIdx[lo] = i; }
    prev[i] = lo > 0 ? tailIdx[lo - 1] : -1;
  }
  const out = [];
  let k = tailIdx[tailVal.length - 1];
  while (k !== -1) { out.push(items[k]); k = prev[k]; }
  return out.reverse();
}

export function blockAlign(refSeq, querySeq, k = 15, minAnchor = 25) {
  const ref = cleanSeq(refSeq), qry = cleanSeq(querySeq);
  if (!ref.length || !qry.length) return { blocks: [], identity: 0, anchorBp: 0 };
  const refPos = new Map();
  for (let i = 0; i + k <= ref.length; i++) {
    const km = ref.slice(i, i + k);
    const a = refPos.get(km);
    if (a) { if (a.length < 8) a.push(i); } else refPos.set(km, [i]); // 高频 k-mer 截断，抑制重复区噪声
  }
  const anchors = [];
  let i = 0;
  while (i + k <= qry.length) {
    const hits = refPos.get(qry.slice(i, i + k));
    if (!hits) { i++; continue; }
    let best = null;
    for (const rp of hits) {
      let l = 0;
      while (i - l - 1 >= 0 && rp - l - 1 >= 0 && qry[i - l - 1] === ref[rp - l - 1]) l++;
      let r = k;
      while (i + r < qry.length && rp + r < ref.length && qry[i + r] === ref[rp + r]) r++;
      const len = l + r;
      if (len >= minAnchor && (!best || len > best.len)) best = { rStart: rp - l, qStart: i - l, len };
    }
    if (best) { anchors.push(best); i = best.qStart + best.len; } else i++;
  }
  const chain = lisChain(anchors);
  const blocks = [];
  let rPrev = 0, qPrev = 0;
  for (const a of chain) {
    if (a.rStart < rPrev || a.qStart < qPrev) continue; // 与已选块重叠则跳过
    if (a.rStart > rPrev || a.qStart > qPrev) blocks.push({ type: "var", rStart: rPrev, rLen: a.rStart - rPrev, qStart: qPrev, qLen: a.qStart - qPrev });
    blocks.push({ type: "anchor", rStart: a.rStart, rLen: a.len, qStart: a.qStart, qLen: a.len });
    rPrev = a.rStart + a.len; qPrev = a.qStart + a.len;
  }
  if (rPrev < ref.length || qPrev < qry.length) blocks.push({ type: "var", rStart: rPrev, rLen: ref.length - rPrev, qStart: qPrev, qLen: qry.length - qPrev });
  const anchorBp = chain.reduce((s, a) => s + a.len, 0);
  return { blocks, identity: ref.length ? anchorBp / ref.length : 0, anchorBp };
}

/**
 * 带状 Needleman-Wunsch 全局比对（支持中间插入/缺失）
 * 返回 { alnRef, alnQry, identity, gaps } —— 两条等长字符串，"-" 表示 gap
 * band 宽度自适应长度差 + buffer，对质粒级序列（≤20 kb）可在浏览器内完成
 */
export function nwAlign(seqA, seqB, opts = {}) {
  const a = cleanSeq(seqA), b = cleanSeq(seqB);
  const n = a.length, m = b.length;
  if (!n || !m) return { alnRef: a, alnQry: b, identity: 0, gaps: 0 };
  // 内存安全护栏：超大输入（如两条差异巨大的长序列）不做逐碱基 DP，返回 overflow 由上层降级为块显示
  if (n * m > 30000000) return { alnRef: a, alnQry: b, identity: 0, gaps: 0, overflow: true };
  // 评分参数
  const MATCH = opts.match ?? 2, MISMATCH = opts.mismatch ?? -3;
  const GAP_OPEN = opts.gapOpen ?? -5, GAP_EXT = opts.gapExt ?? -2;
  // 带宽：必须 ≥ 长度差，否则终点 (n,m) 落在带外 → rowLen 为负崩溃（修复短读段比对长质粒）
  const band = Math.max(60, Math.abs(n - m) + 40);

  const NEG = -1e9;
  // 三矩阵（M/Ix/Iy）用带状稀疏存储：每行只存 [max(0,j-band)..min(m,j+band)]
  const rowLen = (i) => Math.min(m, i + band) - Math.max(0, i - band) + 1;
  const colOff = (i) => Math.max(0, i - band);
  // 用 Float32Array 分配
  const M = [], Ix = [], Iy = [];
  for (let i = 0; i <= n; i++) {
    const len = rowLen(i);
    M.push(new Float32Array(len).fill(NEG));
    Ix.push(new Float32Array(len).fill(NEG));
    Iy.push(new Float32Array(len).fill(NEG));
  }
  const idx = (i, j) => j - colOff(i);
  // 初始化
  M[0][idx(0, 0)] = 0;
  for (let j = 1; j <= Math.min(m, band); j++) { Iy[0][idx(0, j)] = GAP_OPEN + GAP_EXT * (j - 1); }
  for (let i = 1; i <= n; i++) {
    const jLo = colOff(i), jHi = Math.min(m, i + band);
    if (jLo === 0) Ix[i][idx(i, 0)] = GAP_OPEN + GAP_EXT * (i - 1);
    for (let j = Math.max(1, jLo); j <= jHi; j++) {
      const s = a[i - 1] === b[j - 1] ? MATCH : MISMATCH;
      // M[i][j] = best(M,Ix,Iy)[i-1][j-1] + s
      const pi = i - 1, pj = j - 1;
      if (pj >= colOff(pi) && pj <= Math.min(m, pi + band)) {
        const k = idx(pi, pj);
        M[i][idx(i, j)] = Math.max(M[pi][k], Ix[pi][k], Iy[pi][k]) + s;
      }
      // Ix[i][j] (gap in b) = best from [i-1][j]
      if (j >= colOff(pi) && j <= Math.min(m, pi + band)) {
        const k = idx(pi, j);
        Ix[i][idx(i, j)] = Math.max(M[pi][k] + GAP_OPEN, Ix[pi][k] + GAP_EXT);
      }
      // Iy[i][j] (gap in a) = best from [i][j-1]
      const pj1 = j - 1;
      if (pj1 >= colOff(i) && pj1 <= Math.min(m, i + band)) {
        const k = idx(i, pj1);
        Iy[i][idx(i, j)] = Math.max(M[i][k] + GAP_OPEN, Iy[i][k] + GAP_EXT);
      }
    }
  }
  // 回溯（用数组 push + reverse 代替字符串前置，O(n) 而非 O(n²)）
  const bufA = [], bufB = [];
  let ci = n, cj = m;
  // 确定终点矩阵
  const endK = idx(n, m);
  let state = M[n][endK] >= Ix[n][endK] ? (M[n][endK] >= Iy[n][endK] ? 0 : 2) : (Ix[n][endK] >= Iy[n][endK] ? 1 : 2);
  while (ci > 0 || cj > 0) {
    if (ci === 0) { bufA.push("-"); bufB.push(b[cj - 1]); cj--; continue; }
    if (cj === 0) { bufA.push(a[ci - 1]); bufB.push("-"); ci--; continue; }
    const pi = ci - 1, pj = cj - 1;
    if (state === 0) { // came from diagonal
      bufA.push(a[ci - 1]); bufB.push(b[cj - 1]);
      // determine prev state
      if (pj >= colOff(pi) && pj <= Math.min(m, pi + band)) {
        const k = idx(pi, pj);
        const vm = M[pi][k], vx = Ix[pi][k], vy = Iy[pi][k];
        state = vm >= vx ? (vm >= vy ? 0 : 2) : (vx >= vy ? 1 : 2);
      } else state = 0;
      ci--; cj--;
    } else if (state === 1) { // gap in b (came from above)
      bufA.push(a[ci - 1]); bufB.push("-");
      if (cj >= colOff(pi) && cj <= Math.min(m, pi + band)) {
        const k = idx(pi, cj);
        state = M[pi][k] + GAP_OPEN >= Ix[pi][k] + GAP_EXT ? 0 : 1;
      } else state = 0;
      ci--;
    } else { // gap in a (came from left)
      bufA.push("-"); bufB.push(b[cj - 1]);
      if (pj >= colOff(ci) && pj <= Math.min(m, ci + band)) {
        const k = idx(ci, pj);
        state = M[ci][k] + GAP_OPEN >= Iy[ci][k] + GAP_EXT ? 0 : 2;
      } else state = 0;
      cj--;
    }
  }
  bufA.reverse(); bufB.reverse();
  const alnA = bufA.join(""), alnB = bufB.join("");
  // 统计
  let matches = 0, gaps = 0;
  for (let i = 0; i < alnA.length; i++) {
    if (alnA[i] === "-" || alnB[i] === "-") gaps++;
    else if (alnA[i] === alnB[i]) matches++;
  }
  const identity = alnA.length > 0 ? matches / alnA.length : 0;
  return { alnRef: alnA, alnQry: alnB, identity, gaps };
}

// ---------- 快速比对：锚点链化 + 局部 NW（MUMmer/Mauve 思路） ----------
// 对高相似度序列（>80%）比全程 NW 快 10-100 倍
// 返回 { segments: [{type:"match"|"aligned"|"var", ...}], identity, gaps }
export function fastAlign(refSeq, qrySeq, opts = {}) {
  const ref = cleanSeq(refSeq), qry = cleanSeq(qrySeq);
  const n = ref.length, m = qry.length;
  if (!n || !m) return { segments: [], identity: 0, gaps: 0, anchorBp: 0 };

  const k = opts.k || 15;
  const minAnchor = opts.minAnchor || 25;
  const maxGapAlign = opts.maxGapAlign || 300; // gap 超过此长度不做逐碱基比对

  // 1) ref 建 k-mer 索引
  const refPos = new Map();
  for (let i = 0; i + k <= n; i++) {
    const km = ref.slice(i, i + k);
    const a = refPos.get(km);
    if (a) { if (a.length < 8) a.push(i); } else refPos.set(km, [i]);
  }

  // 2) 扫描 query 找最大精确匹配锚点
  const anchors = [];
  let i = 0;
  while (i + k <= m) {
    const hits = refPos.get(qry.slice(i, i + k));
    if (!hits) { i++; continue; }
    let best = null;
    for (const rp of hits) {
      let l = 0;
      while (i - l - 1 >= 0 && rp - l - 1 >= 0 && qry[i - l - 1] === ref[rp - l - 1]) l++;
      let r = k;
      while (i + r < m && rp + r < n && qry[i + r] === ref[rp + r]) r++;
      const len = l + r;
      if (len >= minAnchor && (!best || len > best.len)) best = { rStart: rp - l, qStart: i - l, len };
    }
    if (best) { anchors.push(best); i = best.qStart + best.len; } else i++;
  }

  // 3) LIS 链化保持共线性（微小重叠在分段时修剪，避免 indel 侧翼延伸造成的重叠锚点被整条丢弃）
  const chain = lisChain(anchors);

  // 4) 锚点覆盖率太低则退回全程 NW（按较短序列覆盖率判定，避免短读段误触发）
  const anchorBp = chain.reduce((s, a) => s + a.len, 0);
  if (anchorBp / Math.min(n, m) < 0.4) {
    const full = nwAlign(ref, qry);
    if (full.overflow) return { segments: [{ type: "var", ref, qry }], identity: 0, gaps: 0, anchorBp };
    return { segments: [{ type: "aligned", alnRef: full.alnRef, alnQry: full.alnQry }], identity: full.identity, gaps: full.gaps, anchorBp };
  }

  // 5) 构建分段结果
  const segments = [];
  let rPrev = 0, qPrev = 0, totalMatch = 0, totalGaps = 0, totalVar = 0;

  const handleGap = (rStart, rEnd, qStart, qEnd) => {
    const rLen = rEnd - rStart, qLen = qEnd - qStart;
    if (rLen === 0 && qLen === 0) return;
    if (rLen <= maxGapAlign && qLen <= maxGapAlign) {
      const aln = nwAlign(ref.slice(rStart, rEnd), qry.slice(qStart, qEnd));
      segments.push({ type: "aligned", alnRef: aln.alnRef, alnQry: aln.alnQry });
      const alen = Math.max(aln.alnRef.length, aln.alnQry.length);
      for (let j = 0; j < alen; j++) {
        const r = aln.alnRef[j], q = aln.alnQry[j];
        if (r === "-" || q === "-" || r === undefined || q === undefined) totalGaps++;
        else if (r === q) totalMatch++;
      }
    } else {
      segments.push({ type: "var", ref: ref.slice(rStart, rEnd), qry: qry.slice(qStart, qEnd) });
      totalVar += Math.max(rLen, qLen);
    }
  };

  for (const a of chain) {
    let rStart = a.rStart, qStart = a.qStart, len = a.len;
    // 修剪与前一锚点的微小重叠（indel 侧翼延伸可能造成 1–几 bp 重叠）
    if (rStart < rPrev) { const d = rPrev - rStart; rStart = rPrev; qStart += d; len -= d; }
    if (qStart < qPrev) { const d = qPrev - qStart; qStart = qPrev; rStart += d; len -= d; }
    if (len <= 0) continue;
    handleGap(rPrev, rStart, qPrev, qStart);
    segments.push({ type: "match", seq: ref.slice(rStart, rStart + len) });
    totalMatch += len;
    rPrev = rStart + len;
    qPrev = qStart + len;
  }
  handleGap(rPrev, n, qPrev, m);

  const totalLen = totalMatch + totalGaps + totalVar;
  const identity = totalLen > 0 ? totalMatch / totalLen : 0;
  return { segments, identity, gaps: totalGaps, anchorBp };
}

// ---------- 自动方向比对（点3：借鉴 SnapGene 参考比对的双向能力） ----------
// 裁剪参考悬垂端后的比对（一致度不被读段未覆盖区稀释）；返回 { segments, identity(0..1), gaps, refStart, refEnd }
function trimAlign(ref, q, opts = {}) {
  const full = fastAlign(ref, q, opts);
  let rPos = 0, firstR = null, lastR = 0;
  for (const seg of full.segments) {
    if (seg.type === "match") {
      if (firstR == null) firstR = rPos;
      lastR = rPos + seg.seq.length;
      rPos += seg.seq.length;
    } else if (seg.type === "aligned") {
      let rb = 0, qb = 0;
      for (let i = 0; i < seg.alnRef.length; i++) {
        if (seg.alnRef[i] !== "-") rb++;
        if (i < seg.alnQry.length && seg.alnQry[i] !== "-") qb++;
      }
      if (qb > 0) { if (firstR == null) firstR = rPos; lastR = rPos + rb; }
      rPos += rb;
    } else {
      const rl = seg.ref.length, ql = seg.qry.length;
      if (ql > 0) { if (firstR == null) firstR = rPos; lastR = rPos + rl; }
      rPos += rl;
    }
  }
  if (firstR == null) firstR = 0;
  if (lastR < firstR) lastR = firstR;
  // 跨度即全参考 → 直接复用，避免重复计算
  if (firstR === 0 && lastR === ref.length) return { ...full, refStart: 0, refEnd: ref.length };
  const trimRef = ref.slice(firstR, lastR);
  const final = trimRef.length ? fastAlign(trimRef, q, opts) : { segments: [], identity: 0, gaps: 0 };
  return { ...final, refStart: firstR, refEnd: lastR };
}

// 同时尝试正向与反向互补，按锚点对查询的覆盖率定方向（对短读段/indel/悬垂端鲁棒），
// 再用 trimAlign 得到裁剪悬垂端后的一致度与定位区间。
// 返回 { segments, identity(0..1), gaps, strand, orientedSeq, refStart, refEnd }
export function alignBest(refSeq, qrySeq, opts = {}) {
  const ref = cleanSeq(refSeq), qry = cleanSeq(qrySeq);
  if (!ref.length || !qry.length) return { segments: [], identity: 0, gaps: 0, strand: "+", orientedSeq: qry, refStart: 0, refEnd: 0 };
  const rcSeq = revComp(qry);
  const fwdCov = fastAlign(ref, qry, opts).anchorBp / qry.length;
  const revCov = fastAlign(ref, rcSeq, opts).anchorBp / qry.length;
  const strand = revCov > fwdCov + 0.02 ? "−" : "+";
  const orientedQ = strand === "−" ? rcSeq : qry;
  const trimmed = trimAlign(ref, orientedQ, opts);
  return { ...trimmed, strand, orientedSeq: orientedQ };
}

// ---------- 读段比对到参考（点3c：SnapGene Align to Reference 工作流） ----------
// 自动定方向 + 裁剪悬垂端 + 给出读段在参考上的定位区间（refStart/refEnd 为 0 基半开区间）
export function alignToReference(refSeq, qrySeq, opts = {}) {
  const ref = cleanSeq(refSeq), qry = cleanSeq(qrySeq);
  if (!ref.length || !qry.length) return { segments: [], identity: 0, gaps: 0, strand: "+", refStart: 0, refEnd: 0 };
  return alignBest(ref, qry, opts);
}
