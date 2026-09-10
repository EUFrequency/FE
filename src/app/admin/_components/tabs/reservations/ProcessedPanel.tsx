"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../../_lib/store";
import type { ReservationStatus } from "../../../_lib/types";
import { Card, EmptyState, Label, Select } from "../../ui";
import { ReservationDetails } from "./ReservationDetails";

type ProcessedStatus = Extract<ReservationStatus, "approved" | "rejected">;

const STATUS_TABS: { key: ProcessedStatus; label: string }[] = [
  { key: "approved", label: "확정" },
  { key: "rejected", label: "반려" },
];

export function ProcessedPanel() {
  const { state } = useAdminStore();
  const [status, setStatus] = useState<ProcessedStatus>("approved");
  const [boothFilter, setBoothFilter] = useState<string>("all");

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
                      <ReservationDetails reservation={r} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                      {r.totalAmount.toLocaleString()}원
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
