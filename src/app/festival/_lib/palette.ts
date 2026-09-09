import type { AdminBooth } from "@/app/admin/_lib/types";

/**
 * 등록된 주점 순서대로 돌아가며 배정하는 색상 팔레트.
 * 주점 자체엔 색상을 저장하지 않고(관리자가 색상까지 고를 필요는 없어서),
 * 화면에 뿌릴 때 인덱스 기준으로 계산해서 씀.
 */
const ACCENTS = [
  { accentColor: "#f5b73a", dotClass: "bg-amber-400" },
  { accentColor: "#5aa9ff", dotClass: "bg-sky-400" },
  { accentColor: "#f87171", dotClass: "bg-red-400" },
  { accentColor: "#4ade80", dotClass: "bg-emerald-400" },
  { accentColor: "#c084fc", dotClass: "bg-purple-400" },
  { accentColor: "#fb923c", dotClass: "bg-orange-400" },
  { accentColor: "#22d3ee", dotClass: "bg-cyan-400" },
  { accentColor: "#f472b6", dotClass: "bg-pink-400" },
];

export type FestivalBooth = AdminBooth & {
  accentColor: string;
  dotClass: string;
};

export function accentFor(index: number) {
  return ACCENTS[index % ACCENTS.length];
}

export function withAccents(booths: AdminBooth[]): FestivalBooth[] {
  return booths.map((booth, i) => ({
    ...booth,
    ...accentFor(i),
  }));
}
