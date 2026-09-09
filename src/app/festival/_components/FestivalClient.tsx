"use client";

import { useMemo, useState } from "react";
import { BoothMap } from "./BoothMap";
import { BoothDetailModal } from "./BoothDetailModal";
import { ReservationModal } from "./ReservationModal";
import { SuccessDialog } from "./SuccessDialog";
import { Modal } from "./Modal";
import { withAccents, type FestivalBooth } from "../_lib/palette";
import type { AdminBooth } from "@/app/admin/_lib/types";

type Flow = "closed" | "detail" | "reservation" | "success";

export function FestivalClient({ booths }: { booths: AdminBooth[] }) {
  const boothsWithAccent = useMemo(() => withAccents(booths), [booths]);

  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null);
  const [flow, setFlow] = useState<Flow>("closed");

  const selectedBooth: FestivalBooth | null =
    boothsWithAccent.find((b) => b.id === selectedBoothId) ?? null;

  const openDetail = (booth: FestivalBooth) => {
    setSelectedBoothId(booth.id);
    setFlow("detail");
  };

  const closeAll = () => {
    setFlow("closed");
    setSelectedBoothId(null);
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
          <BoothMap booths={boothsWithAccent} onSelect={openDetail} />
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
