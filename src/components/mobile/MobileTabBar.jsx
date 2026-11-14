// ==================== 移动端底部导航栏（P0） ====================
// 替代桌面端顶部标签栏。固定底部、大触控目标、主题自适应、支持刘海屏安全区。
// props:
//   tabs: [{ k, i: IconComp, l }]   标签定义（与桌面端共用）
//   activeTab, setActiveTab          当前标签
//   badge: number                    「今日实验」上显示的进行中实验数
export default function MobileTabBar({ tabs, activeTab, setActiveTab, badge }) {
  return (
    <nav
      className="flex-shrink-0 grid bg-[var(--px-paper)] border-t-2 border-[var(--px-ink)] z-[60]"
      style={{
        gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {tabs.map(({ k, i: I, l }) => {
        const on = activeTab === k;
        return (
          <button
            key={k}
            onClick={() => setActiveTab(k)}
            className="relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] transition-colors active:opacity-70"
            style={{ color: on ? "var(--px-accent)" : "var(--px-ink)" }}
          >
            {/* 顶部激活指示条 */}
            {on && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                style={{ background: "var(--px-accent)" }}
              />
            )}
            <span className="relative">
              <I size={20} strokeWidth={on ? 2.4 : 2} />
              {k === "today" && badge > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-0.5 flex items-center justify-center text-[9px] font-bold text-white bg-rose-500 rounded-full">
                  {badge}
                </span>
              )}
            </span>
            <span className={`text-[10px] leading-none ${on ? "font-bold" : "font-medium opacity-80"}`}>
              {l}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
