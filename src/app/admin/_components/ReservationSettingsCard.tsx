"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../_lib/store";
import {
  forceCloseReservationAction,
  forceOpenReservationAction,
  listSeasonsAction,
} from "../_lib/season-actions";
import { isGeneralReservationOpen, isMatchingReservationOpen, isViewOpen } from "../_lib/season-status";
import { formatPeriod } from "@/lib/kst";
import { Button, Card, SectionTitle } from "./ui";

type Kind = "general" | "matching";

export function ReservationSettingsCard() {
  const { state, dispatch } = useAdminStore();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // /festival과 똑같은 기준으로 "지금 조작 대상 시즌"을 고름 - 조회 가능하거나 진행중인
  // 축제 시즌. 강제 오픈/마감은 이 시즌의 날짜를 직접 바꾸는 방식이라 여기서 딱 하나만 대상이 됨.
  const activeSeason = useMemo(
    () =>
      state.seasons.find(
        (s) => s.type === "festival" && s.status !== "ended" && (isViewOpen(s) || s.status === "ongoing"),
      ) ?? null,
    [state.seasons],
  );

  async function refresh() {
    const result = await listSeasonsAction();
    if (result.ok) dispatch({ type: "seasons/replaceAll", payload: result.data });
  }

  async function run(kind: Kind, action: "open" | "close") {
    if (!activeSeason) return;
    const key = `${kind}-${action}`;
    setBusyKey(key);
    setError(null);
    try {
      const result =
        action === "open"
          ? await forceOpenReservationAction(activeSeason.id, kind)
          : await forceCloseReservationAction(activeSeason.id, kind);
      if (!result.ok) throw new Error(result.error);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리에 실패했습니다.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Card className="p-4">
      <SectionTitle hint="/festival 예약 접수 스위치">예약 접수 설정</SectionTitle>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        평소엔 시즌 관리에서 등록한 예약 기간을 그대로 따릅니다. 상황에 따라 일찍
        닫아야 하면(강제 마감) 지금 이 순간을 마감 시각으로, 기간이 지나도 계속 받아야
        하면(강제 오픈) 지금 이 순간을 시작 시각으로 바꿉니다 - 원래 기간이 이미 끝난
        뒤에 강제 오픈하면 마감은 &quot;종료시까지&quot;(무기한)로 바뀝니다.
      </p>

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {!activeSeason ? (
        <div className="mt-4 rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-neutral-400 dark:border-white/10 dark:text-neutral-500">
          지금 조작할 수 있는 축제 시즌이 없습니다.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <ReservationRow
            label="일반 예약"
            open={isGeneralReservationOpen(activeSeason)}
            period={formatPeriod(activeSeason.reservationStartDate, activeSeason.reservationEndDate)}
            busy={busyKey === "general-open" || busyKey === "general-close"}
            onOpen={() => run("general", "open")}
            onClose={() => run("general", "close")}
          />
          <ReservationRow
            label="과팅 예약"
            open={isMatchingReservationOpen(activeSeason)}
            period={formatPeriod(
              activeSeason.matchingReservationStartDate,
              activeSeason.matchingReservationEndDate,
            )}
            busy={busyKey === "matching-open" || busyKey === "matching-close"}
            onOpen={() => run("matching", "open")}
            onClose={() => run("matching", "close")}
          />
        </div>
      )}
    </Card>
  );
}

function ReservationRow({
  label,
  open,
  period,
  busy,
  onOpen,
  onClose,
}: {
  label: string;
  open: boolean;
  period: string;
  busy: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/5 p-3 dark:border-white/5">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {label}
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              open
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-neutral-500/10 text-neutral-500 dark:text-neutral-400"
            }`}
          >
            {open ? "접수중" : "닫힘"}
          </span>
        </div>
        <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">{period}</div>
      </div>
      <div className="flex gap-1.5">
        <Button variant="secondary" disabled={busy} onClick={onOpen}>
          강제 오픈
        </Button>
        <Button variant="danger" disabled={busy} onClick={onClose}>
          강제 마감
        </Button>
      </div>
    </div>
  );
}
