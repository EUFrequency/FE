"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../../_lib/store";
import {
  convertMatchingToGeneralAction,
  listReservationsAction,
  pairReservationsAction,
  rejectReservationAction,
  unpairReservationAction,
} from "../../../_lib/reservation-actions";
import { buildMatchingCancelMessage, buildMatchingConvertMessage } from "../../../_lib/messages";
import { MIN_GENERAL_HEADCOUNT, type Reservation } from "../../../_lib/types";
import { Badge, Button, Checkbox, Input, Label, Select } from "../../ui";
import { CopyButton } from "../../CopyButton";
import { Modal } from "../../Modal";
import { CopyableMessage } from "./PendingPanel";
import { ReservationDetails } from "./ReservationDetails";

type Side = "male" | "female";

const GENDER_LABEL: Record<Side, string> = { male: "남성팀", female: "여성팀" };

/**
 * 확정(승인)된 과팅 예약만 모아서 주점/날짜/시간대로 필터링하고, 성별로 나눠 보여주는 탭.
 * 각 칸에 체크박스 하나씩(성별별로 최대 1개)만 고를 수 있고, 고른 조합에 따라
 * 취소/일반전환/맺기 버튼이 달라진다 - 승인은 이미 끝난 상태라 여기서는 상태를 바꾸지 않고
 * pairedWith만 기록/해제하거나, 예약 자체를 취소·전환한다.
 */
export function MatchingTab() {
  const { state, dispatch } = useAdminStore();
  const [boothFilter, setBoothFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [selected, setSelected] = useState<{ male: string | null; female: string | null }>({
    male: null,
    female: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<Reservation | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);

  const confirmedMatching = useMemo(
    () => state.reservations.filter((r) => r.matching && r.status === "approved"),
    [state.reservations],
  );
  const byId = useMemo(
    () => new Map(state.reservations.map((r) => [r.id, r])),
    [state.reservations],
  );

  const boothOptions = useMemo(() => {
    const map = new Map<string, string>();
    confirmedMatching.forEach((r) => map.set(r.boothId, r.boothName));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [confirmedMatching]);
  const dateOptions = useMemo(
    () => Array.from(new Set(confirmedMatching.map((r) => r.date))).sort(),
    [confirmedMatching],
  );
  const timeOptions = useMemo(
    () => Array.from(new Set(confirmedMatching.map((r) => r.time))).sort(),
    [confirmedMatching],
  );

  const filtered = useMemo(
    () =>
      confirmedMatching
        .filter(
          (r) =>
            (boothFilter === "all" || r.boothId === boothFilter) &&
            (dateFilter === "all" || r.date === dateFilter) &&
            (timeFilter === "all" || r.time === timeFilter),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [confirmedMatching, boothFilter, dateFilter, timeFilter],
  );

  const males = useMemo(() => filtered.filter((r) => r.matchingGender === "male"), [filtered]);
  const females = useMemo(
    () => filtered.filter((r) => r.matchingGender === "female"),
    [filtered],
  );

  const selectedMale = selected.male ? byId.get(selected.male) ?? null : null;
  const selectedFemale = selected.female ? byId.get(selected.female) ?? null : null;
  const noneChecked = !selectedMale && !selectedFemale;
  const bothChecked = !!selectedMale && !!selectedFemale;
  const activeSingle = !bothChecked && !noneChecked ? (selectedMale ?? selectedFemale) : null;

  // 필터를 "전체"로 두면 서로 다른 주점/날짜/시간대의 예약도 같은 목록에 함께 뜨기 때문에,
  // 맺기 전에 pairReservations()가 서버에서 검사하는 조건(주점/날짜/시간대/인원수/짝 유무)을
  // 미리 클라이언트에서도 확인해서 안 맞는 조합은 버튼을 눌러보기 전에 바로 알려준다.
  // (이미 짝이 있는 예약도 취소/전환용으로는 계속 목록에 보이므로, 맺기 시도 시엔 따로 걸러야 함)
  const pairBlockers: string[] = [];
  if (bothChecked && selectedMale && selectedFemale) {
    const mismatchFields = [
      selectedMale.boothId !== selectedFemale.boothId ? "주점" : null,
      selectedMale.date !== selectedFemale.date ? "날짜" : null,
      selectedMale.time !== selectedFemale.time ? "시간대" : null,
      selectedMale.headcount !== selectedFemale.headcount ? "인원수" : null,
    ].filter((reason): reason is string => reason !== null);
    if (mismatchFields.length > 0) {
      pairBlockers.push(`두 팀의 ${mismatchFields.join("・")}가 달라 맺을 수 없어요`);
    }
    if (selectedMale.pairedWith) {
      pairBlockers.push(
        `${selectedMale.representativeName}님(남성팀)은 이미 다른 팀과 맺어져 있어요 - 먼저 짝을 풀어주세요`,
      );
    }
    if (selectedFemale.pairedWith) {
      pairBlockers.push(
        `${selectedFemale.representativeName}님(여성팀)은 이미 다른 팀과 맺어져 있어요 - 먼저 짝을 풀어주세요`,
      );
    }
  }
  const canPair = bothChecked && pairBlockers.length === 0;

  function toggle(side: Side, id: string) {
    setError(null);
    setSelected((prev) => ({ ...prev, [side]: prev[side] === id ? null : id }));
  }

  function clearSelection() {
    setSelected({ male: null, female: null });
  }

  async function refreshAll() {
    const result = await listReservationsAction();
    if (result.ok) dispatch({ type: "reservations/replaceAll", payload: result.data });
  }

  function requestCancel() {
    if (activeSingle) setCancelTarget(activeSingle);
  }

  function handleCancelled(id: string) {
    dispatch({ type: "reservations/reject", payload: { id } });
    setCancelTarget(null);
    clearSelection();
  }

  async function handleUnpair(r: Reservation) {
    if (!confirm("짝을 해제할까요? 확정 상태는 그대로 유지됩니다.")) return;
    setBusy(true);
    setError(null);
    try {
      const result = await unpairReservationAction(r.id);
      if (!result.ok) throw new Error(result.error);
      dispatch({ type: "reservations/unpair", payload: { id: r.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "짝 해제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePair() {
    if (!canPair || !selectedMale || !selectedFemale) return;
    setBusy(true);
    setError(null);
    try {
      const result = await pairReservationsAction(selectedMale.id, selectedFemale.id);
      if (!result.ok) throw new Error(result.error);
      dispatch({
        type: "reservations/pair",
        payload: { idA: selectedMale.id, idB: selectedFemale.id },
      });
      clearSelection();
    } catch (e) {
      setError(e instanceof Error ? e.message : "짝짓기에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConverted() {
    setConvertTarget(null);
    clearSelection();
    await refreshAll();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          확정(승인)된 과팅 예약만 모아서 보여줘요. 한쪽만 고르면 취소·일반 전환을, 양쪽을
          하나씩 고르면 맺기를 할 수 있어요.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-40"
            value={boothFilter}
            onChange={(e) => setBoothFilter(e.target.value)}
          >
            <option value="all">전체 주점</option>
            {boothOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
          <Select
            className="w-36"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="all">전체 날짜</option>
            {dateOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select
            className="w-44"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="all">전체 시간대</option>
            {timeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/5 dark:bg-white/[0.02]">
        {pairBlockers.length > 0 && (
          <div className="flex flex-col items-end gap-0.5">
            {pairBlockers.map((reason) => (
              <span key={reason} className="text-xs text-red-500">
                {reason}
              </span>
            ))}
          </div>
        )}
        <Button variant="danger" disabled={!activeSingle || busy} onClick={requestCancel}>
          취소하기
        </Button>
        <Button
          variant="secondary"
          disabled={!activeSingle || busy}
          onClick={() => activeSingle && setConvertTarget(activeSingle)}
        >
          일반 예약으로 전환하기
        </Button>
        <Button variant="primary" disabled={!canPair || busy} onClick={handlePair}>
          맺기
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <GenderColumn
          label={GENDER_LABEL.male}
          side="male"
          reservations={males}
          selectedId={selected.male}
          byId={byId}
          onToggle={toggle}
          onUnpair={handleUnpair}
        />
        <GenderColumn
          label={GENDER_LABEL.female}
          side="female"
          reservations={females}
          selectedId={selected.female}
          byId={byId}
          onToggle={toggle}
          onUnpair={handleUnpair}
        />
      </div>

      <Modal open={convertTarget !== null} onClose={() => !busy && setConvertTarget(null)}>
        {convertTarget && (
          <ConvertModal
            reservation={convertTarget}
            partner={convertTarget.pairedWith ? byId.get(convertTarget.pairedWith) ?? null : null}
            onDone={handleConverted}
            onCancel={() => setConvertTarget(null)}
          />
        )}
      </Modal>

      <Modal open={cancelTarget !== null} onClose={() => setCancelTarget(null)}>
        {cancelTarget && (
          <CancelMatchingModal
            reservation={cancelTarget}
            onDone={() => handleCancelled(cancelTarget.id)}
            onCancel={() => setCancelTarget(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function GenderColumn({
  label,
  side,
  reservations,
  selectedId,
  byId,
  onToggle,
  onUnpair,
}: {
  label: string;
  side: Side;
  reservations: Reservation[];
  selectedId: string | null;
  byId: Map<string, Reservation>;
  onToggle: (side: Side, id: string) => void;
  onUnpair: (r: Reservation) => void;
}) {
  return (
    <div className="rounded-xl border border-black/5 p-3 dark:border-white/5">
      <div className="text-xs font-semibold text-purple-600 dark:text-purple-400">
        {label} ({reservations.length})
      </div>
      {reservations.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">없음</p>
      ) : (
        <div className="mt-2 space-y-2">
          {reservations.map((r) => {
            const partner = r.pairedWith ? byId.get(r.pairedWith) ?? null : null;
            return (
              <div
                key={r.id}
                className="flex items-start gap-2.5 rounded-lg border border-black/5 bg-white p-2.5 dark:border-white/5 dark:bg-white/[0.03]"
              >
                <div className="pt-0.5">
                  <Checkbox checked={selectedId === r.id} onChange={() => onToggle(side, r.id)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {r.representativeName}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {r.assignedAlias && <Badge tone="purple">별칭: {r.assignedAlias}</Badge>}
                      {partner && <Badge tone="sky">🔗 짝: {partner.representativeName}</Badge>}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {r.boothName} · {r.department} · {r.headcount}명 · {r.date} {r.time}
                  </div>
                  <div className="mt-1.5">
                    <ReservationDetails
                      reservation={r}
                      pairedReservation={partner}
                      onUnpair={partner ? () => onUnpair(r) : undefined}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CancelMatchingModal({
  reservation,
  onDone,
  onCancel,
}: {
  reservation: Reservation;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await rejectReservationAction(reservation.id);
      if (!result.ok) throw new Error(result.error);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "취소에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
        매칭 예약 취소
      </h2>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        아래 메시지를 복사해서 카카오톡으로 먼저 보내주세요. &quot;취소 처리&quot;를 눌러야
        실제로 상태가 바뀝니다.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CopyButton text={reservation.phone} label="전화번호 복사" />
        <CopyButton
          text={`${reservation.bank} ${reservation.accountNumber}`}
          label="계좌·은행 복사"
        />
      </div>

      <div className="mt-3">
        <ReservationDetails reservation={reservation} defaultOpen />
      </div>

      <div className="mt-4">
        <CopyableMessage
          label={reservation.representativeName}
          text={buildMatchingCancelMessage(reservation)}
        />
      </div>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          닫기
        </Button>
        <Button variant="danger" onClick={confirm} disabled={busy}>
          {busy ? "처리 중..." : "취소 처리"}
        </Button>
      </div>
    </div>
  );
}

function ConvertModal({
  reservation,
  partner,
  onDone,
  onCancel,
}: {
  reservation: Reservation;
  partner: Reservation | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const max = reservation.headcount * 2;
  const [headcount, setHeadcount] = useState(partner ? max : reservation.headcount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    Number.isInteger(headcount) && headcount >= MIN_GENERAL_HEADCOUNT && headcount <= max;

  async function confirm() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const result = await convertMatchingToGeneralAction(reservation.id, headcount);
      if (!result.ok) throw new Error(result.error);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "전환에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
        일반 예약으로 전환
      </h2>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        이 매칭 예약{partner ? "과 짝(상대팀)을 함께" : "을"} 취소하고, 아래 인원수로 새
        일반 예약을 접수합니다. 새 예약은 대기 상태로 접수되며 관리자가 다시 승인해야 합니다.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
        <dt className="text-neutral-500 dark:text-neutral-400">주점 · 일시</dt>
        <dd className="text-right text-neutral-900 dark:text-neutral-100">
          {reservation.boothName} · {reservation.date} {reservation.time}
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-400">대표자</dt>
        <dd className="text-right text-neutral-900 dark:text-neutral-100">
          {reservation.representativeName} · {reservation.department}
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-400">기존 인원</dt>
        <dd className="text-right text-neutral-900 dark:text-neutral-100">
          {reservation.headcount}명
          {partner && ` + 짝(${partner.representativeName}) ${partner.headcount}명`}
        </dd>
      </dl>

      <label className="mt-4 block">
        <Label>최종 인원수 ({MIN_GENERAL_HEADCOUNT}~{max}명)</Label>
        <Input
          type="number"
          min={MIN_GENERAL_HEADCOUNT}
          max={max}
          value={headcount}
          onChange={(e) => setHeadcount(Number(e.target.value))}
          className="mt-1"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CopyButton text={reservation.phone} label="전화번호 복사" />
      </div>

      {valid && (
        <div className="mt-3">
          <CopyableMessage
            label={reservation.representativeName}
            text={buildMatchingConvertMessage(reservation, headcount)}
          />
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          취소
        </Button>
        <Button variant="primary" onClick={confirm} disabled={busy || !valid}>
          {busy ? "처리 중..." : "전환하기"}
        </Button>
      </div>
    </div>
  );
}
