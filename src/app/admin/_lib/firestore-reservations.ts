import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Reservation, ReservationStatus } from "./types";

const COLLECTION = "reservations";
const COUNTERS_COLLECTION = "counters";
const ORDER_NUMBER_COUNTER = "reservationOrderNumber";
const ALIASES_COLLECTION = "boothAliases";

function reservationsCollection() {
  return getAdminDb().collection(COLLECTION);
}

function toReservation(doc: FirebaseFirestore.QueryDocumentSnapshot): Reservation {
  const data = doc.data() as Omit<Reservation, "id">;
  return {
    id: doc.id,
    ...data,
    // 예전에 만들어진 문서 호환용 기본값
    orderNumber: data.orderNumber ?? 0,
    assignedAlias: data.assignedAlias ?? null,
  };
}

export async function listReservations(): Promise<Reservation[]> {
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
 * 과팅 신청 예약에 배정할 별칭을 고름.
 * 같은 주점에서 이미 배정된(반려되지 않은) 별칭은 제외하고 풀 순서대로 첫 빈 자리를 반환.
 * 풀이 비었거나 모두 소진되면 null.
 */
function pickAlias(pool: string[], usedAliases: Set<string>): string | null {
  for (const alias of pool) {
    if (!usedAliases.has(alias)) return alias;
  }
  return null;
}

/**
 * 공개 축제 페이지(/festival)에서 예약 신청 시 호출 - 인증 불필요.
 * status는 항상 "pending"으로 시작해서 관리자 승인을 거치게 됨.
 *
 * 트랜잭션 안에서
 *  1) 전역 카운터를 1 올려 고유 주문번호를 발급하고
 *  2) 과팅 신청이면 주점별 별칭 풀에서 겹치지 않는 별칭을 하나 배정한다.
 *
 * @returns 발급된 주문번호와 배정된 별칭
 */
export async function createReservation(
  input: Omit<
    Reservation,
    "id" | "status" | "createdAt" | "orderNumber" | "assignedAlias"
  >,
): Promise<{ orderNumber: number; assignedAlias: string | null }> {
  const db = getAdminDb();
  const reservationRef = reservationsCollection().doc();
  const counterRef = db.collection(COUNTERS_COLLECTION).doc(ORDER_NUMBER_COUNTER);

  return db.runTransaction(async (tx) => {
    // --- 모든 읽기 먼저 ---
    const counterSnap = await tx.get(counterRef);
    const current = (counterSnap.data()?.value as number | undefined) ?? 0;
    const orderNumber = current + 1;

    let assignedAlias: string | null = null;
    if (input.matching) {
      const poolSnap = await tx.get(
        db.collection(ALIASES_COLLECTION).doc(input.boothId),
      );
      const pool: string[] = Array.isArray(poolSnap.data()?.aliases)
        ? (poolSnap.data()!.aliases as string[])
        : [];

      if (pool.length > 0) {
        const boothReservationsSnap = await tx.get(
          reservationsCollection().where("boothId", "==", input.boothId),
        );
        const used = new Set<string>();
        boothReservationsSnap.forEach((doc) => {
          const data = doc.data();
          // 반려된 예약이 물고 있던 별칭은 다시 풀로 반환
          if (data.status !== "rejected" && data.assignedAlias) {
            used.add(data.assignedAlias as string);
          }
        });
        assignedAlias = pickAlias(pool, used);
      }
    }

    // --- 그다음 쓰기 ---
    const reservation: Omit<Reservation, "id"> = {
      ...input,
      orderNumber,
      assignedAlias,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    tx.set(reservationRef, reservation);
    tx.set(counterRef, { value: orderNumber }, { merge: true });

    return { orderNumber, assignedAlias };
  });
}
