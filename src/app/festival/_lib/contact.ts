export type ContactKind = "phone" | "link" | "text";

/**
 * 문의 연락처 값의 형태를 판별.
 * - http(s)://로 시작 → 링크(오픈채팅 등) → 눌러서 이동
 * - 숫자/하이픈만 있음 → 전화번호 → 눌러서 복사
 * - 그 외 → 그냥 텍스트로 표시 (추후 다른 형식이 와도 안 깨지게)
 */
export function detectContactKind(value: string): ContactKind {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return "link";
  if (/^[0-9][0-9-]*[0-9]$/.test(v)) return "phone";
  return "text";
}
