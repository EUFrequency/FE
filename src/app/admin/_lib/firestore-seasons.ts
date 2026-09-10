import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Season, SeasonStatus } from "./types";

const COLLECTION = "seasons";

/** Firestore에는 status를 저장하지 않음 - 항상 날짜 기준으로 계산해서 붙여줌 */
type SeasonDocData = Omit<Season, "id" | "status">;

function seasonsCollection() {
  return getAdminDb().collection(COLLECTION);
}

/** 오늘 날짜, 조기종료 여부, 시작/종료일만으로 상태를 계산 - 관리자가 따로 켜고 끌 필요 없음 */
function computeStatus(season: Pick<Season, "startDate" | "endDate" | "earlyEndedAt">): SeasonStatus {
  if (season.earlyEndedAt) return "ended";
  const today = new Date().toISOString().slice(0, 10);
  if (today < season.startDate) return "upcoming";
  if (today > season.endDate) return "ended";
  return "ongoing";
}

function toSeason(id: string, data: SeasonDocData): Season {
  return { id, ...data, status: computeStatus(data) };
}

export async function listSeasons(): Promise<Season[]> {
  const snap = await seasonsCollection().get();
  return snap.docs
    .map((doc) => toSeason(doc.id, doc.data() as SeasonDocData))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/** startDate~endDate 구간이 다른 시즌과 겹치는지 확인 (excludeId는 비교에서 제외) */
async function findOverlap(
  startDate: string,
  endDate: string,
  excludeId?: string,
): Promise<Season | null> {
  const snap = await seasonsCollection().get();
  for (const doc of snap.docs) {
    if (doc.id === excludeId) continue;
    const data = doc.data() as SeasonDocData;
    const noOverlap = endDate < data.startDate || startDate > data.endDate;
    if (!noOverlap) return toSeason(doc.id, data);
  }
  return null;
}

export async function addSeason(season: Omit<Season, "status">): Promise<void> {
  const overlap = await findOverlap(season.startDate, season.endDate);
  if (overlap) {
    throw new Error(
      `'${overlap.name}'(${overlap.startDate} ~ ${overlap.endDate})과 기간이 겹칩니다. 기간을 다시 확인해주세요.`,
    );
  }
  const { id, ...rest } = season;
  await seasonsCollection().doc(id).set(rest);
}

/**
 * 진행중인 시즌을 지금 당장 조기종료함.
 * 종료일을 오늘 날짜로 당기고 earlyEndedAt을 남겨서, 그 순간부터 상태가 무조건 "종료"로 고정됨
 * (그날 하루는 아직 기간 안이라 날짜 계산만으론 "진행중"으로 보일 수 있어서, 명시적으로 고정).
 */
export async function endSeasonEarly(id: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await seasonsCollection().doc(id).update({ endDate: today, earlyEndedAt: today });
}
