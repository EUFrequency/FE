import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";

const COLLECTION = "boothAliases";

function aliasDoc(boothId: string) {
  return getAdminDb().collection(COLLECTION).doc(boothId);
}

/** 주점의 별칭 풀을 읽음. 없으면 빈 배열 */
export async function getBoothAliasPool(boothId: string): Promise<string[]> {
  const snap = await aliasDoc(boothId).get();
  if (!snap.exists) return [];
  const aliases = snap.data()?.aliases;
  return Array.isArray(aliases) ? (aliases as string[]) : [];
}

/** 주점의 별칭 풀을 통째로 저장(덮어쓰기). 빈 배열이면 문서를 삭제 */
export async function saveBoothAliasPool(
  boothId: string,
  aliases: string[],
): Promise<void> {
  const cleaned = Array.from(
    new Set(aliases.map((a) => a.trim()).filter(Boolean)),
  );
  if (cleaned.length === 0) {
    await aliasDoc(boothId).delete();
    return;
  }
  await aliasDoc(boothId).set({ boothId, aliases: cleaned });
}
