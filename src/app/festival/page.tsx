import type { Metadata, ResolvingMetadata } from "next";
import { listBoothsLight } from "@/app/admin/_lib/firestore-booths";
import { getDepartments } from "@/app/admin/_lib/firestore-settings";
import { getLayout } from "@/app/admin/_lib/firestore-layouts";
import { getFestivalData } from "./_lib/active-season";
import { FestivalClient } from "./_components/FestivalClient";

// 매 요청마다 렌더링해서 오픈/마감 판정은 항상 "지금" 기준으로 계산함(SSR).
// 시즌/주점/배치도/학과 목록 자체는 각 조회 함수 안에서 Data Cache로 캐싱되고
// 관리자가 수정할 때 태그로 즉시 무효화되므로, 실제 Firestore 읽기는 최소화됨.
// 예약 가능 여부(슬롯 마감 등)는 예약 모달에서 별도 서버 액션으로 그때그때 실시간 조회함.
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
  const [{ activeSeason, viewOpen, generalOpen, matchingOpen }, booths, departments, layout] =
    await Promise.all([
      getFestivalData(),
      listBoothsLight().catch(() => []),
      getDepartments().catch(() => []),
      getLayout().catch(() => null),
    ]);

  return (
    <FestivalClient
      booths={booths}
      season={activeSeason}
      viewOpen={viewOpen}
      generalOpen={generalOpen}
      matchingOpen={matchingOpen}
      departments={departments}
      layout={layout}
    />
  );
}
