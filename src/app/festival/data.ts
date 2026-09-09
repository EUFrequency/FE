/**
 * 이 파일의 BOOTHS/Booth/Menu는 더 이상 /festival 페이지가 직접 쓰지 않음
 * (실제 주점 데이터는 Firestore에서 옴 - festival/page.tsx 참고).
 * 관리자 쪽 시드 데이터(admin/_lib/mock-data.ts)가 참고용 더미로만 계속 사용 중.
 * 아래 DEPARTMENTS ~ ADMIN_ACCOUNT는 지금도 예약 폼에서 그대로 쓰임.
 */
export type BoothId = "boss" | "bug" | "muscle" | "er";

export type Menu = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  emoji: string;
};

export type Booth = {
  id: BoothId;
  department: string;
  name: string;
  description: string;
  minOrder: number;
  accentColor: string;
  dotClass: string;
  menus: Menu[];
};

export const BOOTHS: Booth[] = [
  {
    id: "boss",
    department: "경영학과",
    name: "사장님 주점",
    description:
      "경영학과의 황금 안주 라인업! 사장님의 안목으로 엄선한 치킨봉과 감자튀김. 최고의 야식 조합.",
    minOrder: 15000,
    accentColor: "#f5b73a",
    dotClass: "bg-amber-400",
    menus: [
      {
        id: "boss-chicken",
        name: "치킨봉",
        description: "바삭한 치킨봉 10개 1접시",
        price: 9000,
        image:
          "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=70",
        emoji: "🍗",
      },
      {
        id: "boss-fries",
        name: "감자튀김",
        description: "고소한 감자튀김 1접시",
        price: 5000,
        image:
          "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=800&q=70",
        emoji: "🍟",
      },
      {
        id: "boss-coke",
        name: "콜라·사이다",
        description: "시원한 캔음료 1개",
        price: 2000,
        image:
          "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=70",
        emoji: "🥤",
      },
    ],
  },
  {
    id: "bug",
    department: "컴퓨터공학과",
    name: "버그 펍",
    description:
      "밤샘 코딩에 지친 개발자들을 위한 안식처. 무한 리필 스낵과 카페인이 준비되어 있습니다.",
    minOrder: 12000,
    accentColor: "#5aa9ff",
    dotClass: "bg-sky-400",
    menus: [
      {
        id: "bug-noodle",
        name: "짜파구리",
        description: "든든한 라면 1인분",
        price: 6000,
        image:
          "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=70",
        emoji: "🍜",
      },
      {
        id: "bug-tteok",
        name: "떡볶이",
        description: "매콤달콤 떡볶이 1인분",
        price: 6000,
        image:
          "https://images.unsplash.com/photo-1635363638580-c2809d049eee?auto=format&fit=crop&w=800&q=70",
        emoji: "🍢",
      },
      {
        id: "bug-drink",
        name: "에너지 드링크",
        description: "코딩 필수템",
        price: 3000,
        image:
          "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=70",
        emoji: "🥤",
      },
    ],
  },
  {
    id: "muscle",
    department: "체육교육과",
    name: "근육 주점",
    description:
      "체육교육과가 준비한 든든한 고단백 안주. 오늘 하루 열심히 놀았다면 근손실은 여기서 막으세요.",
    minOrder: 20000,
    accentColor: "#f87171",
    dotClass: "bg-red-400",
    menus: [
      {
        id: "muscle-meat",
        name: "차돌박이 구이",
        description: "든든한 차돌박이 1접시",
        price: 15000,
        image:
          "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=70",
        emoji: "🥩",
      },
      {
        id: "muscle-egg",
        name: "계란말이",
        description: "폭신폭신 계란말이 1접시",
        price: 7000,
        image:
          "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=70",
        emoji: "🍳",
      },
      {
        id: "muscle-drink",
        name: "프로틴 셰이크",
        description: "차별화된 근육 특화 음료",
        price: 4000,
        image:
          "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=70",
        emoji: "🥛",
      },
    ],
  },
  {
    id: "er",
    department: "간호학과",
    name: "응급 주점",
    description:
      "취기가 오른 당신에게 응급 처방! 해장과 위로가 필요한 순간, 간호학과가 케어해 드립니다.",
    minOrder: 10000,
    accentColor: "#4ade80",
    dotClass: "bg-emerald-400",
    menus: [
      {
        id: "er-soup",
        name: "북엇국",
        description: "해장에 딱, 시원한 북엇국 1그릇",
        price: 6000,
        image:
          "https://images.unsplash.com/photo-1526318896980-cf78c088247c?auto=format&fit=crop&w=800&q=70",
        emoji: "🍲",
      },
      {
        id: "er-tofu",
        name: "두부김치",
        description: "따끈한 두부와 잘 익은 김치",
        price: 7000,
        image:
          "https://images.unsplash.com/photo-1583224944844-5b268c057e5a?auto=format&fit=crop&w=800&q=70",
        emoji: "🥘",
      },
      {
        id: "er-water",
        name: "이온음료",
        description: "탈수 방지 필수 처방",
        price: 2500,
        image:
          "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=70",
        emoji: "💧",
      },
    ],
  },
];

export const DEPARTMENTS = [
  "경영학과",
  "컴퓨터공학과",
  "체육교육과",
  "간호학과",
  "미술학과",
  "국문학과",
  "경제학과",
  "수학과",
  "물리학과",
  "화학과",
  "생명과학과",
  "심리학과",
  "사회학과",
  "법학과",
  "건축학과",
  "기계공학과",
  "전자공학과",
];

export const BANKS = [
  "카카오뱅크",
  "토스뱅크",
  "국민은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "농협",
  "케이뱅크",
  "IBK기업은행",
  "SC제일은행",
];

export const FESTIVAL_DATES = [
  { value: "2026-09-10", label: "9월 10일 (목)" },
  { value: "2026-09-11", label: "9월 11일 (금)" },
  { value: "2026-09-12", label: "9월 12일 (토)" },
];

export const FESTIVAL_TIMES = [
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
];

export const MATCHING_FEE_PER_PERSON = 3000;

export const ADMIN_ACCOUNT = {
  bank: "카카오뱅크",
  holder: "학생처",
  number: "3333-12-3456789",
};
