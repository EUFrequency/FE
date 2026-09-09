import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { buildSeedSeasons } from "./mock-data";
import type { Season, SeasonStatus } from "./types";

const COLLECTION = "seasons";

function seasonsCollection() {
  return getAdminDb().collection(COLLECTION);
}

function toSeason(doc: FirebaseFirestore.QueryDocumentSnapshot): Season {
  const data = doc.data() as Omit<Season, "id">;
  return { id: doc.id, ...data };
}

/** 컬렉션이 비어 있으면(최초 1회) 기존 더미 시즌 데이터를 그대로 채워 넣음 */
async function seedIfEmpty() {
  const snap = await seasonsCollection().limit(1).get();
  if (!snap.empty) return;

  const batch = getAdminDb().batch();
  for (const season of buildSeedSeasons()) {
    const { id, ...rest } = season;
    batch.set(seasonsCollection().doc(id), rest);
  }
  await batch.commit();
}

export async function listSeasons(): Promise<Season[]> {
  await seedIfEmpty();
  const snap = await seasonsCollection().get();
  return snap.docs.map(toSeason).sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function addSeason(season: Season): Promise<void> {
  const { id, ...rest } = season;
  await seasonsCollection().doc(id).set(rest);
}

/** 시즌의 시작/종료일과 오늘 날짜를 비교해 자연스러운 상태를 계산 */
function deriveNaturalStatus(season: Pick<Season, "startDate" | "endDate">): SeasonStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (today < season.startDate) return "upcoming";
  if (today > season.endDate) return "ended";
  return "ongoing";
}

/**
 * 특정 시즌을 진행중으로 전환하고, 기존에 진행중이던 다른 시즌들은
 * 날짜 기준 자연 상태(예정/종료)로 되돌림.
 */
export async function activateSeason(id: string): Promise<void> {
  const db = getAdminDb();
  const currentlyOngoing = await seasonsCollection().where("status", "==", "ongoing").get();

  const batch = db.batch();
  currentlyOngoing.docs.forEach((doc) => {
    if (doc.id === id) return;
    const data = doc.data() as Omit<Season, "id">;
    batch.update(doc.ref, { status: deriveNaturalStatus(data) });
  });
  batch.update(seasonsCollection().doc(id), { status: "ongoing" satisfies SeasonStatus });
  await batch.commit();
}
