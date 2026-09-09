"use client";

import type { FestivalBooth } from "../_lib/palette";
import { MenuThumb } from "./MenuThumb";

type Props = {
  booth: FestivalBooth;
  onClose: () => void;
  onReserve: () => void;
};

export function BoothDetailModal({ booth, onClose, onReserve }: Props) {
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
          <div className="text-xs text-amber-600 dark:text-amber-400">
            {booth.department}
          </div>
          <h2 className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            {booth.name}
          </h2>
          <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {booth.descriptionText}
          </p>

          {booth.descriptionImages.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {booth.descriptionImages.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-24 w-24 flex-shrink-0 rounded-xl object-cover"
                />
              ))}
            </div>
          )}

          <div className="mt-5 inline-block rounded-full border border-amber-500/50 bg-amber-500/10 px-4 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
            최소 주문금액 {booth.minOrder.toLocaleString()}원
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
                      <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
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
            onClick={onReserve}
            className="h-14 w-full rounded-2xl bg-amber-500 font-semibold text-neutral-900 transition hover:bg-amber-400"
          >
            예약하러 가기 →
          </button>
        </div>
      </div>
    </div>
  );
}
