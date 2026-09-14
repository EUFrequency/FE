"use client";

import { useEffect, useState } from "react";
import {
  getOverbookLimitAction,
  setOverbookLimitAction,
} from "../_lib/settings-actions";
import { DEFAULT_OVERBOOK_LIMIT } from "../_lib/types";
import { Button, Card, Input, SectionTitle } from "./ui";

/** 모든 주점에 공통 적용되는 오버부킹(정원 초과 대기 접수) 허용 수 - 시스템 전체 설정 하나로 관리 */
export function OverbookSettingCard() {
  const [saved, setSaved] = useState(DEFAULT_OVERBOOK_LIMIT);
  const [draft, setDraft] = useState(String(DEFAULT_OVERBOOK_LIMIT));
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    let alive = true;
    getOverbookLimitAction().then((res) => {
      if (!alive) return;
      if (res.ok) {
        setSaved(res.data);
        setDraft(String(res.data));
      } else {
        setLoadError(res.error);
      }
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const parsed = Number(draft);
  const valid = Number.isInteger(parsed) && parsed >= 0;
  const dirty = valid && parsed !== saved;

  async function save() {
    if (!valid) return;
    setSaveError(null);
    setSavedMsg(false);
    setSaving(true);
    try {
      const res = await setOverbookLimitAction(parsed);
      if (!res.ok) throw new Error(res.error);
      setSaved(parsed);
      setDraft(String(parsed));
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
      <SectionTitle hint="모든 주점의 일반·과팅 예약에 동일하게 적용">
        오버부킹(대기 접수) 허용 수
      </SectionTitle>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        테이블 종류(정원+용도)마다, 등록된 테이블 수를 넘겨서 몇 팀까지 더 접수(대기)를
        받을지 정해요(과팅은 성별별로 각각 적용). 일반 예약은 등록된 테이블 조합으로
        인원을 채울 수 없을 때만 이 여유분을 써서 대기로 접수돼요. 승인(확정) 시점에는
        이 여유분과 무관하게 실제 테이블 수만 그대로 적용돼요.
      </p>

      {loadError && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          {loadError}
        </div>
      )}

      {loaded && (
        <>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="number"
              min={0}
              step={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full sm:w-32"
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
          {!valid && (
            <p className="mt-1.5 text-[11px] text-red-500">
              0 이상의 정수를 입력해주세요.
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
