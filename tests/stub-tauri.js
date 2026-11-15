const CDS = "ATGGCTAGCAAGGAGTACGGCATCGAGTGGATCCTCAATGGCGGCATGCGCGGCAATGACGTGGTCAAGTTCGGCGAGGACATCAACGAGCTGGTGGTGAAGGGCACCGTGGTCTTCGACGGCAACGTGATCAAGGAGCTGACCGGCGTGGTGGAGTACGGCAAGCTGACCATCGAGTTCGACCTGCTGACCGGCGTGAAGTAA";
const AMP = "ATGAGTATTCAACATTTCCGTGTCGCCCTTATTCCCTTTTTTGCGGCATTTTGCCTTCCTGTTTTTGCTCACCCAGAAACGCTGGTGAAAGTAAAAGATGCTGAAGATCAGTTGGGTGCACGAGTGGGTTACATCGAACTGGATCTCAACAGCGGTAAGATCCTTGAGAGTTTTCGCCCCGAAGAACGTTTTCCAATGATGAGCACTTTTAAAGTTCTGCTATGTG";
const ORI = "GCGGTGGCGCGGGCCTGATGCGGTATTTTCTCCTTACGCATCTGTGCGGTATTTCACACCGCATATGGTGCACTCTCAGTACAATCTGCTCTGATGCCGCATAGTTAAGCCAGCCCCGACACCCGCCAACACCCGCTGACGCGCCCTGACGGGCTTGTCTGCTCCCGGCATCCGCTTACAGACAAGCTGTGACCGTCTCCGGGAGCTGCATGTGTCAGAGGTTTTCACCGTCATCACCGAAACGCGCGAG";
const blocks = [
  ["promoter","T7 启动子","TAATACGACTCACTATAGGGAGA"],
  ["misc_feature","RBS 核糖体结合位点","AGGAGATATACAT"],
  ["CDS","目的基因 CDS (示例)",CDS],
  ["terminator","T7 终止子","GCTAGTTATTGCTCAGCGG"],
  ["misc_feature","MCS 多克隆位点","GAATTCGAGCTCGGTACCCGGGGATCCTCTAGAGTCGACCTGCAGGCATGCAAGCTT"],
  ["CDS","AmpR 氨苄抗性 (片段)",AMP],
  ["rep_origin","ColE1 复制起点 (片段)",ORI],
];
let cum = 0; const features = [];
for (const [key,label,seq] of blocks) { features.push({ key, label, start: cum+1, end: cum+seq.length, strand: 1 }); cum += seq.length; }
const seq = blocks.map((b)=>b[2]).join("");
features.unshift({ key:"source", label:"pDemo-1 载体骨架", start:1, end:seq.length, strand:1 });
const demo = { id:"demo1", name:"pDemo-1", circular:true, seq, features };
const frag = { id:"frag1", name:"insert-A", circular:false, seq: CDS, features:[] };

export const invoke = async (cmd, args) => {
  if (cmd === "load_data" && args.key === "cloning") {
    return JSON.stringify({
      plasmids: [demo, frag], activeId: "demo1", alignIds: ["frag1"],
      primersByPlasmid: { demo1: [
        { id:"pf", name:"T7-F", seq:"TAATACGACTCACTATAGGG" },
        { id:"pr", name:"T7-R", seq:"GCTAGTTATTGCTCAGCGG" },
      ] },
    });
  }
  if (cmd === "load_data") return null;
  return null;
};
