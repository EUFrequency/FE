import "server-only";
import { unstable_cache, updateTag } from "next/cache";
import { getAdminDb } from "@/lib/firebase/admin";
import type { SeasonLayout } from "./types";

const COLLECTION = "layouts";
/** 배치도는 시즌과 무관하게 항상 하나만 존재 - 문서 id 고정 */
const GLOBAL_LAYOUT_ID = "global";

function layoutRef() {
  return getAdminDb().collection(COLLECTION).doc(GLOBAL_LAYOUT_ID);
}

/**
 * 주점 배치도를 가져옴. 저장된 적 없으면 null.
 * /festival 공개 페이지도 쓰므로 60초 Data Cache로 감싸고, 배치도 저장/주점 삭제 시
 * "layout" 태그로 즉시 무효화함.
 */
export const getLayout = unstable_cache(
  async (): Promise<SeasonLayout | null> => {
    const doc = await layoutRef().get();
    if (!doc.exists) return null;
    return doc.data() as SeasonLayout;
  },
  ["layout"],
  { revalidate: 60, tags: ["layout"] },
);

export async function saveLayout(layout: SeasonLayout): Promise<void> {
  await layoutRef().set(layout);
  updateTag("layout");
}

/**
 * 삭제되는 주점을 배치도에서 제거. 주점 삭제와 같은 batch에 얹어서 쓰도록, 커밋은
 * 호출한 쪽에서 함. 배치도가 아직 없거나 그 주점이 배치돼 있지 않으면 아무 것도 안 함.
 */
export async function queueRemoveBoothFromLayout(
  batch: FirebaseFirestore.WriteBatch,
  boothId: string,
): Promise<void> {
  const doc = await layoutRef().get();
  if (!doc.exists) return;
  const layout = doc.data() as SeasonLayout;
  const cells = layout.cells ?? {};
  if (!Object.values(cells).includes(boothId)) return;

  const nextCells = Object.fromEntries(
    Object.entries(cells).map(([key, value]) => [key, value === boothId ? null : value]),
  );
  batch.update(doc.ref, { cells: nextCells });
}
