"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "../../../_lib/store";
import type { Reservation } from "../../../_lib/types";
import { Badge, Button, Card, EmptyState, Label, Select } from "../../ui";

const HEADERS = [
  "순번",
  "대표자 성함",
  "연락처",
  "메뉴명",
  "가격",
  "개수",
  "과팅여부",
  "인원수",
  "배정된 별칭",
] as const;

type DataRow = {
  kind: "data";
  key: string;
  seq: string;
  representativeName: string;
  phone: string;
  menuName: string;
  price: string;
  quantity: string;
  /** "", "O", "O(남)", "O(여)", "X" */
  matching: string;
  headcount: string;
  alias: string;
};
type SpacerRow = { kind: "spacer"; key: string };
type Row = DataRow | SpacerRow;

const GENDER_SHORT: Record<"male" | "female", string> = {
  male: "남",
  female: "여",
};

function matchingLabel(r: Reservation): string {
  if (!r.matching) return "X";
  return r.matchingGender ? `O(${GENDER_SHORT[r.matchingGender]})` : "O";
}

/** 확정(승인)된 예약을 접수 순서대로, 메뉴 한 줄씩 펼쳐서 표로 만든다. 주문끼리는 빈 행으로 구분 */
function buildRows(reservations: Reservation[]): Row[] {
  const rows: Row[] = [];
  reservations.forEach((r, ri) => {
    const items = r.orderItems.length > 0 ? r.orderItems : [null];
    items.forEach((item, ii) => {
      const first = ii === 0;
      rows.push({
        kind: "data",
        key: `${r.id}-${ii}`,
        seq: first ? `#${ri + 1}` : "",
        representativeName: first ? r.representativeName : "",
        phone: first ? r.phone : "",
        menuName: item ? item.menuName : "-",
        price: item ? `${item.unitPrice.toLocaleString()}원` : "",
        quantity: item ? String(item.quantity) : "",
        matching: first ? matchingLabel(r) : "",
        headcount: first ? `${r.headcount}명` : "",
        alias: first ? (r.assignedAlias ?? "-") : "",
      });
    });
    if (ri < reservations.length - 1) rows.push({ kind: "spacer", key: `sp-${r.id}` });
  });
  return rows;
}

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function rowsToCsv(rows: Row[]): string {
  const lines = [HEADERS.map(csvField).join(",")];
  for (const row of rows) {
    if (row.kind === "spacer") {
      lines.push("");
      continue;
    }
    lines.push(
      [
        row.seq,
        row.representativeName,
        row.phone,
        row.menuName,
        row.price,
        row.quantity,
        row.matching,
        row.headcount,
        row.alias === "-" ? "" : row.alias,
      ]
        .map(csvField)
        .join(","),
    );
  }
  // 엑셀 한글 깨짐 방지용 BOM
  return "\uFEFF" + lines.join("\r\n");
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

export function OrderHistoryPanel() {
  const { state } = useAdminStore();
  const [boothFilter, setBoothFilter] = useState<string>("all");

  const approved = useMemo(
    () => state.reservations.filter((r) => r.status === "approved"),
    [state.reservations],
  );

  const boothOptions = useMemo(() => {
    const map = new Map<string, string>();
    approved.forEach((r) => map.set(r.boothId, r.boothName));
    return Array.from(map.entries());
  }, [approved]);

  const ordered = useMemo(
    () =>
      approved
        .filter((r) => boothFilter === "all" || r.boothId === boothFilter)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [approved, boothFilter],
  );

  const rows = useMemo(() => buildRows(ordered), [ordered]);

  function handleExport() {
    const boothLabel =
      boothFilter === "all"
        ? "전체"
        : (boothOptions.find(([id]) => id === boothFilter)?.[1] ?? "주점");
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    downloadCsv(`주문내역_${boothLabel}_${today}.csv`, rowsToCsv(rows));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          확정된 주문 {ordered.length}건 (접수 순)
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={ordered.length === 0}
          >
            CSV 내보내기
          </Button>
          <label className="flex shrink-0 items-center gap-2">
            <Label className="shrink-0 whitespace-nowrap">주점</Label>
            <Select
              className="w-44"
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
          </label>
        </div>
      </div>

      {ordered.length === 0 ? (
        <EmptyState>확정된 주문이 없습니다.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-black/5 text-xs text-neutral-500 dark:border-white/5 dark:text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-medium">순번</th>
                  <th className="px-4 py-3 font-medium">대표자 성함</th>
                  <th className="px-4 py-3 font-medium">연락처</th>
                  <th className="px-4 py-3 font-medium">메뉴명</th>
                  <th className="px-4 py-3 text-right font-medium">가격</th>
                  <th className="px-4 py-3 text-right font-medium">개수</th>
                  <th className="px-4 py-3 font-medium">과팅여부</th>
                  <th className="px-4 py-3 font-medium">인원수(N인 테이블)</th>
                  <th className="px-4 py-3 font-medium">배정된 별칭</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) =>
                  row.kind === "spacer" ? (
                    <tr
                      key={row.key}
                      aria-hidden
                      className="border-b border-black/5 last:border-0 dark:border-white/5"
                    >
                      {Array.from({ length: 9 }).map((_, i) => (
                        <td key={i} className="px-4 py-2.5">
                          &nbsp;
                        </td>
                      ))}
                    </tr>
                  ) : (
                    <tr
                      key={row.key}
                      className="border-b border-black/5 last:border-0 dark:border-white/5"
                    >
                      <td className="px-4 py-2.5 font-mono font-medium text-neutral-900 dark:text-neutral-100">
                        {row.seq}
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
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        승인된 예약만 접수된 순서대로 표시됩니다. 한 주문에 메뉴가 여러 개면 줄을 나눠
        표시하고, 주문끼리는 빈 줄로 구분합니다. CSV도 같은 구성으로 내려받습니다.
      </p>
    </div>
  );
}
