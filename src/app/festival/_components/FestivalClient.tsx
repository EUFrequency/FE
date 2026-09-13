"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BoothMap } from "./BoothMap";
import { BoothDetailModal } from "./BoothDetailModal";
import { ReservationModal } from "./ReservationModal";
import { SuccessDialog } from "./SuccessDialog";
import { Modal } from "./Modal";
import { getPublicBoothAction } from "../_lib/booth-actions";
import { accentFor, withAccents, type FestivalBooth } from "../_lib/palette";
import type { Account, AdminBooth, Season } from "@/app/admin/_lib/types";

type Flow = "closed" | "detail" | "reservation" | "success";

export function FestivalClient({
  booths,
  season,
  generalOpen,
  matchingOpen,
  departments,
}: {
  booths: AdminBooth[];
  season: Season | null;
  /** 전체(일반) 예약 접수 중인지. false면 소개만 보이고 예약 버튼은 막힘 */
  generalOpen: boolean;
  /** 과팅 예약 접수 중인지. false면 예약 폼에서 과팅 신청 옵션이 막힘 */
  matchingOpen: boolean;
  /** 예약 폼의 학과 선택지 (관리자 페이지에서 관리) */
  departments: string[];
}) {
  // 배치도용 - 이미지 없이 가벼움. 목록 화면은 이거로 충분.
  const boothsWithAccent = useMemo(() => withAccents(booths), [booths]);

  const [flow, setFlow] = useState<Flow>("closed");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  // 주점을 눌렀을 때만 그 주점의 이미지 포함 전체 정보 + 입금 계좌를 따로 불러와 여기 담음
  const [boothDetail, setBoothDetail] = useState<FestivalBooth | null>(null);
  const [paymentAccount, setPaymentAccount] = useState<Account | null>(null);
  const [loadingBoothId, setLoadingBoothId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitInfo, setSubmitInfo] = useState<{
    zone: "normal" | "overbook";
    waitingNumber: number | null;
  } | null>(null);

  const openDetail = async (booth: FestivalBooth, index: number) => {
    setSelectedName(booth.name);
    setFlow("detail");
    setBoothDetail(null);
    setPaymentAccount(null);
    setLoadError(null);
    setLoadingBoothId(booth.id);
    try {
      const result = await getPublicBoothAction(booth.id);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setBoothDetail({ ...result.data.booth, ...accentFor(index) });
      setPaymentAccount(result.data.account);
    } finally {
      setLoadingBoothId(null);
    }
  };

  const closeAll = () => {
    setFlow("closed");
    setBoothDetail(null);
    setPaymentAccount(null);
    setSelectedName(null);
    setLoadError(null);
    setSubmitInfo(null);
  };

  const loading = loadingBoothId !== null;

  return (
    <main className="min-h-screen w-full bg-neutral-100 text-neutral-900 dark:bg-[#0b0805] dark:text-neutral-100">
      <div className="mx-auto flex w-full max-w-[440px] flex-col px-5 pt-10 pb-16">
        <header className="relative text-center">
          <div
            className="pointer-events-none absolute inset-x-0 -top-8 -z-10 mx-auto h-40 w-64 rounded-full bg-amber-500/25 blur-3xl dark:bg-amber-500/10"
            aria-hidden
          />

          {season && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${
                generalOpen
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-neutral-500/10 text-neutral-500 dark:text-neutral-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  generalOpen ? "animate-pulse bg-emerald-500" : "bg-neutral-400"
                }`}
              />
              {generalOpen ? "예약 접수중" : "예약 준비중"}
            </span>
          )}

          <div className="mt-3 text-xs font-medium tracking-[0.2em] text-amber-600 dark:text-amber-400">
            {season ? season.name : "FREQUENCY"}
          </div>
          <h1 className="mt-2 font-serif text-5xl font-bold italic tracking-tight text-neutral-900 dark:text-neutral-50">
            Frequency
          </h1>
          <div className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            축제편 주점 예약
          </div>
          {season && (
            <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-black/5 bg-white/70 px-4 py-2 text-xs text-neutral-600 shadow-sm backdrop-blur dark:border-white/5 dark:bg-white/[0.04] dark:text-neutral-300">
              <span>📍 본관 앞 운동장</span>
              <span className="h-3 w-px bg-neutral-300 dark:bg-neutral-700" />
              <span>
                🗓 {season.startDate} ~ {season.endDate}
              </span>
            </div>
          )}
        </header>

        <div className="mt-8">
          {season ? (
            <BoothMap booths={boothsWithAccent} onSelect={openDetail} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-black/10 px-5 py-16 text-center text-sm text-neutral-500 dark:border-white/10 dark:text-neutral-400">
              <span className="text-3xl opacity-60" aria-hidden>
                🎪
              </span>
              지금은 진행 중인 축제가 없습니다.
              <br />
              축제 기간에 다시 찾아와주세요.
            </div>
          )}
        </div>

        <Link
          href="/festival/notice"
          className="mt-8 flex items-center justify-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/5 py-3 text-sm font-medium text-amber-600 transition hover:bg-amber-500/10 dark:text-amber-400"
        >
          📋 예약 안내 확인하기
        </Link>
      </div>

      {/* Detail modal */}
      <Modal open={flow === "detail"} onClose={closeAll}>
        {loading || !boothDetail ? (
          <BoothLoadingSheet
            name={selectedName}
            error={loadError}
            onClose={closeAll}
          />
        ) : (
          <BoothDetailModal
            booth={boothDetail}
            reservationOpen={generalOpen}
            reservationPeriod={
              season
                ? { start: season.reservationStartDate, end: season.reservationEndDate }
                : null
            }
            onClose={closeAll}
            onReserve={() => setFlow("reservation")}
          />
        )}
      </Modal>

      {/* Reservation modal */}
      <Modal
        open={flow === "reservation" && !!boothDetail && !!season && generalOpen}
        onClose={closeAll}
      >
        {boothDetail && season && generalOpen && (
          <ReservationModal
            booth={boothDetail}
            account={paymentAccount}
            season={season}
            matchingOpen={matchingOpen}
            departments={departments}
            onClose={closeAll}
            onSubmit={(info) => {
              setSubmitInfo(info);
              setFlow("success");
            }}
          />
        )}
      </Modal>

      {/* Success dialog (over the map) */}
      {flow === "success" && selectedName && (
        <SuccessDialog
          boothName={selectedName}
          zone={submitInfo?.zone ?? "normal"}
          waitingNumber={submitInfo?.waitingNumber ?? null}
          reservationEndDate={season?.reservationEndDate ?? null}
          onClose={closeAll}
        />
      )}
    </main>
  );
}

function BoothLoadingSheet({
  name,
  error,
  onClose,
}: {
  name: string | null;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-auto flex h-full flex-col">
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
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          {error ? (
            <>
              <p className="text-sm text-red-500">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-neutral-500 underline underline-offset-2 dark:text-neutral-400"
              >
                닫기
              </button>
            </>
          ) : (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {name ? `${name} 불러오는 중...` : "불러오는 중..."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
