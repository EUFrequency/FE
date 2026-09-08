import { BOOTHS } from "@/app/festival/data";
import type {
  AdminBooth,
  Reservation,
  ReservationOrderItem,
  Season,
  TableConfig,
} from "./types";

const MATCHING_FEE_PER_PERSON = 3000;

/** festival 더미 메뉴에서 이름/가격을 그대로 가져와 영수증 항목을 만듦 */
function orderItem(boothId: string, menuId: string, quantity: number): ReservationOrderItem {
  const booth = BOOTHS.find((b) => b.id === boothId);
  const menu = booth?.menus.find((m) => m.id === menuId);
  if (!booth || !menu) {
    throw new Error(`알 수 없는 메뉴: ${boothId}/${menuId}`);
  }
  return { menuName: menu.name, unitPrice: menu.price, quantity };
}

function sumOrder(items: ReservationOrderItem[]) {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

function buildReservation(
  base: Omit<Reservation, "menuAmount" | "matchingFee" | "totalAmount"> & {
    orderItems: ReservationOrderItem[];
  },
): Reservation {
  const menuAmount = sumOrder(base.orderItems);
  const matchingFee = base.matching ? base.headcount * MATCHING_FEE_PER_PERSON : 0;
  return { ...base, menuAmount, matchingFee, totalAmount: menuAmount + matchingFee };
}

function tables(...pairs: [number, number][]): TableConfig[] {
  return pairs.map(([capacity, count], i) => ({
    id: `table-${capacity}-${i}`,
    capacity,
    count,
  }));
}

/** 축제편 더미 주점 데이터를 관리자용 주점 데이터로 변환 (초기 시드값) */
export function buildSeedBooths(): AdminBooth[] {
  const defaultTables: TableConfig[][] = [
    tables([2, 4], [4, 3], [6, 1]),
    tables([2, 3], [4, 4]),
    tables([2, 2], [4, 2], [6, 2]),
    tables([2, 5], [4, 1]),
  ];

  return BOOTHS.map((booth, i) => ({
    id: booth.id,
    name: booth.name,
    ownerName: `${booth.department} 대표`,
    ownerPhone: i % 2 === 0 ? "010-1234-5678" : null,
    descriptionText: booth.description,
    descriptionImages: booth.menus.slice(0, 1).map((m) => m.image),
    menus: booth.menus.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      price: m.price,
      image: m.image,
    })),
    minOrder: booth.minOrder,
    tables: defaultTables[i] ?? tables([4, 2]),
    createdAt: new Date("2026-08-20").toISOString(),
  }));
}

export function buildSeedSeasons(): Season[] {
  return [
    {
      id: "season-2026-fall",
      name: "2026 가을 대동제",
      type: "festival",
      status: "ongoing",
      year: 2026,
      startDate: "2026-09-10",
      endDate: "2026-09-12",
    },
    {
      id: "season-2026-spring",
      name: "2026 새내기 배움터",
      type: "event",
      status: "ended",
      year: 2026,
      startDate: "2026-02-20",
      endDate: "2026-02-22",
    },
    {
      id: "season-2025-fall",
      name: "2025 가을 대동제",
      type: "festival",
      status: "ended",
      year: 2025,
      startDate: "2025-09-11",
      endDate: "2025-09-13",
    },
    {
      id: "season-2027-fall",
      name: "2027 가을 대동제",
      type: "festival",
      status: "upcoming",
      year: 2027,
      startDate: "2027-09-09",
      endDate: "2027-09-11",
    },
  ];
}

export function buildSeedReservations(): Reservation[] {
  return [
    buildReservation({
      id: "res-1",
      boothId: "boss",
      boothName: "사장님 주점",
      representativeName: "김민준",
      phone: "010-1111-2222",
      department: "미술학과",
      headcount: 3,
      date: "2026-09-10",
      time: "19:00",
      matching: true,
      matchingGender: "male",
      participantDepartments: ["미술학과", "국문학과", "경제학과"],
      orderItems: [
        orderItem("boss", "boss-chicken", 2),
        orderItem("boss", "boss-fries", 1),
        orderItem("boss", "boss-coke", 2),
      ],
      status: "pending",
      createdAt: "2026-09-08T10:12:00+09:00",
    }),
    buildReservation({
      id: "res-2",
      boothId: "bug",
      boothName: "버그 펍",
      representativeName: "이서연",
      phone: "010-2222-3333",
      department: "컴퓨터공학과",
      headcount: 4,
      date: "2026-09-10",
      time: "20:00",
      matching: false,
      orderItems: [
        orderItem("bug", "bug-noodle", 2),
        orderItem("bug", "bug-tteok", 2),
        orderItem("bug", "bug-drink", 2),
      ],
      status: "pending",
      createdAt: "2026-09-08T11:03:00+09:00",
    }),
    buildReservation({
      id: "res-3",
      boothId: "muscle",
      boothName: "근육 주점",
      representativeName: "박도윤",
      phone: "010-3333-4444",
      department: "체육교육과",
      headcount: 2,
      date: "2026-09-11",
      time: "18:30",
      matching: true,
      matchingGender: "female",
      participantDepartments: ["체육교육과", "심리학과"],
      orderItems: [
        orderItem("muscle", "muscle-meat", 1),
        orderItem("muscle", "muscle-egg", 1),
        orderItem("muscle", "muscle-drink", 2),
      ],
      status: "pending",
      createdAt: "2026-09-08T13:40:00+09:00",
    }),
    buildReservation({
      id: "res-4",
      boothId: "er",
      boothName: "응급 주점",
      representativeName: "최지우",
      phone: "010-4444-5555",
      department: "간호학과",
      headcount: 5,
      date: "2026-09-12",
      time: "19:30",
      matching: false,
      orderItems: [
        orderItem("er", "er-soup", 2),
        orderItem("er", "er-tofu", 2),
        orderItem("er", "er-water", 4),
      ],
      status: "pending",
      createdAt: "2026-09-08T15:21:00+09:00",
    }),
    buildReservation({
      id: "res-5",
      boothId: "boss",
      boothName: "사장님 주점",
      representativeName: "정하윤",
      phone: "010-5555-6666",
      department: "법학과",
      headcount: 4,
      date: "2026-09-10",
      time: "18:30",
      matching: true,
      matchingGender: "female",
      participantDepartments: ["법학과", "화학과", "물리학과", "수학과"],
      orderItems: [
        orderItem("boss", "boss-chicken", 3),
        orderItem("boss", "boss-fries", 2),
      ],
      status: "approved",
      createdAt: "2026-09-07T09:00:00+09:00",
    }),
    buildReservation({
      id: "res-6",
      boothId: "bug",
      boothName: "버그 펍",
      representativeName: "오세훈",
      phone: "010-7777-8888",
      department: "전자공학과",
      headcount: 2,
      date: "2026-09-11",
      time: "21:00",
      matching: false,
      orderItems: [
        orderItem("bug", "bug-noodle", 1),
        orderItem("bug", "bug-tteok", 1),
        orderItem("bug", "bug-drink", 1),
      ],
      status: "rejected",
      createdAt: "2026-09-07T16:30:00+09:00",
    }),
  ];
}
