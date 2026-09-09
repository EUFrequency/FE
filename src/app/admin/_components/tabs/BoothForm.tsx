"use client";

import { useState } from "react";
import { createId } from "../../_lib/id";
import { resizeImageFile, resizeImageFiles } from "../../_lib/files";
import type { AdminBooth, MenuItem, TableConfig } from "../../_lib/types";
import { Button, Input, Label, Textarea } from "../ui";

const MAX_DESCRIPTION_IMAGES = 5;
const MAX_MENUS = 8;

type Props = {
  initial: AdminBooth | null;
  onCancel: () => void;
  onSubmit: (booth: AdminBooth) => Promise<void>;
};

function emptyMenu(): MenuItem {
  return { id: createId("menu"), name: "", description: "", price: 0, image: "" };
}

function defaultTables(): TableConfig[] {
  return [
    { id: createId("table"), capacity: 2, count: 0 },
    { id: createId("table"), capacity: 4, count: 0 },
    { id: createId("table"), capacity: 6, count: 0 },
  ];
}

export function BoothForm({ initial, onCancel, onSubmit }: Props) {
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
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validMenus = menus.filter((m) => m.name.trim() && m.price > 0);
  const valid =
    department.trim() &&
    name.trim() &&
    ownerName.trim() &&
    descriptionText.trim() &&
    minOrder > 0 &&
    validMenus.length > 0;

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
      await onSubmit({
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
        createdAt: initial?.createdAt ?? new Date().toISOString(),
      });
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
            onChange={(e) => setOwnerPhone(e.target.value)}
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
          <Label>테이블 정보</Label>
          <Button
            variant="secondary"
            type="button"
            onClick={() =>
              setTables((prev) => [
                ...prev,
                { id: createId("table"), capacity: 0, count: 0 },
              ])
            }
          >
            + 테이블 종류 추가
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {tables.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
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
                  인 테이블
                </span>
              </div>
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
          ))}
        </div>
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
