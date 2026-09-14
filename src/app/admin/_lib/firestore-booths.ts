import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { queueRemoveBoothFromLayout } from "./firestore-layouts";
import { deleteBoothInventory } from "./firestore-inventory";
import { MAX_GENERAL_HEADCOUNT, type AdminBooth, type MenuItem, type MinOrderRule, type TableConfig, type TimeSlot } from "./types";

const BOOTHS_COLLECTION = "booths";
const IMAGES_SUBCOLLECTION = "images";
const ALIASES_COLLECTION = "boothAliases";

type ImageDoc = {
  kind: "description" | "menu";
  /** kind === "menu"일 때만 값이 있음 */
  menuId: string | null;
  dataUrl: string;
  position: number;
};

type BoothDocData = {
  department: string;
  name: string;
  ownerName: string;
  ownerPhone: string | null;
  descriptionText: string;
  tags?: string[];
  minOrderRules?: MinOrderRule[];
  /** @deprecated minOrderRules 도입 전 문서 호환용 - 고정 금액 하나였음 */
  minOrder?: number;
  tables: AdminBooth["tables"];
  timeSlots?: TimeSlot[];
  menus: Omit<MenuItem, "image">[];
  accountId: string | null;
  createdAt: string;
  updatedAt: string;
};

function boothsCollection() {
  return getAdminDb().collection(BOOTHS_COLLECTION);
}

/** forMatching이 없던 시절 테이블 문서 호환: 없으면 일반 테이블로 취급 */
function normalizeTables(tables: TableConfig[] | undefined): TableConfig[] {
  return (tables ?? []).map((t) => ({ ...t, forMatching: t.forMatching ?? false }));
}

/** timeSlots가 없던 시절 문서 호환: 없으면 빈 배열 (관리자가 새로 설정해야 함) */
function normalizeTimeSlots(slots: TimeSlot[] | undefined): TimeSlot[] {
  return (slots ?? []).filter((s) => s.label && s.startTime && s.endTime);
}

/** minOrderRules가 없던 시절(고정 금액 minOrder 하나) 문서 호환: 인원 제한 없는 규칙 하나로 변환 */
function normalizeMinOrderRules(
  rules: MinOrderRule[] | undefined,
  legacyMinOrder: number | undefined,
): MinOrderRule[] {
  if (Array.isArray(rules) && rules.length > 0) return rules;
  if (typeof legacyMinOrder === "number") {
    return [{ maxHeadcount: MAX_GENERAL_HEADCOUNT, minAmount: legacyMinOrder }];
  }
  return [];
}

function toLightBooth(id: string, data: BoothDocData): AdminBooth {
  return {
    id,
    department: data.department ?? "",
    name: data.name,
    ownerName: data.ownerName,
    ownerPhone: data.ownerPhone ?? null,
    descriptionText: data.descriptionText,
    descriptionImages: [],
    tags: data.tags ?? [],
    menus: (data.menus ?? []).map((m) => ({ ...m, image: "" })),
    minOrderRules: normalizeMinOrderRules(data.minOrderRules, data.minOrder),
    tables: normalizeTables(data.tables),
    timeSlots: normalizeTimeSlots(data.timeSlots),
    accountId: data.accountId ?? null,
    createdAt: data.createdAt,
  };
}

/** 문서 하나 + 그 images 서브컬렉션을 읽어 이미지까지 포함한 완전한 주점으로 조립 */
async function hydrateBoothWithImages(
  doc: FirebaseFirestore.DocumentSnapshot,
): Promise<AdminBooth | null> {
  if (!doc.exists) return null;
  const data = doc.data() as BoothDocData;
  const imagesSnap = await doc.ref
    .collection(IMAGES_SUBCOLLECTION)
    .orderBy("position", "asc")
    .get();
  const images = imagesSnap.docs.map((d) => d.data() as ImageDoc);

  const descriptionImages = images
    .filter((img) => img.kind === "description")
    .map((img) => img.dataUrl);

  const menuImageByMenuId = new Map(
    images
      .filter((img) => img.kind === "menu" && img.menuId)
      .map((img) => [img.menuId as string, img.dataUrl]),
  );

  return {
    id: doc.id,
    department: data.department ?? "",
    name: data.name,
    ownerName: data.ownerName,
    ownerPhone: data.ownerPhone ?? null,
    descriptionText: data.descriptionText,
    descriptionImages,
    tags: data.tags ?? [],
    menus: (data.menus ?? []).map((m) => ({
      ...m,
      image: menuImageByMenuId.get(m.id) ?? "",
    })),
    minOrderRules: normalizeMinOrderRules(data.minOrderRules, data.minOrder),
    tables: normalizeTables(data.tables),
    timeSlots: normalizeTimeSlots(data.timeSlots),
    accountId: data.accountId ?? null,
    createdAt: data.createdAt,
  };
}

/**
 * 관리자 목록 화면용 - 이미지 없이 가벼운 필드만 가져옴 (읽기 비용 절약).
 * descriptionImages는 빈 배열, 메뉴의 image는 빈 문자열로 채워짐.
 */
export async function listBoothsLight(): Promise<AdminBooth[]> {
  const snap = await boothsCollection().orderBy("createdAt", "asc").get();
  return snap.docs.map((doc) => toLightBooth(doc.id, doc.data() as BoothDocData));
}

/** 수정 모달을 열 때 등, 이미지까지 포함한 완전한 주점 데이터가 필요할 때 사용 (관리자 전용) */
export async function getBoothWithImages(id: string): Promise<AdminBooth | null> {
  const doc = await boothsCollection().doc(id).get();
  return hydrateBoothWithImages(doc);
}

/** 이미지 없이 주점 본문서 하나만 읽음 - 예약 정원 확인처럼 테이블 구성만 필요할 때 */
export async function getBoothLight(id: string): Promise<AdminBooth | null> {
  const doc = await boothsCollection().doc(id).get();
  if (!doc.exists) return null;
  return toLightBooth(doc.id, doc.data() as BoothDocData);
}

/** 생성/수정 공용 - booth.id를 문서 id로 그대로 사용 (upsert) */
export async function saveBooth(booth: AdminBooth): Promise<void> {
  const db = getAdminDb();
  const ref = boothsCollection().doc(booth.id);
  const now = new Date().toISOString();

  const menusMeta: Omit<MenuItem, "image">[] = booth.menus.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    price: m.price,
    perPersonRequired: m.perPersonRequired ?? false,
    excludeFromMinOrder: m.excludeFromMinOrder ?? false,
  }));

  const docData: BoothDocData = {
    department: booth.department,
    name: booth.name,
    ownerName: booth.ownerName,
    ownerPhone: booth.ownerPhone,
    descriptionText: booth.descriptionText,
    tags: booth.tags,
    minOrderRules: booth.minOrderRules,
    tables: booth.tables,
    timeSlots: booth.timeSlots,
    menus: menusMeta,
    accountId: booth.accountId,
    createdAt: booth.createdAt,
    updatedAt: now,
  };

  const imagesRef = ref.collection(IMAGES_SUBCOLLECTION);
  const existingImages = await imagesRef.get();

  const batch = db.batch();
  batch.set(ref, docData);
  existingImages.docs.forEach((d) => batch.delete(d.ref));

  booth.descriptionImages.forEach((dataUrl, i) => {
    const imageDoc: ImageDoc = { kind: "description", menuId: null, dataUrl, position: i };
    batch.set(imagesRef.doc(`desc-${i}`), imageDoc);
  });

  booth.menus.forEach((menu, i) => {
    if (!menu.image) return;
    const imageDoc: ImageDoc = { kind: "menu", menuId: menu.id, dataUrl: menu.image, position: i };
    batch.set(imagesRef.doc(`menu-${menu.id}`), imageDoc);
  });

  await batch.commit();
}

/** 주점 삭제 + 그 이미지 서브컬렉션 + 모든 시즌 배치도에 남아있는 참조까지 함께 정리 */
export async function deleteBooth(id: string): Promise<void> {
  const db = getAdminDb();
  const ref = boothsCollection().doc(id);
  const imagesRef = ref.collection(IMAGES_SUBCOLLECTION);
  const existingImages = await imagesRef.get();

  const batch = db.batch();
  existingImages.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(ref);
  batch.delete(db.collection(ALIASES_COLLECTION).doc(id));
  await queueRemoveBoothFromLayout(batch, id);
  await batch.commit();

  // 정원 슬롯 문서(서브컬렉션)는 배치에 못 넣어서 따로 정리
  await deleteBoothInventory(id);
}
