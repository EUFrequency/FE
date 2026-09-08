"use client";

import { logoutAction } from "../actions";

export const ADMIN_TABS = [
  { key: "dashboard", label: "대시보드", group: null },
  { key: "revenue", label: "매출 관리", group: null },
  { key: "seasons", label: "시즌 관리", group: null },
  { key: "reservations", label: "예약", group: "축제 시즌" },
  { key: "booths", label: "주점 등록", group: "축제 시즌" },
  { key: "layout", label: "주점 배치", group: "축제 시즌" },
  { key: "event-requests", label: "요청 관리", group: "이벤트 시즌" },
] as const;

export type AdminTabKey = (typeof ADMIN_TABS)[number]["key"];

/** 사이드바에 표시할 그룹 순서. null은 제목 없는 최상단 그룹 */
const GROUP_ORDER = [null, "축제 시즌", "이벤트 시즌"] as const;

type Props = {
  active: string;
  onSelect: (key: AdminTabKey) => void;
  onNavigate?: () => void;
};

export function SidebarNav({ active, onSelect, onNavigate }: Props) {
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
      {GROUP_ORDER.map((groupTitle) => (
        <div key={groupTitle ?? "top"} className="flex flex-col gap-1">
          {groupTitle && (
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {groupTitle}
            </div>
          )}
          {ADMIN_TABS.filter((tab) => tab.group === groupTitle).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                onSelect(tab.key);
                onNavigate?.();
              }}
              className={`flex h-10 items-center rounded-lg px-3 text-left text-sm font-medium transition ${
                active === tab.key
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ active, onSelect }: Props) {
  return (
    <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-black/5 bg-white dark:border-white/5 dark:bg-white/[0.02] md:flex">
      <SidebarHeader />
      <SidebarNav active={active} onSelect={onSelect} />
      <SidebarFooter />
    </aside>
  );
}

export function SidebarHeader() {
  return (
    <div className="flex h-16 flex-shrink-0 items-center border-b border-black/5 px-4 dark:border-white/5">
      <div>
        <div className="text-[11px] font-medium tracking-wide text-amber-600 dark:text-amber-400">
          Frequency
        </div>
        <div className="text-sm font-bold text-neutral-900 dark:text-neutral-50">
          관리자 페이지
        </div>
      </div>
    </div>
  );
}

export function SidebarFooter() {
  return (
    <div className="flex flex-col gap-2 border-t border-black/5 p-3 dark:border-white/5">
      <a
        href="/festival"
        target="_blank"
        rel="noreferrer"
        className="flex h-9 items-center rounded-lg px-3 text-sm text-neutral-500 transition hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/5"
      >
        축제 사이트 보기 ↗
      </a>
      <form action={logoutAction}>
        <button
          type="submit"
          className="flex h-9 w-full items-center rounded-lg px-3 text-left text-sm text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
