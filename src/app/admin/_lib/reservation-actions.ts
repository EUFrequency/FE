"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import { listBoothsLight } from "./firestore-booths";
import { rebuildBoothInventory } from "./firestore-inventory";
import {
  listReservations,
  pairReservations,
  setReservationStatus,
  unpairReservation,
} from "./firestore-reservations";
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

/** 대기중인 매칭 예약 둘을 짝지어 같은 테이블로 묶고 동시에 승인 */
export async function pairReservationsAction(
  idA: string,
  idB: string,
): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await pairReservations(idA, idB);
  });
}

/** 잘못 짝지은 걸 되돌림 (승인 상태는 유지, 짝만 풀림) */
export async function unpairReservationAction(id: string): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await unpairReservation(id);
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
