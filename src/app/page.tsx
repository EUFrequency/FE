import { redirect } from "next/navigation";

// 루트 도메인은 실제 서비스 화면인 /festival로 보냄 (create-next-app 기본 페이지가 그대로 남아있으면
// 도메인만 공유했을 때 엉뚱한 안내 화면이 뜨고 링크 미리보기도 이상해짐)
export default function RootPage() {
  redirect("/festival");
}
