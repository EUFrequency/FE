import type { SeasonLayout } from "./types";

/**
 * 주점 배치도를 원격 저장소(파이어베이스 예정)에 반영하는 자리입니다.
 *
 * 지금은 실제 API가 없어서 네트워크 호출을 흉내만 냅니다.
 * 나중에 Firebase 연동 작업을 할 때 이 함수 내부만 아래처럼 교체하면 됩니다.
 *
 *   const db = getFirestore(app);
 *   await setDoc(doc(db, "seasonLayouts", seasonId), layout);
 *
 * 호출하는 쪽(LayoutTab)은 이 함수의 반환 Promise만 신경 쓰므로,
 * 내부 구현이 바뀌어도 UI 코드는 그대로 유지됩니다.
 */
export async function persistSeasonLayout(
  seasonId: string,
  layout: SeasonLayout,
): Promise<void> {
  // TODO: Firebase Firestore 등 실제 원격 저장소 연동으로 교체
  await new Promise((resolve) => setTimeout(resolve, 500));
  void seasonId;
  void layout;
}
