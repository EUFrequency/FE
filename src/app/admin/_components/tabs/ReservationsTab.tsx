"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminStore } from "../../_lib/store";
import {
  listReservationsAction,
  resetAllReservationsAction,
} from "../../_lib/reservation-actions";
import { Button, Input, Label } from "../ui";
import { Modal } from "../Modal";
import { PendingPanel } from "./reservations/PendingPanel";
import { ProcessedPanel } from "./reservations/ProcessedPanel";
import { MatchingTab } from "./reservations/MatchingTab";
import { OrderHistoryPanel } from "./reservations/OrderHistoryPanel";
import { SettlementPanel } from "./reservations/SettlementPanel";

const SUB_TABS = [
  { key: "pending", label: "대기" },
  { key: "processed", label: "처리완료" },
  { key: "matching", label: "매칭 관리" },
  { key: "orders", label: "주문 내역" },
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
  const [resetOpen, setResetOpen] = useState(false);
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
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "새로고침 중..." : "새로고침"}
          </Button>
          <Button variant="danger" onClick={() => setResetOpen(true)}>
            전체 초기화
          </Button>
        </div>
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
      {sub === "processed" && <ProcessedPanel />}
      {sub === "matching" && <MatchingTab />}
      {sub === "orders" && <OrderHistoryPanel />}
      {sub === "settlement" && <SettlementPanel />}

      <Modal open={resetOpen} onClose={() => setResetOpen(false)}>
        {resetOpen && (
          <ResetAllModal
            onCancel={() => setResetOpen(false)}
            onDone={() => {
              setResetOpen(false);
              dispatch({ type: "reservations/replaceAll", payload: [] });
            }}
          />
        )}
      </Modal>
    </div>
  );
}

/** 예약 전체 삭제 - 되돌릴 수 없어서 로그인 세션과 별개로 ADMIN_PASSWORD를 한 번 더 확인 */
function ResetAllModal({
  onCancel,
  onDone,
}: {
  onCancel: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      const result = await resetAllReservationsAction(password);
      if (!result.ok) throw new Error(result.error);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "초기화에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-base font-semibold text-red-600 dark:text-red-400">
        예약 전체 초기화
      </h2>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        대기·승인·반려를 가리지 않고 모든 예약 내역과 정원 현황이 완전히
        삭제됩니다. <b className="font-semibold text-red-500">되돌릴 수 없어요.</b>{" "}
        계속하려면 관리자 비밀번호를 다시 입력해주세요.
      </p>

      <label className="mt-4 block">
        <Label>관리자 비밀번호</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirm()}
          autoFocus
          className="mt-1"
        />
      </label>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          취소
        </Button>
        <Button variant="danger" onClick={confirm} disabled={busy || !password}>
          {busy ? "초기화 중..." : "전체 삭제"}
        </Button>
      </div>
    </div>
  );
}
