"use server";

import { unstable_cache } from "next/cache";
import { getBoothWithImages } from "@/app/admin/_lib/firestore-booths";
import type { AdminBooth } from "@/app/admin/_lib/types";

/**
 * 주점 상세(이미지 포함)를 60초 동안 캐시해서 가져옴 - 인증 불필요, 공개.
 *
 * 이 함수가 없으면 축제 당일 몰린 인원이 같은 주점을 동시에 열어볼 때마다
 * 매번 Firestore에서 이미지 서브컬렉션을 다시 읽어오게 되는데, unstable_cache로
 * 같은 주점은 60초에 한 번만 실제로 읽고 그 사이엔 캐시를 나눠 씀.
 */
const getCachedBooth = unstable_cache(
  async (id: string): Promise<AdminBooth | null> => getBoothWithImages(id),
  ["festival-booth-detail"],
  { revalidate: 60 },
);

export async function getPublicBoothAction(
  id: string,
): Promise<{ ok: true; data: AdminBooth } | { ok: false; error: string }> {
  try {
    const booth = await getCachedBooth(id);
    if (!booth) return { ok: false, error: "주점을 찾을 수 없습니다." };
    return { ok: true, data: booth };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "주점 정보를 불러오지 못했습니다.",
    };
  }
}
