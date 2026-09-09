"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../_lib/store";
import { createId } from "../../_lib/id";
import { activateSeasonAction, addSeasonAction, listSeasonsAction } from "../../_lib/season-actions";
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

export function SeasonsTab() {
  const { state, dispatch, seasonsError } = useAdminStore();
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const years = useMemo(() => {
    const set = new Set(state.seasons.map((s) => s.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [state.seasons]);

  const filtered = useMemo(() => {
    return state.seasons
      .filter((s) => yearFilter === "all" || s.year === Number(yearFilter))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [state.seasons, yearFilter]);

  async function handleActivate(id: string) {
    setRowError(null);
    setActivatingId(id);
    try {
      const result = await activateSeasonAction(id);
      if (!result.ok) throw new Error(result.error);
      dispatch({ type: "seasons/activate", payload: { id } });
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "활성화에 실패했습니다.");
    } finally {
      setActivatingId(null);
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

  async function handleAdd(season: Season) {
    const result = await addSeasonAction(season);
    if (!result.ok) throw new Error(result.error);
    dispatch({ type: "seasons/add", payload: season });
    setShowAddForm(false);
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
          <Button variant="primary" onClick={() => setShowAddForm((v) => !v)}>
            {showAddForm ? "닫기" : "+ 새 시즌 추가"}
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

      {showAddForm && <AddSeasonForm onCancel={() => setShowAddForm(false)} onSubmit={handleAdd} />}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-black/5 text-xs text-neutral-500 dark:border-white/5 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">타입</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">연도</th>
                <th className="px-4 py-3 font-medium">기간</th>
                <th className="px-4 py-3 font-medium text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((season) => (
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
                  </td>
                  <td className="px-4 py-3 text-right">
                    {season.status === "ongoing" ? (
                      <Button variant="ghost" disabled>
                        진행 중
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        disabled={activatingId === season.id}
                        onClick={() => handleActivate(season.id)}
                      >
                        {activatingId === season.id ? "처리 중..." : "활성화"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
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
        &quot;활성화&quot;를 누르면 해당 시즌이 진행중 상태가 되고, 기존에
        진행중이던 다른 시즌은 기간에 따라 예정/종료 상태로 자동 전환됩니다.
      </p>
    </div>
  );
}

function AddSeasonForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (season: Season) => Promise<void>;
}) {
  const currentYear = new Date().getFullYear();
  const [name, setName] = useState("");
  const [type, setType] = useState<SeasonType>("festival");
  const [year, setYear] = useState(currentYear);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim() && startDate && endDate && startDate <= endDate;

  async function submit() {
    if (!valid || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const status =
        today < startDate ? "upcoming" : today > endDate ? "ended" : "ongoing";
      await onSubmit({
        id: createId("season"),
        name: name.trim(),
        type,
        year,
        startDate,
        endDate,
        status,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "추가에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-4">
      <SectionTitle>새 시즌 추가</SectionTitle>
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
            <Label>시작일</Label>
            <Input
              className="mt-1.5"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="block">
            <Label>종료일</Label>
            <Input
              className="mt-1.5"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
      </div>
      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" disabled={submitting} onClick={onCancel}>
          취소
        </Button>
        <Button variant="primary" disabled={!valid || submitting} onClick={submit}>
          {submitting ? "추가 중..." : "추가"}
        </Button>
      </div>
    </Card>
  );
}
