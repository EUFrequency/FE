import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import type { SeasonLayout } from "./types";

const COLLECTION = "layouts";

function layoutsCollection() {
  return getAdminDb().collection(COLLECTION);
}

/** 시즌 배치도는 문서 id = seasonId. 저장된 적 없으면 null */
export async function getLayout(seasonId: string): Promise<SeasonLayout | null> {
  const doc = await layoutsCollection().doc(seasonId).get();
  if (!doc.exists) return null;
  return doc.data() as SeasonLayout;
}

export async function saveLayout(seasonId: string, layout: SeasonLayout): Promise<void> {
  await layoutsCollection().doc(seasonId).set(layout);
}

/** 시즌 삭제와 같은 batch에 얹어서, 그 시즌의 배치도 문서도 같이 지움 (없어도 안전) */
export function queueDeleteLayout(batch: FirebaseFirestore.WriteBatch, seasonId: string) {
  batch.delete(layoutsCollection().doc(seasonId));
}

/**
 * 삭제되는 주점을 모든 시즌 배치도에서 제거.
 * 주점 삭제와 같은 batch에 얹어서 쓰도록, 커밋은 호출한 쪽에서 함.
 * 실제로 그 주점이 배치돼 있던 시즌 배치도의 개수를 반환.
 */
export async function queueRemoveBoothFromLayouts(
  batch: FirebaseFirestore.WriteBatch,
  boothId: string,
): Promise<number> {
  const snap = await layoutsCollection().get();
  let touched = 0;

  snap.docs.forEach((doc) => {
    const layout = doc.data() as SeasonLayout;
    const cells = layout.cells ?? {};
    if (!Object.values(cells).includes(boothId)) return;

    const nextCells = Object.fromEntries(
      Object.entries(cells).map(([key, value]) => [key, value === boothId ? null : value]),
    );
    batch.update(doc.ref, { cells: nextCells });
    touched += 1;
  });

  return touched;
}
