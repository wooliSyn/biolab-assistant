// 冒烟测试：SSR 渲染 SessionFollowup / SideMaterials（#5 实验后闭环），验证计数 / 完成态 / 隐藏 / 无 Context 降级
import React from "react";
import { renderToString } from "react-dom/server";
import SessionFollowup from "../src/components/SessionFollowup.jsx";
import SideMaterials from "../src/components/SideMaterials.jsx";
import { SessionActions } from "../src/lib/sessionActions.js";

const noop = () => {};
const act = { updateSession: noop, refineProtocol: noop };
const now = Date.now();
const s = {
  id: "s1", name: "PCR 扩增", status: "running", templateId: "t1",
  materials: "LB 液体培养基\n1.5 mL 离心管\n移液器",
  matChecked: { "LB 液体培养基": true },
  review: "这次退火温度偏低，条带略暗",
  followups: [
    { id: "f1", at: now - 60000, text: "挑单菌落摇菌", fired: true, done: false },
    { id: "f2", at: now + 3600000, text: "送测序", fired: false, done: false },
  ],
};

const strip = (h) => h.replace(/<!-- -->/g, "");
const html1 = strip(renderToString(
  <SessionActions.Provider value={act}>
    <SessionFollowup s={s} now={now} isDone={false} />
  </SessionActions.Provider>
));
const expect1 = ["物品 1/3", "笔记 · 总结 ✓", "完善 protocol", "提醒 2 · 1 到期"];
for (const k of expect1) {
  if (!html1.includes(k)) throw new Error("SessionFollowup 缺少: " + k);
}
console.log("✓ SessionFollowup 渲染：物品计数 / 笔记标记 / 提醒到期 均正确");

const html2 = strip(renderToString(
  <SessionActions.Provider value={act}>
    <SideMaterials sessions={[s]} />
  </SessionActions.Provider>
));
for (const k of ["物料 · PCR 扩增", "1/3", "确定", "已全部确认"]) {
  if (k === "已全部确认") continue; // 1/3 未勾完，不应出现
  if (!html2.includes(k)) throw new Error("SideMaterials 缺少: " + k);
}
if (html2.includes("已全部确认")) throw new Error("SideMaterials 未勾完却显示全部确认");
console.log("✓ SideMaterials 渲染：侧栏清单 / 计数 / 确定按钮 正确");

// 全部勾完 → 绿色完成态
const s2 = { ...s, matChecked: { "LB 液体培养基": true, "1.5 mL 离心管": true, "移液器": true } };
const html3 = strip(renderToString(
  <SessionActions.Provider value={act}>
    <SideMaterials sessions={[s2]} />
  </SessionActions.Provider>
));
if (!html3.includes("已全部确认，可以开始了")) throw new Error("SideMaterials 完成态缺失");
console.log("✓ SideMaterials 完成态正确");

// matHidden → 侧栏不显示
const html4 = strip(renderToString(
  <SessionActions.Provider value={act}>
    <SideMaterials sessions={[{ ...s, matHidden: true }]} />
  </SessionActions.Provider>
));
if (html4.includes("物料 ·")) throw new Error("matHidden 未生效");
console.log("✓ matHidden 隐藏生效");

// 无 Context（迷你窗 / 详情弹窗外）→ 优雅降级不崩
const html5 = renderToString(<SessionFollowup s={s} now={now} isDone={false} />);
if (html5 !== "") throw new Error("无 Context 时应返回 null");
console.log("✓ 无 SessionActions Context 时优雅降级");

console.log("全部冒烟用例通过");