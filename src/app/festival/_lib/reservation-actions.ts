"use server";

import { getBoothLight } from "@/app/admin/_lib/firestore-booths";
import { getDepartments } from "@/app/admin/_lib/firestore-settings";
import {
  createReservation,
  hasReservationForPhone,
  normalizePhone,
  ReservationBlockedError,
} from "@/app/admin/_lib/firestore-reservations";
import { formatTimeSlot, resolveSlot } from "@/app/admin/_lib/slots";
import { FirebaseNotConfiguredError } from "@/lib/firebase/admin";
import type {
  AdminBooth,
  MatchingGender,
  Reservation,
  ReservationOrderItem,
} from "@/app/admin/_lib/types";
import { getFestivalData } from "./active-season";
import { seasonDateOptions } from "./season-dates";
import { BANKS, MATCHING_FEE_PER_PERSON } from "../data";

export type SubmitReservationInput = Omit<
  Reservation,
  "id" | "status" | "createdAt" | "assignedAlias" | "tableCapacity"
>;

export type SubmitReservationResult =
  | { ok: true; zone: "normal" | "overbook" }
  | { ok: false; error: string };

const MAX_TEXT_LEN = 40;

function isNonEmptyText(v: unknown, maxLen = MAX_TEXT_LEN): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.trim().length <= maxLen;
}

/**
 * 클라이언트가 보낸 주문 내역(메뉴명/수량)은 신뢰하되, 가격(unitPrice)과 합계(menuAmount)는
 * 절대 신뢰하지 않고 주점의 현재 메뉴 가격으로 서버에서 다시 계산한다.
 * (클라이언트가 금액을 조작해서 보내는 걸 막기 위함 - 입금 확인은 결국 이 금액 기준으로 함)
 * 메뉴가 사라졌거나(이름 불일치) 수량이 이상하면 null.
 */
function recomputeOrder(
  booth: AdminBooth,
  items: ReservationOrderItem[],
): { orderItems: ReservationOrderItem[]; menuAmount: number } | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const menuByName = new Map(booth.menus.map((m) => [m.name, m]));
  const orderItems: ReservationOrderItem[] = [];
  let menuAmount = 0;

  for (const item of items) {
    if (!item || typeof item.menuName !== "string") return null;
    const menu = menuByName.get(item.menuName);
    if (!menu) return null;
    const quantity = Math.trunc(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 999) return null;
    menuAmount += menu.price * quantity;
    orderItems.push({ menuName: menu.name, unitPrice: menu.price, quantity });
  }
  return { orderItems, menuAmount };
}

/** 공개 예약 폼에서 호출 - 관리자 인증이 필요 없음. 클라이언트 값은 하나도 그대로 믿지 않음 */
export async function submitReservationAction(
  input: SubmitReservationInput,
): Promise<SubmitReservationResult> {
  // 1) 형식 검증 - 여기서 걸러지는 건 전부 "버그가 아니라 있을 수 없는 요청"
  if (!isNonEmptyText(input.boothId, 200)) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  if (!isNonEmptyText(input.representativeName)) {
    return { ok: false, error: "대표 예약자 이름을 입력해주세요." };
  }
  const phone = normalizePhone(input.phone ?? "");
  if (phone.length < 9 || phone.length > 11) {
    return { ok: false, error: "전화번호 형식이 올바르지 않습니다." };
  }
  const departments = await getDepartments();
  if (!departments.includes(input.department)) {
    return { ok: false, error: "학과를 다시 선택해주세요." };
  }
  if (!BANKS.includes(input.bank)) {
    return { ok: false, error: "은행을 다시 선택해주세요." };
  }
  if (!isNonEmptyText(input.accountNumber)) {
    return { ok: false, error: "계좌번호를 입력해주세요." };
  }
  if (!isNonEmptyText(input.date, 10) || !isNonEmptyText(input.time, 5)) {
    return { ok: false, error: "방문 날짜/시간을 선택해주세요." };
  }
  if (!Number.isInteger(input.headcount) || input.headcount < 1 || input.headcount > 20) {
    return { ok: false, error: "인원수가 올바르지 않습니다." };
  }
  if (typeof input.matching !== "boolean") {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  if (input.matching) {
    const gender = input.matchingGender as MatchingGender | undefined;
    if (gender !== "male" && gender !== "female") {
      return { ok: false, error: "과팅 팀 성별을 선택해주세요." };
    }
    const depts = input.participantDepartments;
    if (
      !Array.isArray(depts) ||
      depts.length !== input.headcount ||
      depts.some((d) => !isNonEmptyText(d) || !departments.includes(d))
    ) {
      return { ok: false, error: "과팅 참석자 학과 정보가 올바르지 않습니다." };
    }
  }

  try {
    // 2) 예약 접수 기간인지 서버에서도 확인 (클라이언트 우회 방지)
    // /festival 페이지가 보여주는 것과 정확히 같은 기준(getFestivalData)으로 판단해야
    // "화면엔 예약 가능하다고 떴는데 제출은 막힘/다른 시즌으로 접수됨" 같은 불일치가 안 생김.
    const { activeSeason, generalOpen, matchingOpen } = await getFestivalData();
    if (!activeSeason || !generalOpen) {
      return { ok: false, error: "지금은 예약 접수 기간이 아닙니다." };
    }
    if (input.matching && !matchingOpen) {
      return { ok: false, error: "지금은 과팅 예약 접수 기간이 아닙니다." };
    }
    // 방문 날짜가 실제 축제 기간 중 하루인지 (달력에 없는 날짜를 직접 조작해서 보내는 것 방지)
    if (!seasonDateOptions(activeSeason).some((d) => d.value === input.date)) {
      return { ok: false, error: "축제 기간 중의 날짜를 선택해주세요." };
    }

    // 3) 전화번호 중복 (트랜잭션에서도 재확인하지만 여기서 먼저 친절하게)
    if (await hasReservationForPhone(phone)) {
      return {
        ok: false,
        error: "이미 예약하신 전화번호입니다. 한 번호로는 한 건만 예약할 수 있습니다.",
      };
    }

    // 4) 주점 확인 + 정원 슬롯 계산 (매칭이면 인원=테이블 정원 정확히 일치, 일반이면 수용 가능한
    //    가장 작은 테이블 - 8인처럼 등록 안 된 테이블 크기는 여기서 확실히 거부됨)
    const booth = await getBoothLight(input.boothId);
    if (!booth) return { ok: false, error: "주점 정보를 찾을 수 없습니다." };
    if (!booth.timeSlots.some((s) => formatTimeSlot(s) === input.time)) {
      return { ok: false, error: "선택할 수 없는 시간입니다." };
    }
    const slot = resolveSlot(booth.tables, {
      matching: input.matching,
      gender: input.matching ? (input.matchingGender as MatchingGender) : null,
      headcount: input.headcount,
    });
    if (!slot.ok) return { ok: false, error: slot.reason };

    // 5) 주문 금액은 클라이언트를 안 믿고 주점의 현재 메뉴 가격으로 다시 계산
    const recomputed = recomputeOrder(booth, input.orderItems);
    if (!recomputed) {
      return {
        ok: false,
        error: "메뉴 정보가 최신이 아닙니다. 새로고침 후 다시 시도해주세요.",
      };
    }
    if (recomputed.menuAmount < booth.minOrder) {
      return {
        ok: false,
        error: `최소 주문금액은 ${booth.minOrder.toLocaleString()}원입니다.`,
      };
    }
    const matchingFee = input.matching ? input.headcount * MATCHING_FEE_PER_PERSON : 0;
    const totalAmount = recomputed.menuAmount + matchingFee;

    const { zone } = await createReservation(
      {
        ...input,
        phone,
        orderItems: recomputed.orderItems,
        menuAmount: recomputed.menuAmount,
        matchingFee,
        totalAmount,
      },
      {
        slotKey: slot.slotKey,
        capacity: slot.capacity,
        tableCount: slot.tableCount,
        limit: slot.limit,
      },
    );
    return { ok: true, zone };
  } catch (e) {
    if (e instanceof ReservationBlockedError) {
      return { ok: false, error: e.message };
    }
    const message =
      e instanceof FirebaseNotConfiguredError
        ? "예약 시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요."
        : e instanceof Error
          ? e.message
          : "예약 접수 중 오류가 발생했습니다.";
    return { ok: false, error: message };
  }
}
