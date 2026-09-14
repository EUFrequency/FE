"use server";

import { getBoothLight } from "@/app/admin/_lib/firestore-booths";
import { getSlotCounts } from "@/app/admin/_lib/firestore-inventory";
import { getOverbookLimit } from "@/app/admin/_lib/firestore-settings";
import { resolveGeneralSlot, resolveMatchingSlot } from "@/app/admin/_lib/slots";
import { FirebaseNotConfiguredError } from "@/lib/firebase/admin";
import type { MatchingGender } from "@/app/admin/_lib/types";

export type AvailabilityInput = {
  matching: boolean;
  gender: MatchingGender | null;
  headcount: number;
};

export type AvailabilityResult =
  | {
      ok: true;
      /** available = 정원 내, overbook = 오버부킹 구간(경고 후 진행 가능) */
      status: "available" | "overbook";
      remaining: number;
      capacity: number;
    }
  | { ok: false; status: "full" | "invalid" | "error"; reason: string };

/**
 * 예약 모달에서 "다음 단계"로 넘어가기 전 정원을 확인.
 * 최종 제출 때 트랜잭션으로 다시 검증하므로 여기선 캐시 없이 가볍게 조회만.
 */
export async function checkAvailabilityAction(
  boothId: string,
  input: AvailabilityInput,
): Promise<AvailabilityResult> {
  try {
    const booth = await getBoothLight(boothId);
    if (!booth) {
      return { ok: false, status: "invalid", reason: "주점을 찾을 수 없습니다." };
    }

    const counts = await getSlotCounts(boothId);

    if (input.matching) {
      const overbookLimit = await getOverbookLimit();
      const slot = resolveMatchingSlot(booth.tables, input, overbookLimit);
      if (!slot.ok) {
        return { ok: false, status: "invalid", reason: slot.reason };
      }
      const active = counts[slot.slotKey] ?? 0;
      if (active >= slot.limit) {
        return { ok: false, status: "full", reason: "해당 인원의 예약이 마감되었습니다." };
      }
      return {
        ok: true,
        status: active >= slot.tableCount ? "overbook" : "available",
        remaining: slot.limit - active,
        capacity: slot.capacity,
      };
    }

    // 일반 예약: 인원수 구간(밴드)에 맞는 테이블 정원 하나가 있는지, 자리가 남아있는지만
    // 미리 확인 (최종 배정은 제출 시 트랜잭션에서 - slots.ts의 resolveGeneralSlot)
    const resolved = resolveGeneralSlot(booth.tables, input.headcount);
    if (!resolved.ok) {
      return { ok: false, status: "full", reason: resolved.reason };
    }
    const active = counts[resolved.slotKey] ?? 0;
    if (active >= resolved.tableCount) {
      return {
        ok: false,
        status: "full",
        reason: "잔여 테이블이 부족하여 예약이 불가능합니다. 다른 시간대를 이용해주세요.",
      };
    }
    return {
      ok: true,
      status: "available",
      remaining: resolved.tableCount - active,
      capacity: resolved.capacity,
    };
  } catch (e) {
    return {
      ok: false,
      status: "error",
      reason:
        e instanceof FirebaseNotConfiguredError
          ? "예약 시스템이 아직 준비되지 않았습니다."
          : "정원 확인 중 오류가 발생했습니다. 다시 시도해주세요.",
    };
  }
}
