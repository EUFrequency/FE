"use client";

import type { FestivalBooth } from "../_lib/palette";

type Props = {
  booths: FestivalBooth[];
  onSelect: (booth: FestivalBooth) => void;
};

export function BoothMap({ booths, onSelect }: Props) {
  return (
    <div className="w-full">
      <div className="rounded-2xl border border-amber-500/30 bg-black/20 p-4 dark:bg-white/[0.02]">
        <div className="mb-4 flex items-center gap-2 text-sm text-amber-500 dark:text-amber-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
          운동장 천막 내부 부스 배치도
        </div>

        {booths.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">
            아직 등록된 주점이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {booths.map((booth) => (
              <button
                key={booth.id}
                type="button"
                onClick={() => onSelect(booth)}
                className="group relative flex flex-col items-start rounded-xl border border-white/10 bg-neutral-100 p-4 text-left transition hover:-translate-y-0.5 hover:border-amber-500/40 dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                <span
                  className={`absolute right-3 top-3 h-2 w-2 rounded-full ${booth.dotClass}`}
                />
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {booth.department}
                </span>
                <span className="mt-1 text-base font-semibold text-neutral-900 dark:text-neutral-50">
                  {booth.name}
                </span>
                <span className="mt-3 text-xs text-neutral-500 dark:text-neutral-500">
                  최소 {booth.minOrder.toLocaleString()}원
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="h-px w-10 bg-neutral-400/50 dark:bg-neutral-600" />
          ▲ 입구
          <span className="h-px w-10 bg-neutral-400/50 dark:bg-neutral-600" />
        </div>
      </div>
      <p className="mt-5 text-center text-xs text-neutral-500 dark:text-neutral-500">
        부스를 탭하여 소개 및 예약
      </p>
    </div>
  );
}
