"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import {
  deleteAccount,
  listAccounts,
  saveAccount,
  setDefaultAccount,
} from "./firestore-accounts";
import type { Account } from "./types";

export async function listAccountsAction(): Promise<ActionResult<Account[]>> {
  return toActionResult(async () => {
    await requireAdmin();
    return listAccounts();
  });
}

export async function saveAccountAction(account: Account): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await saveAccount(account);
  });
}

export async function setDefaultAccountAction(id: string): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await setDefaultAccount(id);
  });
}

export async function deleteAccountAction(id: string): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await deleteAccount(id);
  });
}
