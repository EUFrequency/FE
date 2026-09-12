"use client";

import { useState } from "react";
import { createId } from "../../_lib/id";
import { formatPhoneInput } from "@/lib/phone";
import { resizeImageFile, resizeImageFiles } from "../../_lib/files";
import type { AdminBooth, MenuItem, TableConfig, TimeSlot } from "../../_lib/types";
import { AccountManager } from "../AccountManager";
import { Button, Input, Label, Textarea } from "../ui";

const MAX_DESCRIPTION_IMAGES = 5;
const MAX_MENUS = 8;

type Props = {
  initial: AdminBooth | null;
  /** 이 주점의 과팅 별칭 풀 (boothAliases 컬렉션에서 별도로 불러온 값) */
  initialAliasPool: string[];
  onCancel: () => void;
  onSubmit: (booth: AdminBooth, aliasPool: string[]) => Promise<void>;
};

function emptyMenu(): MenuItem {
  return { id: createId("menu"), name: "", description: "", price: 0, image: "" };
}

function defaultTables(): TableConfig[] {
  return [
    { id: createId("table"), capacity: 4, count: 0, forMatching: false },
    { id: createId("table"), capacity: 6, count: 0, forMatching: false },
    { id: createId("table"), capacity: 4, count: 0, forMatching: true },
  ];
}

function defaultTimeSlots(): TimeSlot[] {
  return [
    { id: createId("slot"), label: "1부", startTime: "11:00", endTime: "11:50" },
    { id: createId("slot"), label: "2부", startTime: "12:00", endTime: "12:50" },
  ];
}

export function BoothForm({ initial, initialAliasPool, onCancel, onSubmit }: Props) {
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [ownerName, setOwnerName] = useState(initial?.ownerName ?? "");
  const [ownerPhone, setOwnerPhone] = useState(initial?.ownerPhone ?? "");
  const [descriptionText, setDescriptionText] = useState(
    initial?.descriptionText ?? "",
  );
  const [descriptionImages, setDescriptionImages] = useState<string[]>(
    initial?.descriptionImages ?? [],
  );
  const [menus, setMenus] = useState<MenuItem[]>(
    initial?.menus.length ? initial.menus : [emptyMenu()],
  );
  const [minOrder, setMinOrder] = useState(initial?.minOrder ?? 0);
  const [tables, setTables] = useState<TableConfig[]>(
    initial?.tables.length ? initial.tables : defaultTables(),
  );
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(
    initial?.timeSlots.length ? initial.timeSlots : defaultTimeSlots(),
  );
  const [accountId, setAccountId] = useState<string | null>(initial?.accountId ?? null);
  const [aliasPool, setAliasPool] = useState<string[]>(initialAliasPool);
  const [aliasInput, setAliasInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validMenus = menus.filter((m) => m.name.trim() && m.price > 0);
  // 매칭 전용 테이블은 양 팀으로 반씩 나눠야 해서 홀수 정원이면 저장을 막음
  const hasOddMatchingTable = tables.some(
    (t) => t.forMatching && t.capacity > 0 && t.capacity % 2 !== 0,
  );
  const validTimeSlots = timeSlots.filter(
    (t) => t.label.trim() && t.startTime && t.endTime,
  );
  const hasInvalidTimeRange = validTimeSlots.some((t) => t.endTime <= t.startTime);
  const valid =
    department.trim() &&
    name.trim() &&
    ownerName.trim() &&
    descriptionText.trim() &&
    minOrder > 0 &&
    validMenus.length > 0 &&
    !hasOddMatchingTable &&
    validTimeSlots.length > 0 &&
    !hasInvalidTimeRange;

  async function handleDescriptionImages(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const remaining = MAX_DESCRIPTION_IMAGES - descriptionImages.length;
    if (remaining <= 0) return;
    setUploading(true);
    try {
      const urls = await resizeImageFiles(Array.from(fileList).slice(0, remaining));
      setDescriptionImages((prev) => [...prev, ...urls].slice(0, MAX_DESCRIPTION_IMAGES));
    } finally {
      setUploading(false);
    }
  }

  function addAlias() {
    const value = aliasInput.trim();
    if (!value) return;
    setAliasPool((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setAliasInput("");
  }

  async function handleMenuImage(menuId: string, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const url = await resizeImageFile(file);
    setMenus((prev) => prev.map((m) => (m.id === menuId ? { ...m, image: url } : m)));
  }

  async function submit() {
    if (!valid || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(
        {
          id: initial?.id ?? createId("booth"),
          department: department.trim(),
          name: name.trim(),
          ownerName: ownerName.trim(),
          ownerPhone: ownerPhone.trim() ? ownerPhone.trim() : null,
          descriptionText: descriptionText.trim(),
          descriptionImages,
          menus: validMenus,
          minOrder: Number(minOrder),
          tables: tables.filter((t) => t.capacity > 0),
          timeSlots: validTimeSlots,
          accountId,
          createdAt: initial?.createdAt ?? new Date().toISOString(),
        },
        aliasPool,
      );
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex max-h-[85vh] flex-col">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/5">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {initial ? "주점 정보 수정" : "새 주점 등록"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="grid h-8 w-8 place-items-center rounded-full text-neutral-500 transition hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <Label>학과/동아리</Label>
          <Input
            className="mt-1.5"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="경영학과"
          />
        </label>
        <label className="block">
          <Label>주점 이름</Label>
          <Input
            className="mt-1.5"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="사장님 주점"
          />
        </label>
        <label className="block">
          <Label>대표자 이름</Label>
          <Input
            className="mt-1.5"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="홍길동"
          />
        </label>
        <label className="block">
          <Label hint="(선택)">대표자 연락처</Label>
          <Input
            className="mt-1.5"
            value={ownerPhone}
            onChange={(e) => setOwnerPhone(formatPhoneInput(e.target.value))}
            placeholder="010-1234-5678"
          />
        </label>
        <label className="block">
          <Label>최소 주문금액 (원)</Label>
          <Input
            className="mt-1.5"
            type="number"
            min={0}
            value={minOrder}
            onChange={(e) => setMinOrder(Number(e.target.value))}
          />
        </label>
      </div>

      {/* 설명 */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <Label>설명</Label>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            이미지 {descriptionImages.length}/{MAX_DESCRIPTION_IMAGES}
          </span>
        </div>
        <Textarea
          className="mt-1.5"
          rows={3}
          value={descriptionText}
          onChange={(e) => setDescriptionText(e.target.value)}
          placeholder="주점 소개 문구를 입력하세요."
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {descriptionImages.map((src, i) => (
            <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() =>
                  setDescriptionImages((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-xs text-white opacity-0 transition group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
          {descriptionImages.length < MAX_DESCRIPTION_IMAGES && (
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-black/15 text-xs text-neutral-400 transition hover:border-amber-500/50 dark:border-white/15">
              {uploading ? "처리 중" : "+ 이미지"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleDescriptionImages(e.target.files)}
              />
            </label>
          )}
        </div>
      </div>

      {/* 메뉴 정보 */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <Label>메뉴 정보 ({menus.length}/{MAX_MENUS})</Label>
          <Button
            variant="secondary"
            type="button"
            disabled={menus.length >= MAX_MENUS}
            onClick={() => setMenus((prev) => [...prev, emptyMenu()])}
          >
            + 메뉴 추가
          </Button>
        </div>
        <div className="mt-2 space-y-3">
          {menus.map((menu, i) => (
            <div
              key={menu.id}
              className="grid grid-cols-1 gap-2 rounded-lg border border-black/10 p-3 sm:grid-cols-[64px_1fr_1fr_120px_36px] sm:items-center dark:border-white/10"
            >
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-black/15 text-[11px] text-neutral-400 dark:border-white/15">
                {menu.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={menu.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  "이미지"
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleMenuImage(menu.id, e.target.files)}
                />
              </label>
              <Input
                value={menu.name}
                placeholder="메뉴 이름"
                onChange={(e) =>
                  setMenus((prev) =>
                    prev.map((m) => (m.id === menu.id ? { ...m, name: e.target.value } : m)),
                  )
                }
              />
              <Input
                value={menu.description}
                placeholder="메뉴 설명"
                onChange={(e) =>
                  setMenus((prev) =>
                    prev.map((m) =>
                      m.id === menu.id ? { ...m, description: e.target.value } : m,
                    ),
                  )
                }
              />
              <Input
                type="number"
                min={0}
                value={menu.price}
                placeholder="가격"
                onChange={(e) =>
                  setMenus((prev) =>
                    prev.map((m) =>
                      m.id === menu.id ? { ...m, price: Number(e.target.value) } : m,
                    ),
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  setMenus((prev) =>
                    prev.length > 1 ? prev.filter((m) => m.id !== menu.id) : prev,
                  )
                }
                disabled={menus.length <= 1}
                className="grid h-9 w-9 place-items-center rounded-lg text-neutral-400 transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-30"
                aria-label={`메뉴 ${i + 1} 삭제`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 테이블 정보 */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <Label hint="(매칭 전용 = 과팅 예약만, 일반 = 과팅 아닌 예약만 앉음)">
            테이블 정보
          </Label>
          <Button
            variant="secondary"
            type="button"
            onClick={() =>
              setTables((prev) => [
                ...prev,
                { id: createId("table"), capacity: 0, count: 0, forMatching: false },
              ])
            }
          >
            + 테이블 종류 추가
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {tables.map((t) => {
            const oddMatching = t.forMatching && t.capacity > 0 && t.capacity % 2 !== 0;
            return (
            <div key={t.id} className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  value={t.capacity}
                  onChange={(e) =>
                    setTables((prev) =>
                      prev.map((x) =>
                        x.id === t.id ? { ...x, capacity: Number(e.target.value) } : x,
                      ),
                    )
                  }
                  className="w-20"
                />
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  인
                </span>
              </div>
              <select
                value={t.forMatching ? "matching" : "general"}
                onChange={(e) =>
                  setTables((prev) =>
                    prev.map((x) =>
                      x.id === t.id
                        ? { ...x, forMatching: e.target.value === "matching" }
                        : x,
                    ),
                  )
                }
                className="h-9 rounded-lg border border-black/10 bg-white px-2 text-sm text-neutral-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-100"
              >
                <option value="general">일반</option>
                <option value="matching">매칭 전용</option>
              </select>
              {t.forMatching && t.capacity > 0 && (
                <span
                  className={`text-xs ${oddMatching ? "font-medium text-red-500" : "text-neutral-400 dark:text-neutral-500"}`}
                >
                  {oddMatching
                    ? "짝수 인원이어야 해요"
                    : `→ ${t.capacity / 2}인 : ${t.capacity / 2}인 매칭`}
                </span>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setTables((prev) =>
                      prev.map((x) =>
                        x.id === t.id ? { ...x, count: Math.max(0, x.count - 1) } : x,
                      ),
                    )
                  }
                  className="grid h-9 w-9 place-items-center rounded-lg border border-black/10 text-amber-600 dark:border-white/10 dark:text-amber-400"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-medium tabular-nums">
                  {t.count}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setTables((prev) =>
                      prev.map((x) => (x.id === t.id ? { ...x, count: x.count + 1 } : x)),
                    )
                  }
                  className="grid h-9 w-9 place-items-center rounded-lg border border-black/10 text-amber-600 dark:border-white/10 dark:text-amber-400"
                >
                  +
                </button>
              </div>
              <span className="text-sm text-neutral-400 dark:text-neutral-500">개</span>
              <button
                type="button"
                onClick={() => setTables((prev) => prev.filter((x) => x.id !== t.id))}
                className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-neutral-400 transition hover:bg-red-500/10 hover:text-red-500"
                aria-label="테이블 종류 삭제"
              >
                ✕
              </button>
            </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
          매칭 전용 테이블의 인원수는 <b className="font-medium">양 팀을 합친 정원</b>이에요.
          예를 들어 6인으로 등록하면 3인 팀 : 3인 팀이 매칭되는 테이블이라는 뜻이라, 예약자는
          3인으로 신청해야 이 테이블에 배정됩니다. 그래서 홀수 정원은 등록할 수 없어요.
        </p>
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
          각 테이블 종류마다 정원 외에 오버부킹 3팀까지 추가로 접수받습니다(매칭 전용은
          남·여 각각 3팀). 오버부킹 예약자에게는 &quot;앞선 예약 취소 시에만 이용 가능&quot;
          안내가 표시됩니다.
        </p>
      </div>

      {/* 시간대(부) 설정 */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <Label hint="(예: 1부 11:00~11:50 - 예약자는 이 중 하나를 골라 예약함)">
            시간대 설정
          </Label>
          <Button
            variant="secondary"
            type="button"
            onClick={() =>
              setTimeSlots((prev) => [
                ...prev,
                { id: createId("slot"), label: "", startTime: "", endTime: "" },
              ])
            }
          >
            + 시간대 추가
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {timeSlots.map((slot) => {
            const invalidRange =
              slot.startTime && slot.endTime && slot.endTime <= slot.startTime;
            return (
              <div key={slot.id} className="flex flex-wrap items-center gap-2">
                <Input
                  value={slot.label}
                  onChange={(e) =>
                    setTimeSlots((prev) =>
                      prev.map((x) =>
                        x.id === slot.id ? { ...x, label: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="1부"
                  className="w-20"
                />
                <Input
                  type="time"
                  value={slot.startTime}
                  onChange={(e) =>
                    setTimeSlots((prev) =>
                      prev.map((x) =>
                        x.id === slot.id ? { ...x, startTime: e.target.value } : x,
                      ),
                    )
                  }
                  className="w-32"
                />
                <span className="text-sm text-neutral-400 dark:text-neutral-500">~</span>
                <Input
                  type="time"
                  value={slot.endTime}
                  onChange={(e) =>
                    setTimeSlots((prev) =>
                      prev.map((x) =>
                        x.id === slot.id ? { ...x, endTime: e.target.value } : x,
                      ),
                    )
                  }
                  className="w-32"
                />
                {invalidRange && (
                  <span className="text-xs font-medium text-red-500">
                    종료 시간이 시작 시간보다 늦어야 해요
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setTimeSlots((prev) => prev.filter((x) => x.id !== slot.id))
                  }
                  className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-neutral-400 transition hover:bg-red-500/10 hover:text-red-500"
                  aria-label="시간대 삭제"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        {validTimeSlots.length === 0 && (
          <p className="mt-2 text-xs font-medium text-red-500">
            시간대를 하나 이상 등록해야 예약을 받을 수 있어요.
          </p>
        )}
      </div>

      {/* 과팅 별칭 풀 */}
      <div className="mt-6">
        <Label hint="(과팅 신청자에게 위에서부터 순서대로 겹치지 않게 배정됨)">
          과팅 별칭 풀
        </Label>
        <div className="mt-1.5 flex gap-2">
          <Input
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAlias();
              }
            }}
            placeholder="예: 체리"
          />
          <Button type="button" variant="secondary" onClick={addAlias}>
            추가
          </Button>
        </div>
        {aliasPool.length === 0 ? (
          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
            등록된 별칭이 없습니다. 별칭이 없으면 과팅 신청자에게 별칭이 배정되지 않습니다.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {aliasPool.map((alias, i) => (
              <span
                key={alias}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white py-1 pl-2 pr-1 text-sm text-neutral-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-100"
              >
                <span className="text-[10px] tabular-nums text-neutral-400 dark:text-neutral-500">
                  {i + 1}
                </span>
                {alias}
                <button
                  type="button"
                  onClick={() => setAliasPool((prev) => prev.filter((a) => a !== alias))}
                  className="grid h-5 w-5 place-items-center rounded-full text-neutral-400 transition hover:bg-red-500/10 hover:text-red-500"
                  aria-label={`${alias} 삭제`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 입금 계좌 */}
      <div className="mt-6">
        <AccountManager
          title="입금 계좌"
          selection={{ selectedAccountId: accountId, onSelect: setAccountId }}
        />
      </div>
      </div>

      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-black/5 px-5 py-4 dark:border-white/5">
        <span className="text-xs text-red-500">{submitError}</span>
        <div className="flex flex-shrink-0 gap-2">
          <Button variant="secondary" type="button" disabled={submitting} onClick={onCancel}>
            취소
          </Button>
          <Button variant="primary" type="button" disabled={!valid || submitting} onClick={submit}>
            {submitting ? "저장 중..." : initial ? "수정 저장" : "등록하기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
