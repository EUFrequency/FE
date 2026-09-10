"use server";

import { getBoothLight } from "@/app/admin/_lib/firestore-booths";
import {
  createReservation,
  hasReservationForPhone,
  ReservationBlockedError,
} from "@/app/admin/_lib/firestore-reservations";
import {
  isGeneralReservationOpen,
  isMatchingReservationOpen,
  listSeasons,
} from "@/app/admin/_lib/firestore-seasons";
import { getReservationSettings } from "@/app/admin/_lib/firestore-settings";
import { resolveSlot } from "@/app/admin/_lib/slots";
import { FirebaseNotConfiguredError } from "@/lib/firebase/admin";
import type { Reservation } from "@/app/admin/_lib/types";

export type SubmitReservationInput = Omit<
  Reservation,
  "id" | "status" | "createdAt" | "assignedAlias" | "tableCapacity"
>;

export type SubmitReservationResult =
  | { ok: true; zone: "normal" | "overbook" }
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
  if (input.matching && !input.matchingGender) {
    return { ok: false, error: "과팅 팀 성별을 선택해주세요." };
  }

  try {
    // 1) 예약 접수 기간인지 서버에서도 확인 (클라이언트 우회 방지)
    const [seasons, settings] = await Promise.all([
      listSeasons(),
      getReservationSettings(),
    ]);
    const festival = seasons.find(
      (s) =>
        s.type === "festival" &&
        s.status !== "ended" &&
        isGeneralReservationOpen(s, settings.general),
    );
    if (!festival) {
      return { ok: false, error: "지금은 예약 접수 기간이 아닙니다." };
    }
    if (input.matching && !isMatchingReservationOpen(festival, settings)) {
      return { ok: false, error: "지금은 과팅 예약 접수 기간이 아닙니다." };
    }

    // 2) 전화번호 중복 (트랜잭션에서도 재확인하지만 여기서 먼저 친절하게)
    if (await hasReservationForPhone(input.phone)) {
      return {
        ok: false,
        error: "이미 예약하신 전화번호입니다. 한 번호로는 한 건만 예약할 수 있습니다.",
      };
    }

    // 3) 정원 슬롯 계산
    const booth = await getBoothLight(input.boothId);
    if (!booth) return { ok: false, error: "주점 정보를 찾을 수 없습니다." };
    const slot = resolveSlot(booth.tables, {
      matching: input.matching,
      gender: input.matchingGender ?? null,
      headcount: input.headcount,
    });
    if (!slot.ok) return { ok: false, error: slot.reason };

    const { zone } = await createReservation(input, {
      slotKey: slot.slotKey,
      capacity: slot.capacity,
      tableCount: slot.tableCount,
      limit: slot.limit,
    });
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
