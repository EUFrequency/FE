import "server-only";
import { isAdminAuthenticated } from "./auth";
import { FirebaseNotConfiguredError } from "@/lib/firebase/admin";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; notConfigured?: boolean };

/** 모든 관리자 전용 Server Action의 진입점에서 호출 - 세션 쿠키를 다시 검증 */
export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    throw new Error("관리자 인증이 필요합니다.");
  }
}

/** Server Action 본문을 감싸서 성공/실패를 일관된 형태로 반환 */
export function toActionResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  return fn()
    .then((data) => ({ ok: true as const, data }))
    .catch((e) => {
      if (e instanceof FirebaseNotConfiguredError) {
        return { ok: false as const, error: e.message, notConfigured: true };
      }
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.",
      };
    });
}
