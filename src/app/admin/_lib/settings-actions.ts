"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import {
  getReservationSettings,
  setReservationSettings,
} from "./firestore-settings";
import type { ReservationSettings } from "./types";

export async function getReservationSettingsAction(): Promise<
  ActionResult<ReservationSettings>
> {
  return toActionResult(async () => {
    await requireAdmin();
    return getReservationSettings();
  });
}

export async function setReservationSettingsAction(
  settings: ReservationSettings,
): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await setReservationSettings(settings);
  });
}
