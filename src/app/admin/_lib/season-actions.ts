"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import { addSeason, deleteSeason, endSeasonEarly, listSeasons } from "./firestore-seasons";
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
