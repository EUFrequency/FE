"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../../_lib/store";
import { Card, EmptyState, Label, Select } from "../../ui";
import { ReservationDetails } from "./ReservationDetails";

export function ConfirmedPanel() {
  const { state } = useAdminStore();
  const [boothFilter, setBoothFilter] = useState<string>("all");

  const confirmed = useMemo(
    () => state.reservations.filter((r) => r.status === "approved"),
    [state.reservations],
  );

  const boothOptions = useMemo(() => {
    const map = new Map<string, string>();
    confirmed.forEach((r) => map.set(r.boothId, r.boothName));
    return Array.from(map.entries());
  }, [confirmed]);

  const filtered = confirmed.filter(
    (r) => boothFilter === "all" || r.boothId === boothFilter,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          확정된 예약 {filtered.length}건
        </span>
        <label className="flex items-center gap-2">
          <Label>주점</Label>
          <Select
            className="w-48"
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState>확정된 예약이 없습니다.</EmptyState>
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
