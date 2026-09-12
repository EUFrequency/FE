"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../../_lib/store";
import {
  approveReservationAction,
  pairReservationsAction,
  rejectReservationAction,
} from "../../../_lib/reservation-actions";
import type { Reservation } from "../../../_lib/types";
import { Button, Card, EmptyState } from "../../ui";
import { CapacityGauge } from "./CapacityGauge";
import { ReservationDetails } from "./ReservationDetails";

/** 두 매칭 팀의 학과 목록이 하나라도 겹치는지 (기록이 없으면 대표자 학과로 대신 비교) */
function overlappingDepartments(a: Reservation, b: Reservation): string[] {
  const deptsA = a.participantDepartments?.length ? a.participantDepartments : [a.department];
  const deptsB = b.participantDepartments?.length ? b.participantDepartments : [b.department];
  const setB = new Set(deptsB);
  return Array.from(new Set(deptsA.filter((d) => setB.has(d))));
}

export function PendingPanel() {
  const { state, dispatch, reservationsError } = useAdminStore();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [pairingForId, setPairingForId] = useState<string | null>(null);

  const pending = useMemo(
    () =>
      state.reservations
        .filter((r) => r.status === "pending")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
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

  function matchingCandidatesFor(r: Reservation): Reservation[] {
    return state.reservations.filter(
      (c) =>
        c.id !== r.id &&
        c.status === "pending" &&
        c.matching &&
        c.boothId === r.boothId &&
        c.date === r.date &&
        c.time === r.time &&
        c.headcount === r.headcount &&
        c.matchingGender &&
        r.matchingGender &&
        c.matchingGender !== r.matchingGender,
    );
  }

  async function handlePair(r: Reservation, candidate: Reservation) {
    const overlap = overlappingDepartments(r, candidate);
    if (overlap.length > 0) {
      const proceed = confirm(
        `두 팀 모두 ${overlap.join(", ")} 소속이 있습니다. 그래도 짝지을까요?`,
      );
      if (!proceed) return;
    }

    setRowError(null);
    setProcessingId(r.id);
    try {
      const result = await pairReservationsAction(r.id, candidate.id);
      if (!result.ok) throw new Error(result.error);
      dispatch({ type: "reservations/pair", payload: { idA: r.id, idB: candidate.id } });
      setPairingForId(null);
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "짝짓기에 실패했습니다.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <CapacityGauge />

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

              {r.matching && pairingForId === r.id && (
                <MatchingCandidates
                  reservation={r}
                  candidates={matchingCandidatesFor(r)}
                  busy={processingId === r.id}
                  onPick={(candidate) => handlePair(r, candidate)}
                  onClose={() => setPairingForId(null)}
                />
              )}

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="danger"
                  disabled={processingId === r.id}
                  onClick={() => handleReject(r.id)}
                >
                  반려
                </Button>
                {r.matching && (
                  <Button
                    variant="secondary"
                    disabled={processingId === r.id}
                    onClick={() =>
                      setPairingForId((prev) => (prev === r.id ? null : r.id))
                    }
                  >
                    {pairingForId === r.id ? "짝 찾기 닫기" : "짝 찾기"}
                  </Button>
                )}
                <Button
                  variant="primary"
                  disabled={processingId === r.id}
                  onClick={() => handleApprove(r.id)}
                >
                  {processingId === r.id
                    ? "처리 중..."
                    : r.matching
                      ? "상대 없이 승인"
                      : "입금 확인 · 승인"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const GENDER_LABEL: Record<string, string> = { male: "남성팀", female: "여성팀" };

function MatchingCandidates({
  reservation,
  candidates,
  busy,
  onPick,
  onClose,
}: {
  reservation: Reservation;
  candidates: Reservation[];
  busy: boolean;
  onPick: (candidate: Reservation) => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-purple-400/30 bg-purple-500/[0.05] p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
          짝지을 상대 팀 ({GENDER_LABEL[reservation.matchingGender ?? ""] ?? ""} 상대)
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
        >
          닫기
        </button>
      </div>
      {candidates.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
          같은 주점·날짜·시간대·인원수에 대기중인 반대 성별 팀이 없습니다.
        </p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {candidates.map((c) => {
            const overlap = overlappingDepartments(reservation, c);
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-black/5 bg-white px-3 py-2 text-xs dark:border-white/5 dark:bg-white/[0.03]"
              >
                <div>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {c.representativeName}
                  </span>
                  <span className="ml-1.5 text-neutral-500 dark:text-neutral-400">
                    {c.department} · {c.headcount}명
                  </span>
                  {overlap.length > 0 && (
                    <span className="ml-1.5 text-amber-600 dark:text-amber-400">
                      ⚠ 학과 겹침 ({overlap.join(", ")})
                    </span>
                  )}
                </div>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => onPick(c)}
                >
                  이 팀과 묶기
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
