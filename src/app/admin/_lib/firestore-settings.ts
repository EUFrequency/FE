import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import type { ReservationSettingMode, ReservationSettings } from "./types";

const COLLECTION = "settings";
const DOC = "reservation";
const CONTACT_DOC = "contact";

const MODES: ReservationSettingMode[] = ["auto", "open", "closed"];

function normalize(v: unknown): ReservationSettingMode {
  return MODES.includes(v as ReservationSettingMode)
    ? (v as ReservationSettingMode)
    : "auto";
}

function settingsRef() {
  return getAdminDb().collection(COLLECTION).doc(DOC);
}

export async function getReservationSettings(): Promise<ReservationSettings> {
  const snap = await settingsRef().get();
  const data = snap.data() ?? {};
  return {
    general: normalize(data.general),
    matching: normalize(data.matching),
  };
}

export async function setReservationSettings(
  settings: ReservationSettings,
): Promise<void> {
  await settingsRef().set(
    {
      general: normalize(settings.general),
      matching: normalize(settings.matching),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

/**
 * 대표 문의 연락처 - 전화번호 또는 오픈채팅 등 링크 하나만 등록(단일 문서).
 * /festival/notice 안내 페이지 하단에 공개적으로 노출됨.
 */
export async function getContactInfo(): Promise<string | null> {
  const snap = await getAdminDb().collection(COLLECTION).doc(CONTACT_DOC).get();
  const value = snap.data()?.value;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function setContactInfo(value: string): Promise<void> {
  const trimmed = value.trim();
  const ref = getAdminDb().collection(COLLECTION).doc(CONTACT_DOC);
  if (!trimmed) {
    await ref.delete();
    return;
  }
  await ref.set({ value: trimmed, updatedAt: new Date().toISOString() });
}
