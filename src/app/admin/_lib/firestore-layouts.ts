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
