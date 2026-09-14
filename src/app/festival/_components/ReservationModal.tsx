"use client";

import { useEffect, useMemo, useState } from "react";
import { BANKS, MATCHING_FEE_PER_PERSON } from "../data";
import type { FestivalBooth } from "../_lib/palette";
import { seasonDateOptions } from "../_lib/season-dates";
import { submitReservationAction } from "../_lib/reservation-actions";
import { checkAvailabilityAction } from "../_lib/availability-actions";
import { MenuThumb } from "./MenuThumb";
import { formatPhoneInput } from "@/lib/phone";
import {
  formatTimeSlot,
  generalHeadcountRange,
  matchingHeadcountOptions,
} from "@/app/admin/_lib/slots";
import { resolveMinOrderAmount } from "@/app/admin/_lib/min-order";
import type { Account, Season } from "@/app/admin/_lib/types";

type Props = {
  booth: FestivalBooth;
  /** 이 주점에 실제로 표시할 입금 계좌. 아직 관리자가 계좌를 등록하지 않았으면 null */
  account: Account | null;
  /** 지금 진행중인 축제 시즌 - 날짜 선택지를 이 기간 안에서만 뽑음 */
  season: Season;
  /** 지금 과팅 예약 접수 기간인지. false면 과팅 신청 옵션이 막힘 */
  matchingOpen: boolean;
  /** 학과 선택지 (관리자 페이지에서 관리) */
  departments: string[];
  onClose: () => void;
  onSubmit: (info: { zone: "normal" | "overbook"; waitingNumber: number | null }) => void;
};

type Gender = "male" | "female";

type Form = {
  date: string;
  time: string;
  name: string;
  phone: string;
  representativeDept: string;
  bank: string;
  accountNumber: string;
  headcount: number;
  matchingEnabled: boolean;
  gender: Gender | "";
  participantDepts: string[]; // index 0 = representative
  quantities: Record<string, number>;
  paymentConfirmed: boolean;
  privacyConsent: boolean;
};

function initialForm(): Form {
  return {
    date: "",
    time: "",
    name: "",
    phone: "",
    representativeDept: "",
    bank: "",
    accountNumber: "",
    headcount: 2,
    matchingEnabled: false,
    gender: "",
    participantDepts: ["", ""],
    quantities: {},
    paymentConfirmed: false,
    privacyConsent: false,
  };
}

export function ReservationModal({
  booth,
  account,
  season,
  matchingOpen,
  departments,
  onClose,
  onSubmit,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<Form>(() => initialForm());
  const [showMatchingInfo, setShowMatchingInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [availabilityMsg, setAvailabilityMsg] = useState<string | null>(null);
  const [zone, setZone] = useState<"normal" | "overbook">("normal");

  const dateOptions = useMemo(() => seasonDateOptions(season), [season]);

  // 주점 테이블 구성에서 예약 가능한 인원 범위를 뽑음
  const matchingSizes = useMemo(
    () => matchingHeadcountOptions(booth.tables),
    [booth.tables],
  );
  const generalRange = useMemo(
    () => generalHeadcountRange(booth.tables),
    [booth.tables],
  );
  const canMatch = matchingOpen && matchingSizes.length > 0;
  const matchingDisabledReason = !matchingOpen
    ? "지금은 과팅 예약 접수 기간이 아닙니다."
    : matchingSizes.length === 0
      ? "이 주점은 과팅 예약을 받지 않습니다."
      : null;

  // 인원수 입력이 현재 모드(매칭/일반)에 유효한지
  const headcountValid = form.matchingEnabled
    ? matchingSizes.includes(form.headcount)
    : !!generalRange &&
      form.headcount >= generalRange.min &&
      form.headcount <= generalRange.max;

  // 1인 1개 필수 메뉴(차림비 등)는 인원수가 바뀔 때마다 그 수량으로 강제 고정 -
  // 매칭이든 일반이든 이번 예약 건 자체의 인원수(form.headcount) 기준
  useEffect(() => {
    setForm((f) => {
      let changed = false;
      const quantities = { ...f.quantities };
      for (const menu of booth.menus) {
        if (menu.perPersonRequired && quantities[menu.id] !== f.headcount) {
          quantities[menu.id] = f.headcount;
          changed = true;
        }
      }
      return changed ? { ...f, quantities } : f;
    });
  }, [form.headcount, booth.menus]);

  const menuTotal = useMemo(
    () =>
      booth.menus.reduce(
        (sum, m) => sum + (form.quantities[m.id] ?? 0) * m.price,
        0,
      ),
    [booth.menus, form.quantities],
  );
  // 최소 주문 금액 충족 여부는 "최소 주문 금액에서 제외" 체크된 메뉴(차림비 등) 금액을
  // 뺀 값으로 따진다 - 실제 결제 총액(menuTotal)에는 항상 그대로 포함됨
  const minOrderQualifyingTotal = useMemo(
    () =>
      booth.menus.reduce(
        (sum, m) =>
          m.excludeFromMinOrder ? sum : sum + (form.quantities[m.id] ?? 0) * m.price,
        0,
      ),
    [booth.menus, form.quantities],
  );
  const matchingFee = form.matchingEnabled
    ? form.headcount * MATCHING_FEE_PER_PERSON
    : 0;
  const grandTotal = menuTotal + matchingFee;
  const minOrderAmount = resolveMinOrderAmount(booth.minOrderRules, form.headcount);
  const meetsMinOrder = minOrderQualifyingTotal >= minOrderAmount;

  const step1Valid =
    form.date &&
    form.time &&
    form.name.trim() &&
    form.phone.trim() &&
    form.representativeDept &&
    form.bank &&
    form.accountNumber.trim() &&
    headcountValid &&
    (!form.matchingEnabled ||
      (form.gender &&
        form.participantDepts.every((d) => d && d.length > 0))) &&
    meetsMinOrder &&
    form.privacyConsent;

  const step2Valid = form.paymentConfirmed && !!account;

  // participantDepts는 headcount만큼 길이를 맞추고, index 0은 항상 대표자 학과와 같게 유지.
  // (헤드카운트/대표자 학과가 바뀔 때 이 함수 안에서 같이 조정 - effect로 뒤늦게 동기화하지 않음)
  const resizeParticipantDepts = (
    prev: string[],
    headcount: number,
    representativeDept: string,
  ) => {
    const next = [...prev];
    while (next.length < headcount) next.push("");
    next.length = headcount;
    next[0] = representativeDept;
    return next;
  };

  const setField = <K extends keyof Form>(key: K, value: Form[K]) => {
    if (key === "headcount" || key === "matchingEnabled" || key === "gender") {
      setAvailabilityMsg(null);
    }
    setForm((f) => {
      if (key === "headcount") {
        const headcount = value as number;
        return {
          ...f,
          headcount,
          participantDepts: resizeParticipantDepts(f.participantDepts, headcount, f.representativeDept),
        };
      }
      if (key === "representativeDept") {
        const representativeDept = value as string;
        return {
          ...f,
          representativeDept,
          participantDepts: resizeParticipantDepts(f.participantDepts, f.headcount, representativeDept),
        };
      }
      return { ...f, [key]: value };
    });
  };

  const toggleMatching = () => {
    if (!form.matchingEnabled) {
      if (!canMatch) return;
      setShowMatchingInfo(true);
    } else {
      setAvailabilityMsg(null);
      setForm((f) => {
        const min = generalRange?.min ?? 2;
        const max = generalRange?.max ?? f.headcount;
        const headcount = Math.min(Math.max(f.headcount, min), max);
        return {
          ...f,
          matchingEnabled: false,
          gender: "",
          headcount,
          participantDepts: resizeParticipantDepts(
            f.participantDepts,
            headcount,
            f.representativeDept,
          ),
        };
      });
    }
  };

  const confirmMatching = () => {
    setAvailabilityMsg(null);
    setForm((f) => {
      const headcount = matchingSizes.includes(f.headcount)
        ? f.headcount
        : (matchingSizes[0] ?? f.headcount);
      return {
        ...f,
        matchingEnabled: true,
        headcount,
        participantDepts: resizeParticipantDepts(
          f.participantDepts,
          headcount,
          f.representativeDept,
        ),
      };
    });
    setShowMatchingInfo(false);
  };

  const goToStep2 = async () => {
    if (!step1Valid || checking) return;
    setAvailabilityMsg(null);
    setChecking(true);
    try {
      const res = await checkAvailabilityAction(booth.id, {
        date: form.date,
        time: form.time,
        matching: form.matchingEnabled,
        gender: form.matchingEnabled ? form.gender || null : null,
        headcount: form.headcount,
      });
      if (!res.ok) {
        setAvailabilityMsg(res.reason);
        return;
      }
      setZone(res.status === "overbook" ? "overbook" : "normal");
      setStep(2);
    } finally {
      setChecking(false);
    }
  };

  const setQty = (menuId: string, delta: number) => {
    setForm((f) => {
      const current = f.quantities[menuId] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...f, quantities: { ...f.quantities, [menuId]: next } };
    });
  };

  const copyAccount = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const selectedDateLabel =
    dateOptions.find((d) => d.value === form.date)?.label ?? "";

  const handleFinalSubmit = async () => {
    if (!step2Valid || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const orderItems = booth.menus
        .filter((m) => (form.quantities[m.id] ?? 0) > 0)
        .map((m) => ({
          menuName: m.name,
          unitPrice: m.price,
          quantity: form.quantities[m.id],
        }));

      const result = await submitReservationAction({
        boothId: booth.id,
        boothName: booth.name,
        representativeName: form.name.trim(),
        phone: form.phone.trim(),
        department: form.representativeDept,
        headcount: form.headcount,
        date: form.date,
        time: form.time,
        bank: form.bank,
        accountNumber: form.accountNumber.trim(),
        matching: form.matchingEnabled,
        matchingGender: form.matchingEnabled ? (form.gender || undefined) : undefined,
        participantDepartments: form.matchingEnabled ? form.participantDepts : undefined,
        orderItems,
        menuAmount: menuTotal,
        matchingFee,
        totalAmount: grandTotal,
      });

      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      onSubmit({ zone: result.zone, waitingNumber: result.waitingNumber });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pointer-events-auto flex h-full flex-col">
      <div className="h-24 flex-shrink-0" onClick={onClose} />
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-neutral-50 shadow-2xl dark:bg-neutral-950">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-3">
          <div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {booth.name} · 예약
            </div>
            <h2 className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
              {step === 1 ? "예약 정보 입력" : "최종 확인 및 결제"}
            </h2>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <StepDots step={step} />
            <button
              type="button"
              onClick={onClose}
              className="ml-2 grid h-8 w-8 place-items-center rounded-full text-neutral-500 transition hover:bg-black/5 dark:hover:bg-white/5"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-28">
          {step === 1 ? (
            <Step1
              booth={booth}
              form={form}
              dateOptions={dateOptions}
              setField={setField}
              toggleMatching={toggleMatching}
              setQty={setQty}
              minOrderQualifyingTotal={minOrderQualifyingTotal}
              minOrderAmount={minOrderAmount}
              meetsMinOrder={meetsMinOrder}
              canMatch={canMatch}
              matchingDisabledReason={matchingDisabledReason}
              matchingSizes={matchingSizes}
              generalRange={generalRange}
              departments={departments}
            />
          ) : (
            <Step2
              booth={booth}
              account={account}
              form={form}
              selectedDateLabel={selectedDateLabel}
              menuTotal={menuTotal}
              minOrderAmount={minOrderAmount}
              matchingFee={matchingFee}
              grandTotal={grandTotal}
              copied={copied}
              copyAccount={copyAccount}
              overbooked={zone === "overbook"}
              onChangeConfirmed={(v) => setField("paymentConfirmed", v)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="absolute inset-x-0 bottom-0 border-t border-black/5 bg-neutral-50/95 backdrop-blur dark:border-white/5 dark:bg-neutral-950/95">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex h-10 w-full items-center justify-center gap-1 text-xs text-neutral-500 dark:text-neutral-400"
            >
              ← 이전으로
            </button>
          )}
          <div className="p-4 pt-0">
            {step === 1 ? (
              <>
                {availabilityMsg && (
                  <p className="mb-2 text-center text-xs font-medium text-red-500">
                    {availabilityMsg}
                  </p>
                )}
                <button
                  type="button"
                  disabled={!step1Valid || checking}
                  onClick={goToStep2}
                  className="h-14 w-full rounded-2xl bg-amber-500 font-semibold text-neutral-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 dark:disabled:bg-white/10 dark:disabled:text-neutral-500"
                >
                  {checking ? "정원 확인 중..." : "다음 단계 →"}
                </button>
              </>
            ) : (
              <>
                {submitError && (
                  <p className="mb-2 text-center text-xs text-red-500">{submitError}</p>
                )}
                <button
                  type="button"
                  disabled={!step2Valid || submitting}
                  onClick={handleFinalSubmit}
                  className="h-14 w-full rounded-2xl bg-amber-500 font-semibold text-neutral-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/40"
                >
                  {submitting ? "접수 중..." : "예약 최종 제출"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showMatchingInfo && (
        <MatchingInfoDialog
          onCancel={() => setShowMatchingInfo(false)}
          onConfirm={confirmMatching}
        />
      )}
    </div>
  );
}

function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`h-1.5 w-6 rounded-full ${step === 1 ? "bg-amber-500" : "bg-neutral-300 dark:bg-neutral-700"}`}
      />
      <span
        className={`h-1.5 w-6 rounded-full ${step === 2 ? "bg-amber-500" : "bg-neutral-300 dark:bg-neutral-700"}`}
      />
    </div>
  );
}

/* ---------- STEP 1 ---------- */

type Step1Props = {
  booth: FestivalBooth;
  form: Form;
  dateOptions: { value: string; label: string }[];
  setField: <K extends keyof Form>(k: K, v: Form[K]) => void;
  toggleMatching: () => void;
  setQty: (menuId: string, delta: number) => void;
  minOrderQualifyingTotal: number;
  minOrderAmount: number;
  meetsMinOrder: boolean;
  canMatch: boolean;
  matchingDisabledReason: string | null;
  matchingSizes: number[];
  generalRange: { min: number; max: number } | null;
  departments: string[];
};

function Step1({
  booth,
  form,
  dateOptions,
  setField,
  toggleMatching,
  setQty,
  minOrderQualifyingTotal,
  minOrderAmount,
  meetsMinOrder,
  canMatch,
  matchingDisabledReason,
  matchingSizes,
  generalRange,
  departments,
}: Step1Props) {
  return (
    <div className="space-y-8">
      {/* 예약 정보 */}
      <section>
        <SectionTitle>예약 정보</SectionTitle>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="날짜">
            <Select
              value={form.date}
              onChange={(v) => setField("date", v)}
              placeholder="선택"
              options={dateOptions}
            />
          </Field>
          <Field label="시간">
            <Select
              value={form.time}
              onChange={(v) => setField("time", v)}
              placeholder="선택"
              options={booth.timeSlots.map((slot) => {
                const label = formatTimeSlot(slot);
                return { value: label, label };
              })}
            />
          </Field>
        </div>
        {booth.timeSlots.length === 0 && (
          <p className="mt-2 text-xs font-medium text-red-500">
            아직 예약 가능한 시간대가 등록되지 않았습니다.
          </p>
        )}
        <Field label="대표 예약자 이름" className="mt-4">
          <Input
            value={form.name}
            onChange={(v) => setField("name", v)}
            placeholder="홍길동"
          />
        </Field>
        <Field label="전화번호" className="mt-4">
          <Input
            value={form.phone}
            onChange={(v) => setField("phone", formatPhoneInput(v))}
            placeholder="010-1234-5678"
            inputMode="numeric"
          />
        </Field>
        <Field label="대표자 학과" className="mt-4">
          <Select
            value={form.representativeDept}
            onChange={(v) => setField("representativeDept", v)}
            placeholder="학과 선택"
            options={departments.map((d) => ({ value: d, label: d }))}
          />
        </Field>
        <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
          환불하게 될 경우 환불받을 계좌를 입력해주세요.
        </p>
        <div className="mt-1.5 grid grid-cols-2 gap-3">
          <Field label="은행">
            <Select
              value={form.bank}
              onChange={(v) => setField("bank", v)}
              placeholder="선택"
              options={BANKS.map((b) => ({ value: b, label: b }))}
            />
          </Field>
          <Field label="계좌번호">
            <Input
              value={form.accountNumber}
              onChange={(v) => setField("accountNumber", v)}
              placeholder="3333-12-3456789"
            />
          </Field>
        </div>
      </section>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/5 dark:bg-white/[0.03]">
        <Checkbox
          checked={form.privacyConsent}
          onChange={() => setField("privacyConsent", !form.privacyConsent)}
        />
        <div>
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            개인정보 수집·이용 동의 (필수)
          </span>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            이름, 전화번호, 학과, 환불 계좌 정보를 예약 확인·매칭 안내·환불 처리 목적으로만
            수집하며, 그 외 용도로는 사용하지 않습니다. 축제가 끝나면 수집한 개인정보는 모두
            즉시 파기합니다.
          </p>
        </div>
      </label>

      {/* 인원 및 과팅 - 과팅 신청 여부를 먼저 물어본 뒤 인원수를 고르게 해서, 인원수를
          먼저 정했다가 과팅을 켜면서 선택지가 바뀌어 다시 골라야 하는 불편을 없앤다 */}
      <section>
        <SectionTitle>인원 및 과팅</SectionTitle>

        <div className="mt-4 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/5 dark:bg-white/[0.03]">
          <label
            className={`flex items-center gap-3 ${canMatch ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
          >
            <Checkbox
              checked={form.matchingEnabled}
              onChange={canMatch ? toggleMatching : () => {}}
            />
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              과팅 신청 💘
            </span>
          </label>
          <p className="mt-2 pl-9 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {matchingDisabledReason ??
              "과팅 선택 시 인당 3,000원의 비용이 추가되며, 이 금액의 일부는 후원됩니다."}
          </p>

          {form.matchingEnabled && (
            <div className="mt-5 space-y-4 pl-9">
              <div>
                <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  우리 팀 성별
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <GenderPill
                    active={form.gender === "male"}
                    onClick={() => setField("gender", "male")}
                    label="🧑 남성팀"
                  />
                  <GenderPill
                    active={form.gender === "female"}
                    onClick={() => setField("gender", "female")}
                    label="👩 여성팀"
                  />
                </div>
                <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-500">
                  혼성팀은 과팅 신청이 불가합니다
                </p>
              </div>

              <div>
                <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  참석자별 학과
                </div>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="mb-1 text-[11px] text-neutral-500 dark:text-neutral-500">
                      대표자
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex h-11 items-center rounded-xl border border-black/5 bg-neutral-100 px-3 text-sm text-neutral-400 dark:border-white/5 dark:bg-white/[0.04]">
                        {form.name || "이름 미입력"}
                      </div>
                      <div className="flex h-11 items-center rounded-xl border border-black/5 bg-neutral-100 px-3 text-sm text-neutral-500 dark:border-white/5 dark:bg-white/[0.04] dark:text-neutral-400">
                        {form.representativeDept || "학과 선택"}
                      </div>
                    </div>
                  </div>
                  {form.participantDepts.slice(1).map((_dept, i) => (
                    <div key={i + 1}>
                      <div className="mb-1 text-[11px] text-neutral-500 dark:text-neutral-500">
                        참석자{i + 1}
                      </div>
                      <Select
                        value={form.participantDepts[i + 1] ?? ""}
                        onChange={(v) => {
                          const next = [...form.participantDepts];
                          next[i + 1] = v;
                          setField("participantDepts", next);
                        }}
                        placeholder="학과 선택"
                        options={departments.map((d) => ({
                          value: d,
                          label: d,
                        }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            인원수
            {form.matchingEnabled && (
              <span className="ml-1 text-neutral-400 dark:text-neutral-500">
                (과팅은 테이블 정원과 같은 인원만 가능)
              </span>
            )}
          </div>
          <div className="mt-2">
            {form.matchingEnabled ? (
              matchingSizes.length <= 1 ? (
                <div className="inline-flex h-10 items-center rounded-xl border border-black/5 bg-neutral-100 px-4 text-sm font-medium text-neutral-700 dark:border-white/5 dark:bg-white/[0.04] dark:text-neutral-200">
                  {form.headcount}인 팀
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {matchingSizes.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setField("headcount", n)}
                      className={`h-10 rounded-xl border px-4 text-sm font-medium transition ${
                        form.headcount === n
                          ? "border-amber-400/60 bg-amber-500/15 text-amber-600 dark:text-amber-300"
                          : "border-black/5 bg-white text-neutral-700 dark:border-white/5 dark:bg-white/[0.04] dark:text-neutral-200"
                      }`}
                    >
                      {n}인
                    </button>
                  ))}
                </div>
              )
            ) : generalRange ? (
              <Stepper
                value={form.headcount}
                onChange={(v) =>
                  setField(
                    "headcount",
                    Math.min(generalRange.max, Math.max(generalRange.min, v)),
                  )
                }
                min={generalRange.min}
                max={generalRange.max}
              />
            ) : (
              <p className="text-xs text-red-500">
                이 주점은 일반 예약을 받지 않습니다.
              </p>
            )}
          </div>
          {!form.matchingEnabled && generalRange && (
            <p className="mt-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
              {generalRange.min}~{generalRange.max}인 예약 가능
            </p>
          )}
          {!form.matchingEnabled && matchingSizes.length > 0 && (
            <p className="mt-1 text-[11px] text-purple-500 dark:text-purple-400">
              💘 과팅 신청은{" "}
              {matchingSizes.length === 1
                ? `${matchingSizes[0]}인만`
                : `${matchingSizes[0]}~${matchingSizes[matchingSizes.length - 1]}인까지`}{" "}
              가능해요
            </p>
          )}
        </div>
      </section>

      {/* 메뉴 선택 */}
      <section>
        <div className="flex items-center justify-between">
          <SectionTitle>메뉴 선택</SectionTitle>
          <span
            className={`text-xs ${meetsMinOrder ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-500 dark:text-neutral-400"}`}
          >
            최소 {minOrderAmount.toLocaleString()}원
            {minOrderQualifyingTotal > 0 &&
              ` · 현재 ${minOrderQualifyingTotal.toLocaleString()}원`}
          </span>
        </div>

        <ul className="mt-4 space-y-4">
          {booth.menus.map((menu) => (
            <li
              key={menu.id}
              className="overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/5 dark:bg-white/[0.03]"
            >
              <MenuThumb image={menu.image} accentColor={booth.accentColor} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-50">
                        {menu.name}
                      </span>
                      {menu.perPersonRequired && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          인원수만큼 필수
                        </span>
                      )}
                    </div>
                    <div className="mt-1 whitespace-pre-line text-xs text-neutral-500 dark:text-neutral-400">
                      {menu.description}
                    </div>
                  </div>
                  <div className="whitespace-nowrap text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {menu.price.toLocaleString()}원
                  </div>
                </div>
                <div className="mt-3">
                  {menu.perPersonRequired ? (
                    <Stepper
                      value={form.headcount}
                      onChange={() => {}}
                      min={form.headcount}
                      max={form.headcount}
                    />
                  ) : (
                    <Stepper
                      value={form.quantities[menu.id] ?? 0}
                      onChange={(v) =>
                        setQty(menu.id, v - (form.quantities[menu.id] ?? 0))
                      }
                      min={0}
                      max={99}
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------- STEP 2 ---------- */

type Step2Props = {
  booth: FestivalBooth;
  account: Account | null;
  form: Form;
  selectedDateLabel: string;
  menuTotal: number;
  minOrderAmount: number;
  matchingFee: number;
  grandTotal: number;
  copied: boolean;
  copyAccount: () => void;
  overbooked: boolean;
  onChangeConfirmed: (v: boolean) => void;
};

function Step2({
  booth,
  account,
  form,
  selectedDateLabel,
  menuTotal,
  minOrderAmount,
  matchingFee,
  grandTotal,
  copied,
  copyAccount,
  overbooked,
  onChangeConfirmed,
}: Step2Props) {
  const orderedMenus = booth.menus
    .map((m) => ({ menu: m, qty: form.quantities[m.id] ?? 0 }))
    .filter((x) => x.qty > 0);

  const depositorName = `${form.name.trim()} ${form.phone.slice(-4)}`;
  const [copiedName, setCopiedName] = useState(false);
  const copyDepositorName = async () => {
    try {
      await navigator.clipboard.writeText(depositorName);
      setCopiedName(true);
      setTimeout(() => setCopiedName(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {overbooked && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6 text-amber-700 dark:text-amber-300">
          <div className="font-semibold">대기(오버부킹) 예약입니다</div>
          <p className="mt-1 text-xs leading-5">
            현재 이 인원의 테이블이 모두 찼습니다. 앞선 예약이 취소될 경우에만
            이용하실 수 있고, 그렇지 않으면 이용이 어려울 수 있습니다. 확정 여부는
            카카오톡으로 개별 안내해 드리니 꼭 확인해주세요.
          </p>
        </div>
      )}
      <section>
        <SectionTitle>예약 정보 확인</SectionTitle>
        <dl className="mt-4 rounded-2xl border border-black/5 bg-white p-4 text-sm dark:border-white/5 dark:bg-white/[0.03]">
          <Row label="부스" value={booth.name} />
          <Row label="대표자" value={form.name} />
          <Row label="학과" value={form.representativeDept} />
          <Row label="전화번호" value={form.phone} />
          <Row
            label="입금 계좌"
            value={`${form.bank} ${form.accountNumber}`}
          />
          <Row
            label="일시"
            value={`${selectedDateLabel} ${form.time}`}
          />
          <Row label="인원" value={`${form.headcount}명`} />
          <Row
            label="과팅"
            value={
              form.matchingEnabled
                ? `신청 (${form.gender === "male" ? "남성팀" : "여성팀"})`
                : "미신청"
            }
            last
          />
        </dl>
      </section>

      {form.matchingEnabled && (
        <section>
          <SectionTitle purple>과팅 구성원 학과</SectionTitle>
          <dl className="mt-4 rounded-2xl border border-purple-400/20 bg-purple-500/[0.03] p-4 text-sm">
            {form.participantDepts.map((dept, i) => (
              <Row
                key={i}
                label={i === 0 ? "대표자" : `참석자${i}`}
                value={dept}
                last={i === form.participantDepts.length - 1}
                muted
              />
            ))}
          </dl>
        </section>
      )}

      <section>
        <SectionTitle>계산서</SectionTitle>
        <div className="mt-4 rounded-2xl border border-black/5 bg-white dark:border-white/5 dark:bg-white/[0.03]">
          {orderedMenus.map(({ menu, qty }) => (
            <div
              key={menu.id}
              className="flex items-start justify-between border-b border-black/5 p-4 last:border-0 dark:border-white/5"
            >
              <div>
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {menu.name}
                </div>
                <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {menu.price.toLocaleString()}원 × {qty}
                </div>
              </div>
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {(menu.price * qty).toLocaleString()}원
              </div>
            </div>
          ))}
          {form.matchingEnabled && (
            <div className="flex items-start justify-between border-b border-black/5 p-4 last:border-0 dark:border-white/5">
              <div>
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  매칭 비용
                </div>
                <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {MATCHING_FEE_PER_PERSON.toLocaleString()}원 ×{" "}
                  {form.headcount}명
                </div>
              </div>
              <div className="text-sm font-medium text-purple-500 dark:text-purple-400">
                {matchingFee.toLocaleString()}원
              </div>
            </div>
          )}
          <div className="flex items-center justify-between bg-black/[0.02] p-4 dark:bg-white/[0.02]">
            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              총 금액
            </div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {grandTotal.toLocaleString()}원
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
          메뉴 합계: {menuTotal.toLocaleString()}원 (최소{" "}
          {minOrderAmount.toLocaleString()}원)
        </div>
      </section>

      <section>
        <SectionTitle>입금 계좌</SectionTitle>
        {account ? (
          <div className="mt-4 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/5 dark:bg-white/[0.03]">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {account.bank} · 예금주: {account.holderName}
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="font-mono text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {account.accountNumber}
              </div>
              <button
                type="button"
                onClick={copyAccount}
                className="h-9 rounded-full border border-amber-500/50 bg-amber-500/10 px-4 text-xs font-medium text-amber-600 transition hover:bg-amber-500/20 dark:text-amber-400"
              >
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              위 계좌로{" "}
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {grandTotal.toLocaleString()}원
              </span>
              을 입금해주세요.
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <div className="text-xs leading-5 text-neutral-700 dark:text-neutral-200">
                입금자명은{" "}
                <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">
                  {depositorName}
                </span>
                로 해주세요 (이름 + 전화번호 뒤 4자리)
              </div>
              <button
                type="button"
                onClick={copyDepositorName}
                className="h-8 shrink-0 rounded-full border border-amber-500/50 bg-white px-3 text-xs font-medium text-amber-600 transition hover:bg-amber-500/10 dark:bg-transparent dark:text-amber-400"
              >
                {copiedName ? "복사됨" : "복사"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
            아직 입금 계좌가 설정되지 않았습니다. 잠시 후 다시 시도해주시거나 주최 측에
            문의해주세요.
          </div>
        )}
      </section>

      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/5 dark:bg-white/[0.03]">
        <Checkbox
          checked={form.paymentConfirmed}
          onChange={() => onChangeConfirmed(!form.paymentConfirmed)}
        />
        <span className="text-sm text-neutral-900 dark:text-neutral-100">
          위 계좌로 입금을 완료하였습니다.
        </span>
      </label>
    </div>
  );
}

function Row({
  label,
  value,
  last,
  muted,
}: {
  label: string;
  value: string;
  last?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 py-2 ${last ? "" : "border-b border-black/5 dark:border-white/5"}`}
    >
      <dt
        className={`text-xs ${muted ? "text-neutral-500 dark:text-neutral-500" : "text-neutral-500 dark:text-neutral-400"}`}
      >
        {label}
      </dt>
      <dd
        className={`text-sm text-neutral-900 dark:text-neutral-100 ${muted ? "font-normal" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

/* ---------- Matching info dialog ---------- */

function MatchingInfoDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-50 p-6 shadow-2xl dark:bg-neutral-900">
        <div className="text-center text-3xl">💘</div>
        <h3 className="mt-3 text-center text-lg font-bold text-neutral-900 dark:text-neutral-50">
          과팅 신청 안내
        </h3>
        <div className="mt-5 rounded-2xl bg-black/[0.03] p-4 text-sm leading-6 text-neutral-700 dark:bg-white/[0.03] dark:text-neutral-300">
          <p>
            과팅 신청 시 인당{" "}
            <span className="font-bold text-amber-600 dark:text-amber-400">
              3,000원
            </span>
            의 비용이 추가되며, 이 금액의 일부는 후원됩니다.
          </p>
          <p className="mt-2">
            매칭 실패한 경우 취소 또는 매칭 상대 없이 예약자분들끼리 이용하실지
            여부를 카톡으로 안내할 예정입니다.
          </p>
          <p className="mt-2">
            매칭 확정 카톡을 받으신 이후로는 예약 취소가 불가능합니다.
          </p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-2xl border border-black/10 font-medium text-neutral-700 transition hover:bg-black/5 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-white/5"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-12 rounded-2xl bg-purple-500 font-medium text-white transition hover:bg-purple-400"
          >
            신청할게요 💜
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Primitives ---------- */

function SectionTitle({
  children,
  purple,
}: {
  children: React.ReactNode;
  purple?: boolean;
}) {
  return (
    <h3
      className={`text-sm font-semibold ${purple ? "text-purple-500 dark:text-purple-400" : "text-neutral-900 dark:text-neutral-100"}`}
    >
      {children}
    </h3>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric";
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className="h-11 w-full rounded-xl border border-black/5 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500/60 dark:border-white/5 dark:bg-white/[0.04] dark:text-neutral-100"
    />
  );
}

function Select({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-11 w-full appearance-none rounded-xl border border-black/5 bg-white px-3 pr-8 text-sm outline-none transition focus:border-amber-500/60 dark:border-white/5 dark:bg-white/[0.04] ${value ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-400 dark:text-neutral-500"}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
        ▾
      </span>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid h-9 w-9 place-items-center rounded-full border border-amber-500/40 text-amber-600 transition hover:bg-amber-500/10 disabled:opacity-40 dark:text-amber-400"
        disabled={value <= min}
        aria-label="감소"
      >
        −
      </button>
      <span className="min-w-6 text-center text-base font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="grid h-9 w-9 place-items-center rounded-full border border-amber-500/40 text-amber-600 transition hover:bg-amber-500/10 disabled:opacity-40 dark:text-amber-400"
        disabled={value >= max}
        aria-label="증가"
      >
        +
      </button>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`grid h-6 w-6 place-items-center rounded-md border transition ${
        checked
          ? "border-amber-500 bg-amber-500 text-neutral-900"
          : "border-neutral-400 bg-transparent dark:border-neutral-600"
      }`}
    >
      {checked && (
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current">
          <path
            d="M5 10.5l3 3 7-7"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

function GenderPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 rounded-xl border text-sm font-medium transition ${
        active
          ? "border-purple-400/60 bg-purple-500/15 text-purple-600 dark:text-purple-300"
          : "border-black/5 bg-white text-neutral-700 hover:bg-black/[0.03] dark:border-white/5 dark:bg-white/[0.04] dark:text-neutral-200 dark:hover:bg-white/[0.06]"
      }`}
    >
      {label}
    </button>
  );
}
