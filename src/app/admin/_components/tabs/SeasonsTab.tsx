"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../_lib/store";
import { createId } from "../../_lib/id";
import {
  addSeasonAction,
  deleteSeasonAction,
  endSeasonEarlyAction,
  listSeasonsAction,
  updateSeasonAction,
} from "../../_lib/season-actions";
import type { Season, SeasonStatus, SeasonType } from "../../_lib/types";
import { Badge, Button, Card, Input, Label, Select, SectionTitle } from "../ui";

const TYPE_LABEL: Record<SeasonType, string> = {
  festival: "축제 시즌",
  event: "이벤트 시즌",
};

const STATUS_LABEL: Record<SeasonStatus, string> = {
  upcoming: "예정",
  ongoing: "진행중",
  ended: "종료",
};

const STATUS_TONE: Record<SeasonStatus, "amber" | "green" | "neutral"> = {
  upcoming: "amber",
  ongoing: "green",
  ended: "neutral",
};

/** 오늘 기준 status를 낙관적으로 계산 (서버 응답을 다시 안 받아와도 화면에 바로 반영하기 위함) */
function computeOptimisticStatus(season: {
  startDate: string;
  endDate: string;
  earlyEndedAt: string | null;
}): SeasonStatus {
  if (season.earlyEndedAt) return "ended";
  const today = new Date().toISOString().slice(0, 10);
  if (today < season.startDate) return "upcoming";
  if (today > season.endDate) return "ended";
  return "ongoing";
}

type FormMode = "closed" | "add" | Season;

export function SeasonsTab() {
  const { state, dispatch, seasonsError } = useAdminStore();
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [formMode, setFormMode] = useState<FormMode>("closed");
  const [endingId, setEndingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const editingSeason = typeof formMode === "object" ? formMode : null;
  const formOpen = formMode !== "closed";

  const years = useMemo(() => {
    const set = new Set(state.seasons.map((s) => s.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [state.seasons]);

  const filtered = useMemo(() => {
    return state.seasons
      .filter((s) => yearFilter === "all" || s.year === Number(yearFilter))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [state.seasons, yearFilter]);

  async function handleEndEarly(season: Season) {
    if (
      !confirm(
        `'${season.name}'을(를) 오늘 날짜로 조기종료할까요?\n종료일이 오늘로 변경되고 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }
    setRowError(null);
    setEndingId(season.id);
    try {
      const result = await endSeasonEarlyAction(season.id);
      if (!result.ok) throw new Error(result.error);
      const today = new Date().toISOString().slice(0, 10);
      dispatch({ type: "seasons/endEarly", payload: { id: season.id, endDate: today } });
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "조기종료에 실패했습니다.");
    } finally {
      setEndingId(null);
    }
  }

  async function handleDelete(season: Season) {
    if (!confirm(`'${season.name}'을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setRowError(null);
    setDeletingId(season.id);
    try {
      const result = await deleteSeasonAction(season.id);
      if (!result.ok) throw new Error(result.error);
      dispatch({ type: "seasons/delete", payload: { id: season.id } });
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRefresh() {
    setRowError(null);
    setRefreshing(true);
    try {
      const result = await listSeasonsAction();
      if (!result.ok) throw new Error(result.error);
      dispatch({ type: "seasons/replaceAll", payload: result.data });
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "새로고침에 실패했습니다.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSubmitForm(season: Omit<Season, "status">) {
    if (editingSeason) {
      const result = await updateSeasonAction(editingSeason.id, season);
      if (!result.ok) throw new Error(result.error);
      dispatch({
        type: "seasons/update",
        payload: { ...season, status: computeOptimisticStatus(season) },
      });
    } else {
      const result = await addSeasonAction(season);
      if (!result.ok) throw new Error(result.error);
      dispatch({
        type: "seasons/add",
        payload: { ...season, status: computeOptimisticStatus(season) },
      });
    }
    setFormMode("closed");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          시즌 관리
        </h1>
        <div className="flex items-center gap-2">
          <Select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-32"
          >
            <option value="all">전체 연도</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </Select>
          <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "새로고침 중..." : "새로고침"}
          </Button>
          <Button
            variant="primary"
            onClick={() => setFormMode((v) => (v === "closed" ? "add" : "closed"))}
          >
            {formOpen ? "닫기" : "+ 새 시즌 추가"}
          </Button>
        </div>
      </div>

      {seasonsError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          <div className="font-semibold">Firebase 연동이 아직 설정되지 않았습니다.</div>
          <div className="mt-1 text-xs leading-5 opacity-90">{seasonsError}</div>
        </div>
      )}
      {rowError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {rowError}
        </div>
      )}

      {formOpen && (
        <SeasonForm
          key={editingSeason?.id ?? "new"}
          initial={editingSeason}
          onCancel={() => setFormMode("closed")}
          onSubmit={handleSubmitForm}
        />
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-black/5 text-xs text-neutral-500 dark:border-white/5 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">타입</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">연도</th>
                <th className="px-4 py-3 font-medium">축제 기간</th>
                <th className="px-4 py-3 font-medium">전체 예약</th>
                <th className="px-4 py-3 font-medium">과팅 예약</th>
                <th className="px-4 py-3 font-medium text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((season) => {
                const ongoing = season.status === "ongoing";
                return (
                  <tr
                    key={season.id}
                    className="border-b border-black/5 last:border-0 dark:border-white/5"
                  >
                    <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                      {season.name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={season.type === "festival" ? "amber" : "sky"}>
                        {TYPE_LABEL[season.type]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[season.status]}>
                        {STATUS_LABEL[season.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                      {season.year}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                      {season.startDate} ~ {season.endDate}
                      {season.earlyEndedAt && (
                        <span className="ml-1 text-red-500">(조기종료)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                      {season.reservationStartDate} ~ {season.reservationEndDate}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                      {season.matchingReservationStartDate} ~{" "}
                      {season.matchingReservationEndDate}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          disabled={ongoing}
                          title={
                            ongoing
                              ? "진행중인 시즌은 수정할 수 없습니다. 먼저 조기종료해주세요."
                              : undefined
                          }
                          onClick={() => setFormMode(season)}
                        >
                          수정
                        </Button>
                        {ongoing ? (
                          <Button
                            variant="danger"
                            disabled={endingId === season.id}
                            onClick={() => handleEndEarly(season)}
                          >
                            {endingId === season.id ? "처리 중..." : "조기종료"}
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            disabled={deletingId === season.id}
                            onClick={() => handleDelete(season)}
                          >
                            {deletingId === season.id ? "삭제 중..." : "삭제"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-neutral-400 dark:text-neutral-500"
                  >
                    조건에 맞는 시즌이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        상태는 축제 기간(시작일~종료일)에 따라 자동으로 정해집니다. /festival 예약 폼은 예약
        기간 안에서만 열립니다(축제 시작 전에 미리 받아도 됨). 진행중인 시즌을 예정보다 일찍
        끝내야 할 때만 &quot;조기종료&quot;를 누르세요 - 종료일이 오늘 날짜로 바뀌고 예약도 함께
        닫히며 되돌릴 수 없습니다. 같은 기간에 두 축제 시즌이 겹칠 수는 없습니다. 진행중인
        시즌은 수정·삭제할 수 없고(조기종료 후 삭제하거나, 대시보드의 강제 오픈/마감을
        사용하세요), 그 외 시즌은 자유롭게 수정·삭제할 수 있습니다(삭제 시 그 시즌의 배치도도
        함께 삭제됨).
      </p>
    </div>
  );
}

function SeasonForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: Season | null;
  onCancel: () => void;
  onSubmit: (season: Omit<Season, "status">) => Promise<void>;
}) {
  const currentYear = new Date().getFullYear();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<SeasonType>(initial?.type ?? "festival");
  const [year, setYear] = useState(initial?.year ?? currentYear);
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [reservationStartDate, setReservationStartDate] = useState(
    initial?.reservationStartDate ?? "",
  );
  const [reservationEndDate, setReservationEndDate] = useState(
    initial?.reservationEndDate ?? "",
  );
  const [matchingReservationStartDate, setMatchingReservationStartDate] = useState(
    initial?.matchingReservationStartDate ?? "",
  );
  const [matchingReservationEndDate, setMatchingReservationEndDate] = useState(
    initial?.matchingReservationEndDate ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    name.trim() &&
    startDate &&
    endDate &&
    startDate <= endDate &&
    reservationStartDate &&
    reservationEndDate &&
    reservationStartDate <= reservationEndDate &&
    reservationEndDate <= endDate &&
    matchingReservationStartDate &&
    matchingReservationEndDate &&
    matchingReservationStartDate <= matchingReservationEndDate &&
    matchingReservationStartDate >= reservationStartDate &&
    matchingReservationEndDate <= reservationEndDate;

  async function submit() {
    if (!valid || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        id: initial?.id ?? createId("season"),
        name: name.trim(),
        type,
        year,
        startDate,
        endDate,
        reservationStartDate,
        reservationEndDate,
        matchingReservationStartDate,
        matchingReservationEndDate,
        // 조기종료 여부는 이 폼에서 건드리지 않음 - 기존 값 그대로 유지(신규는 null)
        earlyEndedAt: initial?.earlyEndedAt ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-4">
      <SectionTitle>{initial ? "시즌 정보 수정" : "새 시즌 추가"}</SectionTitle>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <Label>시즌 이름</Label>
          <Input
            className="mt-1.5"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="2026 가을 대동제"
          />
        </label>
        <label className="block">
          <Label>타입</Label>
          <Select
            className="mt-1.5"
            value={type}
            onChange={(e) => setType(e.target.value as SeasonType)}
          >
            <option value="festival">축제 시즌</option>
            <option value="event">이벤트 시즌</option>
          </Select>
        </label>
        <label className="block">
          <Label>연도</Label>
          <Input
            className="mt-1.5"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <Label>축제 시작일</Label>
            <Input
              className="mt-1.5"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="block">
            <Label>축제 종료일</Label>
            <Input
              className="mt-1.5"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <Label>전체 예약 시작일</Label>
            <Input
              className="mt-1.5"
              type="date"
              value={reservationStartDate}
              onChange={(e) => setReservationStartDate(e.target.value)}
            />
          </label>
          <label className="block">
            <Label>전체 예약 마감일</Label>
            <Input
              className="mt-1.5"
              type="date"
              value={reservationEndDate}
              onChange={(e) => setReservationEndDate(e.target.value)}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <Label>과팅 예약 시작일</Label>
            <Input
              className="mt-1.5"
              type="date"
              value={matchingReservationStartDate}
              onChange={(e) => setMatchingReservationStartDate(e.target.value)}
            />
          </label>
          <label className="block">
            <Label>과팅 예약 마감일</Label>
            <Input
              className="mt-1.5"
              type="date"
              value={matchingReservationEndDate}
              onChange={(e) => setMatchingReservationEndDate(e.target.value)}
            />
          </label>
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
        축제 기간 = 예약자가 고르는 방문 날짜, 전체 예약 기간 = /festival에서 예약을 받는
        기간(마감일은 축제 종료일 이내), 과팅 예약 기간 = 과팅 신청을 받는 기간(전체 예약
        기간 안). 상황에 따라 대시보드에서 강제 오픈/마감으로 연장·조기마감할 수 있습니다.
      </p>
      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" disabled={submitting} onClick={onCancel}>
          취소
        </Button>
        <Button variant="primary" disabled={!valid || submitting} onClick={submit}>
          {submitting ? "저장 중..." : initial ? "수정 저장" : "추가"}
        </Button>
      </div>
    </Card>
  );
}
