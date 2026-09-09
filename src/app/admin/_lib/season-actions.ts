"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import { activateSeason, addSeason, listSeasons } from "./firestore-seasons";
import type { Season } from "./types";

export async function listSeasonsAction(): Promise<ActionResult<Season[]>> {
  return toActionResult(async () => {
    await requireAdmin();
    return listSeasons();
  });
}

export async function addSeasonAction(season: Season): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await addSeason(season);
  });
}

export async function activateSeasonAction(id: string): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await activateSeason(id);
  });
}
