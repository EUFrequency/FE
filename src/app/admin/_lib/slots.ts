import {
  MAX_GENERAL_HEADCOUNT,
  MIN_GENERAL_HEADCOUNT,
  TABLE_OVERBOOK,
  type MatchingGender,
  type Reservation,
  type TableConfig,
  type TableUsage,
  type TimeSlot,
} from "./types";

/** 시간대를 예약 폼/내역에 보여줄 문자열로 - 예: "1부 11:00~11:50" */
export function formatTimeSlot(slot: TimeSlot): string {
  return `${slot.label} ${slot.startTime}~${slot.endTime}`;
}

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

/**
 * 매칭 예약이 어느 테이블 슬롯에 들어가는지 계산.
 * "매칭 전용" 테이블의 정원은 테이블 전체(양 팀 합) 기준으로 등록됨
 * (예: 6인 매칭 테이블 = 3인 팀 : 3인 팀). 그래서 한 팀의 인원수는 테이블 정원의 절반이어야
 * 매칭됨(headcount * 2 === capacity). 홀수 정원 테이블은 반으로 나눌 수 없어 매칭 대상에서 제외.
 *
 * 일반 예약은 테이블 하나가 아니라 여러 테이블 조합으로 배정될 수 있어
 * resolveGeneralTableCombo()를 대신 사용한다 (아래).
 */
export function resolveMatchingSlot(
  tables: TableConfig[],
  input: { gender: MatchingGender | null; headcount: number },
): SlotResolution {
  if (!Number.isInteger(input.headcount) || input.headcount < 1) {
    return { ok: false, reason: "인원수가 올바르지 않습니다." };
  }
  if (!input.gender) return { ok: false, reason: "팀 성별을 선택해주세요." };

  const usable = tables.filter((t) => t.count > 0);
  // 테이블 정원(capacity)은 양 팀 합계라 내 팀 인원수의 2배여야 그 테이블에 배정됨
  const table = usable.find(
    (t) => t.forMatching && t.capacity === input.headcount * 2,
  );
  if (!table) {
    const sizes = matchingHeadcountOptions(usable);
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

export type GeneralTableAvailability = { capacity: number; available: number };

/**
 * 일반 테이블 구성 + 지금 활성(대기+승인) 예약 수로, 정원별로 "추가로 더 쓸 수 있는
 * 테이블 수"(오버부킹 포함)를 계산한다. 같은 정원의 테이블 행이 여러 개면 합산.
 */
export function generalTableAvailability(
  tables: TableConfig[],
  activeByCapacity: (capacity: number) => number,
): GeneralTableAvailability[] {
  const totalByCapacity = new Map<number, number>();
  for (const t of tables) {
    if (t.forMatching || t.count <= 0) continue;
    totalByCapacity.set(t.capacity, (totalByCapacity.get(t.capacity) ?? 0) + t.count);
  }
  return Array.from(totalByCapacity.entries()).map(([capacity, count]) => ({
    capacity,
    available: Math.max(0, count + TABLE_OVERBOOK - activeByCapacity(capacity)),
  }));
}

/**
 * headcount를 만족하는 일반 테이블 조합을 찾는다.
 * 우선순위: 1) 테이블 개수가 적을수록, 2) 그 안에서 남는 좌석(waste)이 적을수록.
 * 예: 6인 테이블이 다 찼고 4인 테이블만 남았으면 자동으로 4인 테이블 2개 조합을 찾는다.
 * 만족하는 조합이 없으면 null.
 */
export function resolveGeneralTableCombo(
  availability: GeneralTableAvailability[],
  headcount: number,
): TableUsage[] | null {
  const usable = availability.filter((a) => a.capacity > 0 && a.available > 0);
  if (usable.length === 0 || headcount <= 0) return null;

  const MAX_TABLES = 12;
  for (let size = 1; size <= MAX_TABLES; size++) {
    const found = bestGeneralComboOfSize(usable, size, headcount);
    if (found) return found;
  }
  return null;
}

function bestGeneralComboOfSize(
  usable: GeneralTableAvailability[],
  size: number,
  headcount: number,
): TableUsage[] | null {
  // best를 그냥 let으로 두면 재귀 클로저 안에서의 재할당을 TS가 못 따라가서
  // 객체 프로퍼티로 감싸둠 (best.value 형태로 읽고 쓰기)
  const state: { best: { counts: Map<number, number>; waste: number } | null } = {
    best: null,
  };

  function rec(
    startIdx: number,
    left: number,
    sum: number,
    counts: Map<number, number>,
  ) {
    if (left === 0) {
      if (sum >= headcount) {
        const waste = sum - headcount;
        if (!state.best || waste < state.best.waste) {
          state.best = { counts: new Map(counts), waste };
        }
      }
      return;
    }
    for (let i = startIdx; i < usable.length; i++) {
      const { capacity, available } = usable[i];
      const used = counts.get(capacity) ?? 0;
      if (used >= available) continue;
      counts.set(capacity, used + 1);
      rec(i, left - 1, sum + capacity, counts);
      counts.set(capacity, used);
    }
  }

  rec(0, size, 0, new Map());
  if (!state.best) return null;
  return Array.from(state.best.counts.entries())
    .filter(([, count]) => count > 0)
    .map(([capacity, count]) => ({ capacity, count }));
}

/**
 * 매칭 예약에서 고를 수 있는 "팀 인원수" 목록 (오름차순).
 * 매칭 전용 테이블의 정원은 양 팀 합계라서 절반이 실제 팀 인원수 (예: 6인 테이블 → 3인 팀).
 * 홀수 정원(반으로 못 나눔)은 잘못 등록된 것으로 보고 제외.
 */
export function matchingHeadcountOptions(tables: TableConfig[]): number[] {
  return Array.from(
    new Set(
      tables
        .filter((t) => t.forMatching && t.count > 0 && t.capacity % 2 === 0)
        .map((t) => t.capacity / 2),
    ),
  ).sort((a, b) => a - b);
}

/**
 * 일반 예약에서 허용되는 인원수 범위 [min, max]. 일반 테이블이 없으면 null.
 * max는 테이블 하나의 정원이 아니라 그냥 상식적인 상한(MAX_GENERAL_HEADCOUNT) -
 * 큰 인원은 여러 테이블 조합으로 나눠 앉히므로 특정 테이블 정원에 묶이지 않는다.
 */
export function generalHeadcountRange(
  tables: TableConfig[],
): { min: number; max: number } | null {
  const hasGeneralTable = tables.some((t) => !t.forMatching && t.count > 0);
  if (!hasGeneralTable) return null;
  return { min: MIN_GENERAL_HEADCOUNT, max: MAX_GENERAL_HEADCOUNT };
}

/**
 * 예약 하나가 차지하는 슬롯들 - 매칭은 항상 1개, 일반은 여러 테이블 조합이면 여러 개일 수 있음.
 * (구버전 문서처럼 tableAssignment가 없으면 tableCapacity 하나짜리 테이블로 간주 - 호환용)
 */
export function reservationSlotKeys(r: {
  matching: boolean;
  matchingGender?: MatchingGender;
  tableCapacity: number;
  tableAssignment?: TableUsage[];
}): { slotKey: string; count: number }[] {
  if (r.matching) {
    if (!r.matchingGender) return [];
    return [{ slotKey: matchingSlotKey(r.tableCapacity, r.matchingGender), count: 1 }];
  }
  const assignment = r.tableAssignment?.length
    ? r.tableAssignment
    : [{ capacity: r.tableCapacity, count: 1 }];
  return assignment.map((a) => ({ slotKey: generalSlotKey(a.capacity), count: a.count }));
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
    for (const { slotKey, count } of reservationSlotKeys(r)) {
      active.set(slotKey, (active.get(slotKey) ?? 0) + count);
      if (r.status === "approved") {
        approved.set(slotKey, (approved.get(slotKey) ?? 0) + count);
      }
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

export type MatchingTableLeftover = {
  tableId: string;
  capacity: number;
  /** 등록된 매칭 전용 테이블 개수 */
  count: number;
  /** 실제로 차 있는 테이블 수 (짝지어진 쌍은 1개, 짝 없이 혼자 승인된 예약도 1개) */
  occupied: number;
  /** 일반으로 전환해도 되는 남는 테이블 수 */
  leftover: number;
  /** 아직 승인/거절하지 않은 매칭 예약 수 - 남아있으면 전환을 미뤄야 함 */
  pendingCount: number;
};

/**
 * 매칭 전용 테이블 종류별로 "실제로 몇 개가 차 있는지"를 계산해 남는(leftover) 테이블 수를 구함.
 * 짝지어진 두 예약(pairedWith)은 테이블 하나를 같이 쓰므로 1개로, 짝 없이 혼자 승인된
 * 매칭 예약도 테이블 하나를 혼자 쓰므로 1개로 센다. 대기중인 예약이 남아있으면
 * (아직 승인/거절을 안 끝냈으면) 잘못된 전환을 막기 위해 pendingCount로 표시만 하고
 * occupied 계산에는 넣지 않는다 - 호출하는 쪽에서 pendingCount > 0이면 전환을 막아야 함.
 */
export function computeMatchingTableLeftover(
  tables: TableConfig[],
  reservations: Reservation[],
): MatchingTableLeftover[] {
  return tables
    .filter((t) => t.forMatching && t.count > 0)
    .map((t) => {
      const atCapacity = reservations.filter(
        (r) => r.matching && r.tableCapacity === t.capacity,
      );
      const pendingCount = atCapacity.filter((r) => r.status === "pending").length;

      const counted = new Set<string>();
      let occupied = 0;
      for (const r of atCapacity) {
        if (r.status !== "approved" || counted.has(r.id)) continue;
        occupied += 1;
        counted.add(r.id);
        if (r.pairedWith) counted.add(r.pairedWith);
      }

      return {
        tableId: t.id,
        capacity: t.capacity,
        count: t.count,
        occupied,
        leftover: Math.max(0, t.count - occupied),
        pendingCount,
      };
    });
}
