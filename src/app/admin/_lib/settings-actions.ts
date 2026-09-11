"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import {
  getContactInfo,
  getDepartments,
  getReservationSettings,
  setContactInfo,
  setDepartments,
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

export async function getDepartmentsAction(): Promise<ActionResult<string[]>> {
  return toActionResult(async () => {
    await requireAdmin();
    return getDepartments();
  });
}

export async function setDepartmentsAction(list: string[]): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await setDepartments(list);
  });
}
