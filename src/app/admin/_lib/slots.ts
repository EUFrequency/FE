import {
  MAX_GENERAL_HEADCOUNT,
  MIN_GENERAL_HEADCOUNT,
  MIN_MATCHING_HEADCOUNT,
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

/** "11:00" -> 660 (자정부터의 분) - 주점마다 다른 시간대를 같은 기준으로 비교하기 위함 */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((v) => Number(v));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * 정원 관리 슬롯 = (날짜, 시간대, 테이블 정원, 용도[, 성별]) 조합.
 * 매칭: `${date}|${time}|${capacity}-matching-${gender}` / 일반: `${date}|${time}|${capacity}-general`
 * 이 슬롯 문서 하나로 예약 수를 O(1)로 집계한다.
 *
 * 날짜·시간대(회차)를 키에 포함하는 이유: 주점 등록 시 정하는 "테이블 개수"는 물리적인
 * 테이블 수로, 각 회차(1부/2부 등)마다 같은 테이블을 비우고 다시 쓴다 - 그래서 정원
 * 풀은 회차마다 독립적으로 리셋돼야 하며, 날짜·시간대에 상관없이 하나로 합쳐 세면 안 된다.
 */
export function matchingSlotKey(
  date: string,
  time: string,
  capacity: number,
  gender: MatchingGender,
): string {
  return `${date}|${time}|${capacity}-matching-${gender}`;
}

export function generalSlotKey(date: string, time: string, capacity: number): string {
  return `${date}|${time}|${capacity}-general`;
}

export type SlotResolution =
  | {
      ok: true;
      slotKey: string;
      /** 이 예약이 차지하는 테이블 정원 */
      capacity: number;
      /** 이 슬롯에 실제로 배치된 테이블 수 */
      tableCount: number;
      /** 오버부킹 포함 최대 허용 수 = tableCount + overbookLimit */
      limit: number;
    }
  | { ok: false; reason: string };

/**
 * 매칭 예약이 어느 테이블 슬롯에 들어가는지 계산.
 * "매칭 전용" 테이블의 정원은 테이블 전체(양 팀 합) 기준으로 등록됨
 * (예: 8인 매칭 테이블 = 최대 4인 팀 : 4인 팀). 한 팀의 인원수는 MIN_MATCHING_HEADCOUNT
 * 이상이면서 테이블 정원의 절반 이하면 되고(headcount * 2 <= capacity), 꼭 절반을 다
 * 채우지 않아도 된다 - 예를 들어 8인 테이블에서도 3:3처럼 더 작은 팀이 앉고 남는 자리는
 * 비워둘 수 있음(단, 1:1은 MIN_MATCHING_HEADCOUNT로 막혀 있어 불가). 후보가 여러
 * 개면(예: 6인·8인 테이블이 둘 다 있을 때 3인 팀) 남는 자리가 가장 적은(가장 작은 정원)
 * 테이블을 우선 배정한다. 홀수 정원 테이블은 반으로 나눌 수 없어 매칭 대상에서 제외.
 *
 * 일반 예약은 여러 테이블을 조합해 배정될 수 있으므로
 * resolveGeneralCombo()를 대신 사용한다 (아래).
 *
 * @param overbookLimit 정원 대비 추가로 받아줄 팀 수 - firestore-settings.ts의 getOverbookLimit()으로 가져온 값을 넘겨야 함
 */
export function resolveMatchingSlot(
  tables: TableConfig[],
  input: { date: string; time: string; gender: MatchingGender | null; headcount: number },
  overbookLimit: number,
): SlotResolution {
  if (!Number.isInteger(input.headcount) || input.headcount < MIN_MATCHING_HEADCOUNT) {
    return {
      ok: false,
      reason: `과팅 예약은 ${MIN_MATCHING_HEADCOUNT}인 이상 팀만 가능합니다(1:1 매칭은 받지 않습니다).`,
    };
  }
  if (!input.gender) return { ok: false, reason: "팀 성별을 선택해주세요." };

  const usable = tables.filter((t) => t.forMatching && t.count > 0 && t.capacity % 2 === 0);
  // 내 팀 인원수의 2배 이하로 들어갈 수 있는 테이블 중, 가장 여유가 적은(가장 작은 정원) 것을 고름
  const candidates = usable
    .filter((t) => t.capacity >= input.headcount * 2)
    .sort((a, b) => a.capacity - b.capacity);
  const table = candidates[0];
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
    slotKey: matchingSlotKey(input.date, input.time, table.capacity, input.gender),
    capacity: table.capacity,
    tableCount: table.count,
    limit: table.count + overbookLimit,
  };
}

export type GeneralTableAvailability = { capacity: number; available: number };

/**
 * 일반 테이블 구성 + 지금 활성(대기+승인) 예약 수로, 정원별로 "추가로 더 쓸 수 있는
 * 테이블 수"를 계산한다. 같은 정원의 테이블 행이 여러 개면 합산.
 *
 * @param overbookLimit 정원 대비 추가로 받아줄 팀 수 - 0을 넘기면 오버부킹 없이 등록된
 * 테이블 수만 따진다(정상 배정 우선 탐색용). 실제 오버부킹 허용치를 넘기면 그만큼 여유를 더 줌.
 */
export function generalTableAvailability(
  tables: TableConfig[],
  activeByCapacity: (capacity: number) => number,
  overbookLimit: number,
): GeneralTableAvailability[] {
  const totalByCapacity = new Map<number, number>();
  for (const t of tables) {
    if (t.forMatching || t.count <= 0) continue;
    totalByCapacity.set(t.capacity, (totalByCapacity.get(t.capacity) ?? 0) + t.count);
  }
  return Array.from(totalByCapacity.entries()).map(([capacity, count]) => ({
    capacity,
    available: Math.max(0, count + overbookLimit - activeByCapacity(capacity)),
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

/**
 * headcount가 테이블 하나(오버부킹 포함)만으로 들어가는지만 확인 - 여러 테이블로 쪼개지는
 * 조합은 절대 찾지 않는다. resolveGeneralCombo의 오버부킹 단계에서 쓰임(아래 설명 참고).
 */
function resolveSingleTableCombo(
  availability: GeneralTableAvailability[],
  headcount: number,
): TableUsage[] | null {
  const usable = availability.filter((a) => a.capacity > 0 && a.available > 0);
  if (usable.length === 0 || headcount <= 0) return null;
  return bestGeneralComboOfSize(usable, 1, headcount);
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

export type GeneralComboResolution =
  | {
      ok: true;
      combo: TableUsage[];
      tableCapacity: number;
      zone: "normal" | "overbook";
      /** zone이 overbook일 때만 값이 있음 - 정원을 넘긴 뒤 몇 번째로 접수됐는지 */
      waitingNumber: number | null;
    }
  | { ok: false; reason: string };

/**
 * 일반 예약이 어느 테이블 조합에 배정되는지 계산. 등록된 테이블만으로 조합을 먼저
 * 찾고(zone: normal), 그걸로 인원을 못 채우면 오버부킹 버퍼까지 포함해서 다시 찾는다
 * (zone: overbook) - 오버부킹은 정상 배정이 불가능할 때만 쓰이는 마지막 수단이라, 굳이
 * 필요하지 않은데 오버부킹 조합을 골라버리는 일이 없다.
 *
 * 오버부킹은 테이블 하나로 해결되는 예약에만 허용한다 - 정원 현황 화면은 테이블
 * 정원별로 따로 카운터를 세기 때문에(예약 단위로 묶어서 보여주지 않음), 한 예약이
 * 여러 테이블로 쪼개지는데 그중 한 조각만 오버부킹이 필요하면 같은 예약인데도 어떤
 * 테이블 칸은 "정상 대기"(노란색)로, 다른 칸은 "오버부킹 대기"(빨간색)로 따로 보여서
 * 예약 하나의 상태가 갈라져 보이는 문제가 생긴다. 그래서 여러 테이블로 쪼개야만
 * 채울 수 있는 인원인데 정상 조합(1차)이 없으면, 오버부킹(2차)도 시도하지 않고
 * 그 자리에서 접수를 막는다 - 이러면 오버부킹으로 확정되는 예약은 항상 테이블
 * 하나짜리라 화면에 두 상태로 갈라져 보일 일이 없다.
 *
 * @param activeByCapacity 정원별 현재 활성(대기+승인) 예약 수 - tx.get()으로 읽어온 값을 넘겨야 함
 * @param overbookLimit 정원 대비 추가로 받아줄 팀 수 - firestore-settings.ts의 getOverbookLimit()으로 가져온 값을 넘겨야 함
 */
export function resolveGeneralCombo(
  tables: TableConfig[],
  activeByCapacity: (capacity: number) => number,
  headcount: number,
  overbookLimit: number,
): GeneralComboResolution {
  if (!Number.isInteger(headcount) || headcount < MIN_GENERAL_HEADCOUNT) {
    return { ok: false, reason: "인원수가 올바르지 않습니다." };
  }
  const generalTables = tables.filter((t) => !t.forMatching && t.count > 0);
  if (generalTables.length === 0) {
    return { ok: false, reason: "이 주점은 일반 예약을 받지 않습니다." };
  }

  // 단체 예약(등록된 테이블을 전부 합쳐도 못 앉는 인원)은 오버부킹으로도 절대 못 채우는
  // 물리적으로 불가능한 인원이므로, 지금 몇 자리가 비어있는지와 무관하게 그 자리에서
  // 막는다 - 오버부킹은 "정원을 살짝 넘는 대기 버퍼"이지 "인원수 자체가 안 맞는 단체"를
  // 위한 게 아님.
  const maxPhysicalCapacity = generalTables.reduce((sum, t) => sum + t.capacity * t.count, 0);
  if (headcount > maxPhysicalCapacity) {
    return {
      ok: false,
      reason: `단체 예약(${headcount}명)은 이 주점의 테이블을 모두 합쳐도 받을 수 없습니다(최대 ${maxPhysicalCapacity}명). 인원을 나눠서 예약해주세요.`,
    };
  }

  // 1차: 오버부킹 없이(등록된 테이블 수만으로) 조합을 찾는다
  const normalAvailability = generalTableAvailability(tables, activeByCapacity, 0);
  let combo = resolveGeneralTableCombo(normalAvailability, headcount);
  if (combo) {
    return {
      ok: true,
      combo,
      tableCapacity: combo.reduce((sum, a) => sum + a.capacity * a.count, 0),
      zone: "normal",
      waitingNumber: null,
    };
  }

  // 2차: 오버부킹 버퍼까지 포함해서 다시 찾되, 테이블 하나로 끝나는 조합만 허용한다
  // (위 함수 설명 참고 - 여러 테이블로 쪼개지는 예약은 오버부킹을 아예 시도하지 않음)
  const overbookAvailability = generalTableAvailability(tables, activeByCapacity, overbookLimit);
  combo = resolveSingleTableCombo(overbookAvailability, headcount);
  if (!combo) {
    return {
      ok: false,
      reason:
        "지금은 인원에 맞는 자리가 없습니다. 여러 테이블로 나눠야 하는 예약은 추가 대기로 받지 않으니, 정원이 빌 때까지 기다리시거나 인원을 나눠 예약해주세요.",
    };
  }

  const registeredByCapacity = new Map<number, number>();
  for (const t of tables) {
    if (t.forMatching || t.count <= 0) continue;
    registeredByCapacity.set(t.capacity, (registeredByCapacity.get(t.capacity) ?? 0) + t.count);
  }
  let maxOverbookDepth = 0;
  for (const { capacity, count } of combo) {
    const before = activeByCapacity(capacity);
    const registered = registeredByCapacity.get(capacity) ?? 0;
    const depth = before + count - registered;
    if (depth > 0) maxOverbookDepth = Math.max(maxOverbookDepth, depth);
  }

  return {
    ok: true,
    combo,
    tableCapacity: combo.reduce((sum, a) => sum + a.capacity * a.count, 0),
    zone: "overbook",
    waitingNumber: maxOverbookDepth,
  };
}

/**
 * 매칭 예약에서 고를 수 있는 "팀 인원수" 목록 (오름차순).
 * 매칭 전용 테이블의 정원은 양 팀 합계라서, MIN_MATCHING_HEADCOUNT 이상이면서 정원의
 * 절반 이하 인원이면 그 테이블에 앉을 수 있다 (예: 8인 테이블 → 2~4인 팀 가능, 3:3처럼
 * 남는 자리를 비워둬도 됨 - resolveMatchingSlot 참고). 1:1은 1:1 매칭을 받지 않기로
 * 해서 애초에 옵션에 안 나옴. 홀수 정원(반으로 못 나눔)은 잘못 등록된 것으로 보고 제외.
 */
export function matchingHeadcountOptions(tables: TableConfig[]): number[] {
  const usable = tables.filter((t) => t.forMatching && t.count > 0 && t.capacity % 2 === 0);
  const options = new Set<number>();
  for (const t of usable) {
    for (let size = MIN_MATCHING_HEADCOUNT; size <= t.capacity / 2; size++) options.add(size);
  }
  return Array.from(options).sort((a, b) => a - b);
}

/**
 * 일반 예약에서 허용되는 인원수 범위 [min, max]. 일반 테이블이 없으면 null.
 * max는 테이블 하나의 정원이 아니라 그냥 상식적인 상한(MAX_GENERAL_HEADCOUNT) -
 * 큰 인원은 여러 테이블 조합으로 나눠 앉히므로 특정 테이블 정원에 묶이지 않는다
 * (resolveGeneralCombo 참고).
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
  date: string;
  time: string;
  matching: boolean;
  matchingGender?: MatchingGender;
  tableCapacity: number;
  tableAssignment?: TableUsage[];
}): { slotKey: string; count: number }[] {
  if (r.matching) {
    if (!r.matchingGender) return [];
    return [
      { slotKey: matchingSlotKey(r.date, r.time, r.tableCapacity, r.matchingGender), count: 1 },
    ];
  }
  const assignment = r.tableAssignment?.length
    ? r.tableAssignment
    : [{ capacity: r.tableCapacity, count: 1 }];
  return assignment.map((a) => ({
    slotKey: generalSlotKey(r.date, r.time, a.capacity),
    count: a.count,
  }));
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
 * 주점 테이블 구성 + 그 주점의 예약 목록(전부 같은 날짜·시간대여야 함)으로 슬롯별 정원
 * 현황을 만든다. (관리자 화면에서 이미 로드된 예약으로 계산 - 추가 읽기 없음)
 *
 * @param date, time 정원 풀이 회차별로 독립적이라 어느 회차를 보는지 명시해야 함
 * @param overbookLimit 정원 대비 추가로 받아줄 팀 수 - firestore-settings.ts의 getOverbookLimit()으로 가져온 값을 넘겨야 함
 */
export function summarizeBoothSlots(
  tables: TableConfig[],
  reservations: Reservation[],
  date: string,
  time: string,
  overbookLimit: number,
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
        ? matchingSlotKey(date, time, t.capacity, gender)
        : generalSlotKey(date, time, t.capacity);
      rows.push({
        slotKey,
        capacity: t.capacity,
        forMatching: t.forMatching,
        gender,
        tableCount: t.count,
        limit: t.count + overbookLimit,
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
 * 주어진 예약 목록(이미 원하는 범위로 걸러져 있어야 함) 안에서, 한 정원(capacity)의
 * 매칭 테이블이 "실제로 몇 개 차 있는지" 계산 - computeMatchingTableLeftover와
 * computeMatchingTableSafeLeftover가 공유하는 핵심 로직.
 *
 * 승인은 성별별로 독립된 정원이라(짝짓기와 무관), 승인된 예약 중 아직 짝이 없는 남/여는
 * "앞으로 서로 짝지어질 수 있다"고 낙관적으로 가정해 max(짝없는 남, 짝없는 여)만큼만
 * 테이블을 쓴다고 본다. 이미 짝지어진 쌍은 테이블 하나를 같이 쓰므로 1개로 센다.
 *
 * 이 낙관적 가정은 반드시 "인원수가 같은 팀끼리"만 성립한다 - pairReservations가
 * 인원수가 다른 두 팀은 애초에 짝짓기를 거부하기 때문. 8인 테이블처럼 한 정원에
 * 여러 인원수(2·3·4인 팀)가 동시에 들어갈 수 있는 경우, 인원수를 구분하지 않고
 * 그냥 다 합쳐서 max(짝없는 남, 짝없는 여)를 구하면 "인원수가 달라 절대 못 짝지어지는"
 * 팀끼리도 서로 자리를 메꿔줄 수 있다고 잘못 가정하게 된다(예: 짝없는 4인 남성팀 1 +
 * 짝없는 3인 여성팀 1 => 실제로는 테이블 2개가 각각 필요한데 계산은 1개로 나옴).
 * 그래서 인원수별로 따로 묶어 계산한 뒤 합산한다 - 4인 테이블처럼 애초에 인원수가
 * 하나뿐인 경우는 그룹이 하나라 기존과 결과가 같다.
 */
function occupiedMatchingTables(
  reservations: Reservation[],
  capacity: number,
): { occupied: number; pendingCount: number } {
  const atCapacity = reservations.filter((r) => r.matching && r.tableCapacity === capacity);
  const pendingCount = atCapacity.filter((r) => r.status === "pending").length;

  const byHeadcount = new Map<number, Reservation[]>();
  for (const r of atCapacity) {
    if (!byHeadcount.has(r.headcount)) byHeadcount.set(r.headcount, []);
    byHeadcount.get(r.headcount)!.push(r);
  }

  let occupied = 0;
  for (const group of byHeadcount.values()) {
    const approved = group.filter((r) => r.status === "approved");
    const approvedIds = new Set(approved.map((r) => r.id));

    const counted = new Set<string>();
    let pairedTables = 0;
    for (const r of approved) {
      if (counted.has(r.id) || !r.pairedWith || !approvedIds.has(r.pairedWith)) continue;
      pairedTables += 1;
      counted.add(r.id);
      counted.add(r.pairedWith);
    }
    const soloMale = approved.filter(
      (r) => !counted.has(r.id) && r.matchingGender === "male",
    ).length;
    const soloFemale = approved.filter(
      (r) => !counted.has(r.id) && r.matchingGender === "female",
    ).length;
    occupied += pairedTables + Math.max(soloMale, soloFemale);
  }

  return { occupied, pendingCount };
}

/**
 * 매칭 전용 테이블 종류별로, 지정한 회차(date, time) 하나만 기준으로 "몇 개가 차 있는지" -
 * 관리자 화면에서 회차별 정원 현황 옆에 참고용으로 보여주는 용도(표시 전용, 전환에는
 * 쓰지 않음 - 아래 computeMatchingTableSafeLeftover 참고).
 */
export function computeMatchingTableLeftover(
  tables: TableConfig[],
  reservations: Reservation[],
  date: string,
  time: string,
): MatchingTableLeftover[] {
  const session = reservations.filter((r) => r.date === date && r.time === time);
  return tables
    .filter((t) => t.forMatching && t.count > 0)
    .map((t) => {
      const { occupied, pendingCount } = occupiedMatchingTables(session, t.capacity);
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

/**
 * "일반으로 전환해도 되는" 진짜 남는 테이블 수 - 매칭 관리 탭의 "남는 테이블 전환" 액션이
 * 실제로 몇 개를 옮길지 결정할 때 쓰는 함수.
 *
 * 테이블 개수는 회차(날짜·시간대)와 무관하게 모든 회차가 공유하는 물리적인 설정이라서,
 * 특정 회차 하나만 보고 "지금 안 쓰이니 전환하자"고 하면 안 된다 - 예를 들어 1부엔 매칭
 * 수요가 없어서 비어 있어도, 같은 날 2부나 다른 날짜에 이미 그 테이블이 필요한 예약이
 * 있을 수 있다. 그래서 등록된 예약이 있는 모든 회차를 하나씩 돌면서 그중 가장 많이 쓰인
 * 회차(최댓값)를 기준으로 남는 개수를 계산한다 - 어느 회차에도 지장이 없는 만큼만 전환됨.
 * 대기중인 예약은 회차 상관없이 하나라도 있으면(나중에 승인되면 어느 회차의 사용량이
 * 늘어날지 모르므로) 합산해서 표시만 하고, 전환은 호출하는 쪽에서 전부 막아야 함.
 */
export function computeMatchingTableSafeLeftover(
  tables: TableConfig[],
  reservations: Reservation[],
): MatchingTableLeftover[] {
  const sessions = new Map<string, Reservation[]>();
  for (const r of reservations) {
    if (!r.matching) continue;
    const key = `${r.date}|${r.time}`;
    if (!sessions.has(key)) sessions.set(key, []);
    sessions.get(key)!.push(r);
  }
  const sessionGroups = Array.from(sessions.values());

  return tables
    .filter((t) => t.forMatching && t.count > 0)
    .map((t) => {
      let occupied = 0;
      let pendingCount = 0;
      for (const group of sessionGroups) {
        const result = occupiedMatchingTables(group, t.capacity);
        occupied = Math.max(occupied, result.occupied);
        pendingCount += result.pendingCount;
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

/**
 * 이 예약을 승인(확정)해도 되는지 확인.
 *
 * 오버부킹은 "접수(대기)"까지만 허용되는 버퍼다 - 실수로 예약 버튼을 누른 경우 등을 대비해
 * 대기 명단은 정원보다 몇 건 더 받아두지만, 실제로 승인(확정)하는 순간부터는 진짜 좌석이
 * 배정되는 것이므로 물리적으로 등록된 테이블 수를 절대 넘을 수 없다. 이미 확정된 예약이
 * 테이블 수만큼 차 있으면, 남은 대기 예약은 앞선 확정 예약이 취소돼야만 승인할 수 있다.
 *
 * 매칭은 짝짓기 여부와 무관하게 성별별로 독립된 정원으로 취급한다 - 예를 들어 4인 매칭
 * 테이블 2개면, 남성팀도 최대 2팀·여성팀도 최대 2팀까지 각자 승인할 수 있다(짝은 승인
 * 이후에 관리자가 매칭 관리 탭에서 별도로 지정함 - firestore-reservations.ts의
 * pairReservations 참고).
 *
 * 정원은 날짜·시간대(회차)마다 독립적으로 리셋되므로(같은 물리 테이블을 회차마다 비우고
 * 다시 씀), 비교 대상 예약들도 target과 같은 날짜·시간대인 것만 센다.
 */
export function canApproveReservation(
  tables: TableConfig[],
  reservations: Reservation[],
  target: Pick<
    Reservation,
    "id" | "date" | "time" | "matching" | "matchingGender" | "tableCapacity" | "tableAssignment"
  >,
): { ok: true } | { ok: false; reason: string } {
  const sameSession = reservations.filter(
    (r) => r.date === target.date && r.time === target.time,
  );

  if (target.matching) {
    const table = tables.find((t) => t.forMatching && t.capacity === target.tableCapacity);
    if (!table) return { ok: false, reason: "테이블 정보를 찾을 수 없습니다." };
    const approvedCount = sameSession.filter(
      (r) =>
        r.id !== target.id &&
        r.status === "approved" &&
        r.matching &&
        r.matchingGender === target.matchingGender &&
        r.tableCapacity === target.tableCapacity,
    ).length;
    if (approvedCount + 1 > table.count) {
      return {
        ok: false,
        reason: `${target.tableCapacity}인 매칭 테이블이 이미 모두 확정되어 지금은 승인할 수 없습니다. 앞선 확정 예약이 취소되면 승인해주세요.`,
      };
    }
    return { ok: true };
  }

  // 일반: tableAssignment의 각 정원별로, 이미 확정(승인)된 다른 예약들의 사용량 + 이 예약의
  // 사용량이 등록된 물리 테이블 수(오버부킹 제외)를 넘는지 확인
  const assignment = target.tableAssignment?.length
    ? target.tableAssignment
    : [{ capacity: target.tableCapacity, count: 1 }];

  const registeredByCapacity = new Map<number, number>();
  for (const t of tables) {
    if (t.forMatching || t.count <= 0) continue;
    registeredByCapacity.set(t.capacity, (registeredByCapacity.get(t.capacity) ?? 0) + t.count);
  }

  const approvedByCapacity = new Map<number, number>();
  for (const r of sameSession) {
    if (r.status !== "approved" || r.matching || r.id === target.id) continue;
    const usage = r.tableAssignment?.length
      ? r.tableAssignment
      : [{ capacity: r.tableCapacity, count: 1 }];
    for (const u of usage) {
      approvedByCapacity.set(u.capacity, (approvedByCapacity.get(u.capacity) ?? 0) + u.count);
    }
  }

  for (const u of assignment) {
    const already = approvedByCapacity.get(u.capacity) ?? 0;
    const registered = registeredByCapacity.get(u.capacity) ?? 0;
    if (already + u.count > registered) {
      return {
        ok: false,
        reason: `${u.capacity}인 테이블이 이미 모두 확정되어 지금은 승인할 수 없습니다. 앞선 확정 예약이 취소되면 승인해주세요.`,
      };
    }
  }
  return { ok: true };
}
