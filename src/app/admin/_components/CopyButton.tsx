"use client";

import { useState } from "react";
import { Button } from "./ui";

/** 전화번호/계좌번호처럼 짧은 값을 클립보드로 복사하는 버튼 */
export function CopyButton({ text, label = "복사" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 접근이 막힌 환경이면 조용히 무시 (텍스트는 이미 화면에 보임)
    }
  }

  return (
    <Button variant="secondary" onClick={copy}>
      {copied ? "복사됨" : label}
    </Button>
  );
}
