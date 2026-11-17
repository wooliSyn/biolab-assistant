// 实验卡片上「实验后闭环」用到的上层操作，经 Context 下发，免得穿过 TodayView / DayDetail 两层逐个传 props。
// 单独放在 lib：组件文件只能导出组件，否则 Fast Refresh 失效（见 CLAUDE.md 坑 2）。
import { createContext } from "react";

// { updateSession(id, patch | (s) => patch), refineProtocol(session) }
export const SessionActions = createContext(null);

export const splitLines = (text) => String(text || "").split("\n").map((x) => x.trim()).filter(Boolean);

// 后续提醒的快捷时间
export function quickTimes(now) {
  const d = new Date(now);
  const at = (days, h, m = 0) => { const x = new Date(d); x.setDate(x.getDate() + days); x.setHours(h, m, 0, 0); return x.getTime(); };
  return [
    ["1 小时后", now + 3600000],
    ["今晚 20:00", at(0, 20) > now ? at(0, 20) : at(1, 20)],
    ["明早 9:00", at(1, 9)],
    ["3 天后 9:00", at(3, 9)],
    ["1 周后 9:00", at(7, 9)],
  ];
}
