import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "frequency_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8시간

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

function computeSessionToken() {
  const secret = getSessionSecret();
  return createHmac("sha256", secret).update("frequency-admin-session").digest("hex");
}

/** 입력된 비밀번호가 .env의 ADMIN_PASSWORD와 일치하는지 검사 */
export function verifyAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;

  const input = Buffer.from(password);
  const target = Buffer.from(expected);
  if (input.length !== target.length) return false;
  return timingSafeEqual(input, target);
}

/** 현재 요청에 유효한 관리자 세션 쿠키가 있는지 확인 */
export async function isAdminAuthenticated() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;

  const expected = computeSessionToken();
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** 로그인 성공 시 세션 쿠키 발급 */
export async function createAdminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, computeSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

/** 로그아웃 시 세션 쿠키 제거 */
export async function destroyAdminSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
