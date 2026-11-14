// ==================== 上下班打卡 + 工作证明 + 连续激励 + 月总结（点5） ====================
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { Fingerprint, LogOut, Award, CalendarCheck2, Flame, Trophy, X, Download, Sparkles } from "lucide-react";
import { dateStr, timeStr, pad, toast } from "../lib/core";

const fmtDur = (ms) => {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分` : `${m} 分钟`;
};
const isWeekend = (ds) => { const w = new Date(`${ds}T12:00:00`).getDay(); return w === 0 || w === 6; };

// 计算从 firstDay 到今天的连续打卡（工作日全勤；周末是否也打满）
// 点5：补签日（makeupIn/makeupOut）单独计数，不参与全勤 / 周末打满统计
function computeStreak(records, firstDay, today) {
  if (!firstDay) return { workday: 0, weekendFull: false, allDays: 0, makeup: 0 };
  let workday = 0, weekendDone = 0, weekendTotal = 0, allDays = 0, makeup = 0;
  const cur = new Date(`${today}T12:00:00`);
  const start = new Date(`${firstDay}T12:00:00`);
  for (let d = new Date(start); d <= cur; d.setDate(d.getDate() + 1)) {
    const ds = dateStr(d.getTime());
    const r = records[ds];
    if (!(r && r.in && r.out)) continue;
    const isMakeup = !!(r.makeupIn || r.makeupOut);
    if (isMakeup) makeup++;
    if (isWeekend(ds)) { weekendTotal++; if (!isMakeup) weekendDone++; }
    else if (!isMakeup) workday++;
    allDays++;
  }
  return { workday, weekendFull: weekendTotal > 0 && weekendDone === weekendTotal, weekendDone, weekendTotal, allDays, makeup };
}

// ==================== 点4：日历长按 → 当日打卡 / 往日补签弹窗 ====================
// date === 今天 → 正常打卡（当前时间）；date < 今天 → 补签（可选时间，标记 makeupIn/makeupOut，不参与全勤）
export function DayPunchDialog({ date, now, attendance, setAttendance, onClose }) {
  const today = dateStr(now);
  const isToday = date === today;
  const rec = attendance.records[date] || null;
  const [inT, setInT] = useState("09:00");
  const [outT, setOutT] = useState("18:00");
  const wk = "日一二三四五六"[new Date(`${date}T12:00:00`).getDay()];

  const tsFor = (t) => new Date(`${date}T${t}:00`).getTime();
  const mergeFirstDay = (p) => (p.firstDay ? (date < p.firstDay ? date : p.firstDay) : date);

  const punchIn = () => {
    const ts = isToday ? Date.now() : tsFor(inT);
    setAttendance((p) => ({
      firstDay: mergeFirstDay(p),
      records: { ...p.records, [date]: { ...(p.records[date] || {}), in: ts, out: p.records[date]?.out ?? null, ...(isToday ? {} : { makeupIn: true }) } },
    }));
    toast(isToday ? "上工打卡成功，今天也加油！" : "已补签上工卡（补签不参与全勤统计）", "success");
  };
  const punchOut = () => {
    const ts = isToday ? Date.now() : tsFor(outT);
    setAttendance((p) => ({
      ...p,
      records: { ...p.records, [date]: { ...(p.records[date] || { in: ts }), out: ts, ...(isToday ? {} : { makeupOut: true }) } },
    }));
    toast(isToday ? "下班打卡成功，辛苦啦！" : "已补签下班卡（补签不参与全勤统计）", "success");
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden animate-[fadeIn_.18s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <Fingerprint size={15} className={isToday ? "text-indigo-500" : "text-orange-500"} />
            {date}（周{wk}）
            {isToday
              ? <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">当日打卡</span>
              : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">补签</span>}
          </span>
          <button onClick={onClose} className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
        </div>
        <div className="p-4 space-y-2.5">
          {!isToday && (
            <div className="text-[10px] text-orange-500 bg-orange-50 rounded-lg px-2.5 py-1.5">补签仅针对今日之前的漏签日；补签记录不参与全勤统计。</div>
          )}
          {/* 上工 */}
          {rec?.in ? (
            <div className="flex items-center justify-between text-[11px] bg-emerald-50 rounded-lg px-2.5 py-2">
              <span className="text-emerald-600 flex items-center gap-1"><Fingerprint size={12} />已上工 {timeStr(rec.in)}{rec.makeupIn && <b className="text-orange-500">（补签）</b>}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {!isToday && (
                <input type="time" value={inT} onChange={(e) => setInT(e.target.value)}
                  className="text-[11px] tabular-nums border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              )}
              <button onClick={punchIn} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-bold bg-emerald-500 hover:bg-emerald-600 shadow transition">
                <Fingerprint size={14} />{isToday ? "上工打卡（现在）" : "补签上工卡"}
              </button>
            </div>
          )}
          {/* 下班 */}
          {rec?.out ? (
            <div className="flex items-center justify-between text-[11px] bg-amber-50 rounded-lg px-2.5 py-2">
              <span className="text-amber-600 flex items-center gap-1"><LogOut size={12} />已下班 {timeStr(rec.out)}{rec.makeupOut && <b className="text-orange-500">（补签）</b>}</span>
            </div>
          ) : rec?.in ? (
            <div className="flex items-center gap-2">
              {!isToday && (
                <input type="time" value={outT} onChange={(e) => setOutT(e.target.value)}
                  className="text-[11px] tabular-nums border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-200" />
              )}
              <button onClick={punchOut} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-bold bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 shadow transition">
                <LogOut size={14} />{isToday ? "下班打卡（现在）" : "补签下班卡"}
              </button>
            </div>
          ) : (
            <div className="text-[10px] text-gray-300 text-center">请先补上上工卡，再补下班卡</div>
          )}
          {rec?.in && rec.out && (
            <div className="text-[10px] text-gray-400 text-center">当日工时 {fmtDur(rec.out - rec.in)}</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Attendance({ attendance, setAttendance, now, sessions }) {
  const today = dateStr(now);
  const h = new Date(now).getHours();
  const rec = attendance.records[today] || null;
  const canIn = h >= 6 && !rec?.in;                       // 上工卡：6 点后冒出
  const canOut = rec?.in && !rec.out && (h >= 18 || h < 5); // 下班卡：晚上/深夜冒出
  const streak = computeStreak(attendance.records, attendance.firstDay, today);

  const [cert, setCert] = useState(null);   // 工作证明弹窗
  const [summary, setSummary] = useState(null); // 月总结弹窗
  const certRef = useRef(null);
  const sumRef = useRef(null);

  const clockIn = () => {
    if (h < 6) { toast("还没到上工时间（6:00 后）；如需现在打卡，请长按日历中的「今天」", "info"); return; }
    const ts = Date.now();
    setAttendance((p) => ({ firstDay: p.firstDay || today, records: { ...p.records, [today]: { in: ts, out: null } } }));
    toast("上工打卡成功，今天也加油！", "success");
  };
  const clockOut = () => {
    if (!(h >= 18 || h < 5)) { toast("还没到下班时间（18:00 后）；如需现在打卡，请长按日历中的「今天」", "info"); return; }
    const ts = Date.now();
    setAttendance((p) => ({ ...p, records: { ...p.records, [today]: { ...(p.records[today] || { in: ts }), out: ts } } }));
    setCert({ in: rec?.in || ts, out: ts });
  };

  // 导出节点为 PNG（html2canvas → save_attachment）
  // 动态 import：html2canvas 体积大且仅导出时使用，改为按需加载，避免拖慢首屏
  const exportImage = async (node, name) => {
    if (!node) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(node, { backgroundColor: "#ffffff", scale: 2 });
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
      const path = await invoke("save_attachment", { name, bytes });
      toast("已保存图片：" + path, "success");
    } catch (e) { toast("导出图片失败：" + e, "error"); }
  };

  // 月总结数据
  const openSummary = () => {
    const ym = today.slice(0, 7);
    const entries = Object.entries(attendance.records).filter(([ds, r]) => ds.startsWith(ym) && r.in && r.out);
    const makeupDays = entries.filter(([, r]) => r.makeupIn || r.makeupOut).length; // 点5：补签单独计数
    let totalMs = 0;
    entries.forEach(([, r]) => { totalMs += (r.out - r.in); });
    // 当月实验统计
    const monthSessions = sessions.filter((s) => dateStr(s.startedAt).startsWith(ym));
    const byName = {};
    monthSessions.forEach((s) => {
      const dur = s.steps.reduce((a, st) => a + (st.durationMin || 0), 0) * 60000;
      byName[s.name] = byName[s.name] || { count: 0, ms: 0 };
      byName[s.name].count++; byName[s.name].ms += dur;
    });
    setSummary({ ym, days: entries.length, makeupDays, totalMs, byName: Object.entries(byName) });
  };

  return (
    <div className="px-3 py-2.5 border-t border-gray-100 flex-shrink-0">
      <div className="text-[11px] font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
        <Fingerprint size={12} className="text-indigo-500" />打卡 · 工时
        <button onClick={openSummary} className="ml-auto text-[10px] text-indigo-500 hover:underline flex items-center gap-0.5"><CalendarCheck2 size={10} />月总结</button>
      </div>

      {/* 连续打卡激励 */}
      {attendance.firstDay && (
        <div className={`mb-2 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-[11px] ${streak.weekendFull ? "bg-gradient-to-r from-amber-100 to-yellow-50 text-amber-700" : "bg-orange-50 text-orange-600"}`}>
          <Flame size={13} className={streak.weekendFull ? "text-amber-500 animate-pulse" : "text-orange-500"} />
          <span>工作日全勤 <b className="tabular-nums">{streak.workday}</b> 天</span>
          {streak.makeup > 0 && <span className="text-orange-400" title="补签日不参与全勤统计">补签 {streak.makeup} 天不计入</span>}
          {streak.weekendFull && <span className="flex items-center gap-0.5 text-amber-600"><Trophy size={12} className="animate-bounce" />周末也打满，太拼了！</span>}
        </div>
      )}

      {/* 打卡卡片（点4：点击按时段打卡；非时段打卡 / 补签 → 长按日历日期） */}
      <div className="space-y-1.5">
        {!rec?.in && (
          <button onClick={clockIn}
            title={canIn ? "点击上工打卡" : "未到上工时段（6:00 后）；长按日历中的「今天」可随时打卡"}
            className="relative w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-bold bg-emerald-500 hover:bg-emerald-600 shadow transition overflow-hidden animate-[fadeIn_.2s_ease]">
            <span className="relative flex items-center gap-2"><Fingerprint size={15} />{canIn ? "上工打卡" : "上工打卡（未到时段）"}</span>
          </button>
        )}
        {rec?.in && !rec.out && (
          <div className="flex items-center justify-between text-[10px] text-gray-500 bg-emerald-50 rounded-lg px-2.5 py-1.5">
            <span className="flex items-center gap-1 text-emerald-600"><Fingerprint size={11} />已上工 {timeStr(rec.in)}{rec.makeupIn && <b className="text-orange-500">（补签）</b>}</span>
            {canOut ? <span className="text-amber-500">可以下班打卡啦</span> : <span className="text-gray-400">工作中…</span>}
          </div>
        )}
        {rec?.in && !rec.out && (
          <button onClick={clockOut}
            title={canOut ? "点击下班打卡并开具工作证明" : "未到下班时段（18:00 后）；长按日历中的「今天」可随时打卡"}
            className="relative w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-bold bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 shadow transition overflow-hidden animate-[fadeIn_.2s_ease]">
            <span className="relative flex items-center gap-2"><LogOut size={15} />{canOut ? "下班打卡 · 开具工作证明" : "下班打卡（未到时段）"}</span>
          </button>
        )}
        {rec?.in && rec.out && (
          <div className="flex items-center justify-between text-[10px] text-gray-500 bg-amber-50 rounded-lg px-2.5 py-1.5">
            <span className="text-amber-600 flex items-center gap-1"><Award size={11} />今日已完成 {timeStr(rec.in)}–{timeStr(rec.out)}{(rec.makeupIn || rec.makeupOut) && <b className="text-orange-500">（补签）</b>}</span>
            <button onClick={() => setCert({ in: rec.in, out: rec.out, makeup: rec.makeupIn || rec.makeupOut })} className="text-indigo-500 hover:underline">查看证明</button>
          </div>
        )}
      </div>

      {/* 工作证明弹窗 */}
      {cert && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setCert(null)}>
          <div className="rhine-exempt bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Award size={15} className="text-amber-500" />工作证明{cert.makeup && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">补签</span>}</span>
              <button onClick={() => setCert(null)} className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
            </div>
            <div ref={certRef} className="p-5 bg-gradient-to-br from-amber-50 to-white">
              <div className="text-center mb-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-2"><Sparkles size={22} className="text-amber-500" /></div>
                <div className="text-base font-bold text-gray-800">实验工作证明</div>
                <div className="text-[10px] text-gray-400 tracking-widest">BIOLAB · CERTIFICATE</div>
              </div>
              <div className="space-y-1.5 text-[12px] text-gray-600 bg-white/70 rounded-xl px-4 py-3 border border-amber-100">
                <div className="flex justify-between"><span className="text-gray-400">日期</span><span className="font-medium tabular-nums">{today}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">上工时间</span><span className="font-medium tabular-nums text-emerald-600">{timeStr(cert.in)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">下班时间</span><span className="font-medium tabular-nums text-amber-600">{timeStr(cert.out)}</span></div>
                <div className="flex justify-between border-t border-dashed border-gray-200 pt-1.5"><span className="text-gray-400">工作时长</span><span className="font-bold text-gray-800">{fmtDur(cert.out - cert.in)}</span></div>
                {cert.makeup && <div className="flex justify-between"><span className="text-gray-400">签卡类型</span><span className="font-medium text-orange-500">补签（不参与全勤统计）</span></div>}
              </div>
              <div className="text-center text-[9px] text-gray-300 mt-3">BioLab 实验助手 · v1.2.2.5 · YunPlover</div>
            </div>
            <div className="px-4 py-3 border-t border-gray-100">
              <button onClick={() => exportImage(certRef.current, `工作证明_${today}.png`)} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"><Download size={13} />导出为图片</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 月总结弹窗 */}
      {summary && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setSummary(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><CalendarCheck2 size={15} className="text-indigo-500" />{summary.ym} 月度总结</span>
              <button onClick={() => setSummary(null)} className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
            </div>
            <div ref={sumRef} className="p-5">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-indigo-50 rounded-xl px-3 py-2.5 text-center"><div className="text-xl font-bold text-indigo-600 tabular-nums">{summary.days}</div><div className="text-[10px] text-gray-400">打卡天数{summary.makeupDays > 0 ? `（含补签 ${summary.makeupDays} 天）` : ""}</div></div>
                <div className="bg-amber-50 rounded-xl px-3 py-2.5 text-center"><div className="text-xl font-bold text-amber-600 tabular-nums">{Math.round(summary.totalMs / 3600000 * 10) / 10}</div><div className="text-[10px] text-gray-400">总工时（小时）</div></div>
              </div>
              <div className="text-[11px] font-semibold text-gray-500 mb-1.5">实验统计</div>
              {summary.byName.length === 0 ? (
                <div className="text-[11px] text-gray-300 text-center py-4">本月暂无实验记录</div>
              ) : (
                <div className="space-y-1">
                  {summary.byName.map(([name, v]) => (
                    <div key={name} className="flex items-center justify-between text-[11px] bg-gray-50 rounded-lg px-2.5 py-1.5">
                      <span className="text-gray-700 truncate">{name}</span>
                      <span className="text-gray-400 tabular-nums flex-shrink-0">{v.count} 次 · {fmtDur(v.ms)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-center text-[9px] text-gray-300 mt-3">BioLab · v1.2.2.5 · YunPlover</div>
            </div>
            <div className="px-4 py-3 border-t border-gray-100">
              <button onClick={() => exportImage(sumRef.current, `月度总结_${summary.ym}.png`)} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"><Download size={13} />导出为图片</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
