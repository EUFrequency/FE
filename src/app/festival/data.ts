/**
 * 예약 폼에서 쓰는 정적 참조 목록. 은행 목록이 바뀌면 여기만 고치면 됨.
 * (주점 데이터는 Firestore에서 오고, 축제 날짜는 활성 시즌 기간에서 계산됨 -
 *  festival/page.tsx, festival/_lib/season-dates.ts 참고)
 *
 * DEPARTMENTS는 관리자 페이지(학과 관리)에서 바꿀 수 있는 기본값/시드 값일 뿐 -
 * 실제 예약 폼은 firestore-settings.ts의 getDepartments()가 돌려주는 값을 씀
 * (admin/_lib/firestore-settings.ts 참고).
 */
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
