"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../../_lib/store";
import {
  rejectReservationAction,
  unpairReservationAction,
} from "../../../_lib/reservation-actions";
import { buildMatchingCancelMessage } from "../../../_lib/messages";
import type { Reservation, ReservationStatus } from "../../../_lib/types";
import { Button, Card, EmptyState, Label, Select } from "../../ui";
import { CopyButton } from "../../CopyButton";
import { Modal } from "../../Modal";
import { CopyableMessage } from "./PendingPanel";
import { ReservationDetails } from "./ReservationDetails";

type ProcessedStatus = Extract<ReservationStatus, "approved" | "rejected">;

const STATUS_TABS: { key: ProcessedStatus; label: string }[] = [
  { key: "approved", label: "확정" },
  { key: "rejected", label: "반려" },
];

export function ProcessedPanel() {
  const { state, dispatch } = useAdminStore();
  const [status, setStatus] = useState<ProcessedStatus>("approved");
  const [boothFilter, setBoothFilter] = useState<string>("all");
  const [unpairError, setUnpairError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);

  const reservationsById = useMemo(
    () => new Map(state.reservations.map((r) => [r.id, r])),
    [state.reservations],
  );

  async function handleUnpair(id: string) {
    if (!confirm("이 예약의 매칭 짝을 풀까요? (승인 상태는 유지됩니다)")) return;
    setUnpairError(null);
    try {
      const result = await unpairReservationAction(id);
      if (!result.ok) throw new Error(result.error);
      dispatch({ type: "reservations/unpair", payload: { id } });
    } catch (e) {
      setUnpairError(e instanceof Error ? e.message : "짝 풀기에 실패했습니다.");
    }
  }

  const byStatus = useMemo(
    () => state.reservations.filter((r) => r.status === status),
    [state.reservations, status],
  );

  const boothOptions = useMemo(() => {
    const map = new Map<string, string>();
    byStatus.forEach((r) => map.set(r.boothId, r.boothName));
    return Array.from(map.entries());
  }, [byStatus]);

  // 상태 탭을 바꾸면 이전에 골라둔 주점이 이번 목록엔 없을 수 있으니 자동으로 전체로 리셋
  const boothFilterValid = boothFilter === "all" || boothOptions.some(([id]) => id === boothFilter);
  const effectiveBoothFilter = boothFilterValid ? boothFilter : "all";

  const filtered = byStatus.filter(
    (r) => effectiveBoothFilter === "all" || r.boothId === effectiveBoothFilter,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-black/10 p-1 dark:border-white/10">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setStatus(t.key);
                setBoothFilter("all");
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                status === t.key
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "text-neutral-500 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <Label>주점</Label>
          <Select
            className="w-48"
            value={effectiveBoothFilter}
            onChange={(e) => setBoothFilter(e.target.value)}
          >
            <option value="all">전체 주점</option>
            {boothOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <span className="block text-sm text-neutral-500 dark:text-neutral-400">
        {STATUS_TABS.find((t) => t.key === status)?.label} {filtered.length}건
      </span>

      {unpairError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {unpairError}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState>
          {status === "approved" ? "확정된 예약이 없습니다." : "반려된 예약이 없습니다."}
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-black/5 text-xs text-neutral-500 dark:border-white/5 dark:text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-medium">주점</th>
                  <th className="px-4 py-3 font-medium">대표자</th>
                  <th className="px-4 py-3 font-medium">연락처</th>
                  <th className="px-4 py-3 font-medium">일시</th>
                  <th className="px-4 py-3 font-medium">인원</th>
                  <th className="px-4 py-3 font-medium">과팅</th>
                  <th className="px-4 py-3 text-right font-medium">결제 금액</th>
                  {status === "approved" && <th className="px-4 py-3 font-medium">관리</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-black/5 last:border-0 dark:border-white/5"
                  >
                    <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                      {r.boothName}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-200">
                      {r.representativeName} · {r.department}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                      {r.phone}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                      {r.date} {r.time}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-200">
                      {r.headcount}명
                    </td>
                    <td className="px-4 py-3">
                      <ReservationDetails
                        reservation={r}
                        pairedReservation={
                          r.pairedWith ? (reservationsById.get(r.pairedWith) ?? null) : null
                        }
                        onUnpair={
                          r.pairedWith ? () => handleUnpair(r.id) : undefined
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                      {r.totalAmount.toLocaleString()}원
                    </td>
                    {status === "approved" && (
                      <td className="px-4 py-3">
                        <Button variant="danger" onClick={() => setCancelTarget(r)}>
                          취소
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={cancelTarget !== null} onClose={() => setCancelTarget(null)}>
        {cancelTarget && (
          <CancelApprovedModal
            reservation={cancelTarget}
            onDone={() => {
              dispatch({ type: "reservations/reject", payload: { id: cancelTarget.id } });
              setCancelTarget(null);
            }}
            onCancel={() => setCancelTarget(null)}
          />
        )}
      </Modal>
    </div>
  );
}

/**
 * 확정(승인)된 예약을 취소 - 매칭 관리 탭의 "취소하기"와 같은 흐름이지만, 매칭이 아닌
 * 일반 예약도 여기서 취소할 수 있도록 한다(지금까지는 확정된 일반 예약을 취소할 방법이
 * 관리자 화면에 아예 없었음). 매칭 예약이면 반려 처리 시 서버에서 알아서 짝도 함께 풀어준다
 * (firestore-reservations.ts의 setReservationStatus 참고) - 상대 예약 자체는 취소되지 않음.
 */
function CancelApprovedModal({
  reservation,
  onDone,
  onCancel,
}: {
  reservation: Reservation;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmCancel() {
    setBusy(true);
    setError(null);
    try {
      const result = await rejectReservationAction(reservation.id);
      if (!result.ok) throw new Error(result.error);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "취소에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
        예약 취소
      </h2>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        아래 메시지를 복사해서 카카오톡으로 먼저 보내주세요. &quot;취소 처리&quot;를 눌러야
        실제로 상태가 바뀝니다.
        {reservation.matching && reservation.pairedWith && (
          <> 짝지어진 상대 예약은 취소되지 않고, 짝만 풀립니다.</>
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CopyButton text={reservation.phone} label="전화번호 복사" />
        <CopyButton
          text={`${reservation.bank} ${reservation.accountNumber}`}
          label="계좌·은행 복사"
        />
      </div>

      <div className="mt-3">
        <ReservationDetails reservation={reservation} defaultOpen />
      </div>

      <div className="mt-4">
        <CopyableMessage
          label={reservation.representativeName}
          text={buildMatchingCancelMessage(reservation)}
        />
      </div>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          닫기
        </Button>
        <Button variant="danger" onClick={confirmCancel} disabled={busy}>
          {busy ? "처리 중..." : "취소 처리"}
        </Button>
      </div>
    </div>
  );
}
