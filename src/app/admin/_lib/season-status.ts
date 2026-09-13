import { nowKST } from "@/lib/kst";
import type { Season } from "./types";

/**
 * 순수 계산 함수만 모아둔 파일 - "server-only"가 아니라서 관리자 클라이언트 컴포넌트
 * (예: ReservationSettingsCard)에서도 그대로 가져다 쓸 수 있다. Firestore 접근이 필요한
 * 쪽은 firestore-seasons.ts에 있고, 거기서도 이 파일의 함수를 그대로 가져다 씀.
 */

/** 지금 주점 정보·메뉴를 조회할 수 있는 기간인지 - 이 기간 밖이면 /festival 전체가 잠김 */
export function isViewOpen(
  season: Pick<Season, "status" | "viewStartDate" | "viewEndDate">,
): boolean {
  if (season.status === "ended") return false;
  const now = nowKST();
  if (now < season.viewStartDate) return false;
  if (season.viewEndDate !== null && now > season.viewEndDate) return false;
  return true;
}

/** 지금 일반 예약을 받는 중인지 - 시즌의 예약 시작/마감 시각을 그대로 따름(마감 null=무기한) */
export function isGeneralReservationOpen(
  season: Pick<Season, "status" | "reservationStartDate" | "reservationEndDate">,
): boolean {
  if (season.status === "ended") return false;
  const now = nowKST();
  if (now < season.reservationStartDate) return false;
  if (season.reservationEndDate !== null && now > season.reservationEndDate) return false;
  return true;
}

/** 지금 과팅 예약을 받는 중인지 - 일반 예약이 열려 있어야 하고, 과팅 자체 기간도 안에 있어야 함 */
export function isMatchingReservationOpen(
  season: Pick<
    Season,
    | "status"
    | "reservationStartDate"
    | "reservationEndDate"
    | "matchingReservationStartDate"
    | "matchingReservationEndDate"
  >,
): boolean {
  if (!isGeneralReservationOpen(season)) return false;
  const now = nowKST();
  if (now < season.matchingReservationStartDate) return false;
  if (
    season.matchingReservationEndDate !== null &&
    now > season.matchingReservationEndDate
  ) {
    return false;
  }
  return true;
}
