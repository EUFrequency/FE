"use server";

import { requireAdmin, toActionResult, type ActionResult } from "./action-result";
import {
  deleteBooth,
  getBoothWithImages,
  listBoothsLight,
  saveBooth,
} from "./firestore-booths";
import { listReservations } from "./firestore-reservations";
import { createId } from "./id";
import { computeMatchingTableSafeLeftover } from "./slots";
import type { AdminBooth } from "./types";

export async function listBoothsAction(): Promise<ActionResult<AdminBooth[]>> {
  return toActionResult(async () => {
    await requireAdmin();
    return listBoothsLight();
  });
}

export async function getBoothAction(id: string): Promise<ActionResult<AdminBooth | null>> {
  return toActionResult(async () => {
    await requireAdmin();
    return getBoothWithImages(id);
  });
}

export async function saveBoothAction(booth: AdminBooth): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await saveBooth(booth);
  });
}

export async function deleteBoothAction(id: string): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireAdmin();
    await deleteBooth(id);
  });
}

/**
 * 남는 매칭 전용 테이블을 같은 정원의 일반 테이블로 전환한다.
 * 대기중인 매칭 예약이 남아있으면(먼저 승인/거절부터 끝내야 함) 거부하고,
 * 실제 남는 개수는 클라이언트 값을 안 믿고 서버에서 다시 계산해서 그만큼만 옮긴다.
 */
export async function convertMatchingTableAction(
  boothId: string,
  tableId: string,
): Promise<ActionResult<AdminBooth>> {
  return toActionResult(async () => {
    await requireAdmin();
    const booth = await getBoothWithImages(boothId);
    if (!booth) throw new Error("주점 정보를 찾을 수 없습니다.");
    const table = booth.tables.find((t) => t.id === tableId);
    if (!table || !table.forMatching) {
      throw new Error("매칭 전용 테이블이 아닙니다.");
    }

    const reservations = await listReservations();
    const leftover = computeMatchingTableSafeLeftover(booth.tables, reservations).find(
      (x) => x.tableId === tableId,
    );
    if (!leftover) throw new Error("테이블 정보를 다시 불러와주세요.");
    if (leftover.pendingCount > 0) {
      throw new Error(
        "아직 처리하지 않은 매칭 예약이 있습니다. 먼저 전부 승인/거절해주세요.",
      );
    }
    if (leftover.leftover <= 0) {
      throw new Error("전환할 수 있는 남는 테이블이 없습니다(다른 회차에서 쓰이고 있을 수 있어요).");
    }

    const amount = leftover.leftover;
    const decremented = booth.tables.map((t) =>
      t.id === tableId ? { ...t, count: t.count - amount } : t,
    );
    const existingGeneral = decremented.find(
      (t) => !t.forMatching && t.capacity === table.capacity,
    );
    const finalTables = existingGeneral
      ? decremented.map((t) =>
          t.id === existingGeneral.id ? { ...t, count: t.count + amount } : t,
        )
      : [
          ...decremented,
          { id: createId("table"), capacity: table.capacity, count: amount, forMatching: false },
        ];

    const updatedBooth: AdminBooth = { ...booth, tables: finalTables };
    await saveBooth(updatedBooth);
    return updatedBooth;
  });
}
