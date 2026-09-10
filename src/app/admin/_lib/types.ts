export type LoginState = { error?: string };

export type SeasonType = "festival" | "event";
export type SeasonStatus = "upcoming" | "ongoing" | "ended";

export type Season = {
  id: string;
  name: string;
  type: SeasonType;
  /** startDate/endDate/earlyEndedAt로부터 항상 자동 계산됨 - 직접 수정하지 않음 */
  status: SeasonStatus;
  year: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  /** 조기종료한 날짜(YYYY-MM-DD). 설정되면 이후 status는 무조건 ended로 고정됨 */
  earlyEndedAt: string | null;
};

export type ReservationStatus = "pending" | "approved" | "rejected";
export type MatchingGender = "male" | "female";

export type ReservationOrderItem = {
  menuName: string;
  unitPrice: number;
  quantity: number;
};

export type Reservation = {
  id: string;
  /** 접수 순서대로 1부터 자동 증가하는 고유 주문번호 (counters/reservationOrderNumber로 관리) */
  orderNumber: number;
  boothId: string;
  boothName: string;
  representativeName: string;
  phone: string;
  department: string;
  headcount: number;
  date: string;
  time: string;
  /** 환불 등에 쓰일 대표 예약자 본인 계좌 정보 */
  bank: string;
  accountNumber: string;
  matching: boolean;
  /** 과팅 신청 시 우리 팀 성별 */
  matchingGender?: MatchingGender;
  /** 과팅 신청 시 참석자별 학과. index 0 = 대표자 학과(= department와 동일) */
  participantDepartments?: string[];
  /**
   * 과팅 신청자에게 배정된 별칭. 주점별 별칭 풀(boothAliases 컬렉션)에서
   * 같은 주점 내 다른 유효 예약과 겹치지 않게 접수 시점에 하나 뽑아서 고정.
   * 과팅 미신청이거나 풀이 비었거나 소진되면 null.
   */
  assignedAlias?: string | null;
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
};

export type TableConfig = {
  id: string;
  capacity: number;
  count: number;
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
  minOrder: number;
  tables: TableConfig[];
  /**
   * 이 주점의 입금 계좌 (accounts 컬렉션 문서 id). null이면 시스템 대표 계좌를 그대로 씀.
   * 올해는 보통 다 null(모임통장 하나로 운영)이고, 내년에 주점별로 따로 관리하게 되면
   * 여기에 각자의 계좌를 지정하면 됨.
   */
  accountId: string | null;
  createdAt: string;
};

/**
 * 주점별 별칭 풀 - 과팅 신청자에게 배정할 별칭 후보 목록.
 * boothAliases 컬렉션에 주점 id를 문서 id로 1:1 저장하며, 주점 등록/수정 폼에서 관리한다.
 */
export type BoothAliasPool = {
  boothId: string;
  /** 배정 가능한 별칭 목록 (위에서부터 순서대로 배정됨) */
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
