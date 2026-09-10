import type { Season } from "@/app/admin/_lib/types";

const WEEKDAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function label(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_KR[d.getDay()]})`;
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
