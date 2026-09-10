"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import { listBoothsLight } from "./firestore-booths";
import { rebuildBoothInventory } from "./firestore-inventory";
import { listReservations, setReservationStatus } from "./firestore-reservations";
import type { Reservation } from "./types";

export async function listReservationsAction(): Promise<ActionResult<Reservation[]>> {
  return toActionResult(async () => {
    await requireAdmin();
    return listReservations();
  });
}

export async function approveReservationAction(id: string): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await setReservationStatus(id, "approved");
  });
}

export async function rejectReservationAction(id: string): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await setReservationStatus(id, "rejected");
  });
}

/** 정원 슬롯 카운트가 실제 예약과 어긋났을 때 전체 주점에 대해 다시 계산 */
export async function rebuildInventoryAction(): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    const [booths, reservations] = await Promise.all([
      listBoothsLight(),
      listReservations(),
    ]);
    for (const booth of booths) {
      await rebuildBoothInventory(booth.id, reservations);
    }
  });
}
