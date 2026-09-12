import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Reservation, ReservationStatus } from "./types";
import { slotRef } from "./firestore-inventory";
import { reservationSlotKey } from "./slots";

const COLLECTION = "reservations";
const ALIASES_COLLECTION = "boothAliases";
const PHONES_COLLECTION = "reservationPhones";

function reservationsCollection() {
  return getAdminDb().collection(COLLECTION);
}

/** 전화번호를 숫자만 남겨서 정규화 (문서 id로 사용) */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function phoneMarkerRef(phone: string) {
  return getAdminDb().collection(PHONES_COLLECTION).doc(normalizePhone(phone));
}

function toIso(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return (v as Timestamp).toDate().toISOString();
  }
  return "";
}

function toReservation(doc: FirebaseFirestore.QueryDocumentSnapshot): Reservation {
  const data = doc.data() as Omit<Reservation, "id">;
  return {
    id: doc.id,
    ...data,
    tableCapacity: data.tableCapacity ?? data.headcount ?? 0,
    assignedAlias: data.assignedAlias ?? null,
    pairedWith: data.pairedWith ?? null,
    createdAt: toIso(data.createdAt),
  };
}

export async function listReservations(): Promise<Reservation[]> {
  const snap = await reservationsCollection().get();
  return snap.docs.map(toReservation);
}

/** 이 전화번호로 이미 접수된(반려되지 않은) 예약이 있는지 */
export async function hasReservationForPhone(phone: string): Promise<boolean> {
  const snap = await phoneMarkerRef(phone).get();
  return snap.exists;
}

export async function setReservationStatus(
  id: string,
  status: Extract<ReservationStatus, "approved" | "rejected">,
): Promise<void> {
  if (status !== "rejected") {
    await reservationsCollection().doc(id).update({ status });
    return;
  }

  // 반려: 정원 슬롯 -1, 전화번호 마커 삭제(재예약 허용), 물고 있던 별칭 반환
  const db = getAdminDb();
  await db.runTransaction(async (tx) => {
    const resRef = reservationsCollection().doc(id);
    const resSnap = await tx.get(resRef);
    if (!resSnap.exists) return;

    const data = resSnap.data() as Partial<Reservation>;
    if (data.status === "rejected") return;

    // 짝지어진 매칭 상대가 있으면 - 이 예약이 거절돼도 상대는 그대로 승인 상태를 유지하되
    // (혼자 이용 가능), 더 이상 짝이 없으니 pairedWith만 풀어줌
    const partnerRef = data.pairedWith
      ? reservationsCollection().doc(data.pairedWith)
      : null;
    const partnerSnap = partnerRef ? await tx.get(partnerRef) : null;

    const alias = data.assignedAlias ?? null;
    const boothId = data.boothId;
    const key =
      boothId && data.tableCapacity != null
        ? reservationSlotKey({
            matching: !!data.matching,
            matchingGender: data.matchingGender,
            tableCapacity: data.tableCapacity,
          })
        : null;

    const sRef = boothId && key ? slotRef(boothId, key) : null;
    let active: number | null = null;
    if (sRef) {
      const sSnap = await tx.get(sRef);
      active = (sSnap.data()?.active as number | undefined) ?? 0;
    }

    let poolRef: FirebaseFirestore.DocumentReference | null = null;
    let assigned: string[] | null = null;
    if (alias && boothId) {
      poolRef = db.collection(ALIASES_COLLECTION).doc(boothId);
      const poolSnap = await tx.get(poolRef);
      if (poolSnap.exists) {
        assigned = Array.isArray(poolSnap.data()?.assigned)
          ? (poolSnap.data()!.assigned as string[])
          : [];
      }
    }

    tx.update(resRef, { status: "rejected", assignedAlias: null, pairedWith: null });
    if (partnerRef && partnerSnap?.exists) {
      tx.update(partnerRef, { pairedWith: null });
    }
    if (sRef && active !== null) {
      tx.set(sRef, { active: Math.max(0, active - 1) }, { merge: true });
    }
    if (data.phone) tx.delete(phoneMarkerRef(data.phone));
    if (poolRef && assigned) {
      tx.update(poolRef, { assigned: assigned.filter((a) => a !== alias) });
    }
  });
}

export class PairReservationsError extends Error {}

/**
 * 대기중인 매칭 예약 둘을 짝지어 하나의 테이블로 묶고 동시에 승인한다.
 * (같은 주점/날짜/시간대/인원수 + 서로 반대 성별이어야 하며, 둘 다 아직 대기중이어야 함 -
 *  이 조건은 호출하는 쪽(관리자 화면)에서 이미 걸러서 후보를 보여주지만, 여기서도 다시
 *  한번 확인해 동시에 다른 관리자가 같은 예약을 처리하는 경쟁 상황을 막는다.)
 */
export async function pairReservations(idA: string, idB: string): Promise<void> {
  if (idA === idB) throw new PairReservationsError("같은 예약을 짝지을 수 없습니다.");
  const db = getAdminDb();
  await db.runTransaction(async (tx) => {
    const refA = reservationsCollection().doc(idA);
    const refB = reservationsCollection().doc(idB);
    const [snapA, snapB] = await Promise.all([tx.get(refA), tx.get(refB)]);
    if (!snapA.exists || !snapB.exists) {
      throw new PairReservationsError("예약 정보를 찾을 수 없습니다.");
    }
    const a = snapA.data() as Partial<Reservation>;
    const b = snapB.data() as Partial<Reservation>;

    const bothPending = a.status === "pending" && b.status === "pending";
    const bothMatching = !!a.matching && !!b.matching;
    const sameSlot =
      a.boothId === b.boothId &&
      a.date === b.date &&
      a.time === b.time &&
      a.headcount === b.headcount;
    const oppositeGender =
      !!a.matchingGender && !!b.matchingGender && a.matchingGender !== b.matchingGender;
    const neitherPaired = !a.pairedWith && !b.pairedWith;

    if (!bothPending || !bothMatching || !sameSlot || !oppositeGender || !neitherPaired) {
      throw new PairReservationsError(
        "두 예약의 조건(주점/날짜/시간대/인원수/성별/처리 상태)이 맞지 않습니다.",
      );
    }

    tx.update(refA, { status: "approved", pairedWith: idB });
    tx.update(refB, { status: "approved", pairedWith: idA });
  });
}

/** 실수로 짝지은 걸 되돌림 - 승인 상태는 그대로 두고 pairedWith만 서로 풀어줌 */
export async function unpairReservation(id: string): Promise<void> {
  const db = getAdminDb();
  await db.runTransaction(async (tx) => {
    const ref = reservationsCollection().doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data() as Partial<Reservation>;
    if (!data.pairedWith) return;

    const partnerRef = reservationsCollection().doc(data.pairedWith);
    const partnerSnap = await tx.get(partnerRef);

    tx.update(ref, { pairedWith: null });
    if (partnerSnap.exists) tx.update(partnerRef, { pairedWith: null });
  });
}

export type CreateReservationSlot = {
  slotKey: string;
  capacity: number;
  tableCount: number;
  limit: number;
};

export class ReservationBlockedError extends Error {
  constructor(
    message: string,
    readonly code: "phone" | "full",
  ) {
    super(message);
    this.name = "ReservationBlockedError";
  }
}

/**
 * 공개 축제 페이지(/festival)에서 예약 신청 시 호출 - 인증 불필요.
 * 트랜잭션 안에서 O(1)로:
 *  1) 전화번호 중복 확인
 *  2) 정원 슬롯 문서 하나 읽어 정원(+오버부킹) 초과 여부 확인 후 +1
 *  3) 과팅이면 주점 별칭 풀에서 겹치지 않는 별칭 배정
 * status는 항상 "pending"으로 시작.
 *
 * @returns 정원 내(normal)인지 오버부킹 구간(overbook)인지 + 배정된 별칭
 */
export async function createReservation(
  input: Omit<
    Reservation,
    "id" | "status" | "createdAt" | "assignedAlias" | "tableCapacity"
  >,
  slot: CreateReservationSlot,
): Promise<{ zone: "normal" | "overbook"; assignedAlias: string | null }> {
  const db = getAdminDb();
  const reservationRef = reservationsCollection().doc();
  const sRef = slotRef(input.boothId, slot.slotKey);
  const pRef = phoneMarkerRef(input.phone);
  const poolRef = db.collection(ALIASES_COLLECTION).doc(input.boothId);

  return db.runTransaction(async (tx) => {
    // --- 읽기 먼저 ---
    const [slotSnap, phoneSnap] = await Promise.all([tx.get(sRef), tx.get(pRef)]);

    if (phoneSnap.exists) {
      throw new ReservationBlockedError(
        "이미 예약하신 전화번호입니다. 한 번호로는 한 건만 예약할 수 있습니다.",
        "phone",
      );
    }

    const active = (slotSnap.data()?.active as number | undefined) ?? 0;
    if (active >= slot.limit) {
      throw new ReservationBlockedError(
        "해당 인원의 예약이 마감되었습니다.",
        "full",
      );
    }
    const zone: "normal" | "overbook" =
      active >= slot.tableCount ? "overbook" : "normal";

    let assignedAlias: string | null = null;
    let poolAssigned: string[] | null = null;
    if (input.matching) {
      const poolSnap = await tx.get(poolRef);
      if (poolSnap.exists) {
        const aliases: string[] = Array.isArray(poolSnap.data()?.aliases)
          ? (poolSnap.data()!.aliases as string[])
          : [];
        const assigned: string[] = Array.isArray(poolSnap.data()?.assigned)
          ? (poolSnap.data()!.assigned as string[])
          : [];
        assignedAlias = aliases.find((a) => !assigned.includes(a)) ?? null;
        if (assignedAlias) poolAssigned = [...assigned, assignedAlias];
      }
    }

    // --- 쓰기 ---
    // matchingGender/participantDepartments처럼 과팅 미신청 시 undefined로 넘어오는 값은
    // Firestore가 문서 필드로 허용하지 않으므로 제거하고 씀 (키 자체를 안 넣음)
    const cleanInput = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    );
    tx.set(reservationRef, {
      ...cleanInput,
      tableCapacity: slot.capacity,
      assignedAlias,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(sRef, { active: active + 1 }, { merge: true });
    tx.set(pRef, {
      phone: input.phone,
      boothId: input.boothId,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (poolAssigned) tx.update(poolRef, { assigned: poolAssigned });

    return { zone, assignedAlias };
  });
}
