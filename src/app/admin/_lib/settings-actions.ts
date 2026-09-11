"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import {
  getContactInfo,
  getReservationSettings,
  setContactInfo,
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

export async function getContactInfoAction(): Promise<ActionResult<string | null>> {
  return toActionResult(async () => {
    await requireAdmin();
    return getContactInfo();
  });
}

export async function setContactInfoAction(value: string): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await setContactInfo(value);
  });
}
