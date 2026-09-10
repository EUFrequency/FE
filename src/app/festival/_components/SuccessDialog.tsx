"use client";

type Props = {
  boothName: string;
  onClose: () => void;
};

export function SuccessDialog({ boothName, onClose }: Props) {
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
          예약이 접수되었습니다!
        </h3>
        <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
          <span className="font-semibold">{boothName}</span> 예약이
          접수되었습니다.
        </p>
        <p className="mt-2 text-xs leading-6 text-neutral-500 dark:text-neutral-400">
          입금 확인 후 예약이 확정됩니다.
          <br />
          과팅 매칭 성공 여부 및 취소·이용 안내는{" "}
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            카카오톡
          </span>
          으로 개별 안내해 드립니다.
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
