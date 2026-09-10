import { listBoothsLight } from "@/app/admin/_lib/firestore-booths";
import {
  isGeneralReservationOpen,
  isMatchingReservationOpen,
  listSeasons,
} from "@/app/admin/_lib/firestore-seasons";
import { getReservationSettings } from "@/app/admin/_lib/firestore-settings";
import { FestivalClient } from "./_components/FestivalClient";

// Firestore 읽기를 매 방문마다 하지 않도록 짧게 캐시 (관리자가 바꾸면 최대 이 시간만큼 늦게 반영됨)
export const revalidate = 30;

export default async function FestivalPage() {
  // 이미지는 여기서 미리 안 가져옴 - 주점 카드를 눌렀을 때만 그 주점 것만 불러옴
  const [booths, seasons, settings] = await Promise.all([
    listBoothsLight().catch(() => []),
    listSeasons().catch(() => []),
    getReservationSettings().catch(() => ({ general: "auto" as const, matching: "auto" as const })),
  ]);

  // 예약을 받는 중이거나 축제가 진행중인 축제 시즌 하나를 찾음.
  const activeSeason =
    seasons.find(
      (s) =>
        s.type === "festival" &&
        s.status !== "ended" &&
        (isGeneralReservationOpen(s, settings.general) || s.status === "ongoing"),
    ) ?? null;

  const generalOpen = activeSeason
    ? isGeneralReservationOpen(activeSeason, settings.general)
    : false;
  const matchingOpen = activeSeason
    ? isMatchingReservationOpen(activeSeason, settings)
    : false;

  return (
    <FestivalClient
      booths={booths}
      season={activeSeason}
      generalOpen={generalOpen}
      matchingOpen={matchingOpen}
    />
  );
}
