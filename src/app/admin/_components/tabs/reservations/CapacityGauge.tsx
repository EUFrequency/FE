"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminStore } from "../../../_lib/store";
import { rebuildInventoryAction } from "../../../_lib/reservation-actions";
import { convertMatchingTableAction } from "../../../_lib/booth-actions";
import { getOverbookLimitAction } from "../../../_lib/settings-actions";
import { computeMatchingTableLeftover, summarizeBoothSlots } from "../../../_lib/slots";
import { DEFAULT_OVERBOOK_LIMIT } from "../../../_lib/types";
import { Badge, Button, Card } from "../../ui";

const GENDER_LABEL = { male: "남", female: "여" } as const;

export function CapacityGauge() {
  const { state, dispatch } = useAdminStore();
  const [rebuilding, setRebuilding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [overbookLimit, setOverbookLimit] = useState(DEFAULT_OVERBOOK_LIMIT);

  useEffect(() => {
    let alive = true;
    getOverbookLimitAction().then((res) => {
      if (alive && res.ok) setOverbookLimit(res.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const rows = useMemo(() => {
    return state.booths
      .map((booth) => {
        const rs = state.reservations.filter((r) => r.boothId === booth.id);
        const slots = summarizeBoothSlots(booth.tables, rs, overbookLimit);
        const leftovers = computeMatchingTableLeftover(booth.tables, rs).filter(
          (l) => l.leftover > 0 || l.pendingCount > 0,
        );
        return { booth, slots, leftovers };
      })
      .filter((b) => b.slots.length > 0);
  }, [state.booths, state.reservations, overbookLimit]);

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

  if (rows.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            정원 현황
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">
            배치도처럼 테이블 하나하나를 칸으로 보여줘요
          </p>
        </div>
        <Button variant="secondary" onClick={handleRebuild} disabled={rebuilding}>
          {rebuilding ? "계산 중..." : "재고 재계산"}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-500 dark:text-neutral-400">
        <LegendSwatch className="border-emerald-500/40 bg-emerald-500/15" label="확정" />
        <LegendSwatch className="border-amber-500/40 bg-amber-500/15" label="대기(배정 가능)" />
        <LegendSwatch
          className="border-dashed border-black/15 bg-black/[0.02] dark:border-white/15 dark:bg-white/[0.02]"
          label="빈자리"
        />
        <LegendSwatch
          className="border-dashed border-red-400/50 bg-red-500/5"
          label="추가 대기(오버부킹)"
        />
      </div>

      {msg && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{msg}</p>
      )}
      {convertError && <p className="mt-2 text-xs text-red-500">{convertError}</p>}

      <div className="mt-3 space-y-2">
        {rows.map(({ booth, slots, leftovers }) => {
          const fullCount = slots.filter((s) => s.approved >= s.tableCount).length;
          return (
            <div
              key={booth.id}
              className="rounded-xl border border-black/5 p-3 dark:border-white/5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  {booth.name}
                </span>
                {fullCount > 0 && (
                  <Badge tone="red">
                    {fullCount}/{slots.length}종 마감
                  </Badge>
                )}
              </div>

              <div className="mt-2.5 space-y-3">
                {slots.map((s) => {
                  const boxes: TableBox[] = [];
                  for (let i = 0; i < s.tableCount; i++) {
                    if (i < s.approved) boxes.push({ key: `c${i}`, kind: "confirmed" });
                    else if (i < s.active) boxes.push({ key: `p${i}`, kind: "pending" });
                    else boxes.push({ key: `e${i}`, kind: "empty" });
                  }
                  const overbookCount = Math.max(0, s.active - s.tableCount);
                  for (let i = 0; i < overbookCount; i++) {
                    boxes.push({ key: `w${i}`, kind: "waiting", num: i + 1 });
                  }

                  return (
                    <div key={s.slotKey}>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {s.capacity}인{" "}
                        {s.forMatching ? `매칭·${s.gender ? GENDER_LABEL[s.gender] : ""}` : "일반"}{" "}
                        <span className="text-neutral-400 dark:text-neutral-500">
                          (확정 {s.approved}/{s.tableCount})
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {boxes.map((b) => (
                          <TableBoxCell key={b.key} box={b} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {leftovers.length > 0 && (
                <div className="mt-2.5 space-y-1.5 border-t border-dashed border-black/10 pt-2.5 dark:border-white/10">
                  {leftovers.map((l) => (
                    <div
                      key={l.tableId}
                      className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
                    >
                      <span className="text-neutral-500 dark:text-neutral-400">
                        💘 {l.capacity}인 매칭 테이블 {l.occupied}/{l.count} 사용중
                        {l.pendingCount > 0 && (
                          <span className="ml-1 text-amber-600 dark:text-amber-400">
                            (대기 {l.pendingCount}건 먼저 처리)
                          </span>
                        )}
                      </span>
                      {l.pendingCount === 0 && l.leftover > 0 && (
                        <Button
                          variant="secondary"
                          disabled={convertingId === l.tableId}
                          onClick={() => handleConvert(booth.id, l.tableId, l.capacity, l.leftover)}
                        >
                          {convertingId === l.tableId
                            ? "전환 중..."
                            : `남는 ${l.leftover}개 일반으로 전환`}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

type TableBox =
  | { key: string; kind: "confirmed" | "pending" | "empty" }
  | { key: string; kind: "waiting"; num: number };

/** 배치도 칸과 같은 모양(둥근 사각 테두리, 빈자리는 점선)으로 테이블 하나를 표시 */
function TableBoxCell({ box }: { box: TableBox }) {
  const style =
    box.kind === "confirmed"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : box.kind === "pending"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : box.kind === "waiting"
          ? "border-dashed border-red-400/50 bg-red-500/5 text-red-500"
          : "border-dashed border-black/15 bg-black/[0.02] text-neutral-300 dark:border-white/15 dark:bg-white/[0.02] dark:text-neutral-600";
  const label =
    box.kind === "confirmed"
      ? "확정"
      : box.kind === "pending"
        ? "대기"
        : box.kind === "waiting"
          ? `대기${box.num}`
          : "빈자리";

  return (
    <div
      className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border text-center text-[9px] font-medium leading-tight ${style}`}
    >
      {label}
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-3 w-3 rounded-md border ${className}`} />
      {label}
    </span>
  );
}
