import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { buildSeedReservations } from "./mock-data";
import type { Reservation, ReservationStatus } from "./types";

const COLLECTION = "reservations";

function reservationsCollection() {
  return getAdminDb().collection(COLLECTION);
}

function toReservation(doc: FirebaseFirestore.QueryDocumentSnapshot): Reservation {
  const data = doc.data() as Omit<Reservation, "id">;
  return { id: doc.id, ...data };
}

/** 컬렉션이 비어 있으면(최초 1회) 기존 더미 예약 데이터를 그대로 채워 넣음 */
async function seedIfEmpty() {
  const snap = await reservationsCollection().limit(1).get();
  if (!snap.empty) return;

  const batch = getAdminDb().batch();
  for (const reservation of buildSeedReservations()) {
    const { id, ...rest } = reservation;
    batch.set(reservationsCollection().doc(id), rest);
  }
  await batch.commit();
}

export async function listReservations(): Promise<Reservation[]> {
  await seedIfEmpty();
  const snap = await reservationsCollection().get();
  return snap.docs.map(toReservation);
}

export async function setReservationStatus(
  id: string,
  status: Extract<ReservationStatus, "approved" | "rejected">,
): Promise<void> {
  await reservationsCollection().doc(id).update({ status });
}

/**
 * 공개 축제 페이지(/festival)에서 예약 신청 시 호출 - 인증 불필요.
 * status는 항상 "pending"으로 시작해서 관리자 승인을 거치게 됨.
 */
export async function createReservation(
  input: Omit<Reservation, "id" | "status" | "createdAt">,
): Promise<void> {
  const ref = reservationsCollection().doc();
  const reservation: Omit<Reservation, "id"> = {
    ...input,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await ref.set(reservation);
}
