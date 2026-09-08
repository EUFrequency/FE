import { EmptyState } from "../ui";

export function EventRequestsTab() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
        요청 관리
      </h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        이벤트 시즌(비회원 미팅 신청 등)의 요청 처리 기능은 추후 구현 예정입니다.
      </p>
      <EmptyState>추후 구현 예정입니다.</EmptyState>
    </div>
  );
}
