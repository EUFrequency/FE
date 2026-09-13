"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import {
  getContactInfo,
  getDepartments,
  setContactInfo,
  setDepartments,
} from "./firestore-settings";

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
