"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import {
  getContactInfo,
  getDepartments,
  getOverbookLimit,
  setContactInfo,
  setDepartments,
  setOverbookLimit,
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

export async function getOverbookLimitAction(): Promise<ActionResult<number>> {
  return toActionResult(async () => {
    await requireAdmin();
    return getOverbookLimit();
  });
}

export async function setOverbookLimitAction(value: number): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await setOverbookLimit(value);
  });
}
