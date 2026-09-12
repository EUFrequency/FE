"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../../_lib/store";
import { rebuildInventoryAction } from "../../../_lib/reservation-actions";
import { convertMatchingTableAction } from "../../../_lib/booth-actions";
import { computeMatchingTableLeftover, summarizeBoothSlots } from "../../../_lib/slots";
import { Button, Card } from "../../ui";

const GENDER_LABEL = { male: "남", female: "여" } as const;

export function CapacityGauge() {
  const { state, dispatch } = useAdminStore();
  const [rebuilding, setRebuilding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  const perBooth = useMemo(() => {
    return state.booths
      .map((booth) => {
        const rs = state.reservations.filter((r) => r.boothId === booth.id);
        return { booth, slots: summarizeBoothSlots(booth.tables, rs) };
      })
      .filter((b) => b.slots.length > 0);
  }, [state.booths, state.reservations]);

  const leftoverByBooth = useMemo(() => {
    return state.booths
      .map((booth) => {
        const rs = state.reservations.filter((r) => r.boothId === booth.id);
        const leftovers = computeMatchingTableLeftover(booth.tables, rs).filter(
          (l) => l.leftover > 0 || l.pendingCount > 0,
        );
        return { booth, leftovers };
      })
      .filter((b) => b.leftovers.length > 0);
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

  async function handleConvert(boothId: string, tableId: string, capacity: number, amount: number) {
    if (
      !confirm(
        `${capacity}인 매칭 테이블 중 남는 ${amount}개를 일반 테이블로 전환할까요? 이후에는 매칭 예약을 받지 않습니다.`,
      )
    ) {
      return;
    }
    setConvertError(null);
    setConvertingId(tableId);
    try {
      const result = await convertMatchingTableAction(boothId, tableId);
      if (!result.ok) throw new Error(result.error);
      dispatch({ type: "booths/update", payload: result.data });
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : "전환에 실패했습니다.");
    } finally {
      setConvertingId(null);
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

      {leftoverByBooth.length > 0 && (
        <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/5">
          <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            매칭 전용 테이블 전환
          </h3>
          <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
            과팅 예약을 다 처리(승인/반려)한 뒤, 짝을 못 찾아 남는 매칭 테이블을 일반
            테이블로 바꿀 수 있어요.
          </p>
          {convertError && (
            <p className="mt-2 text-xs text-red-500">{convertError}</p>
          )}
          <div className="mt-2 space-y-1.5">
            {leftoverByBooth.map(({ booth, leftovers }) =>
              leftovers.map((l) => (
                <div
                  key={`${booth.id}-${l.tableId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 px-3 py-2 text-xs dark:border-white/10"
                >
                  <span className="text-neutral-600 dark:text-neutral-300">
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {booth.name}
                    </span>{" "}
                    · {l.capacity}인 매칭 테이블 {l.occupied}/{l.count} 사용중
                    {l.pendingCount > 0 && (
                      <span className="ml-1.5 text-amber-600 dark:text-amber-400">
                        (대기중 {l.pendingCount}건 - 먼저 처리해주세요)
                      </span>
                    )}
                  </span>
                  {l.pendingCount === 0 && l.leftover > 0 && (
                    <Button
                      variant="secondary"
                      disabled={convertingId === l.tableId}
                      onClick={() =>
                        handleConvert(booth.id, l.tableId, l.capacity, l.leftover)
                      }
                    >
                      {convertingId === l.tableId
                        ? "전환 중..."
                        : `남는 ${l.leftover}개 일반으로 전환`}
                    </Button>
                  )}
                </div>
              )),
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
