"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminStoreProvider } from "../_lib/store";
import {
  ADMIN_TABS,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarNav,
  type AdminTabKey,
} from "./Sidebar";
import { DashboardTab } from "./tabs/DashboardTab";
import { RevenueTab } from "./tabs/RevenueTab";
import { SeasonsTab } from "./tabs/SeasonsTab";
import { ReservationsTab } from "./tabs/ReservationsTab";
import { BoothsTab } from "./tabs/BoothsTab";
import { LayoutTab } from "./tabs/LayoutTab";
import { EventRequestsTab } from "./tabs/EventRequestsTab";
import type { Account, AdminBooth, Reservation, Season } from "../_lib/types";

const DEFAULT_TAB: AdminTabKey = "dashboard";
const TAB_KEYS = ADMIN_TABS.map((t) => t.key);

function isTabKey(value: string | null): value is AdminTabKey {
  return !!value && (TAB_KEYS as string[]).includes(value);
}

type Props = {
  initialBooths: AdminBooth[];
  boothsError: string | null;
  initialSeasons: Season[];
  seasonsError: string | null;
  initialReservations: Reservation[];
  reservationsError: string | null;
  initialAccounts: Account[];
  accountsError: string | null;
};

export function AdminApp({
  initialBooths,
  boothsError,
  initialSeasons,
  seasonsError,
  initialReservations,
  reservationsError,
  initialAccounts,
  accountsError,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const tabParam = searchParams.get("tab");
  const tab: AdminTabKey = isTabKey(tabParam) ? tabParam : DEFAULT_TAB;

  function setTab(key: AdminTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`/admin?${params.toString()}`, { scroll: false });
  }

  const currentLabel = ADMIN_TABS.find((t) => t.key === tab)?.label ?? "";

  return (
    <AdminStoreProvider
      initialBooths={initialBooths}
      boothsError={boothsError}
      initialSeasons={initialSeasons}
      seasonsError={seasonsError}
      initialReservations={initialReservations}
      reservationsError={reservationsError}
      initialAccounts={initialAccounts}
      accountsError={accountsError}
    >
      <div className="flex min-h-screen bg-neutral-100 dark:bg-[#0b0805]">
        <Sidebar active={tab} onSelect={setTab} />

        {/* 모바일 드로어 */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative flex h-full w-64 flex-col bg-white dark:bg-neutral-950">
              <SidebarHeader />
              <SidebarNav
                active={tab}
                onSelect={setTab}
                onNavigate={() => setMobileNavOpen(false)}
              />
              <SidebarFooter />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-black/5 bg-white px-4 dark:border-white/5 dark:bg-white/[0.02] md:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-lg text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/5"
              aria-label="메뉴 열기"
            >
              ☰
            </button>
            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {currentLabel}
            </span>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {tab === "dashboard" && <DashboardTab />}
            {tab === "revenue" && <RevenueTab />}
            {tab === "seasons" && <SeasonsTab />}
            {tab === "reservations" && <ReservationsTab />}
            {tab === "booths" && <BoothsTab />}
            {tab === "layout" && <LayoutTab />}
            {tab === "event-requests" && <EventRequestsTab />}
          </main>
        </div>
      </div>
    </AdminStoreProvider>
  );
}
