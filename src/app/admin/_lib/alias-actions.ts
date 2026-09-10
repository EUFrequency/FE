"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import { getBoothAliasPool, saveBoothAliasPool } from "./firestore-aliases";

export async function getBoothAliasPoolAction(
  boothId: string,
): Promise<ActionResult<string[]>> {
  return toActionResult(async () => {
    await requireAdmin();
    return getBoothAliasPool(boothId);
  });
}

export async function saveBoothAliasPoolAction(
  boothId: string,
  aliases: string[],
): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await saveBoothAliasPool(boothId, aliases);
  });
}
