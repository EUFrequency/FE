import "server-only";
import { unstable_cache, updateTag } from "next/cache";
import { getAdminDb } from "@/lib/firebase/admin";
import { nowKST, todayKST } from "@/lib/kst";
import { isGeneralReservationOpen, isMatchingReservationOpen, isViewOpen } from "./season-status";
import type { Season, SeasonStatus } from "./types";

export { isGeneralReservationOpen, isMatchingReservationOpen, isViewOpen };

const COLLECTION = "seasons";

/** Firestore에는 status를 저장하지 않음 - 항상 날짜 기준으로 계산해서 붙여줌 */
type SeasonDocData = Omit<Season, "id" | "status">;

function seasonsCollection() {
  return getAdminDb().collection(COLLECTION);
}

/** 오늘 날짜, 조기종료 여부, 시작/종료일만으로 상태를 계산 - 관리자가 따로 켜고 끌 필요 없음 */
function computeStatus(season: Pick<Season, "startDate" | "endDate" | "earlyEndedAt">): SeasonStatus {
  if (season.earlyEndedAt) return "ended";
  const today = todayKST();
  if (today < season.startDate) return "upcoming";
  if (today > season.endDate) return "ended";
  return "ongoing";
}

/** 필드가 없으면 fallback, 옛날처럼 시간 없는 "YYYY-MM-DD"면 그날 00:00으로 채움 */
function normalizeStart(value: string | undefined, fallback: string): string {
  const raw = value ?? fallback;
  return raw.includes("T") ? raw : `${raw}T00:00`;
}

/** 필드가 없으면 fallback, null이면 그대로 null(무기한), 시간 없는 옛날 값이면 그날 23:59로 채움 */
function normalizeEnd(
  value: string | null | undefined,
  fallback: string | null,
): string | null {
  const raw = value === undefined ? fallback : value;
  if (raw === null) return null;
  return raw.includes("T") ? raw : `${raw}T23:59`;
}

function toSeason(id: string, data: SeasonDocData): Season {
  const reservationStartDate = normalizeStart(data.reservationStartDate, data.startDate);
  const reservationEndDate = normalizeEnd(data.reservationEndDate, data.endDate);
  const matchingReservationStartDate = normalizeStart(
    data.matchingReservationStartDate,
    reservationStartDate,
  );
  const matchingReservationEndDate = normalizeEnd(
    data.matchingReservationEndDate,
    reservationEndDate,
  );
  // 조회 기간이 없던 시절 문서 호환: 일반 예약 기간과 동일하게 취급(그게 곧 이전의 "볼 수 있는 기간")
  const viewStartDate = normalizeStart(data.viewStartDate, reservationStartDate);
  const viewEndDate = normalizeEnd(data.viewEndDate, reservationEndDate);

  return {
    id,
    ...data,
    reservationStartDate,
    reservationEndDate,
    matchingReservationStartDate,
    matchingReservationEndDate,
    viewStartDate,
    viewEndDate,
    status: computeStatus(data),
  };
}

/**
 * /festival 공개 페이지의 오픈/마감 판정(getFestivalData)도 이 함수로 시즌 문서를 가져와
 * 매번 "지금" 기준으로 새로 계산하므로, 문서 자체만 60초 Data Cache로 감싸도 오픈/마감
 * 판정은 항상 정확함 - 관리자가 시즌을 추가/수정하거나 강제 오픈/마감을 누르면
 * "seasons" 태그로 즉시 무효화됨.
 */
export const listSeasons = unstable_cache(
  async (): Promise<Season[]> => {
    const snap = await seasonsCollection().get();
    return snap.docs
      .map((doc) => toSeason(doc.id, doc.data() as SeasonDocData))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  },
  ["seasons"],
  { revalidate: 60, tags: ["seasons"] },
);

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

/**
 * add/update 공용 날짜 검증. 폼은 항상 구체적인 값을 요구하므로(무기한 null은 대시보드의
 * 강제 오픈에서만 생김) 여기 들어오는 종료 시각들은 실질적으로 항상 값이 있다고 보되,
 * 타입상 null일 수 있어 방어적으로 처리한다. 포함 관계: 조회 ⊇ 일반예약 ⊇ 과팅예약.
 */
function validateSeasonDates(season: Omit<Season, "id" | "status">): void {
  if (season.startDate > season.endDate) {
    throw new Error("축제 종료일이 시작일보다 빠릅니다.");
  }
  if (season.viewEndDate !== null && season.viewStartDate > season.viewEndDate) {
    throw new Error("조회 마감 시각이 시작 시각보다 빠릅니다.");
  }
  if (
    season.reservationEndDate !== null &&
    season.reservationStartDate > season.reservationEndDate
  ) {
    throw new Error("일반 예약 마감 시각이 시작 시각보다 빠릅니다.");
  }
  if (
    season.reservationEndDate !== null &&
    season.reservationEndDate > `${season.endDate}T23:59`
  ) {
    throw new Error("일반 예약 마감 시각은 축제 종료일 이내여야 합니다.");
  }
  if (season.viewStartDate > season.reservationStartDate) {
    throw new Error("조회 기간은 일반 예약 시작 시각보다 먼저(또는 같이) 시작해야 합니다.");
  }
  if (
    season.viewEndDate !== null &&
    (season.reservationEndDate === null || season.viewEndDate < season.reservationEndDate)
  ) {
    throw new Error("조회 기간은 일반 예약 마감 시각까지(또는 그 이후까지) 있어야 합니다.");
  }
  if (
    season.matchingReservationEndDate !== null &&
    season.matchingReservationStartDate > season.matchingReservationEndDate
  ) {
    throw new Error("과팅 예약 마감 시각이 시작 시각보다 빠릅니다.");
  }
  if (season.matchingReservationStartDate < season.reservationStartDate) {
    throw new Error("과팅 예약 기간은 일반 예약 기간 안에 있어야 합니다.");
  }
  if (
    season.reservationEndDate !== null &&
    (season.matchingReservationEndDate === null ||
      season.matchingReservationEndDate > season.reservationEndDate)
  ) {
    throw new Error("과팅 예약 기간은 일반 예약 기간 안에 있어야 합니다.");
  }
}

export async function addSeason(season: Omit<Season, "status">): Promise<void> {
  validateSeasonDates(season);
  const overlap = await findOverlap(season.startDate, season.endDate);
  if (overlap) {
    throw new Error(
      `'${overlap.name}'(${overlap.startDate} ~ ${overlap.endDate})과 기간이 겹칩니다. 기간을 다시 확인해주세요.`,
    );
  }
  const { id, ...rest } = season;
  await seasonsCollection().doc(id).set(rest);
  updateTag("seasons");
}

/**
 * 시즌 정보 수정. 진행중인 시즌은 수정할 수 없음(조기종료 또는 대시보드의
 * 강제 오픈/마감을 대신 쓰도록 안내) - 축제 도중에 날짜가 바뀌는 걸 막기 위한 안전장치.
 */
export async function updateSeason(
  id: string,
  patch: Omit<Season, "id" | "status">,
): Promise<void> {
  const doc = await seasonsCollection().doc(id).get();
  if (!doc.exists) throw new Error("시즌을 찾을 수 없습니다.");

  const current = doc.data() as SeasonDocData;
  if (computeStatus(current) === "ongoing") {
    throw new Error(
      "진행중인 시즌은 수정할 수 없습니다. 조기종료하거나 대시보드의 예약 접수 설정(강제 오픈/마감)을 사용해주세요.",
    );
  }

  validateSeasonDates(patch);
  const overlap = await findOverlap(patch.startDate, patch.endDate, id);
  if (overlap) {
    throw new Error(
      `'${overlap.name}'(${overlap.startDate} ~ ${overlap.endDate})과 기간이 겹칩니다. 기간을 다시 확인해주세요.`,
    );
  }
  await doc.ref.set(patch);
  updateTag("seasons");
}

/**
 * 진행중인 시즌을 지금 당장 조기종료함.
 * 종료일을 오늘 날짜로 당기고 earlyEndedAt을 남겨서, 그 순간부터 상태가 무조건 "종료"로 고정됨
 * (그날 하루는 아직 기간 안이라 날짜 계산만으론 "진행중"으로 보일 수 있어서, 명시적으로 고정).
 */
export async function endSeasonEarly(id: string): Promise<void> {
  const today = todayKST();
  await seasonsCollection().doc(id).update({ endDate: today, earlyEndedAt: today });
  updateTag("seasons");
}

type ReservationKind = "general" | "matching";

/**
 * 대시보드의 "강제 오픈" - 누른 시점(KST)을 그 종류(일반/과팅)의 시작 시각으로 바꿔서
 * 지금 당장 열리게 한다. 원래 종료 시각이 이미 지난 과거였다면(마감된 뒤 다시 여는 경우)
 * 종료 시각을 null(무기한/"종료시까지")로 바꾼다. 조회 기간이 새 예약 기간을 못 담으면
 * (조회가 안 되면 예약 폼까지 갈 수 없으므로) 조회 기간도 함께 넓힌다.
 */
export async function forceOpenReservation(
  seasonId: string,
  kind: ReservationKind,
): Promise<void> {
  const ref = seasonsCollection().doc(seasonId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("시즌을 찾을 수 없습니다.");
  const season = toSeason(doc.id, doc.data() as SeasonDocData);

  const now = nowKST();
  const patch: Record<string, string | null> = {};

  let newEnd: string | null;
  if (kind === "general") {
    newEnd = season.reservationEndDate !== null && season.reservationEndDate < now
      ? null
      : season.reservationEndDate;
    patch.reservationStartDate = now;
    patch.reservationEndDate = newEnd;
  } else {
    newEnd =
      season.matchingReservationEndDate !== null && season.matchingReservationEndDate < now
        ? null
        : season.matchingReservationEndDate;
    patch.matchingReservationStartDate = now;
    patch.matchingReservationEndDate = newEnd;
  }

  if (now < season.viewStartDate) {
    patch.viewStartDate = now;
  }
  if (newEnd === null) {
    if (season.viewEndDate !== null) patch.viewEndDate = null;
  } else if (season.viewEndDate !== null && season.viewEndDate < newEnd) {
    patch.viewEndDate = newEnd;
  }

  await ref.update(patch);
  updateTag("seasons");
}

/**
 * 대시보드의 "강제 마감" - 누른 시점(KST)을 그 종류(일반/과팅)의 종료 시각으로 바꿔서
 * 지금 당장 닫히게 한다(조기마감). 시작 시각은 건드리지 않는다.
 */
export async function forceCloseReservation(
  seasonId: string,
  kind: ReservationKind,
): Promise<void> {
  const now = nowKST();
  const ref = seasonsCollection().doc(seasonId);
  if (kind === "general") {
    await ref.update({ reservationEndDate: now });
  } else {
    await ref.update({ matchingReservationEndDate: now });
  }
  updateTag("seasons");
}

/**
 * 시즌 삭제. 진행중인 시즌은 삭제할 수 없음(먼저 조기종료해야 함) - 축제 도중에
 * 갑자기 없어지는 걸 막기 위한 안전장치. 주점 배치도는 시즌과 무관하게 하나뿐이라
 * 시즌을 지워도 그대로 남는다.
 */
export async function deleteSeason(id: string): Promise<void> {
  const doc = await seasonsCollection().doc(id).get();
  if (!doc.exists) return;

  const data = doc.data() as SeasonDocData;
  if (computeStatus(data) === "ongoing") {
    throw new Error("진행중인 시즌은 삭제할 수 없습니다. 먼저 조기종료해주세요.");
  }

  await doc.ref.delete();
  updateTag("seasons");
}
