"use client";

import { formatKoreanDateTime } from "@/lib/kst";

type Props = {
  boothName: string;
  /** available = 정원 내 확정 예약, overbook = 대기(오버부킹) 예약 */
  zone: "normal" | "overbook";
  /** overbook일 때 몇 번째 대기인지 (1부터 시작). normal이면 null */
  waitingNumber: number | null;
  /** 일반 예약 마감 시각 (YYYY-MM-DDTHH:mm) - 대기 예약 안내 문구에 씀. null(무기한)이면 생략 */
  reservationEndDate: string | null;
  onClose: () => void;
};

export function SuccessDialog({
  boothName,
  zone,
  waitingNumber,
  reservationEndDate,
  onClose,
}: Props) {
  const overbooked = zone === "overbook";
  const deadline = reservationEndDate ? formatKoreanDateTime(reservationEndDate) : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-50 p-6 pb-5 text-center shadow-2xl dark:bg-neutral-900">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-amber-500 text-amber-500">
          <svg viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-current">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-bold text-neutral-900 dark:text-neutral-50">
          {overbooked ? "대기 예약으로 접수되었습니다" : "예약이 접수되었습니다!"}
        </h3>
        <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
          <span className="font-semibold">{boothName}</span> 예약이
          접수되었습니다.
        </p>

        {overbooked && waitingNumber && (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
            현재 자리가 가득 차 대기 {waitingNumber}번으로 접수됐어요
          </p>
        )}

        <p className="mt-2 text-xs leading-6 text-neutral-500 dark:text-neutral-400">
          {overbooked ? (
            <>
              앞선 예약이 취소되는 경우에만 이용하실 수 있어요.
              {deadline && (
                <>
                  {" "}
                  예약 마감일({deadline})까지 취소 고객이 나오지 않으면 이용이
                  제한될 수 있습니다.
                </>
              )}
              <br />
              확정 여부는{" "}
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                카카오톡
              </span>
              으로 개별 안내해 드립니다.
            </>
          ) : (
            <>
              입금 확인 후 예약이 확정됩니다.
              <br />
              과팅 매칭 성공 여부 및 취소·이용 안내는{" "}
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                카카오톡
              </span>
              으로 개별 안내해 드립니다.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-14 w-full rounded-2xl bg-amber-500 font-semibold text-neutral-900 transition hover:bg-amber-400"
        >
          확인
        </button>
      </div>
    </div>
  );
}
