"use client";

import { useState } from "react";
import { detectContactKind, instagramProfileUrl } from "../_lib/contact";

/**
 * 문의 연락처 한 줄 표시.
 * 전화번호 형식이면 탭해서 복사, 링크 형식이면 눌러서 이동, 그 외엔 그냥 텍스트.
 */
export function ContactDisplay({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const kind = detectContactKind(value);

  if (kind === "link") {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold underline underline-offset-2"
      >
        문의 : 오픈채팅으로 문의하기 ↗
      </a>
    );
  }

  if (kind === "instagram") {
    return (
      <a
        href={instagramProfileUrl(value)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold underline underline-offset-2"
      >
        문의 : 인스타그램으로 문의하기 ↗
      </a>
    );
  }

  if (kind === "phone") {
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // 클립보드 접근이 막힌 환경이면 조용히 무시 (숫자는 이미 화면에 보임)
      }
    };
    return (
      <button type="button" onClick={copy} className="font-semibold">
        문의 : {value}
        <span className="ml-1 text-[11px] font-normal opacity-70">
          {copied ? "(복사됨)" : "(탭하여 복사)"}
        </span>
      </button>
    );
  }

  return <span className="font-semibold">문의 : {value}</span>;
}
