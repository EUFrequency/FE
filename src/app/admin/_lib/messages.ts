import type { Reservation } from "./types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://frequency.orso.it.kr";

function formatDateKorean(date: string): string {
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

/** "1부 11:00~11:50" -> "1부(11:00~11:50)" */
function formatTimeWithParens(time: string): string {
  const idx = time.indexOf(" ");
  if (idx === -1) return time;
  return `${time.slice(0, idx)}(${time.slice(idx + 1)})`;
}

/** 승인(확정) 안내 - 카카오톡으로 그대로 붙여넣을 수 있는 메시지 */
export function buildApprovalMessage(r: Reservation): string {
  const lines = [
    `안녕하세요 ${r.representativeName}님, ${formatDateKorean(r.date)} ${formatTimeWithParens(
      r.time,
    )}에 예약이 완료되었습니다.`,
  ];
  if (r.matching && r.assignedAlias) {
    lines.push(`별칭 : ${r.assignedAlias}`);
  }
  lines.push(`유의사항은 ${SITE_URL}/festival/notice 를 통해 꼭 확인해주세요.`);
  return lines.join("\n");
}

/** 반려 안내 - 카카오톡으로 그대로 붙여넣을 수 있는 메시지 */
export function buildRejectionMessage(r: Reservation): string {
  return [
    `안녕하세요 ${r.representativeName}님, 아쉽게도 ${formatDateKorean(
      r.date,
    )} ${formatTimeWithParens(r.time)} 예약이 확정되지 못했습니다.`,
    `입금하신 금액은 확인 후 환불해드리겠습니다.`,
    `문의사항이 있으시면 편하게 말씀해주세요.`,
  ].join("\n");
}

/** 이미 확정된 매칭 예약을 취소할 때 안내 - 반려와 달리 입금이 이미 확인된 상태라 환불 안내 포함 */
export function buildMatchingCancelMessage(r: Reservation): string {
  return [
    `안녕하세요 ${r.representativeName}님, 부득이하게 ${formatDateKorean(
      r.date,
    )} ${formatTimeWithParens(r.time)} 예약이 취소되었습니다.`,
    `입금하신 금액은 확인 후 환불해드리겠습니다.`,
    `문의사항이 있으시면 편하게 말씀해주세요.`,
  ].join("\n");
}

/** 매칭 예약을 일반 예약으로 전환 접수했을 때 안내 */
export function buildMatchingConvertMessage(r: Reservation, newHeadcount: number): string {
  return [
    `안녕하세요 ${r.representativeName}님, ${formatDateKorean(
      r.date,
    )} ${formatTimeWithParens(r.time)} 예약이 일반 예약(총 ${newHeadcount}명)으로 변경 접수되었습니다.`,
    `확정 여부는 다시 안내드리겠습니다.`,
  ].join("\n");
}
