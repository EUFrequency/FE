import "server-only";
import { cache } from "react";
import {
  isGeneralReservationOpen,
  isMatchingReservationOpen,
  isViewOpen,
  listSeasons,
} from "@/app/admin/_lib/firestore-seasons";
import type { Season } from "@/app/admin/_lib/types";

type FestivalData = {
  seasons: Season[];
  /** 지금 조회 가능하거나(또는 진행 중인) 축제 시즌 (없으면 null) */
  activeSeason: Season | null;
  /** 주점 정보·메뉴를 조회할 수 있는 기간인지 - false면 /festival 전체가 잠김 */
  viewOpen: boolean;
  generalOpen: boolean;
  matchingOpen: boolean;
};

/**
 * /festival의 page.tsx와 generateMetadata가 같은 요청 안에서 이 함수를 호출하면
 * React cache()가 실제 Firestore 조회를 한 번만 하도록 묶어줌 (중복 읽기 방지).
 */
export const getFestivalData = cache(async (): Promise<FestivalData> => {
  const seasons = await listSeasons().catch(() => []);

  // 조회 가능하거나 축제가 진행중인 축제 시즌 하나를 찾음 - 강제 오픈/마감은 시즌의
  // 조회/예약 시각 자체를 바꾸는 방식이라(firestore-seasons.ts 참고) 별도 모드 분기가 없음.
  const activeSeason =
    seasons.find(
      (s) => s.type === "festival" && s.status !== "ended" && (isViewOpen(s) || s.status === "ongoing"),
    ) ?? null;

  return {
    seasons,
    activeSeason,
    viewOpen: activeSeason ? isViewOpen(activeSeason) : false,
    generalOpen: activeSeason ? isGeneralReservationOpen(activeSeason) : false,
    matchingOpen: activeSeason ? isMatchingReservationOpen(activeSeason) : false,
  };
});
