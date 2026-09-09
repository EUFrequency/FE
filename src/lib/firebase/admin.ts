import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * 서버 전용 Firebase Admin SDK 초기화.
 *
 * 브라우저에서는 절대 import하면 안 됨 — 서비스 계정 비밀키를 다룸.
 * (Server Action / Server Component에서만 사용)
 */
function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawPrivateKey) {
    throw new FirebaseNotConfiguredError();
  }

  // .env 파일에 저장된 개행 문자(\n)는 리터럴 문자열이므로 실제 개행으로 치환
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Firebase 서비스 계정 환경변수가 설정되지 않았습니다. " +
        ".env.local의 FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY를 확인해주세요.",
    );
    this.name = "FirebaseNotConfiguredError";
  }
}

let cachedDb: Firestore | null = null;

/** Firestore 인스턴스를 반환. 환경변수가 없으면 FirebaseNotConfiguredError를 던짐 */
export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getAdminApp());
  return cachedDb;
}
