import type { Season } from "@/app/admin/_lib/types";

const WEEKDAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

// 날짜 계산은 전부 UTC 기준으로 처리한다. 로컬 타임존(KST 등)으로 파싱하면
// toISOString() 단계에서 하루가 밀려서 addDays가 날짜를 못 넘기는 버그가 생김.
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function label(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY_KR[d.getUTCDay()]})`;
}

/** 시즌의 시작일~종료일 사이 모든 날짜를 예약 폼 날짜 선택지로 변환 */
export function seasonDateOptions(
  season: Pick<Season, "startDate" | "endDate">,
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  let cursor = season.startDate;
  // 안전장치: 시즌 기간이 비정상적으로 길어도 무한루프 안 나게 최대치 제한
  for (let i = 0; i < 60 && cursor <= season.endDate; i++) {
    options.push({ value: cursor, label: label(cursor) });
    cursor = addDays(cursor, 1);
  }
  return options;
}
