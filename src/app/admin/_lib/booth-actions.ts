"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import {
  deleteBooth,
  getBoothWithImages,
  listBoothsLight,
  saveBooth,
} from "./firestore-booths";
import type { AdminBooth } from "./types";

export async function listBoothsAction(): Promise<ActionResult<AdminBooth[]>> {
  return toActionResult(async () => {
    await requireAdmin();
    return listBoothsLight();
  });
}

export async function getBoothAction(id: string): Promise<ActionResult<AdminBooth | null>> {
  return toActionResult(async () => {
    await requireAdmin();
    return getBoothWithImages(id);
  });
}

export async function saveBoothAction(booth: AdminBooth): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await saveBooth(booth);
  });
}

export async function deleteBoothAction(id: string): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await deleteBooth(id);
  });
}
