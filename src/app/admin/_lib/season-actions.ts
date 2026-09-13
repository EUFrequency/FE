"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import {
  addSeason,
  deleteSeason,
  endSeasonEarly,
  forceCloseReservation,
  forceOpenReservation,
  listSeasons,
  updateSeason,
} from "./firestore-seasons";
import type { Season } from "./types";

export async function listSeasonsAction(): Promise<ActionResult<Season[]>> {
  return toActionResult(async () => {
    await requireAdmin();
    return listSeasons();
  });
}

export async function addSeasonAction(season: Omit<Season, "status">): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await addSeason(season);
  });
}

export async function updateSeasonAction(
  id: string,
  patch: Omit<Season, "id" | "status">,
): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await updateSeason(id, patch);
  });
}

export async function endSeasonEarlyAction(id: string): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await endSeasonEarly(id);
  });
}

export async function deleteSeasonAction(id: string): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await deleteSeason(id);
  });
}

/** 지금(KST) 시각을 시작으로 삼아 그 종류(일반/과팅) 예약을 바로 열기 - 연장·조기오픈용 */
export async function forceOpenReservationAction(
  seasonId: string,
  kind: "general" | "matching",
): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await forceOpenReservation(seasonId, kind);
  });
}

/** 지금(KST) 시각을 마감으로 삼아 그 종류(일반/과팅) 예약을 바로 닫기 - 조기마감용 */
export async function forceCloseReservationAction(
  seasonId: string,
  kind: "general" | "matching",
): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await forceCloseReservation(seasonId, kind);
  });
}
