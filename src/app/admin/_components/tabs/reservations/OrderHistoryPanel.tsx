"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../../_lib/store";
import { rejectReservationAction } from "../../../_lib/reservation-actions";
import type { Reservation } from "../../../_lib/types";
import { Badge, Button, Card, Checkbox, EmptyState, Label, Select } from "../../ui";
import { CopyButton } from "../../CopyButton";
import { Modal } from "../../Modal";
import { ReservationDetails } from "./ReservationDetails";

const HEADERS = [
  "순번",
  "날짜",
  "시간대",
  "대표자 성함",
  "연락처",
  "메뉴명",
  "가격",
  "개수",
  "과팅여부",
  "인원수",
  "배정된 별칭",
  "매칭 상대",
  "관리",
] as const;
/** 표/CSV 모두 이 칸 수 기준으로 정렬 - 헤더가 바뀌면 여기도 같이 맞춰야 함 */
const COL_COUNT = HEADERS.length;

type DataRow = {
  kind: "data";
  key: string;
  seq: string;
  /** 첫 줄에서만 채워짐 - "취소" 버튼이 어느 예약을 가리키는지 */
  reservationId: string;
  date: string;
  time: string;
  representativeName: string;
  phone: string;
  menuName: string;
  price: string;
  quantity: string;
  /** "", "O", "O(남)", "O(여)", "X" */
  matching: string;
  headcount: string;
  alias: string;
  /** 짝지어진 상대 표시 (없으면 "") */
  pairedLabel: string;
};
type SpacerRow = { kind: "spacer"; key: string };
/** 예약(그룹) 하나가 끝날 때 그 예약의 주문액 합계를 보여주는 줄 */
type SubtotalRow = { kind: "subtotal"; key: string; label: string; amount: number };
/** 시간대/날짜/전체 단위 구분선 - 그 아래에 메뉴 집계가 이어짐 */
type DividerRow = { kind: "divider"; key: string; title: string };
/** 구분선 아래, 그 구간(시간대/날짜) 전체에서 팔린 메뉴별 집계 한 줄 */
type MenuSummaryRow = {
  kind: "menuSummary";
  key: string;
  menuName: string;
  quantity: number;
  amount: number;
};
/** 시간대/날짜 구간의 합계 줄 (메뉴 집계 바로 아래) */
type SectionTotalRow = { kind: "sectionTotal"; key: string; label: string; amount: number };
/** 맨 마지막, 기간 전체 매출 한 줄 */
type GrandTotalRow = { kind: "grandTotal"; key: string; label: string; amount: number };

type Row =
  | DataRow
  | SpacerRow
  | SubtotalRow
  | DividerRow
  | MenuSummaryRow
  | SectionTotalRow
  | GrandTotalRow;

const GENDER_SHORT: Record<"male" | "female", string> = {
  male: "남",
  female: "여",
};

function matchingLabel(r: Reservation): string {
  if (!r.matching) return "X";
  return r.matchingGender ? `O(${GENDER_SHORT[r.matchingGender]})` : "O";
}

/** "1부 11:00~11:50"에서 정렬용 시작 시각("11:00")만 뽑음 - 라벨 문자열 순서(1부/10부/2부)로
 *  잘못 정렬되는 걸 막기 위해 실제 시각으로 비교한다 */
function parseStartTime(time: string): string {
  const m = /(\d{2}:\d{2})~/.exec(time);
  return m ? m[1] : time;
}

/** 같은 주점/날짜/시간대(=슬롯) 안에서, 서로 짝지어진 두 예약을 나란히 붙이고
 *  그 외엔 createdAt 순서를 그대로 유지한다. 짝의 위치는 둘 중 먼저 접수된 쪽 기준. */
function buildOrderGroups(bucket: Reservation[]): Reservation[][] {
  const byId = new Map(bucket.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const groups: { members: Reservation[]; sortKey: string }[] = [];

  for (const r of bucket) {
    if (seen.has(r.id)) continue;
    const partner = r.pairedWith ? byId.get(r.pairedWith) : undefined;
    if (partner && !seen.has(partner.id)) {
      const [first, second] =
        r.createdAt <= partner.createdAt ? [r, partner] : [partner, r];
      groups.push({ members: [first, second], sortKey: first.createdAt });
      seen.add(r.id);
      seen.add(partner.id);
    } else {
      groups.push({ members: [r], sortKey: r.createdAt });
      seen.add(r.id);
    }
  }

  groups.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return groups.map((g) => g.members);
}

/** 예약 목록(항상 주점 하나로 한정된 상태)에서 팔린 메뉴별 수량/금액을 집계 */
function aggregateMenus(
  reservations: Reservation[],
): { menuName: string; quantity: number; amount: number }[] {
  const map = new Map<string, { quantity: number; amount: number }>();
  for (const r of reservations) {
    for (const item of r.orderItems) {
      const key = item.menuName;
      const cur = map.get(key) ?? { quantity: 0, amount: 0 };
      cur.quantity += item.quantity;
      cur.amount += item.unitPrice * item.quantity;
      map.set(key, cur);
    }
  }
  return Array.from(map.entries())
    .map(([menuName, v]) => ({ menuName, ...v }))
    .sort((a, b) => b.amount - a.amount);
}

function sumMenuAmount(reservations: Reservation[]): number {
  return reservations.reduce((sum, r) => sum + r.menuAmount, 0);
}

/**
 * 확정(승인)된 예약을 날짜 → 시간대(부) → 접수 순서(짝은 서로 붙여서)로 묶어 표로 만든다.
 * 각 예약 블록 끝에 그 예약의 주문액 소계, 각 시간대가 끝나면 그 시간대 전체 메뉴 집계,
 * 각 날짜가 끝나면 그 날짜 전체 메뉴 집계, 맨 끝에 기간 전체 매출을 붙인다.
 *
 * grandTotal은 날짜/시간대 필터로 화면에 좁혀 보여주는 것과 별개로, 그 주점의 전체
 * 기간 매출을 그대로 보여줘야 해서 filtered가 아니라 필터링 이전 값을 따로 받는다.
 */
function buildRows(filtered: Reservation[], boothLabel: string, grandTotal: number): Row[] {
  const rows: Row[] = [];
  let seq = 0;

  const byDate = new Map<string, Reservation[]>();
  for (const r of filtered) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date)!.push(r);
  }
  const dates = Array.from(byDate.keys()).sort();

  dates.forEach((date) => {
    const dateReservations = byDate.get(date)!;
    const byTime = new Map<string, Reservation[]>();
    for (const r of dateReservations) {
      if (!byTime.has(r.time)) byTime.set(r.time, []);
      byTime.get(r.time)!.push(r);
    }
    const times = Array.from(byTime.keys()).sort((a, b) =>
      parseStartTime(a).localeCompare(parseStartTime(b)),
    );

    times.forEach((time) => {
      const bucket = byTime.get(time)!;
      const groups = buildOrderGroups(bucket);

      groups.forEach((members) => {
        members.forEach((r) => {
          seq += 1;
          const currentSeq = seq;
          const items = r.orderItems.length > 0 ? r.orderItems : [null];
          const partner = r.pairedWith
            ? bucket.find((o) => o.id === r.pairedWith)
            : undefined;
          items.forEach((item, ii) => {
            const first = ii === 0;
            rows.push({
              kind: "data",
              key: `${r.id}-${ii}`,
              seq: first ? `#${currentSeq}` : "",
              reservationId: first ? r.id : "",
              date: first ? r.date : "",
              time: first ? r.time : "",
              representativeName: first ? r.representativeName : "",
              phone: first ? r.phone : "",
              menuName: item ? item.menuName : "-",
              price: item ? `${item.unitPrice.toLocaleString()}원` : "",
              quantity: item ? String(item.quantity) : "",
              matching: first ? matchingLabel(r) : "",
              headcount: first ? `${r.headcount}명` : "",
              alias: first ? (r.assignedAlias ?? "-") : "",
              pairedLabel: first && partner ? `🔗 ${partner.representativeName}` : "",
            });
          });
          rows.push({
            kind: "subtotal",
            key: `subtotal-${r.id}`,
            label: `${r.representativeName} 소계`,
            amount: r.menuAmount,
          });
          rows.push({ kind: "spacer", key: `sp-${r.id}` });
        });
      });

      const timeMenus = aggregateMenus(bucket);
      rows.push({
        kind: "divider",
        key: `div-time-${date}-${time}`,
        title: `${date} ${time} · 전체 메뉴`,
      });
      timeMenus.forEach((m) =>
        rows.push({
          kind: "menuSummary",
          key: `menu-${date}-${time}-${m.menuName}`,
          menuName: m.menuName,
          quantity: m.quantity,
          amount: m.amount,
        }),
      );
      rows.push({
        kind: "sectionTotal",
        key: `total-time-${date}-${time}`,
        label: `${time} 합계`,
        amount: sumMenuAmount(bucket),
      });
      rows.push({ kind: "spacer", key: `sp-time-${date}-${time}` });
    });

    const dateMenus = aggregateMenus(dateReservations);
    rows.push({ kind: "divider", key: `div-date-${date}`, title: `${date} · 전체 메뉴` });
    dateMenus.forEach((m) =>
      rows.push({
        kind: "menuSummary",
        key: `menu-date-${date}-${m.menuName}`,
        menuName: m.menuName,
        quantity: m.quantity,
        amount: m.amount,
      }),
    );
    rows.push({
      kind: "sectionTotal",
      key: `total-date-${date}`,
      label: `${date} 합계`,
      amount: sumMenuAmount(dateReservations),
    });
    rows.push({ kind: "spacer", key: `sp-date-${date}` });
  });

  rows.push({ kind: "divider", key: "div-grand", title: `${boothLabel} 총 매출` });
  rows.push({
    kind: "grandTotal",
    key: "grand-total",
    label: `${boothLabel} 총 매출`,
    amount: grandTotal,
  });

  return rows;
}

/**
 * 대표자 성함 등은 예약자가 자유롭게 입력한 값이라, "=1+1"이나 "@SUM(...)"처럼 셀 앞에
 * 수식 트리거 문자(=,+,-,@)로 시작하는 값을 넣으면 엑셀/시트에서 열 때 수식으로 실행될 수
 * 있음(CSV Injection) - 그런 값은 앞에 어포스트로피를 붙여 텍스트로 강제한다.
 */
function csvField(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function csvRow(cells: string[]): string {
  return cells.map(csvField).join(",");
}

function rowsToCsv(rows: Row[]): string {
  const lines = [HEADERS.map(csvField).join(",")];
  for (const row of rows) {
    switch (row.kind) {
      case "spacer":
        lines.push("");
        break;
      case "data":
        lines.push(
          csvRow([
            row.seq,
            row.date,
            row.time,
            row.representativeName,
            row.phone,
            row.menuName,
            row.price,
            row.quantity,
            row.matching,
            row.headcount,
            row.alias === "-" ? "" : row.alias,
            row.pairedLabel,
            "",
          ]),
        );
        break;
      case "subtotal":
      case "sectionTotal":
        lines.push(csvRow(["", "", "", "", "", row.label, `${row.amount.toLocaleString()}원`]));
        break;
      case "divider":
        lines.push(csvRow([`== ${row.title} ==`]));
        break;
      case "menuSummary":
        lines.push(
          csvRow(["", "", "", "", "", row.menuName, `${row.amount.toLocaleString()}원`, String(row.quantity)]),
        );
        break;
      case "grandTotal":
        lines.push(csvRow(["", "", "", "", "", row.label, `${row.amount.toLocaleString()}원`]));
        break;
    }
  }
  // 엑셀 한글 깨짐 방지용 BOM
  return "﻿" + lines.join("\r\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 소계/합계류 줄 공통 렌더링 - 라벨은 "메뉴명" 칸 앞까지, 금액은 "가격" 칸에 맞춘다 */
function TotalLikeRow({
  label,
  amount,
  emphasis,
}: {
  label: string;
  amount: number;
  emphasis?: boolean;
}) {
  const textCls = emphasis
    ? "text-sm font-bold text-neutral-900 dark:text-neutral-100"
    : "text-xs font-semibold text-neutral-600 dark:text-neutral-300";
  return (
    <>
      <td colSpan={6} className={`px-4 py-2 text-right ${textCls}`}>
        {label}
      </td>
      <td className={`px-4 py-2 text-right tabular-nums ${textCls}`}>
        {amount.toLocaleString()}원
      </td>
      {Array.from({ length: COL_COUNT - 7 }).map((_, i) => (
        <td key={i} className="px-4 py-2" />
      ))}
    </>
  );
}

export function OrderHistoryPanel() {
  const { state, dispatch } = useAdminStore();
  const [boothFilter, setBoothFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);

  const approved = useMemo(
    () => state.reservations.filter((r) => r.status === "approved"),
    [state.reservations],
  );

  const boothOptions = useMemo(() => {
    const map = new Map<string, string>();
    approved.forEach((r) => map.set(r.boothId, r.boothName));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [approved]);

  // "전체 주점"은 없애고 주점 하나를 콕 찝어서만 보게 함 - 아직 안 골랐으면 첫 번째 주점으로
  const selectedBoothId = boothFilter || boothOptions[0]?.[0] || "";
  const boothLabel = boothOptions.find(([id]) => id === selectedBoothId)?.[1] ?? "주점";

  const boothScoped = useMemo(
    () => approved.filter((r) => r.boothId === selectedBoothId),
    [approved, selectedBoothId],
  );

  const dateOptions = useMemo(
    () => Array.from(new Set(boothScoped.map((r) => r.date))).sort(),
    [boothScoped],
  );
  const timeOptions = useMemo(
    () =>
      Array.from(new Set(boothScoped.map((r) => r.time))).sort((a, b) =>
        parseStartTime(a).localeCompare(parseStartTime(b)),
      ),
    [boothScoped],
  );

  const filtered = useMemo(
    () =>
      boothScoped.filter(
        (r) =>
          (dateFilter === "all" || r.date === dateFilter) &&
          (timeFilter === "all" || r.time === timeFilter),
      ),
    [boothScoped, dateFilter, timeFilter],
  );

  const grandTotal = useMemo(() => sumMenuAmount(boothScoped), [boothScoped]);

  const rows = useMemo(
    () => buildRows(filtered, boothLabel, grandTotal),
    [filtered, boothLabel, grandTotal],
  );

  const byReservationId = useMemo(
    () => new Map(filtered.map((r) => [r.id, r])),
    [filtered],
  );

  function handleCancelled(id: string) {
    dispatch({ type: "reservations/reject", payload: { id } });
    setCancelTarget(null);
  }

  function handleBoothChange(id: string) {
    setBoothFilter(id);
    setDateFilter("all");
    setTimeFilter("all");
  }

  function handleExport() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    downloadCsv(`주문내역_${boothLabel}_${today}.csv`, rowsToCsv(rows));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          확정된 주문 {filtered.length}건 (날짜 → 시간대 → 접수 순)
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" onClick={handleExport} disabled={filtered.length === 0}>
            CSV 내보내기
          </Button>
          <label className="flex shrink-0 items-center gap-2">
            <Label className="shrink-0 whitespace-nowrap">주점</Label>
            <Select
              className="w-40"
              value={selectedBoothId}
              onChange={(e) => handleBoothChange(e.target.value)}
            >
              {boothOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex shrink-0 items-center gap-2">
            <Label className="shrink-0 whitespace-nowrap">날짜</Label>
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
          </label>
          <label className="flex shrink-0 items-center gap-2">
            <Label className="shrink-0 whitespace-nowrap">시간대</Label>
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
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState>확정된 주문이 없습니다.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="border-b border-black/5 text-xs text-neutral-500 dark:border-white/5 dark:text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-medium">순번</th>
                  <th className="px-4 py-3 font-medium">날짜</th>
                  <th className="px-4 py-3 font-medium">시간대</th>
                  <th className="px-4 py-3 font-medium">대표자 성함</th>
                  <th className="px-4 py-3 font-medium">연락처</th>
                  <th className="px-4 py-3 font-medium">메뉴명</th>
                  <th className="px-4 py-3 text-right font-medium">가격</th>
                  <th className="px-4 py-3 text-right font-medium">개수</th>
                  <th className="px-4 py-3 font-medium">과팅여부</th>
                  <th className="px-4 py-3 font-medium">인원수(N인 테이블)</th>
                  <th className="px-4 py-3 font-medium">배정된 별칭</th>
                  <th className="px-4 py-3 font-medium">매칭 상대</th>
                  <th className="px-4 py-3 font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  if (row.kind === "spacer") {
                    return (
                      <tr
                        key={row.key}
                        aria-hidden
                        className="border-b border-black/5 last:border-0 dark:border-white/5"
                      >
                        {Array.from({ length: COL_COUNT }).map((_, i) => (
                          <td key={i} className="px-4 py-2.5">
                            &nbsp;
                          </td>
                        ))}
                      </tr>
                    );
                  }

                  if (row.kind === "divider") {
                    return (
                      <tr key={row.key} className="bg-amber-500/10 dark:bg-amber-500/[0.08]">
                        <td
                          colSpan={COL_COUNT}
                          className="px-4 py-2 text-xs font-bold tracking-wide text-amber-700 dark:text-amber-400"
                        >
                          {row.title}
                        </td>
                      </tr>
                    );
                  }

                  if (row.kind === "subtotal") {
                    return (
                      <tr
                        key={row.key}
                        className="border-b border-black/5 bg-black/[0.015] last:border-0 dark:border-white/5 dark:bg-white/[0.02]"
                      >
                        <TotalLikeRow label={row.label} amount={row.amount} />
                      </tr>
                    );
                  }

                  if (row.kind === "sectionTotal") {
                    return (
                      <tr
                        key={row.key}
                        className="border-b border-black/5 bg-black/[0.03] last:border-0 dark:border-white/5 dark:bg-white/[0.04]"
                      >
                        <TotalLikeRow label={row.label} amount={row.amount} emphasis />
                      </tr>
                    );
                  }

                  if (row.kind === "menuSummary") {
                    return (
                      <tr
                        key={row.key}
                        className="border-b border-black/5 bg-black/[0.015] last:border-0 dark:border-white/5 dark:bg-white/[0.02]"
                      >
                        <td colSpan={5} />
                        <td className="px-4 py-2 text-xs text-neutral-600 dark:text-neutral-300">
                          {row.menuName}
                        </td>
                        <td className="px-4 py-2 text-right text-xs tabular-nums text-neutral-600 dark:text-neutral-300">
                          {row.amount.toLocaleString()}원
                        </td>
                        <td className="px-4 py-2 text-right text-xs tabular-nums text-neutral-600 dark:text-neutral-300">
                          {row.quantity}
                        </td>
                        <td colSpan={COL_COUNT - 8} />
                      </tr>
                    );
                  }

                  if (row.kind === "grandTotal") {
                    return (
                      <tr
                        key={row.key}
                        className="border-b-2 border-amber-500/40 bg-amber-500/15 last:border-0 dark:bg-amber-500/10"
                      >
                        <TotalLikeRow label={row.label} amount={row.amount} emphasis />
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={row.key}
                      className="border-b border-black/5 last:border-0 dark:border-white/5"
                    >
                      <td className="px-4 py-2.5 font-mono font-medium text-neutral-900 dark:text-neutral-100">
                        {row.seq}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-neutral-700 dark:text-neutral-200">
                        {row.date}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-neutral-700 dark:text-neutral-200">
                        {row.time}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-200">
                        {row.representativeName}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-neutral-700 dark:text-neutral-200">
                        {row.phone}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-200">
                        {row.menuName}
                      </td>
                      <td className="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-200">
                        {row.price}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-700 dark:text-neutral-200">
                        {row.quantity}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.matching === "" ? null : (
                          <Badge tone={row.matching.startsWith("O") ? "purple" : "neutral"}>
                            {row.matching}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-200">
                        {row.headcount}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.alias === "" ? null : row.alias === "-" ? (
                          <span className="text-neutral-400 dark:text-neutral-500">-</span>
                        ) : (
                          <Badge tone="amber">{row.alias}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.pairedLabel === "" ? null : (
                          <Badge tone="sky">{row.pairedLabel}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.reservationId !== "" && (
                          <Button
                            variant="danger"
                            onClick={() => {
                              const target = byReservationId.get(row.reservationId);
                              if (target) setCancelTarget(target);
                            }}
                          >
                            취소
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        승인된 예약만 날짜 → 시간대 → 접수 순서(짝지어진 두 팀은 서로 붙여서)로 표시됩니다.
        예약마다 끝에 주문액 소계, 시간대·날짜가 끝날 때마다 그 구간 전체 메뉴 집계, 맨
        아래에 기간 전체 매출을 보여줍니다. CSV도 같은 구성으로 내려받습니다.
      </p>

      <Modal open={cancelTarget !== null} onClose={() => setCancelTarget(null)}>
        {cancelTarget && (
          <CancelOrderModal
            reservation={cancelTarget}
            onDone={() => handleCancelled(cancelTarget.id)}
            onCancel={() => setCancelTarget(null)}
          />
        )}
      </Modal>
    </div>
  );
}

/**
 * 확정된 주문(예약)을 취소하기 전에, 이미 환불을 진행했는지 다시 한번 확인시키는 모달.
 * 계좌/은행 복사와 주문서(영수증)를 보여줘 얼마를 어디로 환불했어야 하는지 헷갈리지 않게 하고,
 * 체크박스를 눌러야 "취소 처리" 버튼이 눌리게 해서 실수로 바로 취소되는 걸 막는다.
 */
function CancelOrderModal({
  reservation,
  onDone,
  onCancel,
}: {
  reservation: Reservation;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [refunded, setRefunded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!refunded) return;
    setBusy(true);
    setError(null);
    try {
      const result = await rejectReservationAction(reservation.id);
      if (!result.ok) throw new Error(result.error);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "취소 처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
        주문 취소
      </h2>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        환불을 먼저 진행한 뒤, 아래 체크박스를 눌러야 &quot;취소 처리&quot; 버튼이 활성화됩니다.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CopyButton
          text={`${reservation.bank} ${reservation.accountNumber}`}
          label="계좌·은행 복사"
        />
      </div>

      <div className="mt-3">
        <ReservationDetails reservation={reservation} defaultOpen />
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-black/10 p-3 dark:border-white/10">
        <Checkbox checked={refunded} onChange={() => setRefunded((v) => !v)} />
        <span className="text-sm text-neutral-700 dark:text-neutral-200">
          {reservation.representativeName}님의 {reservation.bank} {reservation.accountNumber}{" "}
          계좌로 {reservation.totalAmount.toLocaleString()}원 환불을 완료했습니다.
        </span>
      </label>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          닫기
        </Button>
        <Button variant="danger" onClick={confirm} disabled={!refunded || busy}>
          {busy ? "처리 중..." : "취소 처리"}
        </Button>
      </div>
    </div>
  );
}
