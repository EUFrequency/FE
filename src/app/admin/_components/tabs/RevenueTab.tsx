import { EmptyState } from "../ui";

export function RevenueTab() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
        매출 관리
      </h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        과팅 신청 매칭 비용 등을 통한 총 수익 통계는 추후 구현 예정입니다.
      </p>
      <EmptyState>추후 구현 예정입니다.</EmptyState>
    </div>
  );
}
