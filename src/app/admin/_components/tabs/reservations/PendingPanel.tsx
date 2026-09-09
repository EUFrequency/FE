"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../../_lib/store";
import {
  approveReservationAction,
  rejectReservationAction,
} from "../../../_lib/reservation-actions";
import { Badge, Button, Card, EmptyState } from "../../ui";
import { ReservationDetails } from "./ReservationDetails";

export function PendingPanel() {
  const { state, dispatch, reservationsError } = useAdminStore();
  const [showHistory, setShowHistory] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const pending = useMemo(
    () =>
      state.reservations
        .filter((r) => r.status === "pending")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [state.reservations],
  );

  const decided = useMemo(
    () => state.reservations.filter((r) => r.status !== "pending"),
    [state.reservations],
  );

  async function handleApprove(id: string) {
    setRowError(null);
    setProcessingId(id);
    try {
      const result = await approveReservationAction(id);
      if (!result.ok) throw new Error(result.error);
      dispatch({ type: "reservations/approve", payload: { id } });
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "승인에 실패했습니다.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(id: string) {
    setRowError(null);
    setProcessingId(id);
    try {
      const result = await rejectReservationAction(id);
      if (!result.ok) throw new Error(result.error);
      dispatch({ type: "reservations/reject", payload: { id } });
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "반려에 실패했습니다.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {pending.length}건 대기 중
        </span>
      </div>

      {reservationsError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          <div className="font-semibold">Firebase 연동이 아직 설정되지 않았습니다.</div>
          <div className="mt-1 text-xs leading-5 opacity-90">{reservationsError}</div>
        </div>
      )}
      {rowError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {rowError}
        </div>
      )}

      {pending.length === 0 ? (
        <EmptyState>대기 중인 예약이 없습니다.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {pending.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {r.boothName}
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {r.representativeName} · {r.department} · {r.phone}
                  </div>
                </div>
                <ReservationDetails reservation={r} />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
                <dt className="text-neutral-500 dark:text-neutral-400">일시</dt>
                <dd className="text-right text-neutral-900 dark:text-neutral-100">
                  {r.date} {r.time}
                </dd>
                <dt className="text-neutral-500 dark:text-neutral-400">인원</dt>
                <dd className="text-right text-neutral-900 dark:text-neutral-100">
                  {r.headcount}명
                </dd>
                <dt className="text-neutral-500 dark:text-neutral-400">결제 금액</dt>
                <dd className="text-right font-semibold text-amber-600 dark:text-amber-400">
                  {r.totalAmount.toLocaleString()}원
                </dd>
              </dl>

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="danger"
                  disabled={processingId === r.id}
                  onClick={() => handleReject(r.id)}
                >
                  반려
                </Button>
                <Button
                  variant="primary"
                  disabled={processingId === r.id}
                  onClick={() => handleApprove(r.id)}
                >
                  {processingId === r.id ? "처리 중..." : "입금 확인 · 승인"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-400"
          >
            {showHistory ? "처리 내역 숨기기" : `처리 내역 보기 (${decided.length})`}
          </button>
          {showHistory && (
            <Card className="mt-3 divide-y divide-black/5 dark:divide-white/5">
              {decided.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="text-neutral-700 dark:text-neutral-200">
                    {r.boothName} · {r.representativeName} · {r.date} {r.time}
                  </span>
                  <Badge tone={r.status === "approved" ? "green" : "red"}>
                    {r.status === "approved" ? "승인됨" : "반려됨"}
                  </Badge>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
