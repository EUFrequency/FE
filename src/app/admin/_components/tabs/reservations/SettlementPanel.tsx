"use client";

import { useMemo } from "react";
import { useAdminStore } from "../../../_lib/store";
import { Card, EmptyState } from "../../ui";

export function SettlementPanel() {
  const { state } = useAdminStore();

  const confirmed = useMemo(
    () => state.reservations.filter((r) => r.status === "approved"),
    [state.reservations],
  );

  const byBooth = useMemo(() => {
    const map = new Map<
      string,
      { boothId: string; boothName: string; revenue: number; matchingRevenue: number; count: number }
    >();
    for (const r of confirmed) {
      const entry = map.get(r.boothId) ?? {
        boothId: r.boothId,
        boothName: r.boothName,
        revenue: 0,
        matchingRevenue: 0,
        count: 0,
      };
      entry.revenue += r.menuAmount;
      entry.matchingRevenue += r.matchingFee;
      entry.count += 1;
      map.set(r.boothId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [confirmed]);

  const totalRevenue = byBooth.reduce((s, b) => s + b.revenue, 0);
  const totalMatchingRevenue = byBooth.reduce((s, b) => s + b.matchingRevenue, 0);

  if (confirmed.length === 0) {
    return <EmptyState>확정된 예약이 없어 집계할 매출이 없습니다.</EmptyState>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="전체 매출" value={totalRevenue} tone="amber" />
        <SummaryCard label="전체 과팅 수익" value={totalMatchingRevenue} tone="purple" />
        <SummaryCard
          label="합계"
          value={totalRevenue + totalMatchingRevenue}
          tone="neutral"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-black/5 text-xs text-neutral-500 dark:border-white/5 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">주점</th>
                <th className="px-4 py-3 text-right font-medium">확정 건수</th>
                <th className="px-4 py-3 text-right font-medium">매출</th>
                <th className="px-4 py-3 text-right font-medium">과팅 수익</th>
                <th className="px-4 py-3 text-right font-medium">합계</th>
              </tr>
            </thead>
            <tbody>
              {byBooth.map((b) => (
                <tr
                  key={b.boothId}
                  className="border-b border-black/5 last:border-0 dark:border-white/5"
                >
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                    {b.boothName}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-300">
                    {b.count}건
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-100">
                    {b.revenue.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-right text-purple-600 dark:text-purple-400">
                    {b.matchingRevenue.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                    {(b.revenue + b.matchingRevenue).toLocaleString()}원
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        승인(확정) 완료된 예약만 집계 대상입니다.
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
