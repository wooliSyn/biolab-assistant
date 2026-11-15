import React from "react";
import { renderToString } from "react-dom/server";
import MapView from "../src/components/PlasmidMap.jsx";

const rnd = (n) => Array.from({ length: n }, () => "ACGT"[(Math.random() * 4) | 0]).join("");
const mk = (name, len, circular, features, nSites, primers = []) => ({
  plasmid: { id: name, name, circular, seq: rnd(len), features },
  sites: Array.from({ length: nSites }, (_, i) => ({ name: ["EcoRI","BamHI","HindIII","NotI","XhoI"][i % 5], pos: 1 + Math.floor((i + 0.5) * len / Math.max(1, nSites)), site: "GAATTC" })),
  mapped: primers,
});

const F = (label, key, start, end, strand) => ({ label, key, start, end, strand });
const demoFeats = [
  F("T7 启动子","promoter",1,23,1), F("RBS","misc_feature",24,36,1),
  F("目的基因 CDS","CDS",37,240,1), F("T7 终止子","terminator",241,260,-1),
  F("MCS 多克隆位点","misc_feature",261,317,1), F("AmpR 氨苄抗性","CDS",318,541,-1),
  F("ColE1 ori","rep_origin",542,790,1), F("短元件","misc_feature",800,806,0),
];
const prim = [
  { id:"p1", name:"T7-F", seq:"TAATACGACTCACTATAGGG", hit:{pos:1,strand:"+",mm:0}, bindLen:20 },
  { id:"p2", name:"T7-R", seq:"GCTAGTTATTGCTCAGCGG",  hit:{pos:241,strand:"−",mm:0}, bindLen:19 },
];

const cases = [
  ["环形·完整示例",            mk("pDemo-1", 2847, true,  demoFeats, 15, prim), { a:400, b:519 }],
  ["环形·无元件无酶切",        mk("pBlank", 3000, true,  [], 0), null],
  ["线性·片段无注释",          mk("frag", 800, false, [], 0), null],
  ["极小质粒 20bp",            mk("tiny", 20, true, [F("whole","CDS",1,20,1)], 2), { a:0, b:19 }],
  ["元件跨满整圈",             mk("pFull", 1000, true, [F("覆盖全长","CDS",1,1000,1)], 3), null],
  ["元件跨原点(end<start 式)", mk("pWrap", 1000, true, [F("跨原点","CDS",950,1050,1)], 3), { a:980, b:999 }],
  ["酶切密集 150 → 仅刻度",    mk("pDense", 5000, true, demoFeats, 150), null],
  ["酶切极多 500 → 省略",      mk("pMany", 5000, true, demoFeats, 500), null],
  ["线性·大量元件分泳道",      mk("pLin", 4000, false, Array.from({length:40},(_,i)=>F(`元件${i}`,"gene",i*95+1,i*95+140,i%2?1:-1)), 20, prim), { a:100, b:300 }],
];

let bad = 0;
for (const [label, props, sel] of cases) {
  for (const h of [460, 260]) {
    try {
      const html = renderToString(React.createElement(MapView, { ...props, sel, setSel: () => {}, onLocate: () => {}, height: h }));
      const nan = (html.match(/NaN|Infinity|undefined/g) || []).length;
      const arcs = (html.match(/<path/g) || []).length;
      const texts = (html.match(/<text/g) || []).length;
      if (nan) { console.log(`✗ ${label} h=${h}: 输出含 NaN/Infinity/undefined ×${nan}`); bad++; }
      else console.log(`✓ ${label} h=${h}: path×${arcs} text×${texts}`);
    } catch (e) { console.log(`✗ ${label} h=${h}: 渲染抛错 → ${e.message}`); bad++; }
  }
}
console.log(bad ? `\n${bad} 个用例有问题` : "\n全部用例通过（无 NaN、无抛错）");
