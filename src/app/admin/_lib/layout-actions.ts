"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import { getLayout, saveLayout } from "./firestore-layouts";
import type { SeasonLayout } from "./types";

export async function getLayoutAction(): Promise<ActionResult<SeasonLayout | null>> {
  return toActionResult(async () => {
    await requireAdmin();
    return getLayout();
  });
}

export async function saveLayoutAction(layout: SeasonLayout): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await saveLayout(layout);
  });
}
