import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Account } from "./types";

const COLLECTION = "accounts";
const BOOTHS_COLLECTION = "booths";

type AccountDocData = Omit<Account, "id">;

function accountsCollection() {
  return getAdminDb().collection(COLLECTION);
}

function toDocData(account: Account): AccountDocData {
  return {
    bank: account.bank,
    accountNumber: account.accountNumber,
    holderName: account.holderName,
    isDefault: account.isDefault,
    createdAt: account.createdAt,
  };
}

function toAccount(id: string, data: AccountDocData): Account {
  return { id, ...data };
}

export async function listAccounts(): Promise<Account[]> {
  const snap = await accountsCollection().orderBy("createdAt", "asc").get();
  return snap.docs.map((doc) => toAccount(doc.id, doc.data() as AccountDocData));
}

export async function getAccount(id: string): Promise<Account | null> {
  const doc = await accountsCollection().doc(id).get();
  if (!doc.exists) return null;
  return toAccount(doc.id, doc.data() as AccountDocData);
}

/** 시스템 대표 계좌 (isDefault === true인 것 하나). 없으면 null */
export async function getDefaultAccount(): Promise<Account | null> {
  const snap = await accountsCollection().where("isDefault", "==", true).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return toAccount(doc.id, doc.data() as AccountDocData);
}

/**
 * 생성/수정 공용 - account.id를 문서 id로 그대로 사용 (upsert).
 * isDefault를 true로 저장하면 다른 계좌들의 대표 지정은 자동으로 해제됨.
 */
export async function saveAccount(account: Account): Promise<void> {
  if (account.isDefault) {
    await setDefaultAccount(account.id, account);
    return;
  }
  await accountsCollection().doc(account.id).set(toDocData(account));
}

/**
 * 특정 계좌를 대표 계좌로 지정하고 나머지는 전부 해제 (시즌 "활성화"와 같은 패턴).
 * newAccountData가 있으면 그 내용으로 새로 생성/덮어쓰기까지 같이 함 (신규 등록 시 바로 대표로 저장하는 경우).
 */
export async function setDefaultAccount(id: string, newAccountData?: Account): Promise<void> {
  const db = getAdminDb();
  const currentlyDefault = await accountsCollection().where("isDefault", "==", true).get();

  const batch = db.batch();
  currentlyDefault.docs.forEach((doc) => {
    if (doc.id === id) return;
    batch.update(doc.ref, { isDefault: false });
  });

  if (newAccountData) {
    batch.set(accountsCollection().doc(id), toDocData({ ...newAccountData, isDefault: true }));
  } else {
    const target = await accountsCollection().doc(id).get();
    if (!target.exists) throw new Error("대상 계좌를 찾을 수 없습니다.");
    batch.update(target.ref, { isDefault: true });
  }

  await batch.commit();
}

/**
 * 계좌 삭제. 대표 계좌는 다른 계좌를 먼저 대표로 지정한 뒤에만 삭제 가능하고,
 * 이 계좌를 쓰던 주점이 있으면 accountId를 비워서(=대표 계좌를 자동으로 쓰게) 정리함.
 */
export async function deleteAccount(id: string): Promise<void> {
  const db = getAdminDb();
  const doc = await accountsCollection().doc(id).get();
  if (!doc.exists) return;

  const data = doc.data() as AccountDocData;
  if (data.isDefault) {
    throw new Error(
      "대표 계좌는 바로 삭제할 수 없습니다. 다른 계좌를 먼저 대표 계좌로 지정해주세요.",
    );
  }

  const boothsUsingThis = await db
    .collection(BOOTHS_COLLECTION)
    .where("accountId", "==", id)
    .get();

  const batch = db.batch();
  batch.delete(accountsCollection().doc(id));
  boothsUsingThis.docs.forEach((boothDoc) => {
    batch.update(boothDoc.ref, { accountId: null });
  });
  await batch.commit();
}
