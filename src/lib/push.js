// ==================== 推送到手机：预留接口 ====================
// 设计约定（本地优先红线）：BioLab 不内置云后端。推送通过"用户自配的 webhook"
// （钉钉群机器人 / 飞书群机器人 / 企业微信机器人 / 自建中继）实现，数据仍全本地。
// 当前为预留接口：未配置 webhook 时返回 reserved，UI 提示"接口预留"。
// 后续启用只需在设置里填入 webhook URL，无需改计算/导出逻辑。

// payload: { title, text }  text 为纯文本表格摘要
// opts:    { webhook }      用户配置的机器人 webhook（可选）
// 返回:    { ok, reserved?, message? }
export async function pushToPhone({ title, text }, { webhook } = {}) {
  if (!webhook || !/^https?:\/\//i.test(webhook)) {
    return { ok: false, reserved: true, message: "推送接口预留：尚未配置 webhook（钉钉/飞书群机器人）。配置后即可把结果推送到手机。" };
  }
  // 钉钉/飞书文本消息通用格式；不同平台如有差异可在此适配。
  const body = { msgtype: "text", text: { content: `${title}\n${text}` } };
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, message: `推送失败：HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: `推送失败：${e?.message || e}（WebView 可能受 CORS 限制，建议经自建中继）` };
  }
}

// 把混合配比结果压成纯文本摘要（供推送/复制）
export function mixToText(result, fillerLabel = "补液/溶剂") {
  const lines = result.rows.map((r) => {
    const take = r.take_mL > 0 ? `取 ${fmtV(r.take_mL)}` : r.take_mg != null ? `称 ${fmtM(r.take_mg)}` : "—";
    return `${r.name}: ${take}${r.note ? `（${r.note}）` : ""}`;
  });
  lines.push(`${fillerLabel}: ${fmtV(result.filler_mL)}`);
  lines.push(`终体积: ${fmtV(result.total_mL)}`);
  return lines.join("\n");
}
const fmtV = (mL) => (Math.abs(mL) < 1 ? `${round(mL * 1000)} µL` : `${round(mL)} mL`);
const fmtM = (mg) => (Math.abs(mg) < 1 ? `${round(mg * 1000)} µg` : `${round(mg)} mg`);
const round = (n) => String(parseFloat((Math.round(n * 10000) / 10000).toPrecision(6)));