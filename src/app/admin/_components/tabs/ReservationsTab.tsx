"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminStore } from "../../_lib/store";
import { listReservationsAction } from "../../_lib/reservation-actions";
import { Button } from "../ui";
import { PendingPanel } from "./reservations/PendingPanel";
import { ConfirmedPanel } from "./reservations/ConfirmedPanel";
import { SettlementPanel } from "./reservations/SettlementPanel";

const SUB_TABS = [
  { key: "pending", label: "승인 대기" },
  { key: "confirmed", label: "확정" },
  { key: "settlement", label: "결산" },
] as const;

type SubTabKey = (typeof SUB_TABS)[number]["key"];

function isSubTabKey(value: string | null): value is SubTabKey {
  return !!value && SUB_TABS.some((t) => t.key === value);
}

export function ReservationsTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dispatch } = useAdminStore();
  const [refreshing, setRefreshing] = useState(false);
  const subParam = searchParams.get("sub");
  const sub: SubTabKey = isSubTabKey(subParam) ? subParam : "pending";

  function setSub(key: SubTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "reservations");
    params.set("sub", key);
    router.replace(`/admin?${params.toString()}`, { scroll: false });
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await listReservationsAction();
      if (result.ok) dispatch({ type: "reservations/replaceAll", payload: result.data });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">예약</h1>
        <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? "새로고침 중..." : "새로고침"}
        </Button>
      </div>

      <div className="flex gap-1 border-b border-black/5 dark:border-white/5">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSub(t.key)}
            className={`relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              sub === t.key
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === "pending" && <PendingPanel />}
      {sub === "confirmed" && <ConfirmedPanel />}
      {sub === "settlement" && <SettlementPanel />}
    </div>
  );
}
