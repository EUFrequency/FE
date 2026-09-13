/**
 * 이 프로젝트의 모든 시간(예약 기간, 강제 오픈/마감 등)은 한국 시간(KST, UTC+9)
 * 기준으로 다룬다. 서버가 어느 타임존에서 돌든(보통 UTC) 항상 KST 벽시계 기준
 * "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" 문자열로 다뤄서, 문자열 비교(<=, >=)만으로
 * 날짜/시간 선후 관계를 판단할 수 있게 한다 - Date 객체 파싱/타임존 변환이 코드
 * 곳곳에 흩어지는 걸 막기 위함.
 */

/** 지금 시각을 KST 기준 "YYYY-MM-DDTHH:mm"로 반환 */
export function nowKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

/** 지금 날짜를 KST 기준 "YYYY-MM-DD"로 반환 */
export function todayKST(): string {
  return nowKST().slice(0, 10);
}

/** "YYYY-MM-DDTHH:mm" -> "3월 10일 13:00" */
export function formatKoreanDateTime(value: string): string {
  const [datePart, timePart] = value.split("T");
  const [, m, d] = datePart.split("-");
  if (!m || !d) return value;
  return timePart ? `${Number(m)}월 ${Number(d)}일 ${timePart}` : `${Number(m)}월 ${Number(d)}일`;
}

/** 기간을 "3월 10일 13:00 ~ 3월 12일 13:00" 또는 (end가 null이면) "~ 종료시까지"로 */
export function formatPeriod(start: string, end: string | null): string {
  return `${formatKoreanDateTime(start)} ~ ${end ? formatKoreanDateTime(end) : "종료시까지"}`;
}
