"use client";

import { useRef, useState } from "react";

/**
 * 주점 소개 이미지를 모달 너비 가득 채워 보여주고, 여러 장이면 옆으로 스와이프해서
 * 한 장씩 넘겨보는 캐러셀. 라이브러리 없이 CSS scroll-snap으로 구현.
 * 모바일은 스와이프로, PC는 좌우 화살표 버튼으로도 넘길 수 있다.
 */
export function ImageCarousel({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) return null;

  function handleScroll() {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  }

  function goTo(index: number) {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="group/carousel relative -mx-5 mt-4">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        {images.map((src, i) => (
          <div
            key={i}
            className="flex h-80 w-full flex-shrink-0 snap-center items-center justify-center bg-neutral-100 dark:bg-neutral-900"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-contain" />
          </div>
        ))}
      </div>
      {images.length > 1 && active > 0 && (
        <button
          type="button"
          onClick={() => goTo(active - 1)}
          aria-label="이전 사진"
          className="absolute top-1/2 left-3 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/40 p-1.5 text-white opacity-0 transition-opacity group-hover/carousel:opacity-100 hover:bg-black/60 sm:flex"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
            <path d="M12.5 15 7.5 10l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {images.length > 1 && active < images.length - 1 && (
        <button
          type="button"
          onClick={() => goTo(active + 1)}
          aria-label="다음 사진"
          className="absolute top-1/2 right-3 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/40 p-1.5 text-white opacity-0 transition-opacity group-hover/carousel:opacity-100 hover:bg-black/60 sm:flex"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
            <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {images.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {images.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === active
                  ? "w-4 bg-amber-500"
                  : "w-1.5 bg-neutral-300 dark:bg-neutral-700"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
