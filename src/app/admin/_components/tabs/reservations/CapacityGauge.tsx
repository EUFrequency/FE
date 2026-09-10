"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../../_lib/store";
import { rebuildInventoryAction } from "../../../_lib/reservation-actions";
import { summarizeBoothSlots } from "../../../_lib/slots";
import { Button, Card } from "../../ui";

const GENDER_LABEL = { male: "남", female: "여" } as const;

export function CapacityGauge() {
  const { state } = useAdminStore();
  const [rebuilding, setRebuilding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const perBooth = useMemo(() => {
    return state.booths
      .map((booth) => {
        const rs = state.reservations.filter((r) => r.boothId === booth.id);
        return { booth, slots: summarizeBoothSlots(booth.tables, rs) };
      })
      .filter((b) => b.slots.length > 0);
  }, [state.booths, state.reservations]);

  async function handleRebuild() {
    setMsg(null);
    setRebuilding(true);
    try {
      const res = await rebuildInventoryAction();
      setMsg(res.ok ? "재고를 다시 계산했습니다." : res.error);
    } finally {
      setRebuilding(false);
    }
  }

  if (perBooth.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          정원 현황
        </h2>
        <Button variant="secondary" onClick={handleRebuild} disabled={rebuilding}>
          {rebuilding ? "계산 중..." : "재고 재계산"}
        </Button>
      </div>
      {msg && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{msg}</p>
      )}
      <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
        확정 / 정원 (접수: 대기 포함 · 오버부킹 상한). 확정이 정원에 닿으면 승인을 멈추세요.
      </p>

      <div className="mt-3 space-y-3">
        {perBooth.map(({ booth, slots }) => (
          <div key={booth.id}>
            <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              {booth.name}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {slots.map((s) => {
                const full = s.approved >= s.tableCount;
                const over = s.active > s.tableCount;
                return (
                  <span
                    key={s.slotKey}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] ${
                      full
                        ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                        : "border-black/10 text-neutral-600 dark:border-white/10 dark:text-neutral-300"
                    }`}
                  >
                    <span className="font-medium">
                      {s.capacity}인
                      {s.forMatching
                        ? ` 매칭·${s.gender ? GENDER_LABEL[s.gender] : ""}`
                        : " 일반"}
                    </span>
                    <span className="tabular-nums">
                      {s.approved}/{s.tableCount}
                    </span>
                    <span className="text-neutral-400 dark:text-neutral-500">
                      (접수 {s.active}
                      {over ? ` · 오버 ${s.active - s.tableCount}` : ""} / 상한{" "}
                      {s.limit})
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
