import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { DEPARTMENTS as DEFAULT_DEPARTMENTS } from "@/app/festival/data";

const COLLECTION = "settings";
const CONTACT_DOC = "contact";
const DEPARTMENTS_DOC = "departments";

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

/**
 * 예약 폼(대표 예약자·과팅 참가자)에서 고를 수 있는 학과 목록.
 * 문서가 아직 없으면(관리자가 한 번도 안 바꿨으면) festival/data.ts의 기본 목록을 그대로 씀.
 */
export async function getDepartments(): Promise<string[]> {
  const snap = await getAdminDb().collection(COLLECTION).doc(DEPARTMENTS_DOC).get();
  const list = snap.data()?.list;
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_DEPARTMENTS;
  return list.filter((d): d is string => typeof d === "string" && d.trim().length > 0);
}

export async function setDepartments(list: string[]): Promise<void> {
  const cleaned = Array.from(new Set(list.map((d) => d.trim()).filter(Boolean)));
  await getAdminDb()
    .collection(COLLECTION)
    .doc(DEPARTMENTS_DOC)
    .set({ list: cleaned, updatedAt: new Date().toISOString() });
}
