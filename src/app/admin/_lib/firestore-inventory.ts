import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Reservation } from "./types";
import { reservationSlotKeys } from "./slots";

const COLLECTION = "boothInventory";
const SLOTS = "slots";

function slotsCollection(boothId: string) {
  return getAdminDb().collection(COLLECTION).doc(boothId).collection(SLOTS);
}

export function slotRef(boothId: string, slotKey: string) {
  return slotsCollection(boothId).doc(slotKey);
}

/** 주점의 모든 슬롯 활성 예약 수를 { slotKey: active }로 반환 */
export async function getSlotCounts(
  boothId: string,
): Promise<Record<string, number>> {
  const snap = await slotsCollection(boothId).get();
  const out: Record<string, number> = {};
  snap.docs.forEach((d) => {
    out[d.id] = (d.data()?.active as number | undefined) ?? 0;
  });
  return out;
}

/**
 * 실제 예약 데이터를 기준으로 한 주점의 슬롯 카운트를 다시 계산해서 덮어씀.
 * 관리자 "재고 재계산" 버튼용 - 카운터가 어긋났을 때 복구.
 */
export async function rebuildBoothInventory(
  boothId: string,
  reservations: Reservation[],
): Promise<void> {
  const counts: Record<string, number> = {};
  for (const r of reservations) {
    if (r.boothId !== boothId || r.status === "rejected") continue;
    for (const { slotKey, count } of reservationSlotKeys(r)) {
      counts[slotKey] = (counts[slotKey] ?? 0) + count;
    }
  }

  const db = getAdminDb();
  const existing = await slotsCollection(boothId).get();
  const batch = db.batch();
  existing.docs.forEach((d) => batch.delete(d.ref));
  for (const [key, active] of Object.entries(counts)) {
    batch.set(slotRef(boothId, key), { active });
  }
  await batch.commit();
}

/** 주점 삭제 시 그 주점의 재고 문서들도 정리 */
export async function deleteBoothInventory(boothId: string): Promise<void> {
  const existing = await slotsCollection(boothId).get();
  if (existing.empty) return;
  const batch = getAdminDb().batch();
  existing.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
