export type LoginState = { error?: string };

export type SeasonType = "festival" | "event";
export type SeasonStatus = "upcoming" | "ongoing" | "ended";

export type Season = {
  id: string;
  name: string;
  type: SeasonType;
  status: SeasonStatus;
  year: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
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
  boothId: string;
  boothName: string;
  representativeName: string;
  phone: string;
  department: string;
  headcount: number;
  date: string;
  time: string;
  matching: boolean;
  /** 과팅 신청 시 우리 팀 성별 */
  matchingGender?: MatchingGender;
  /** 과팅 신청 시 참석자별 학과. index 0 = 대표자 학과(= department와 동일) */
  participantDepartments?: string[];
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
  name: string;
  ownerName: string;
  ownerPhone: string | null;
  descriptionText: string;
  descriptionImages: string[]; // data URL 목록
  menus: MenuItem[];
  minOrder: number;
  tables: TableConfig[];
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
