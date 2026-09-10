import { listBoothsLight } from "@/app/admin/_lib/firestore-booths";
import { listSeasons } from "@/app/admin/_lib/firestore-seasons";
import { FestivalClient } from "./_components/FestivalClient";

// Firestore 읽기를 매 방문마다 하지 않도록 짧게 캐시 (관리자가 주점을 바꾸면 최대 이 시간만큼 늦게 반영됨)
export const revalidate = 30;

export default async function FestivalPage() {
  // 이미지는 여기서 미리 안 가져옴 - 주점 카드를 눌렀을 때만 그 주점 것만 불러옴
  // (모든 방문자가 배치도만 봐도 4개 주점 x 12장 이미지를 통째로 받게 되는 걸 방지)
  const [booths, seasons] = await Promise.all([
    listBoothsLight().catch(() => []),
    listSeasons().catch(() => []),
  ]);

  // 지금 진행중인 축제 시즌 하나를 찾아서 페이지 상단/예약 날짜 선택지에 씀.
  // 없으면(축제 기간이 아니면) 아래 FestivalClient가 안내 화면만 보여줌.
  const activeSeason = seasons.find((s) => s.type === "festival" && s.status === "ongoing") ?? null;

  return <FestivalClient booths={booths} season={activeSeason} />;
}
