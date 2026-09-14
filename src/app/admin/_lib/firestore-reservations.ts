import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  MIN_GENERAL_HEADCOUNT,
  type Reservation,
  type ReservationStatus,
  type TableConfig,
  type TableUsage,
} from "./types";
import { deleteBoothInventory, slotRef } from "./firestore-inventory";
import {
  canApproveReservation,
  reservationSlotKeys,
  resolveGeneralSlot,
} from "./slots";

const COLLECTION = "reservations";
const BOOTHS_COLLECTION = "booths";
const ALIASES_COLLECTION = "boothAliases";
const PHONES_COLLECTION = "reservationPhones";

export class ApprovalBlockedError extends Error {}

function reservationsCollection() {
  return getAdminDb().collection(COLLECTION);
}

/** 전화번호를 숫자만 남겨서 정규화 (문서 id로 사용) */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * 전화번호 중복은 "같은 날짜 + 같은 시간대"에만 적용 - 주점이 달라도 같은 시간대면 막고,
 * 날짜나 시간대가 다르면(다른 회차) 같은 번호로 또 예약할 수 있음.
 */
function phoneMarkerRef(phone: string, date: string, time: string) {
  const key = `${normalizePhone(phone)}|${date}|${time}`;
  return getAdminDb().collection(PHONES_COLLECTION).doc(key);
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

async function deleteAllDocsInBatches(collectionName: string): Promise<void> {
  const db = getAdminDb();
  const collRef = db.collection(collectionName);
  for (;;) {
    const snap = await collRef.limit(500).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * 모든 예약 내역(대기·승인·반려 가리지 않고 전부)과 그에 딸린 상태(전화번호 중복 마커,
 * 주점별 정원 슬롯 카운터)를 완전히 초기화한다 - 되돌릴 수 없음.
 * 별칭 풀(boothAliases)은 예약이 아니라 관리자가 등록해둔 설정이라 건드리지 않는다.
 */
export async function resetAllReservations(): Promise<void> {
  await deleteAllDocsInBatches(COLLECTION);
  await deleteAllDocsInBatches(PHONES_COLLECTION);

  const boothsSnap = await getAdminDb().collection(BOOTHS_COLLECTION).get();
  for (const boothDoc of boothsSnap.docs) {
    await deleteBoothInventory(boothDoc.id);
  }
}

/** 이 전화번호로 같은 날짜·시간대에 이미 접수된(반려되지 않은) 예약이 있는지 */
export async function hasReservationForPhone(
  phone: string,
  date: string,
  time: string,
): Promise<boolean> {
  const snap = await phoneMarkerRef(phone, date, time).get();
  return snap.exists;
}

export async function setReservationStatus(
  id: string,
  status: Extract<ReservationStatus, "approved" | "rejected">,
): Promise<void> {
  if (status === "approved") {
    // 승인(확정): 오버부킹은 접수까지만 허용되는 버퍼라, 실제 확정은 물리적 테이블 수를
    // 절대 넘을 수 없음 - 이미 그만큼 확정돼 있으면 앞선 확정 예약이 취소돼야 승인 가능.
    const db = getAdminDb();
    await db.runTransaction(async (tx) => {
      const resRef = reservationsCollection().doc(id);
      const resSnap = await tx.get(resRef);
      if (!resSnap.exists) throw new ApprovalBlockedError("예약 정보를 찾을 수 없습니다.");

      const data = resSnap.data() as Partial<Reservation>;
      if (data.status === "approved") return;
      if (data.status === "rejected") {
        throw new ApprovalBlockedError("이미 반려된 예약은 승인할 수 없습니다.");
      }
      if (!data.boothId) throw new ApprovalBlockedError("주점 정보가 없는 예약입니다.");

      const boothRef = getAdminDb().collection(BOOTHS_COLLECTION).doc(data.boothId);
      const [boothSnap, reservationsSnap] = await Promise.all([
        tx.get(boothRef),
        tx.get(reservationsCollection().where("boothId", "==", data.boothId)),
      ]);
      const tables = (boothSnap.data()?.tables as TableConfig[] | undefined) ?? [];
      const allReservations = reservationsSnap.docs.map((d) => toReservation(d));

      const check = canApproveReservation(tables, allReservations, {
        id,
        matching: !!data.matching,
        matchingGender: data.matchingGender,
        tableCapacity: data.tableCapacity ?? 0,
        tableAssignment: data.tableAssignment,
      });
      if (!check.ok) throw new ApprovalBlockedError(check.reason);

      tx.update(resRef, { status: "approved" });
    });
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
    // (혼자 이용 가능), 더 이상 짝이 없으니 pairedWith만 풀어줌 (상대의 별칭은 그대로 둠 -
    // 나중에 다른 상대와 다시 맺으면 그때 pairReservations가 새 별칭으로 덮어씀)
    const partnerRef = data.pairedWith
      ? reservationsCollection().doc(data.pairedWith)
      : null;
    const partnerSnap = partnerRef ? await tx.get(partnerRef) : null;

    const boothId = data.boothId;
    // 일반 예약은 테이블 조합(tableAssignment)이라 여러 슬롯을 동시에 -해야 할 수 있음
    const slotEntries = boothId
      ? reservationSlotKeys({
          matching: !!data.matching,
          matchingGender: data.matchingGender,
          tableCapacity: data.tableCapacity ?? 0,
          tableAssignment: data.tableAssignment,
        })
      : [];
    const slotTargets = slotEntries.map((entry) => ({
      ...entry,
      ref: slotRef(boothId!, entry.slotKey),
    }));
    const slotSnaps = await Promise.all(slotTargets.map((t) => tx.get(t.ref)));
    const slotDecrements = slotTargets.map((t, i) => ({
      ref: t.ref,
      newActive: Math.max(
        0,
        ((slotSnaps[i].data()?.active as number | undefined) ?? 0) - t.count,
      ),
    }));

    tx.update(resRef, { status: "rejected", assignedAlias: null, pairedWith: null });
    if (partnerRef && partnerSnap?.exists) {
      tx.update(partnerRef, { pairedWith: null });
    }
    for (const s of slotDecrements) {
      tx.set(s.ref, { active: s.newActive }, { merge: true });
    }
    if (data.phone && data.date && data.time) {
      tx.delete(phoneMarkerRef(data.phone, data.date, data.time));
    }
  });
}

export class PairReservationsError extends Error {}

/**
 * 이미 각자 승인(확정)된 매칭 예약 둘을 짝으로 묶는다 (관리자 페이지의 "매칭 관리" 탭에서 사용).
 * 승인은 성별별 정원(canApproveReservation)만으로 이미 끝난 상태라, 여기서는 상태를 바꾸지
 * 않고 서로의 id를 pairedWith에 기록하면서 같은 별칭(alias)을 양쪽에 똑같이 배정한다 -
 * 같은 주점/날짜/시간대/인원수 + 서로 반대 성별 + 둘 다 승인 상태 + 둘 다 아직 짝이 없어야 함.
 *
 * 별칭은 그 주점의 별칭 풀(boothAliases)에서 고르되, 같은 주점/날짜/시간대 안에서 다른
 * 승인된 예약이 이미 쓰고 있으면 거부한다(다른 회차는 겹쳐도 됨 - 그날 그 시간대에만
 * 사람들이 서로를 구분하면 되므로). 풀에 없는 새 별칭을 넘기면 그 자리에서 풀에도
 * 추가해서, 이후 다른 매칭에서도 바로 고를 수 있게 한다.
 */
export async function pairReservations(
  idA: string,
  idB: string,
  alias: string,
): Promise<void> {
  if (idA === idB) throw new PairReservationsError("같은 예약을 짝지을 수 없습니다.");
  const trimmedAlias = alias.trim();
  if (!trimmedAlias) throw new PairReservationsError("별칭을 입력해주세요.");

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

    const bothApproved = a.status === "approved" && b.status === "approved";
    const bothMatching = !!a.matching && !!b.matching;
    const sameSlot =
      a.boothId === b.boothId &&
      a.date === b.date &&
      a.time === b.time &&
      a.headcount === b.headcount;
    const oppositeGender =
      !!a.matchingGender && !!b.matchingGender && a.matchingGender !== b.matchingGender;
    const neitherPaired = !a.pairedWith && !b.pairedWith;

    if (!bothApproved || !bothMatching || !sameSlot || !oppositeGender || !neitherPaired) {
      throw new PairReservationsError(
        "두 예약의 조건(주점/날짜/시간대/인원수/성별/승인 상태)이 맞지 않습니다.",
      );
    }

    const boothId = a.boothId!;
    const date = a.date!;
    const time = a.time!;

    const sameSlotSnap = await tx.get(
      reservationsCollection()
        .where("boothId", "==", boothId)
        .where("date", "==", date)
        .where("time", "==", time)
        .where("status", "==", "approved"),
    );
    const aliasTaken = sameSlotSnap.docs.some(
      (d) =>
        d.id !== idA &&
        d.id !== idB &&
        (d.data().assignedAlias as string | null | undefined) === trimmedAlias,
    );
    if (aliasTaken) {
      throw new PairReservationsError(
        `"${trimmedAlias}" 별칭은 같은 날짜·시간대에 이미 사용 중입니다.`,
      );
    }

    const poolRef = getAdminDb().collection(ALIASES_COLLECTION).doc(boothId);
    const poolSnap = await tx.get(poolRef);
    const poolAliases: string[] = Array.isArray(poolSnap.data()?.aliases)
      ? (poolSnap.data()!.aliases as string[])
      : [];

    tx.update(refA, { pairedWith: idB, assignedAlias: trimmedAlias });
    tx.update(refB, { pairedWith: idA, assignedAlias: trimmedAlias });
    if (!poolAliases.includes(trimmedAlias)) {
      tx.set(poolRef, { boothId, aliases: [...poolAliases, trimmedAlias] }, { merge: true });
    }
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

/**
 * 확정(승인)된 매칭 예약 하나를 취소하고, 그 자리에 일반 예약을 새로 접수한다
 * (관리자 페이지 "매칭 관리" 탭에서 사용) - 예: 3인 매칭 팀이 매칭이 성사되지 않아
 * 그냥 자기들끼리 이용하기로 한 경우, 또는 이미 짝지어진 3:3 팀이 하나의 일반
 * 예약(최대 6인)으로 합쳐서 이용하기로 한 경우.
 *
 * newHeadcount는 이 예약의 팀 인원수(n)의 최대 2배(n*2)까지만 허용 - 짝지어진 상대까지
 * 합친 인원(짝지어진 두 팀은 항상 인원수가 같으므로 n+n=n*2)을 넘을 수 없다.
 * 짝이 있었다면 상대 예약도 함께 취소한다(같은 사람들이 새 일반 예약으로 흡수되므로).
 *
 * 새 일반 예약은 기존 예약의 대표자/연락처/학과/계좌/주문 내역을 그대로 물려받고,
 * 실제 테이블 배정은 createReservation의 resolveGeneralSlot에 맡긴다(인원수 구간에 맞는
 * 테이블 정원 하나 - 그 정원이 이미 다 찼으면 다른 정원으로 옮겨주지 않고 그냥 실패한다)
 * - 상태는 항상 새로 접수된 "대기"부터 시작해 관리자가 다시 승인해야 함
 * (물리 정원을 넘겨 확정되는 일이 없도록).
 */
export async function convertMatchingToGeneral(
  reservationId: string,
  newHeadcount: number,
): Promise<{ zone: "normal" | "overbook"; assignedAlias: string | null; waitingNumber: number | null }> {
  const resRef = reservationsCollection().doc(reservationId);
  const snap = await resRef.get();
  if (!snap.exists) throw new Error("예약 정보를 찾을 수 없습니다.");
  const data = snap.data() as Reservation;

  if (!data.matching) throw new Error("매칭 예약이 아닙니다.");
  if (data.status !== "approved") {
    throw new Error("확정된 매칭 예약만 일반 예약으로 전환할 수 있습니다.");
  }
  const maxHeadcount = data.headcount * 2;
  if (
    !Number.isInteger(newHeadcount) ||
    newHeadcount < MIN_GENERAL_HEADCOUNT ||
    newHeadcount > maxHeadcount
  ) {
    throw new Error(`인원수는 ${MIN_GENERAL_HEADCOUNT}명 이상 ${maxHeadcount}명 이하로 입력해주세요.`);
  }

  const boothSnap = await getAdminDb().collection(BOOTHS_COLLECTION).doc(data.boothId).get();
  const tables = (boothSnap.data()?.tables as TableConfig[] | undefined) ?? [];

  await setReservationStatus(reservationId, "rejected");
  if (data.pairedWith) {
    await setReservationStatus(data.pairedWith, "rejected");
  }

  return createReservation(
    {
      boothId: data.boothId,
      boothName: data.boothName,
      representativeName: data.representativeName,
      phone: data.phone,
      department: data.department,
      headcount: newHeadcount,
      date: data.date,
      time: data.time,
      bank: data.bank,
      accountNumber: data.accountNumber,
      matching: false,
      orderItems: data.orderItems,
      menuAmount: data.menuAmount,
      matchingFee: 0,
      totalAmount: data.menuAmount,
    },
    { kind: "general", tables },
  );
}

/** 매칭은 미리 정해진 테이블 하나, 일반은 인원수 구간에 맞는 정원을 트랜잭션 안에서
 *  골라야 해서(resolveGeneralSlot) 테이블 목록 자체를 넘김 */
export type CreateReservationSlot =
  | { kind: "matching"; slotKey: string; capacity: number; tableCount: number; limit: number }
  | { kind: "general"; tables: TableConfig[] };

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
 * 트랜잭션 안에서:
 *  1) 같은 날짜·시간대 전화번호 중복 확인
 *  2) 매칭이면 정원 슬롯 하나(오버부킹 포함 limit), 일반이면 인원수 구간(밴드)에 맞는
 *     테이블 정원 하나(오버부킹 없음)를 찾아 정원 초과 여부를 확인하고 슬롯을 +1
 * status는 항상 "pending"으로 시작하고, 별칭(assignedAlias)은 아직 없음(null) -
 * 매칭 관리 탭에서 짝을 지을 때 관리자가 배정한다(pairReservations 참고).
 *
 * @returns 정원 내(normal)인지 오버부킹 구간(overbook)인지(매칭만 해당) +
 *          오버부킹이면 대기 번째 수 (1부터 시작, 정원을 넘긴 뒤 몇 번째로 접수됐는지)
 */
export async function createReservation(
  input: Omit<
    Reservation,
    "id" | "status" | "createdAt" | "assignedAlias" | "tableCapacity" | "tableAssignment"
  >,
  slot: CreateReservationSlot,
): Promise<{
  zone: "normal" | "overbook";
  assignedAlias: string | null;
  waitingNumber: number | null;
}> {
  const db = getAdminDb();
  const reservationRef = reservationsCollection().doc();
  const pRef = phoneMarkerRef(input.phone, input.date, input.time);

  return db.runTransaction(async (tx) => {
    // --- 읽기 먼저 ---
    const phoneSnap = await tx.get(pRef);
    if (phoneSnap.exists) {
      throw new ReservationBlockedError(
        "이미 같은 날짜·시간대에 예약하신 전화번호입니다. 한 번호로 같은 시간대엔 한 건만 예약할 수 있습니다.",
        "phone",
      );
    }

    let tableCapacity: number;
    let tableAssignment: TableUsage[];
    let zone: "normal" | "overbook";
    let waitingNumber: number | null = null;
    const slotWrites: { ref: FirebaseFirestore.DocumentReference; active: number }[] = [];

    if (slot.kind === "matching") {
      const sRef = slotRef(input.boothId, slot.slotKey);
      const slotSnap = await tx.get(sRef);
      const active = (slotSnap.data()?.active as number | undefined) ?? 0;
      if (active >= slot.limit) {
        throw new ReservationBlockedError("해당 인원의 예약이 마감되었습니다.", "full");
      }
      zone = active >= slot.tableCount ? "overbook" : "normal";
      if (zone === "overbook") waitingNumber = active - slot.tableCount + 1;
      tableCapacity = slot.capacity;
      tableAssignment = [{ capacity: slot.capacity, count: 1 }];
      slotWrites.push({ ref: sRef, active: active + 1 });
    } else {
      // 일반: 인원수 구간(밴드)에 맞는 테이블 정원 하나에만 배정 - 여러 테이블을 조합해
      // 늘려주지 않고, 오버부킹도 없음(정원이 차면 바로 마감). resolveGeneralSlot 참고.
      const resolved = resolveGeneralSlot(slot.tables, input.headcount);
      if (!resolved.ok) {
        throw new ReservationBlockedError(resolved.reason, "full");
      }
      const sRef = slotRef(input.boothId, resolved.slotKey);
      const slotSnap = await tx.get(sRef);
      const active = (slotSnap.data()?.active as number | undefined) ?? 0;
      if (active >= resolved.tableCount) {
        throw new ReservationBlockedError(
          "잔여 테이블이 부족하여 예약이 불가능합니다. 다른 시간대를 이용해주세요.",
          "full",
        );
      }
      zone = "normal";
      tableCapacity = resolved.capacity;
      tableAssignment = [{ capacity: resolved.capacity, count: 1 }];
      slotWrites.push({ ref: sRef, active: active + 1 });
    }

    // 별칭은 이제 예약 접수 시점이 아니라 매칭 관리 탭에서 짝을 지을 때 배정되므로
    // (pairReservations 참고) 여기서는 항상 null로 시작한다.
    const assignedAlias: string | null = null;

    // --- 쓰기 ---
    // matchingGender/participantDepartments처럼 과팅 미신청 시 undefined로 넘어오는 값은
    // Firestore가 문서 필드로 허용하지 않으므로 제거하고 씀 (키 자체를 안 넣음)
    const cleanInput = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    );
    tx.set(reservationRef, {
      ...cleanInput,
      tableCapacity,
      tableAssignment,
      assignedAlias,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });
    for (const w of slotWrites) {
      tx.set(w.ref, { active: w.active }, { merge: true });
    }
    tx.set(pRef, {
      phone: input.phone,
      boothId: input.boothId,
      date: input.date,
      time: input.time,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { zone, assignedAlias, waitingNumber };
  });
}
