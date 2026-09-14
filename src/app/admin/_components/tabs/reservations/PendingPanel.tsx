"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../../_lib/store";
import {
  approveReservationAction,
  rejectReservationAction,
} from "../../../_lib/reservation-actions";
import { buildApprovalMessage, buildRejectionMessage } from "../../../_lib/messages";
import type { Reservation } from "../../../_lib/types";
import { Button, Card, EmptyState, Select } from "../../ui";
import { CopyButton } from "../../CopyButton";
import { Modal } from "../../Modal";
import { CapacityGauge } from "./CapacityGauge";
import { ReservationDetails } from "./ReservationDetails";

type PendingAction =
  | { type: "approve"; reservation: Reservation }
  | { type: "reject"; reservation: Reservation };

/** ISO 문자열 -> "2026년 9월 15일 오후 3:24" (KST) */
function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function PendingPanel() {
  const { state, dispatch, reservationsError } = useAdminStore();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [boothFilter, setBoothFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");

  const pending = useMemo(
    () =>
      state.reservations
        .filter((r) => r.status === "pending")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [state.reservations],
  );

  // 필터 선택지는 지금 대기 중인 예약들 기준으로만 뽑음(처리된 예약은 이 탭 관심사가 아님)
  const boothOptions = useMemo(() => {
    const map = new Map<string, string>();
    pending.forEach((r) => map.set(r.boothId, r.boothName));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [pending]);
  const dateOptions = useMemo(
    () => Array.from(new Set(pending.map((r) => r.date))).sort(),
    [pending],
  );
  const timeOptions = useMemo(
    () => Array.from(new Set(pending.map((r) => r.time))).sort(),
    [pending],
  );

  const filteredPending = useMemo(
    () =>
      pending.filter(
        (r) =>
          (boothFilter === "all" || r.boothId === boothFilter) &&
          (dateFilter === "all" || r.date === dateFilter) &&
          (timeFilter === "all" || r.time === timeFilter),
      ),
    [pending, boothFilter, dateFilter, timeFilter],
  );

  function requestApprove(r: Reservation) {
    setActionError(null);
    setPendingAction({ type: "approve", reservation: r });
  }

  function requestReject(r: Reservation) {
    setActionError(null);
    setPendingAction({ type: "reject", reservation: r });
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    setActionBusy(true);
    setActionError(null);
    try {
      if (pendingAction.type === "approve") {
        const result = await approveReservationAction(pendingAction.reservation.id);
        if (!result.ok) throw new Error(result.error);
        dispatch({
          type: "reservations/approve",
          payload: { id: pendingAction.reservation.id },
        });
      } else {
        const result = await rejectReservationAction(pendingAction.reservation.id);
        if (!result.ok) throw new Error(result.error);
        dispatch({
          type: "reservations/reject",
          payload: { id: pendingAction.reservation.id },
        });
      }
      setPendingAction(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "처리에 실패했습니다.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {boothFilter === "all" && dateFilter === "all" && timeFilter === "all"
            ? `${pending.length}건 대기 중`
            : `${filteredPending.length}건 대기 중 (전체 ${pending.length}건)`}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-40"
            value={boothFilter}
            onChange={(e) => setBoothFilter(e.target.value)}
          >
            <option value="all">전체 주점</option>
            {boothOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
          <Select
            className="w-36"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="all">전체 날짜</option>
            {dateOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select
            className="w-44"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="all">전체 시간대</option>
            {timeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <CapacityGauge boothFilter={boothFilter} dateFilter={dateFilter} timeFilter={timeFilter} />

      {reservationsError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          <div className="font-semibold">Firebase 연동이 아직 설정되지 않았습니다.</div>
          <div className="mt-1 text-xs leading-5 opacity-90">{reservationsError}</div>
        </div>
      )}

      {filteredPending.length === 0 ? (
        <EmptyState>
          {pending.length === 0 ? "대기 중인 예약이 없습니다." : "필터에 맞는 예약이 없습니다."}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filteredPending.map((r) => (
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
                <dt className="text-neutral-500 dark:text-neutral-400">접수 시각</dt>
                <dd className="text-right text-neutral-900 dark:text-neutral-100">
                  {formatCreatedAt(r.createdAt)}
                </dd>
              </dl>

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="danger" onClick={() => requestReject(r)}>
                  반려
                </Button>
                <Button variant="primary" onClick={() => requestApprove(r)}>
                  입금 확인 · 승인
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={pendingAction !== null} onClose={() => !actionBusy && setPendingAction(null)}>
        {pendingAction && (
          <PendingActionModal
            action={pendingAction}
            busy={actionBusy}
            error={actionError}
            onConfirm={confirmPendingAction}
            onCancel={() => setPendingAction(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function actionModalTitle(action: PendingAction): string {
  return action.type === "approve" ? "예약 확정 안내 보내기" : "반려 안내 보내기";
}

function confirmButtonLabel(action: PendingAction): string {
  return action.type === "approve" ? "승인 처리" : "반려 처리";
}

function messagesFor(action: PendingAction): { label: string; text: string }[] {
  const text =
    action.type === "approve"
      ? buildApprovalMessage(action.reservation)
      : buildRejectionMessage(action.reservation);
  return [{ label: action.reservation.representativeName, text }];
}

function PendingActionModal({
  action,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  action: PendingAction;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const messages = messagesFor(action);
  const r = action.reservation;
  return (
    <div className="p-5">
      <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
        {actionModalTitle(action)}
      </h2>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        아래 메시지를 복사해서 카카오톡으로 먼저 보내주세요. &quot;{confirmButtonLabel(action)}&quot;을
        눌러야 실제로 상태가 바뀝니다.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CopyButton text={r.phone} label="전화번호 복사" />
        {action.type === "reject" && (
          <CopyButton text={`${r.bank} ${r.accountNumber}`} label="계좌·은행 복사" />
        )}
      </div>

      {action.type === "reject" && (
        <div className="mt-3">
          <ReservationDetails reservation={r} defaultOpen />
        </div>
      )}

      <div className="mt-4 space-y-3">
        {messages.map((m, i) => (
          <CopyableMessage key={i} label={m.label} text={m.text} />
        ))}
      </div>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          취소
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={busy}>
          {busy ? "처리 중..." : confirmButtonLabel(action)}
        </Button>
      </div>
    </div>
  );
}

export function CopyableMessage({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 접근이 막힌 환경이면 조용히 무시 (텍스트는 이미 화면에 보임)
    }
  }

  return (
    <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
          {label}님께 보낼 메시지
        </span>
        <Button variant="secondary" onClick={copy}>
          {copied ? "복사됨" : "복사"}
        </Button>
      </div>
      <textarea
        readOnly
        value={text}
        rows={4}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-2 w-full resize-none rounded-lg border border-black/10 bg-neutral-50 p-2 text-xs leading-5 text-neutral-700 outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-200"
      />
    </div>
  );
}
