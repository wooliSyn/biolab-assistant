// ==================== 初次使用引导 + 使用手册（平面设计） ====================
import { useState } from "react";
import {
  ChevronRight, ChevronLeft, X, FlaskConical, GanttChartSquare, Play,
  NotebookPen, Moon, MousePointerClick,
} from "lucide-react";

const PAGES = [
  {
    no: "01",
    icon: FlaskConical,
    title: "BioLab 实验助手",
    body: "为生物实验设计的时间管理与执行工具。\n\n制定方案 → 逐步倒计时 → 到点系统通知 + 任务栏闪烁 → 记录数据与随笔。每一个时间点都不会被遗漏。",
  },
  {
    no: "02",
    icon: GanttChartSquare,
    title: "时间线：像读 DNA 比对一样看实验",
    body: "上方是当日总览：每 3 小时一个刻度，每个实验排成一行，只显示不连续的线段；中间的「阅读框」标出下方放大视图正在看哪段时间，随滚动和缩放实时变化。\n\n· Ctrl + 滚轮 缩放，滚轮 平移\n· 刻度可精确到分钟，当前时间线精确到秒\n· 悬停色块看概要，点击看每步起止与完成情况\n· 右键空白处可在该时间新建实验，长按可快速插入",
  },
  {
    no: "03",
    icon: Play,
    title: "开始一个实验",
    body: "点「新建实验」，从方案库选模板（可查原始 protocol）或自定义。\n\n每步有倒计时，到点弹通知；做完点「确认，下一步」。离开去做别的？点「托管」。\n\n实验排到深夜时，启动页会自动询问：第一天做到哪一步、次日几点开始，一键插入「过夜等待」，保证睡眠。",
  },
  {
    no: "04",
    icon: NotebookPen,
    title: "记录 · 配方 · 数据 · 克隆",
    body: "· 当日备注支持 LaTeX 公式；右侧栏便条可拖拽排序\n· 「配方」页是一面便利贴墙：LB、TAE、PBS……直接点单元格改表格\n· 「数据集」登记原始数据并设处理提醒\n· 「克隆辅助」提供引物 Tm、限制酶速查与流程清单",
  },
];

export default function Onboarding({ mode, onClose }) {
  // mode: "welcome" 初次使用 | "manual" 使用手册
  const [page, setPage] = useState(0);
  const isWelcome = mode === "welcome";
  const p = PAGES[page];
  const I = p.icon;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden flex shadow-2xl" style={{ minHeight: 360 }}>
        {/* 左侧纯色信息栏 */}
        <div className="onboarding-left w-36 flex-shrink-0 bg-indigo-600 text-white flex flex-col relative">
          <div className="px-5 pt-6 flex items-center gap-1.5">
            <FlaskConical size={14} />
            <span className="text-xs font-bold tracking-widest">BioLab</span>
          </div>
          {/* 大页码 */}
          <div className="px-5 mt-8 text-6xl font-black tabular-nums leading-none tracking-tight">{p.no}</div>
          <div className="px-5 mt-2 text-[10px] text-white/60 tracking-widest">/ {String(PAGES.length).padStart(2, "0")}</div>
          {/* 进度条（平面方块） */}
          <div className="px-5 mt-6 flex gap-1">
            {PAGES.map((_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={`h-1 flex-1 transition-colors ${i <= page ? "bg-white" : "bg-white/25 hover:bg-white/50"}`} />
            ))}
          </div>
          <div className="mt-auto px-5 pb-5">
            <I size={22} className="text-white/70" />
            <div className="text-[9px] text-white/50 mt-2 tracking-wider">{isWelcome ? "初次见面" : "使用手册"}</div>
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 flex flex-col p-7 relative">
          <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100"><X size={16} /></button>

          <div className="flex items-center gap-2 text-indigo-600 mb-3">
            <I size={18} />
            <span className="text-[10px] font-semibold tracking-widest text-gray-400">{isWelcome ? "WELCOME" : "MANUAL"}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{p.title}</h2>
          <p className="text-[12.5px] leading-relaxed text-gray-500 whitespace-pre-line flex-1">{p.body}</p>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            <button onClick={() => setPage((v) => Math.max(0, v - 1))} disabled={page === 0}
              className="flex items-center gap-1 px-3 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
              <ChevronLeft size={14} />上一页
            </button>
            <div className="text-[10px] text-gray-300 tabular-nums">{page + 1} / {PAGES.length}</div>
            {page < PAGES.length - 1 ? (
              <button onClick={() => setPage((v) => v + 1)}
                className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition">
                下一页<ChevronRight size={14} />
              </button>
            ) : (
              <button onClick={onClose}
                className="flex items-center gap-1 px-5 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition">
                <MousePointerClick size={13} />{isWelcome ? "开始使用" : "明白了"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
