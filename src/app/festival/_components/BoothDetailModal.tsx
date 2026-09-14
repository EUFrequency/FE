"use client";

import { matchingHeadcountOptions } from "@/app/admin/_lib/slots";
import { lowestMinOrderAmount } from "@/app/admin/_lib/min-order";
import { formatPeriod } from "@/lib/kst";
import type { FestivalBooth } from "../_lib/palette";
import { ImageCarousel } from "./ImageCarousel";
import { MenuThumb } from "./MenuThumb";

type Props = {
  booth: FestivalBooth;
  /** 지금 예약 접수 기간인지 */
  reservationOpen: boolean;
  /** 예약 접수 기간 (안내 문구용) - end가 null이면 무기한("종료시까지") */
  reservationPeriod: { start: string; end: string | null } | null;
  onClose: () => void;
  onReserve: () => void;
};

export function BoothDetailModal({
  booth,
  reservationOpen,
  reservationPeriod,
  onClose,
  onReserve,
}: Props) {
  const matchingSizes = matchingHeadcountOptions(booth.tables);

  return (
    <div className="pointer-events-auto flex h-full flex-col">
      {/* Top gap showing festival header behind */}
      <div className="h-24 flex-shrink-0" onClick={onClose} />
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-neutral-50 shadow-2xl dark:bg-neutral-950">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-neutral-500 transition hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="닫기"
        >
          ✕
        </button>

        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-32">
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            {booth.department}
            {matchingSizes.length > 0 && (
              <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                💘 매칭 {matchingSizes.join("·")}인 팀
              </span>
            )}
          </div>
          <h2 className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            {booth.name}
          </h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {booth.descriptionText}
          </p>

          <ImageCarousel images={booth.descriptionImages} />

          <div className="mt-5 inline-block rounded-full border border-amber-500/50 bg-amber-500/10 px-4 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
            최소 주문금액 {lowestMinOrderAmount(booth.minOrderRules).toLocaleString()}원~
            {booth.minOrderRules.length > 1 && " (인원수에 따라 달라요)"}
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              메뉴 소개
            </h3>
            <ul className="mt-4 space-y-4">
              {booth.menus.map((menu) => (
                <li
                  key={menu.id}
                  className="overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/5 dark:bg-white/[0.03]"
                >
                  <MenuThumb image={menu.image} accentColor={booth.accentColor} />
                  <div className="flex items-start justify-between gap-3 p-4">
                    <div>
                      <div className="font-semibold text-neutral-900 dark:text-neutral-50">
                        {menu.name}
                      </div>
                      <div className="mt-1 whitespace-pre-line text-xs text-neutral-500 dark:text-neutral-400">
                        {menu.description}
                      </div>
                    </div>
                    <div className="whitespace-nowrap text-sm font-semibold text-amber-600 dark:text-amber-400">
                      {menu.price.toLocaleString()}원
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 border-t border-black/5 bg-neutral-50/95 p-4 backdrop-blur dark:border-white/5 dark:bg-neutral-950/95">
          <button
            type="button"
            onClick={reservationOpen ? onReserve : undefined}
            disabled={!reservationOpen}
            className="h-14 w-full rounded-2xl bg-amber-500 font-semibold text-neutral-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 dark:disabled:bg-white/10 dark:disabled:text-neutral-500"
          >
            {reservationOpen ? "예약하러 가기 →" : "예약 기간이 아닙니다"}
          </button>
          {!reservationOpen && reservationPeriod && (
            <div className="mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
              예약 기간: {formatPeriod(reservationPeriod.start, reservationPeriod.end)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
