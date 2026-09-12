export type ContactKind = "phone" | "link" | "instagram" | "text";

/**
 * 문의 연락처 값의 형태를 판별.
 * - http(s)://로 시작 → 링크(오픈채팅 등) → 눌러서 이동
 * - @로 시작 → 인스타그램 아이디 → 프로필로 이동
 * - 숫자/하이픈만 있음 → 전화번호 → 눌러서 복사
 * - 그 외 → 그냥 텍스트로 표시 (추후 다른 형식이 와도 안 깨지게)
 */
export function detectContactKind(value: string): ContactKind {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return "link";
  if (/^@/.test(v)) return "instagram";
  if (/^[0-9][0-9-]*[0-9]$/.test(v)) return "phone";
  return "text";
}

/** "@아이디" -> 인스타그램 프로필 주소. 맨 앞 @만 제거하고 나머지는 그대로 씀 */
export function instagramProfileUrl(value: string): string {
  return `https://instagram.com/${value.trim().replace(/^@/, "")}`;
}
