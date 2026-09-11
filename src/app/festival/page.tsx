import type { Metadata, ResolvingMetadata } from "next";
import { listBoothsLight } from "@/app/admin/_lib/firestore-booths";
import { getDepartments } from "@/app/admin/_lib/firestore-settings";
import { getFestivalData } from "./_lib/active-season";
import { FestivalClient } from "./_components/FestivalClient";

// 예약 오픈/마감, 주점 목록 등 실시간성이 중요한 정보라 캐시 없이 매 요청마다 새로 조회함(SSR)
export const dynamic = "force-dynamic";

export async function generateMetadata(
  _props: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  // 루트 레이아웃의 openGraph/twitter(공유 미리보기 이미지 등)를 그대로 이어받고
  // title/description만 시즌에 맞게 덮어씀. 여기서 openGraph를 통째로 새로 만들면
  // 루트에서 자동으로 붙는 og:image가 통째로 사라짐 (Next는 얕은 병합이라 객체째 교체됨).
  const parentMeta = await parent;
  const { activeSeason } = await getFestivalData();
  const title = activeSeason ? activeSeason.name : "Frequency";
  const description = activeSeason
    ? `${activeSeason.name} 주점 예약 · ${activeSeason.startDate} ~ ${activeSeason.endDate}`
    : "학교 축제 주점 예약 - Frequency";

  return {
    title,
    description,
    openGraph: { ...parentMeta.openGraph, title, description },
    twitter: { ...parentMeta.twitter, title, description },
  };
}

export default async function FestivalPage() {
  // 이미지는 여기서 미리 안 가져옴 - 주점 카드를 눌렀을 때만 그 주점 것만 불러옴
  const [booths, { activeSeason, generalOpen, matchingOpen }, departments] = await Promise.all([
    listBoothsLight().catch(() => []),
    getFestivalData(),
    getDepartments().catch(() => []),
  ]);

  return (
    <FestivalClient
      booths={booths}
      season={activeSeason}
      generalOpen={generalOpen}
      matchingOpen={matchingOpen}
      departments={departments}
    />
  );
}
