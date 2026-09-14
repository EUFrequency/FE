import {
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
 * 일반 예약은 인원수 구간(밴드)으로 테이블 정원 하나에 배정되므로
 * resolveGeneralSlot()을 대신 사용한다 (아래).
 *
 * @param overbookLimit 정원 대비 추가로 받아줄 팀 수 - firestore-settings.ts의 getOverbookLimit()으로 가져온 값을 넘겨야 함
 */
export function resolveMatchingSlot(
  tables: TableConfig[],
  input: { gender: MatchingGender | null; headcount: number },
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
    slotKey: matchingSlotKey(table.capacity, input.gender),
    capacity: table.capacity,
    tableCount: table.count,
    limit: table.count + overbookLimit,
  };
}

/**
 * 일반 예약이 어느 테이블 정원 하나에 배정되는지 계산 - 더 이상 여러 테이블을 조합하지
 * 않고, 등록된 일반 테이블 정원을 오름차순으로 나열해 인원수 구간(밴드) 하나에만 매칭한다.
 * 각 구간은 (바로 아래 정원, 이 정원]으로 자동 결정됨 - 예를 들어
 *   4/6/8인 테이블이 있으면: 4인=2~4명, 6인=5~6명, 8인=7~8명
 *   4/8인만 있으면(6인 없음): 4인=2~4명, 8인=5~8명
 * 등록된 테이블 중 가장 큰 정원보다 인원이 많으면 이 주점에서는 애초에 받을 수 없는
 * 인원이므로(예전처럼 여러 테이블을 합쳐 늘려주지 않음) 그 자리에서 막는다 - 오버부킹도
 * 이제 일반 예약에는 적용하지 않아(resolveMatchingSlot과 달리 overbookLimit을 받지 않음),
 * tableCount를 넘기면 바로 마감으로 처리한다(호출하는 쪽에서 active >= tableCount로 확인).
 */
export function resolveGeneralSlot(
  tables: TableConfig[],
  headcount: number,
): SlotResolution {
  if (!Number.isInteger(headcount) || headcount < MIN_GENERAL_HEADCOUNT) {
    return { ok: false, reason: "인원수가 올바르지 않습니다." };
  }

  const byCapacity = new Map<number, number>();
  for (const t of tables) {
    if (t.forMatching || t.count <= 0) continue;
    byCapacity.set(t.capacity, (byCapacity.get(t.capacity) ?? 0) + t.count);
  }
  const capacities = Array.from(byCapacity.keys()).sort((a, b) => a - b);
  if (capacities.length === 0) {
    return { ok: false, reason: "이 주점은 일반 예약을 받지 않습니다." };
  }

  let prev = MIN_GENERAL_HEADCOUNT - 1;
  for (const capacity of capacities) {
    if (headcount > prev && headcount <= capacity) {
      const tableCount = byCapacity.get(capacity)!;
      return {
        ok: true,
        slotKey: generalSlotKey(capacity),
        capacity,
        tableCount,
        limit: tableCount,
      };
    }
    prev = capacity;
  }

  const max = capacities[capacities.length - 1];
  return {
    ok: false,
    reason: `이 주점은 최대 ${max}인까지만 일반 예약을 받습니다. 인원을 줄여서 다시 시도해주세요.`,
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
 * max는 이제 등록된 일반 테이블 중 가장 큰 정원 - 더 이상 여러 테이블을 조합해 늘려주지
 * 않으므로(resolveGeneralSlot 참고) 그 이상은 이 주점에서 원천적으로 받을 수 없다.
 */
export function generalHeadcountRange(
  tables: TableConfig[],
): { min: number; max: number } | null {
  const capacities = tables
    .filter((t) => !t.forMatching && t.count > 0)
    .map((t) => t.capacity);
  if (capacities.length === 0) return null;
  return { min: MIN_GENERAL_HEADCOUNT, max: Math.max(...capacities) };
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
 *
 * @param overbookLimit 정원 대비 추가로 받아줄 팀 수 - firestore-settings.ts의 getOverbookLimit()으로 가져온 값을 넘겨야 함
 */
export function summarizeBoothSlots(
  tables: TableConfig[],
  reservations: Reservation[],
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
        ? matchingSlotKey(t.capacity, gender)
        : generalSlotKey(t.capacity);
      rows.push({
        slotKey,
        capacity: t.capacity,
        forMatching: t.forMatching,
        gender,
        tableCount: t.count,
        // 오버부킹은 이제 매칭 예약에만 적용됨(일반 예약은 밴드가 차면 바로 마감)
        limit: t.forMatching ? t.count + overbookLimit : t.count,
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
 *
 * 승인은 이제 성별별로 독립된 정원이라(짝짓기와 무관), 승인된 예약 중 아직 짝이 없는
 * 남/여는 "앞으로 서로 짝지어질 수 있다"고 낙관적으로 가정해 max(짝없는 남, 짝없는 여)만큼만
 * 테이블을 쓴다고 본다. 이미 짝지어진 쌍은 테이블 하나를 같이 쓰므로 1개로 센다.
 * (예: 짝없는 남 2 + 짝없는 여 1이면 최선의 경우 1쌍 + 혼자 1명 = 테이블 2개로 충분)
 *
 * 대기중인 예약이 남아있으면(아직 승인/거절을 안 끝냈으면) 잘못된 전환을 막기 위해
 * pendingCount로 표시만 하고 occupied 계산에는 넣지 않는다 - 호출하는 쪽에서
 * pendingCount > 0이면 전환을 막아야 함.
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
      const approved = atCapacity.filter((r) => r.status === "approved");
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
      const occupied = pairedTables + Math.max(soloMale, soloFemale);

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
 */
export function canApproveReservation(
  tables: TableConfig[],
  reservations: Reservation[],
  target: Pick<
    Reservation,
    "id" | "matching" | "matchingGender" | "tableCapacity" | "tableAssignment"
  >,
): { ok: true } | { ok: false; reason: string } {
  if (target.matching) {
    const table = tables.find((t) => t.forMatching && t.capacity === target.tableCapacity);
    if (!table) return { ok: false, reason: "테이블 정보를 찾을 수 없습니다." };
    const approvedCount = reservations.filter(
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
  for (const r of reservations) {
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
