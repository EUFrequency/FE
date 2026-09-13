import type { MinOrderRule } from "./types";

/**
 * 인원수에 맞는 최소 주문금액을 규칙에서 찾는다.
 * 인원수 오름차순으로 정렬한 뒤, headcount 이상을 처음으로 커버하는 규칙을 쓰고,
 * 모든 규칙의 maxHeadcount보다 인원이 많으면 가장 큰(마지막) 규칙을 그대로 적용한다.
 */
export function resolveMinOrderAmount(rules: MinOrderRule[], headcount: number): number {
  if (rules.length === 0) return 0;
  const sorted = [...rules].sort((a, b) => a.maxHeadcount - b.maxHeadcount);
  const match = sorted.find((r) => headcount <= r.maxHeadcount);
  return (match ?? sorted[sorted.length - 1]).minAmount;
}

/** 인원수를 아직 모르는 화면(부스 목록 등)에서 보여줄 대표값 - 규칙 중 가장 낮은 최소금액 */
export function lowestMinOrderAmount(rules: MinOrderRule[]): number {
  if (rules.length === 0) return 0;
  return Math.min(...rules.map((r) => r.minAmount));
}
