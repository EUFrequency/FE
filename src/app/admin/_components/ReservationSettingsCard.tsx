"use client";

import { useEffect, useState } from "react";
import {
  getReservationSettingsAction,
  setReservationSettingsAction,
} from "../_lib/settings-actions";
import type { ReservationSettingMode, ReservationSettings } from "../_lib/types";
import { Card, SectionTitle } from "./ui";

const MODES: { value: ReservationSettingMode; label: string; hint: string }[] = [
  { value: "auto", label: "자동", hint: "시즌 예약 기간을 따름" },
  { value: "open", label: "강제 오픈", hint: "기간 무시하고 열기 (연장)" },
  { value: "closed", label: "강제 마감", hint: "기간 무시하고 닫기 (조기마감)" },
];

export function ReservationSettingsCard() {
  const [settings, setSettings] = useState<ReservationSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<keyof ReservationSettings | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getReservationSettingsAction().then((res) => {
      if (!alive) return;
      if (res.ok) setSettings(res.data);
      else setLoadError(res.error);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function change(key: keyof ReservationSettings, mode: ReservationSettingMode) {
    if (!settings) return;
    const prev = settings;
    const next = { ...settings, [key]: mode };
    setSettings(next);
    setRowError(null);
    setSavingKey(key);
    try {
      const res = await setReservationSettingsAction(next);
      if (!res.ok) throw new Error(res.error);
    } catch (e) {
      setSettings(prev);
      setRowError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <Card className="p-4">
      <SectionTitle hint="/festival 예약 접수 스위치">예약 접수 설정</SectionTitle>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        평소엔 &quot;자동&quot;으로 두면 시즌에 등록한 예약 기간을 따릅니다. 상황에 따라
        일찍 닫거나(강제 마감), 기간이 지나도 계속 받아야 할 때(강제 오픈) 여기서 바꿉니다.
        과팅 예약은 전체 예약이 열려 있어야 함께 열립니다.
      </p>

      {loadError && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          {loadError}
        </div>
      )}
      {rowError && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
          {rowError}
        </div>
      )}

      {settings && (
        <div className="mt-4 space-y-4">
          <SettingRow
            label="전체 예약"
            value={settings.general}
            saving={savingKey === "general"}
            onChange={(m) => change("general", m)}
          />
          <SettingRow
            label="과팅 예약"
            value={settings.matching}
            saving={savingKey === "matching"}
            onChange={(m) => change("matching", m)}
          />
        </div>
      )}
    </Card>
  );
}

function SettingRow({
  label,
  value,
  saving,
  onChange,
}: {
  label: string;
  value: ReservationSettingMode;
  saving: boolean;
  onChange: (m: ReservationSettingMode) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-neutral-800 dark:text-neutral-200">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            disabled={saving}
            title={m.hint}
            onClick={() => onChange(m.value)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
              value === m.value
                ? m.value === "closed"
                  ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                  : m.value === "open"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-black/10 text-neutral-500 hover:bg-black/5 dark:border-white/10 dark:text-neutral-400 dark:hover:bg-white/5"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
