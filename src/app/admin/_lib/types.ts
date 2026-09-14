export type LoginState = { error?: string };

export type SeasonType = "festival" | "event";
export type SeasonStatus = "upcoming" | "ongoing" | "ended";

/**
 * 시간이 붙는 필드(조회/일반예약/과팅예약)는 전부 KST 기준 "YYYY-MM-DDTHH:mm" 문자열.
 * 시작 시각은 항상 값이 있고, 종료 시각만 null이 될 수 있는데 - 이건 관리자가 폼에서
 * 직접 비워두는 게 아니라(폼은 항상 값을 요구함), 대시보드의 "강제 오픈"을 이미 지난
 * 기간에 눌렀을 때만 자동으로 null(= "종료시까지", 무기한)이 된다. firestore-seasons.ts의
 * forceOpenReservation/forceCloseReservation 참고.
 */
export type Season = {
  id: string;
  name: string;
  type: SeasonType;
  /** startDate/endDate/earlyEndedAt로부터 항상 자동 계산됨 - 직접 수정하지 않음 */
  status: SeasonStatus;
  year: number;
  /** 축제 진행 시작일 (YYYY-MM-DD, 시간 없음) - 예약 폼의 방문 날짜 선택지가 이 구간에서 나옴 */
  startDate: string;
  /** 축제 진행 종료일 (YYYY-MM-DD, 시간 없음) */
  endDate: string;
  /**
   * 사용자가 주점 정보·메뉴를 조회할 수 있는 기간 시작. 일반/과팅 예약 기간을 항상
   * 포함해야 함(조회가 안 되면 예약 폼(2페이지)까지 갈 방법이 없으므로) - 이 기간 밖이면
   * /festival 페이지 전체가 잠기고 안내만 뜬다.
   */
  viewStartDate: string;
  /** 조회 가능 기간 종료. null이면 무기한("종료시까지") */
  viewEndDate: string | null;
  /** 일반 예약 접수 시작 시각 */
  reservationStartDate: string;
  /** 일반 예약 접수 마감 시각. null이면 무기한("종료시까지") */
  reservationEndDate: string | null;
  /** 과팅 예약 접수 시작 시각 - 일반 예약 기간 안에 있어야 함 */
  matchingReservationStartDate: string;
  /** 과팅 예약 접수 마감 시각. null이면 무기한("종료시까지") */
  matchingReservationEndDate: string | null;
  /** 조기종료한 날짜(YYYY-MM-DD). 설정되면 이후 status는 무조건 ended로 고정됨 */
  earlyEndedAt: string | null;
};

/**
 * 테이블 종류(정원+용도)마다 허용하는 오버부킹 팀 수 (매칭은 성별별로 각각 적용) 의 기본값.
 * 관리자가 설정(settings/overbook, firestore-settings.ts의 getOverbookLimit)을 바꾸지 않았을 때만 씀 -
 * 실제로 쓰이는 값은 항상 getOverbookLimit()을 통해 가져와야 함.
 */
export const DEFAULT_OVERBOOK_LIMIT = 3;

/** 일반 예약이 앉을 수 있는 최소 인원 (1인 예약 불가) */
export const MIN_GENERAL_HEADCOUNT = 2;

/**
 * 일반 예약 인원의 상한. 테이블 하나의 정원과는 무관함 - 큰 인원은 여러 테이블
 * 조합으로 나눠 앉히므로, 이 값은 그냥 비상식적으로 큰 인원을 막기 위한 안전장치
 * (slots.ts의 generalHeadcountRange/resolveGeneralCombo 참고).
 */
export const MAX_GENERAL_HEADCOUNT = 20;

/** 과팅(매칭) 팀 최소 인원 - 1:1 매칭은 받지 않음(반드시 2인 이상 팀끼리만 매칭) */
export const MIN_MATCHING_HEADCOUNT = 2;

export type ReservationStatus = "pending" | "approved" | "rejected";
export type MatchingGender = "male" | "female";

export type ReservationOrderItem = {
  menuName: string;
  unitPrice: number;
  quantity: number;
};

/** 예약 하나가 실제로 차지하는 테이블 구성. 정원 slotKey는 capacity로부터 파생 */
export type TableUsage = { capacity: number; count: number };

export type Reservation = {
  id: string;
  boothId: string;
  boothName: string;
  representativeName: string;
  phone: string;
  department: string;
  headcount: number;
  /**
   * 이 예약이 차지한 테이블 정원 합계 (참고용). 매칭이면 테이블 정원(=headcount*2)과 동일,
   * 일반이면 tableAssignment에 있는 테이블들의 정원 합. 실제 정원 슬롯 집계는
   * tableAssignment(일반) / matchingGender+headcount(매칭) 기준으로 함 - slots.ts 참고.
   */
  tableCapacity: number;
  /**
   * 일반 예약이 실제로 배정된 테이블 조합 (예: 10인 -> 6인 테이블 1개 + 4인 테이블 1개).
   * 매칭 예약은 항상 테이블 하나만 쓰므로 비워둠(undefined) - tableCapacity로 충분.
   */
  tableAssignment?: TableUsage[];
  date: string;
  time: string;
  /**
   * time의 시작/종료 시각을 자정부터의 분(minute)으로 미리 변환해둔 값 - 서버가 접수
   * 시점에 booth.timeSlots에서 계산해 채움(클라이언트 입력 아님). 주점마다 시간대를
   * 자유롭게 등록할 수 있어서 문자열(time)만으로는 다른 주점끼리 시간이 겹치는지 비교하기
   * 어려운데, 이 값으로 같은 전화번호가 다른 주점 예약과 시간이 겹치는지 확인한다
   * (firestore-reservations.ts의 시간대 잠금 - reservationTimeLocks 컬렉션 참고).
   * 옛날 예약 문서엔 없을 수 있음(undefined).
   */
  timeStartMin?: number;
  timeEndMin?: number;
  /** 환불 등에 쓰일 대표 예약자 본인 계좌 정보 */
  bank: string;
  accountNumber: string;
  matching: boolean;
  /** 과팅 신청 시 우리 팀 성별 */
  matchingGender?: MatchingGender;
  /** 과팅 신청 시 참석자별 학과. index 0 = 대표자 학과(= department와 동일) */
  participantDepartments?: string[];
  /**
   * 매칭 짝지어진 별칭. 예약 접수 시점이 아니라 관리자가 매칭 관리 탭에서 짝을
   * 지어줄 때(pairReservations) 그 주점의 별칭 풀에서 골라 양쪽에 똑같이 배정한다
   * (같은 주점/날짜/시간대 안에서 겹치지 않게). 아직 짝지어지지 않았으면 null.
   */
  assignedAlias?: string | null;
  /**
   * 매칭 짝지어진 상대 예약 id. 관리자가 대기중인 반대 성별 예약과 짝지으면 양쪽에
   * 서로의 id가 채워지고 둘 다 승인 처리됨. 상대가 거절되면 자동으로 null로 풀림.
   */
  pairedWith?: string | null;
  /** 주문한 메뉴 내역 (영수증 표시용) */
  orderItems: ReservationOrderItem[];
  /** 메뉴 주문 금액 (주점 매출로 집계) = orderItems 합계 */
  menuAmount: number;
  /** 과팅 신청 비용 (인당 3,000원, 주최측 수익으로 집계) */
  matchingFee: number;
  /** menuAmount + matchingFee */
  totalAmount: number;
  status: ReservationStatus;
  createdAt: string;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string; // data URL 또는 외부 이미지 URL
  /** 차림비처럼 인원수만큼 무조건 시켜야 하는 메뉴면 true - 예약 화면에서 인원수만큼 자동 선택되고 수량을 바꿀 수 없음 */
  perPersonRequired?: boolean;
  /**
   * true면 이 메뉴 금액은 최소 주문 금액 충족 여부를 따질 때 제외한다(다른 메뉴로 채워야 함) -
   * 실제 결제 총액에는 항상 그대로 포함됨. perPersonRequired 메뉴(차림비 등)에서만 의미가
   * 있고, 그 외에는 무시됨. 기본값(undefined)은 기존과 동일하게 포함.
   */
  excludeFromMinOrder?: boolean;
};

export type TableConfig = {
  id: string;
  capacity: number;
  count: number;
  /** true = 과팅(매칭) 예약 전용, false = 일반 예약 전용 */
  forMatching: boolean;
};

/** 주점이 운영하는 시간대(부) - 예: 1부 11:00~11:50 */
export type TimeSlot = {
  id: string;
  label: string;
  startTime: string; // "11:00"
  endTime: string; // "11:50"
};

/**
 * 인원수 구간별 최소 주문금액 규칙 - "N인 이하면 X원 이상 주문".
 * 여러 개를 인원수 오름차순으로 등록하며, 예약 인원이 맨 마지막(가장 큰) 규칙의
 * maxHeadcount보다 많아도 그 규칙의 minAmount를 그대로 적용한다(catch-all) - min-order.ts 참고.
 */
export type MinOrderRule = {
  /** 이 인원수 이하일 때 이 규칙이 적용됨 */
  maxHeadcount: number;
  /** 위 인원수 이하일 때 필요한 최소 주문 금액 */
  minAmount: number;
};

export type AdminBooth = {
  id: string;
  /** 이 주점을 운영하는 학과/동아리 등 (배치도·공개 페이지 표시용) */
  department: string;
  name: string;
  ownerName: string;
  ownerPhone: string | null;
  descriptionText: string;
  descriptionImages: string[]; // data URL 목록
  menus: MenuItem[];
  minOrderRules: MinOrderRule[];
  tables: TableConfig[];
  /** 예약 화면에서 고를 수 있는 시간대 목록. 관리자가 주점마다 직접 설정 */
  timeSlots: TimeSlot[];
  /**
   * 이 주점의 입금 계좌 (accounts 컬렉션 문서 id). null이면 시스템 대표 계좌를 그대로 씀.
   * 올해는 보통 다 null(모임통장 하나로 운영)이고, 내년에 주점별로 따로 관리하게 되면
   * 여기에 각자의 계좌를 지정하면 됨.
   */
  accountId: string | null;
  createdAt: string;
};

/**
 * 주점별 별칭 풀 - 매칭(과팅) 짝을 지을 때 관리자가 고를 수 있는 별칭 후보 목록.
 * boothAliases 컬렉션에 주점 id를 문서 id로 1:1 저장하며, 주점 등록/수정 폼에서 관리한다.
 * (어떤 별칭이 지금 쓰이고 있는지는 이 문서가 아니라 예약 데이터 자체에서 그때그때
 * 계산함 - 같은 주점/날짜/시간대 안에서 승인된 예약들의 assignedAlias를 보면 됨)
 */
export type BoothAliasPool = {
  boothId: string;
  /** 배정 가능한 별칭 목록 (위에서부터 순서대로 보여줌) */
  aliases: string[];
};

/** 입금 계좌 - 시스템 대표 계좌 1개(isDefault) + 주점별 개별 계좌들을 같은 테이블에서 관리 */
export type Account = {
  id: string;
  bank: string;
  accountNumber: string;
  holderName: string;
  /** 이 계좌가 시스템 전체 대표 계좌인지. 동시에 하나만 true */
  isDefault: boolean;
  createdAt: string;
};

/** M행 N열 배치도에서 각 셀의 좌표 키: `${row}-${col}` */
export type SeasonLayout = {
  rows: number;
  cols: number;
  cells: Record<string, string | null>; // key -> boothId
  /** 마지막으로 "저장하기"를 눌러 반영된 시각 (ISO) */
  updatedAt: string;
};
