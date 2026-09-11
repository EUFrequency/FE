"use client";

import { useEffect, useState } from "react";
import {
  getDepartmentsAction,
  setDepartmentsAction,
} from "../../_lib/settings-actions";
import { Button, Card, Input, SectionTitle } from "../ui";

/** 예약 폼(대표 예약자·과팅 참가자)에서 고르는 학과 목록 관리 */
export function DepartmentsTab() {
  const [saved, setSaved] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newDept, setNewDept] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    let alive = true;
    getDepartmentsAction().then((res) => {
      if (!alive) return;
      if (res.ok) {
        setSaved(res.data);
        setDraft(res.data);
      } else {
        setLoadError(res.error);
      }
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function addDept() {
    const trimmed = newDept.trim();
    if (!trimmed || draft.includes(trimmed)) return;
    setDraft((d) => [...d, trimmed]);
    setNewDept("");
  }

  function removeDept(index: number) {
    setDraft((d) => d.filter((_, i) => i !== index));
  }

  function updateDept(index: number, value: string) {
    setDraft((d) => d.map((x, i) => (i === index ? value : x)));
  }

  async function save() {
    const cleaned = draft.map((d) => d.trim()).filter(Boolean);
    if (new Set(cleaned).size !== cleaned.length) {
      setSaveError("중복된 학과명이 있어요.");
      return;
    }
    setSaveError(null);
    setSavedMsg(false);
    setSaving(true);
    try {
      const res = await setDepartmentsAction(cleaned);
      if (!res.ok) throw new Error(res.error);
      setSaved(cleaned);
      setDraft(cleaned);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 1500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
        학과 관리
      </h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        예약 화면에서 대표 예약자·과팅 참가자가 고르는 학과 목록이에요. 저장하면 바로
        반영됩니다.
      </p>

      <Card className="p-4">
        <SectionTitle hint={`${draft.length}개`}>학과 목록</SectionTitle>

        {loadError && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            {loadError}
          </div>
        )}

        {!loaded ? (
          <p className="mt-3 text-sm text-neutral-400 dark:text-neutral-500">
            불러오는 중...
          </p>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {draft.length === 0 && (
                <p className="rounded-lg border border-dashed border-black/10 px-3 py-4 text-center text-xs text-neutral-400 dark:border-white/10 dark:text-neutral-500">
                  등록된 학과가 없습니다.
                </p>
              )}
              {draft.map((dept, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={dept}
                    onChange={(e) => updateDept(i, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => removeDept(i)}
                  >
                    삭제
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Input
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDept();
                  }
                }}
                placeholder="새 학과 이름"
                className="flex-1"
              />
              <Button type="button" variant="secondary" onClick={addDept}>
                + 추가
              </Button>
            </div>

            {saveError && <p className="mt-2 text-xs text-red-500">{saveError}</p>}
            {savedMsg && (
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                저장되었습니다.
              </p>
            )}

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="primary"
                disabled={!dirty || saving}
                onClick={save}
              >
                {saving ? "저장 중..." : "변경사항 저장"}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
