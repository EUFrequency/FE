"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
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
