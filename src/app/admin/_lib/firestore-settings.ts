import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import type { ReservationSettingMode, ReservationSettings } from "./types";

const COLLECTION = "settings";
const DOC = "reservation";

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
