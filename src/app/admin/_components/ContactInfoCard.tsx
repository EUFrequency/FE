"use client";

import { useEffect, useState } from "react";
import {
  getContactInfoAction,
  setContactInfoAction,
} from "../_lib/settings-actions";
import { detectContactKind } from "@/app/festival/_lib/contact";
import { Button, Card, Input, SectionTitle } from "./ui";

/** 대시보드에서 관리하는 대표 문의 연락처 (전화번호 또는 오픈채팅 링크 등, 하나만 등록) */
export function ContactInfoCard() {
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    let alive = true;
    getContactInfoAction().then((res) => {
      if (!alive) return;
      if (res.ok) {
        setSaved(res.data);
        setDraft(res.data ?? "");
      } else {
        setLoadError(res.error);
      }
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const dirty = draft.trim() !== (saved ?? "");
  const kind = draft.trim() ? detectContactKind(draft.trim()) : null;

  async function save() {
    setSaveError(null);
    setSavedMsg(false);
    setSaving(true);
    try {
      const res = await setContactInfoAction(draft);
      if (!res.ok) throw new Error(res.error);
      const trimmed = draft.trim();
      setSaved(trimmed || null);
      setDraft(trimmed);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 1500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <SectionTitle hint="예약 안내 페이지 하단에 공개로 노출됨">
        대표 문의 연락처
      </SectionTitle>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        전화번호(예: 010-1234-5678)를 넣으면 방문자가 탭해서 복사할 수 있고, 오픈채팅 등
        http(s):// 링크를 넣으면 눌러서 바로 이동하는 버튼으로, @로 시작하는 인스타그램
        아이디(예: @frequency)를 넣으면 프로필로 이동하는 버튼으로 표시돼요. 하나만 등록할
        수 있습니다.
      </p>

      {loadError && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          {loadError}
        </div>
      )}

      {loaded && (
        <>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="010-1234-5678 / https://open.kakao.com/... / @frequency"
              className="flex-1"
            />
            <Button
              variant="primary"
              type="button"
              disabled={!dirty || saving}
              onClick={save}
            >
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
          {draft.trim() && (
            <p className="mt-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
              {kind === "link"
                ? "→ 링크 버튼으로 표시됩니다."
                : kind === "instagram"
                  ? "→ 인스타그램 프로필로 이동하는 버튼으로 표시됩니다."
                  : kind === "phone"
                    ? "→ 탭하면 복사되는 전화번호로 표시됩니다."
                    : "→ 전화번호·링크·인스타그램 형식이 아니라 텍스트 그대로 표시됩니다."}
            </p>
          )}
          {savedMsg && (
            <p className="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
              저장되었습니다.
            </p>
          )}
          {saveError && (
            <p className="mt-1.5 text-[11px] text-red-500">{saveError}</p>
          )}
        </>
      )}
    </Card>
  );
}
