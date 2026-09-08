"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../../_lib/store";
import { Badge, Button, Card, EmptyState } from "../../ui";
import { ReservationDetails } from "./ReservationDetails";

export function PendingPanel() {
  const { state, dispatch } = useAdminStore();
  const [showHistory, setShowHistory] = useState(false);

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

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {pending.length}건 대기 중
        </span>
      </div>

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
                  onClick={() =>
                    dispatch({ type: "reservations/reject", payload: { id: r.id } })
                  }
                >
                  반려
                </Button>
                <Button
                  variant="primary"
                  onClick={() =>
                    dispatch({ type: "reservations/approve", payload: { id: r.id } })
                  }
                >
                  입금 확인 · 승인
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
