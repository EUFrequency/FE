import { AccountManager } from "../AccountManager";
import { ReservationSettingsCard } from "../ReservationSettingsCard";
import { Card } from "../ui";

export function DashboardTab() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
        대시보드
      </h1>

      <ReservationSettingsCard />

      <Card className="p-4">
        <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
          대표 계좌는 주점을 등록할 때 별도 계좌를 지정하지 않으면 자동으로 쓰이는,
          시스템 전체의 기본 입금 계좌입니다. 올해처럼 모임통장 하나로 운영한다면
          여기서 계좌 하나만 등록하고 대표로 지정해두면 됩니다.
        </p>
        <AccountManager title="계좌 관리" />
      </Card>
    </div>
  );
}
