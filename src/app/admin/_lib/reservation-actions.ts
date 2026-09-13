"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import { listBoothsLight } from "./firestore-booths";
import { rebuildBoothInventory } from "./firestore-inventory";
import {
  convertMatchingToGeneral,
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

/** 확정된 매칭 예약 둘을 짝짓고, 그 주점 별칭 풀에서 고른(또는 새로 입력한) 별칭을 양쪽에 배정 */
export async function pairReservationsAction(
  idA: string,
  idB: string,
  alias: string,
): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await pairReservations(idA, idB, alias);
  });
}

/** 잘못 짝지은 걸 되돌림 (승인 상태는 유지, 짝만 풀림) */
export async function unpairReservationAction(id: string): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await unpairReservation(id);
  });
}

/** 확정된 매칭 예약(및 짝이 있으면 상대까지)을 취소하고 그 인원으로 일반 예약을 새로 접수 */
export async function convertMatchingToGeneralAction(
  id: string,
  newHeadcount: number,
): Promise<ActionResult<{ zone: "normal" | "overbook"; waitingNumber: number | null }>> {
  return toActionResult(async () => {
    await requireAdmin();
    const { zone, waitingNumber } = await convertMatchingToGeneral(id, newHeadcount);
    return { zone, waitingNumber };
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
