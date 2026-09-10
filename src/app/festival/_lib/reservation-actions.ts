"use server";

import { createReservation } from "@/app/admin/_lib/firestore-reservations";
import { FirebaseNotConfiguredError } from "@/lib/firebase/admin";
import type { Reservation } from "@/app/admin/_lib/types";

export type SubmitReservationInput = Omit<
  Reservation,
  "id" | "status" | "createdAt" | "orderNumber" | "assignedAlias"
>;

export type SubmitReservationResult =
  | { ok: true; orderNumber: number }
  | { ok: false; error: string };

/** 공개 예약 폼에서 호출 - 관리자 인증이 필요 없음 */
export async function submitReservationAction(
  input: SubmitReservationInput,
): Promise<SubmitReservationResult> {
  // 클라이언트 검증을 믿지 않고 서버에서도 최소한은 다시 확인
  if (
    !input.boothId ||
    !input.representativeName.trim() ||
    !input.phone.trim() ||
    !input.department.trim() ||
    !input.bank.trim() ||
    !input.accountNumber.trim() ||
    !input.date ||
    !input.time ||
    input.headcount < 1
  ) {
    return { ok: false, error: "필수 정보가 누락되었습니다." };
  }
  if (input.menuAmount <= 0) {
    return { ok: false, error: "메뉴를 선택해주세요." };
  }

  try {
    const { orderNumber } = await createReservation(input);
    return { ok: true, orderNumber };
  } catch (e) {
    const message =
      e instanceof FirebaseNotConfiguredError
        ? "예약 시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요."
        : e instanceof Error
          ? e.message
          : "예약 접수 중 오류가 발생했습니다.";
    return { ok: false, error: message };
  }
}
