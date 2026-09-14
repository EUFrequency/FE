"use client";

import { useMemo } from "react";
import { matchingHeadcountOptions } from "@/app/admin/_lib/slots";
import { lowestMinOrderAmount } from "@/app/admin/_lib/min-order";
import type { FestivalBooth } from "../_lib/palette";
import type { SeasonLayout } from "@/app/admin/_lib/types";

type Props = {
  booths: FestivalBooth[];
  /** 관리자 "주점 배치" 탭에서 저장한 배치도. null이면(아직 저장한 적 없음) 목록으로 대체 표시 */
  layout: SeasonLayout | null;
  onSelect: (booth: FestivalBooth, index: number) => void;
};

export function BoothMap({ booths, layout, onSelect }: Props) {
  const boothById = useMemo(() => new Map(booths.map((b) => [b.id, b])), [booths]);
  const indexById = useMemo(
    () => new Map(booths.map((b, i) => [b.id, i])),
    [booths],
  );

  // 배치도에 실제로 놓인(그리고 아직 존재하는) 주점이 하나라도 있어야 격자로 보여줌 -
  // 관리자가 배치도를 아직 안 만들었거나 다 비어있으면 예전처럼 목록으로 대체
  const hasPlacedBooths =
    !!layout &&
    Object.values(layout.cells).some((boothId) => boothId && boothById.has(boothId));

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-white p-4 dark:bg-white/[0.02]">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "16px 16px",
            color: "#f59e0b",
          }}
          aria-hidden
        />

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-amber-500 dark:text-amber-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
            운동장 천막 내부 부스 배치도
          </div>
          {booths.length > 0 && (
            <span className="text-[11px] text-neutral-500 dark:text-neutral-500">
              부스 {booths.length}곳
            </span>
          )}
        </div>

        <div className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-400/40 text-xs font-medium tracking-[0.3em] text-neutral-400 dark:border-neutral-600/50 dark:text-neutral-500">
          <span aria-hidden>🎤</span>
          무대
        </div>

        {booths.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-neutral-400 dark:text-neutral-500">
            <span className="text-2xl opacity-60" aria-hidden>
              🏮
            </span>
            아직 등록된 주점이 없습니다.
          </div>
        ) : hasPlacedBooths && layout ? (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: layout.rows }).map((_, r) =>
              Array.from({ length: layout.cols }).map((_, c) => {
                const cellKey = `${r}-${c}`;
                const boothId = layout.cells[cellKey];
                const occupant = boothId ? boothById.get(boothId) : null;
                if (!occupant) {
                  return (
                    <div
                      key={cellKey}
                      className="min-h-[108px] rounded-xl border border-dashed border-black/10 dark:border-white/10"
                      aria-hidden
                    />
                  );
                }
                return (
                  <BoothCard
                    key={cellKey}
                    booth={occupant}
                    onClick={() => onSelect(occupant, indexById.get(occupant.id) ?? 0)}
                  />
                );
              }),
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {booths.map((booth, index) => (
              <BoothCard key={booth.id} booth={booth} onClick={() => onSelect(booth, index)} />
            ))}
          </div>
        )}
      </div>
      <p className="mt-5 text-center text-xs text-neutral-500 dark:text-neutral-500">
        부스를 탭하여 소개 및 예약
      </p>
    </div>
  );
}

function BoothCard({ booth, onClick }: { booth: FestivalBooth; onClick: () => void }) {
  const canMatch = matchingHeadcountOptions(booth.tables).length > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-start overflow-hidden rounded-xl border border-white/10 bg-neutral-100 p-4 pl-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/[0.06] dark:bg-white/[0.03]"
      style={{ boxShadow: `inset 3px 0 0 0 ${booth.accentColor}` }}
    >
      <span className={`absolute right-3 top-3 h-2 w-2 rounded-full ${booth.dotClass}`} />
      <span className="text-xs text-neutral-500 dark:text-neutral-400">{booth.department}</span>
      <span className="mt-1 line-clamp-1 text-base font-semibold text-neutral-900 dark:text-neutral-50">
        {booth.name}
      </span>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
          최소 {lowestMinOrderAmount(booth.minOrderRules).toLocaleString()}원~
        </span>
        {canMatch && (
          <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-400">
            💘 매칭
          </span>
        )}
      </div>
    </button>
  );
}
