import "server-only";
import { cache } from "react";
import {
  isGeneralReservationOpen,
  isMatchingReservationOpen,
  listSeasons,
} from "@/app/admin/_lib/firestore-seasons";
import { getReservationSettings } from "@/app/admin/_lib/firestore-settings";
import type { ReservationSettings, Season } from "@/app/admin/_lib/types";

type FestivalData = {
  seasons: Season[];
  settings: ReservationSettings;
  /** 지금 예약을 받고 있거나 진행 중인 축제 시즌 (없으면 null) */
  activeSeason: Season | null;
  generalOpen: boolean;
  matchingOpen: boolean;
};

/**
 * /festival의 page.tsx와 generateMetadata가 같은 요청 안에서 이 함수를 호출하면
 * React cache()가 실제 Firestore 조회를 한 번만 하도록 묶어줌 (중복 읽기 방지).
 */
export const getFestivalData = cache(async (): Promise<FestivalData> => {
  const [seasons, settings] = await Promise.all([
    listSeasons().catch(() => []),
    getReservationSettings().catch(
      () => ({ general: "auto", matching: "auto" }) as ReservationSettings,
    ),
  ]);

  // 예약을 받는 중이거나 축제가 진행중인 축제 시즌 하나를 찾음.
  // 이 "어떤 시즌이 지금 시즌인가" 판단은 항상 auto(실제 날짜) 기준으로만 함 - 관리자가
  // 예약을 강제 오픈/마감으로 걸어놨다고 해서 엉뚱한(예: 내년) 시즌이 선택되면 안 되기 때문.
  // 강제 오픈/마감은 아래 generalOpen/matchingOpen처럼 "선택된 시즌의 예약 가능 여부"에만 적용.
  const activeSeason =
    seasons.find(
      (s) =>
        s.type === "festival" &&
        s.status !== "ended" &&
        (isGeneralReservationOpen(s, "auto") || s.status === "ongoing"),
    ) ?? null;

  return {
    seasons,
    settings,
    activeSeason,
    generalOpen: activeSeason ? isGeneralReservationOpen(activeSeason, settings.general) : false,
    matchingOpen: activeSeason ? isMatchingReservationOpen(activeSeason, settings) : false,
  };
});
