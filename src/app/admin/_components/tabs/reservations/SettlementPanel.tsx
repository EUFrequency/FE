"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../../_lib/store";
import type { ReservationStatus } from "../../../_lib/types";
import { Badge, Card, EmptyState, Label, Select } from "../../ui";

const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
};

const STATUS_TONE: Record<ReservationStatus, "amber" | "green" | "red"> = {
  pending: "amber",
  approved: "green",
  rejected: "red",
};

export function SettlementPanel() {
  const { state } = useAdminStore();
  const [boothFilter, setBoothFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const boothOptions = useMemo(() => {
    const map = new Map<string, string>();
    state.reservations.forEach((r) => map.set(r.boothId, r.boothName));
    return Array.from(map.entries());
  }, [state.reservations]);

  const filtered = useMemo(() => {
    return state.reservations
      .filter((r) => boothFilter === "all" || r.boothId === boothFilter)
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state.reservations, boothFilter, statusFilter]);

  const totalRevenue = filtered.reduce((s, r) => s + r.menuAmount, 0);
  const totalMatchingRevenue = filtered.reduce((s, r) => s + r.matchingFee, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <label className="flex items-center gap-2">
          <Label>주점</Label>
          <Select
            className="w-44"
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
        </label>
        <label className="flex items-center gap-2">
          <Label>상태</Label>
          <Select
            className="w-36"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">전체 상태</option>
            <option value="pending">대기</option>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
          </Select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="매출" value={totalRevenue} tone="amber" />
        <SummaryCard label="과팅 수익" value={totalMatchingRevenue} tone="purple" />
        <SummaryCard label="합계" value={totalRevenue + totalMatchingRevenue} tone="neutral" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState>조건에 맞는 예약이 없습니다.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-black/5 text-xs text-neutral-500 dark:border-white/5 dark:text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-medium">주점명</th>
                  <th className="px-4 py-3 font-medium">예약자</th>
                  <th className="px-4 py-3 text-right font-medium">매출</th>
                  <th className="px-4 py-3 text-right font-medium">과팅 수익</th>
                  <th className="px-4 py-3 text-right font-medium">합계</th>
                  <th className="px-4 py-3 font-medium">상태</th>
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
                      {r.representativeName}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-100">
                      {r.menuAmount.toLocaleString()}원
                    </td>
                    <td className="px-4 py-3 text-right text-purple-600 dark:text-purple-400">
                      {r.matchingFee.toLocaleString()}원
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                      {r.totalAmount.toLocaleString()}원
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        위 매출/과팅 수익/합계는 현재 필터에 걸린 예약 기준입니다. 실제로 입금이 끝난 금액만
        보려면 상태를 &quot;승인&quot;으로 필터링하세요.
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "purple" | "neutral";
}) {
  const toneClass = {
    amber: "text-amber-600 dark:text-amber-400",
    purple: "text-purple-600 dark:text-purple-400",
    neutral: "text-neutral-900 dark:text-neutral-100",
  }[tone];
  return (
    <Card className="p-4">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold ${toneClass}`}>
        {value.toLocaleString()}원
      </div>
    </Card>
  );
}
