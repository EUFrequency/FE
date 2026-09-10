import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";

const COLLECTION = "boothAliases";

function aliasDoc(boothId: string) {
  return getAdminDb().collection(COLLECTION).doc(boothId);
}

function normalize(aliases: string[]): string[] {
  return Array.from(new Set(aliases.map((a) => a.trim()).filter(Boolean)));
}

/** 주점의 별칭 풀(후보 목록)을 읽음. 없으면 빈 배열 - 주점 등록/수정 폼용 */
export async function getBoothAliasPool(boothId: string): Promise<string[]> {
  const snap = await aliasDoc(boothId).get();
  if (!snap.exists) return [];
  const aliases = snap.data()?.aliases;
  return Array.isArray(aliases) ? (aliases as string[]) : [];
}

/**
 * 주점의 별칭 후보 목록을 저장(덮어쓰기). 빈 배열이면 문서를 삭제.
 * 이미 배정된 별칭(assigned)은 새 목록 안에 있는 것만 남긴다.
 */
export async function saveBoothAliasPool(
  boothId: string,
  aliases: string[],
): Promise<void> {
  const cleaned = normalize(aliases);
  const ref = aliasDoc(boothId);
  if (cleaned.length === 0) {
    await ref.delete();
    return;
  }
  const snap = await ref.get();
  const prevAssigned: string[] = Array.isArray(snap.data()?.assigned)
    ? (snap.data()!.assigned as string[])
    : [];
  const assigned = prevAssigned.filter((a) => cleaned.includes(a));
  await ref.set({ boothId, aliases: cleaned, assigned });
}
