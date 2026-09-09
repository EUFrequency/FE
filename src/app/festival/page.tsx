import { listPublicBooths } from "@/app/admin/_lib/firestore-booths";
import { FestivalClient } from "./_components/FestivalClient";

// Firestore 읽기를 매 방문마다 하지 않도록 짧게 캐시 (관리자가 주점을 바꾸면 최대 이 시간만큼 늦게 반영됨)
export const revalidate = 30;

export default async function FestivalPage() {
  const booths = await listPublicBooths().catch(() => []);
  return <FestivalClient booths={booths} />;
}
