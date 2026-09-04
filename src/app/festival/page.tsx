"use client";

import { useState } from "react";
import { BoothMap } from "./_components/BoothMap";
import { BoothDetailModal } from "./_components/BoothDetailModal";
import { ReservationModal } from "./_components/ReservationModal";
import { SuccessDialog } from "./_components/SuccessDialog";
import { Modal } from "./_components/Modal";
import type { Booth } from "./data";

type Flow = "closed" | "detail" | "reservation" | "success";

export default function FestivalPage() {
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);
  const [flow, setFlow] = useState<Flow>("closed");

  const openDetail = (booth: Booth) => {
    setSelectedBooth(booth);
    setFlow("detail");
  };

  const closeAll = () => {
    setFlow("closed");
    setSelectedBooth(null);
  };

  return (
    <main className="min-h-screen w-full bg-neutral-100 text-neutral-900 dark:bg-[#0b0805] dark:text-neutral-100">
      <div className="mx-auto flex w-full max-w-[440px] flex-col px-5 pt-10 pb-16">
        <header className="text-center">
          <div className="text-xs font-medium tracking-wide text-amber-600 dark:text-amber-400">
            2026 가을 대동제
          </div>
          <h1 className="mt-2 font-serif text-4xl font-bold italic tracking-tight text-neutral-900 dark:text-neutral-50">
            Frequency
          </h1>
          <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            축제편 주점 예약
          </div>
          <div className="mt-5 flex items-center justify-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
            <span>📍 본관 앞 운동장</span>
            <span>·</span>
            <span>🕐 18:00 – 21:30</span>
          </div>
        </header>

        <div className="mt-8">
          <BoothMap onSelect={openDetail} />
        </div>
      </div>

      {/* Detail modal */}
      <Modal open={flow === "detail" && !!selectedBooth} onClose={closeAll}>
        {selectedBooth && (
          <BoothDetailModal
            booth={selectedBooth}
            onClose={closeAll}
            onReserve={() => setFlow("reservation")}
          />
        )}
      </Modal>

      {/* Reservation modal */}
      <Modal
        open={flow === "reservation" && !!selectedBooth}
        onClose={closeAll}
      >
        {selectedBooth && (
          <ReservationModal
            booth={selectedBooth}
            onClose={closeAll}
            onSubmit={() => setFlow("success")}
          />
        )}
      </Modal>

      {/* Success dialog (over the map) */}
      {flow === "success" && selectedBooth && (
        <SuccessDialog
          boothName={selectedBooth.name}
          onClose={closeAll}
        />
      )}
    </main>
  );
}
