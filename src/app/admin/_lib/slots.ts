import {
  MIN_GENERAL_HEADCOUNT,
  TABLE_OVERBOOK,
  type MatchingGender,
  type Reservation,
  type TableConfig,
} from "./types";

/**
 * 정원 관리 슬롯 = (테이블 정원, 용도[, 성별]) 조합.
 * 매칭: `${capacity}-matching-${gender}` / 일반: `${capacity}-general`
 * 이 슬롯 문서 하나로 예약 수를 O(1)로 집계한다.
 */
export function matchingSlotKey(capacity: number, gender: MatchingGender): string {
  return `${capacity}-matching-${gender}`;
}

export function generalSlotKey(capacity: number): string {
  return `${capacity}-general`;
}

export type SlotResolution =
  | {
      ok: true;
      slotKey: string;
      /** 이 예약이 차지하는 테이블 정원 */
      capacity: number;
      /** 이 슬롯에 실제로 배치된 테이블 수 */
      tableCount: number;
      /** 오버부킹 포함 최대 허용 수 = tableCount + TABLE_OVERBOOK */
      limit: number;
    }
  | { ok: false; reason: string };

type ResolveInput = {
  matching: boolean;
  gender: MatchingGender | null;
  headcount: number;
};

/**
 * 주점의 테이블 구성 + 예약 조건으로 어느 슬롯에 들어가는지 계산.
 *
 * - 매칭: 인원수와 정확히 같은 정원의 "매칭 전용" 테이블이 있어야 함 (headcount === capacity)
 * - 일반: 최소 2인, 인원수를 수용하는 가장 작은 "일반" 테이블에 배치. 최대 정원 초과 시 불가.
 */
export function resolveSlot(
  tables: TableConfig[],
  input: ResolveInput,
): SlotResolution {
  const usable = tables.filter((t) => t.count > 0);

  if (input.matching) {
    if (!input.gender) return { ok: false, reason: "팀 성별을 선택해주세요." };
    const table = usable.find(
      (t) => t.forMatching && t.capacity === input.headcount,
    );
    if (!table) {
      const sizes = usable
        .filter((t) => t.forMatching)
        .map((t) => t.capacity)
        .sort((a, b) => a - b);
      return {
        ok: false,
        reason:
          sizes.length > 0
            ? `이 주점의 과팅 예약은 ${sizes.join(", ")}인 팀만 가능합니다.`
            : "이 주점은 과팅 예약을 받지 않습니다.",
      };
    }
    return {
      ok: true,
      slotKey: matchingSlotKey(table.capacity, input.gender),
      capacity: table.capacity,
      tableCount: table.count,
      limit: table.count + TABLE_OVERBOOK,
    };
  }

  // 일반 예약
  const generalTables = usable
    .filter((t) => !t.forMatching)
    .sort((a, b) => a.capacity - b.capacity);
  if (generalTables.length === 0) {
    return { ok: false, reason: "이 주점은 일반 예약을 받지 않습니다." };
  }
  if (input.headcount < MIN_GENERAL_HEADCOUNT) {
    return {
      ok: false,
      reason: `${MIN_GENERAL_HEADCOUNT}인부터 예약할 수 있습니다.`,
    };
  }
  const maxCapacity = generalTables[generalTables.length - 1].capacity;
  if (input.headcount > maxCapacity) {
    return {
      ok: false,
      reason: `최대 ${maxCapacity}인까지 예약할 수 있습니다.`,
    };
  }
  const table = generalTables.find((t) => t.capacity >= input.headcount)!;
  return {
    ok: true,
    slotKey: generalSlotKey(table.capacity),
    capacity: table.capacity,
    tableCount: table.count,
    limit: table.count + TABLE_OVERBOOK,
  };
}

/** 매칭 예약에서 고를 수 있는 인원수(= 매칭 전용 테이블 정원들). 오름차순 */
export function matchingHeadcountOptions(tables: TableConfig[]): number[] {
  return Array.from(
    new Set(
      tables.filter((t) => t.forMatching && t.count > 0).map((t) => t.capacity),
    ),
  ).sort((a, b) => a - b);
}

/** 일반 예약에서 허용되는 인원수 범위 [min, max]. 일반 테이블이 없으면 null */
export function generalHeadcountRange(
  tables: TableConfig[],
): { min: number; max: number } | null {
  const caps = tables
    .filter((t) => !t.forMatching && t.count > 0)
    .map((t) => t.capacity);
  if (caps.length === 0) return null;
  return { min: MIN_GENERAL_HEADCOUNT, max: Math.max(...caps) };
}

/** 예약 하나가 차지하는 슬롯 키 (매칭이면 성별 포함). 미매칭+성별없음이면 null */
export function reservationSlotKey(r: {
  matching: boolean;
  matchingGender?: MatchingGender;
  tableCapacity: number;
}): string | null {
  if (r.matching) {
    if (!r.matchingGender) return null;
    return matchingSlotKey(r.tableCapacity, r.matchingGender);
  }
  return generalSlotKey(r.tableCapacity);
}

export type SlotSummary = {
  slotKey: string;
  capacity: number;
  forMatching: boolean;
  gender: MatchingGender | null;
  tableCount: number;
  /** 오버부킹 포함 상한 */
  limit: number;
  /** 반려되지 않은 예약 수 */
  active: number;
  /** 그 중 확정(승인)된 수 */
  approved: number;
};

/**
 * 주점 테이블 구성 + 그 주점의 예약 목록으로 슬롯별 정원 현황을 만든다.
 * (관리자 화면에서 이미 로드된 예약으로 계산 - 추가 읽기 없음)
 */
export function summarizeBoothSlots(
  tables: TableConfig[],
  reservations: Reservation[],
): SlotSummary[] {
  const active = new Map<string, number>();
  const approved = new Map<string, number>();
  for (const r of reservations) {
    if (r.status === "rejected") continue;
    const key = reservationSlotKey(r);
    if (!key) continue;
    active.set(key, (active.get(key) ?? 0) + 1);
    if (r.status === "approved") {
      approved.set(key, (approved.get(key) ?? 0) + 1);
    }
  }

  const rows: SlotSummary[] = [];
  for (const t of tables) {
    if (t.count <= 0) continue;
    const genders: (MatchingGender | null)[] = t.forMatching
      ? ["male", "female"]
      : [null];
    for (const gender of genders) {
      const slotKey = gender
        ? matchingSlotKey(t.capacity, gender)
        : generalSlotKey(t.capacity);
      rows.push({
        slotKey,
        capacity: t.capacity,
        forMatching: t.forMatching,
        gender,
        tableCount: t.count,
        limit: t.count + TABLE_OVERBOOK,
        active: active.get(slotKey) ?? 0,
        approved: approved.get(slotKey) ?? 0,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      Number(a.forMatching) - Number(b.forMatching) ||
      a.capacity - b.capacity ||
      (a.gender ?? "").localeCompare(b.gender ?? ""),
  );
}
