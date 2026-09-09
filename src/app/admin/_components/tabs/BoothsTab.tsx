"use client";

import { useState } from "react";
import { useAdminStore } from "../../_lib/store";
import {
  deleteBoothAction,
  getBoothAction,
  listBoothsAction,
  saveBoothAction,
} from "../../_lib/booth-actions";
import type { AdminBooth } from "../../_lib/types";
import { Modal } from "../Modal";
import { Badge, Button, Card, EmptyState } from "../ui";
import { BoothForm } from "./BoothForm";

export function BoothsTab() {
  const { state, dispatch, boothsError } = useAdminStore();
  const [mode, setMode] = useState<"list" | "add" | AdminBooth>("list");
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const editing = typeof mode === "object" ? mode : null;
  const formOpen = mode === "add" || editing !== null;

  async function handleEdit(boothId: string) {
    setRowError(null);
    setLoadingEditId(boothId);
    try {
      const result = await getBoothAction(boothId);
      if (!result.ok) throw new Error(result.error);
      if (!result.data) throw new Error("주점을 찾을 수 없습니다.");
      setMode(result.data);
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "주점 정보를 불러오지 못했습니다.");
    } finally {
      setLoadingEditId(null);
    }
  }

  async function handleDelete(booth: AdminBooth) {
    if (!confirm(`'${booth.name}'을(를) 삭제할까요?`)) return;
    setRowError(null);
    setDeletingId(booth.id);
    try {
      const result = await deleteBoothAction(booth.id);
      if (!result.ok) throw new Error(result.error);
      dispatch({ type: "booths/delete", payload: { id: booth.id } });
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRefresh() {
    setRowError(null);
    setRefreshing(true);
    try {
      const result = await listBoothsAction();
      if (!result.ok) throw new Error(result.error);
      dispatch({ type: "booths/replaceAll", payload: result.data });
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "새로고침에 실패했습니다.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSubmit(booth: AdminBooth) {
    const result = await saveBoothAction(booth);
    if (!result.ok) throw new Error(result.error);
    dispatch({ type: editing ? "booths/update" : "booths/add", payload: booth });
    setMode("list");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          주점 등록
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "새로고침 중..." : "새로고침"}
          </Button>
          <Button variant="primary" onClick={() => setMode("add")}>
            + 새 주점 등록
          </Button>
        </div>
      </div>

      {boothsError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          <div className="font-semibold">Firebase 연동이 아직 설정되지 않았습니다.</div>
          <div className="mt-1 text-xs leading-5 opacity-90">{boothsError}</div>
        </div>
      )}
      {rowError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {rowError}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setMode("list")}>
        {formOpen && (
          <BoothForm
            key={editing?.id ?? "new"}
            initial={editing}
            onCancel={() => setMode("list")}
            onSubmit={handleSubmit}
          />
        )}
      </Modal>

      {state.booths.length === 0 ? (
        <EmptyState>등록된 주점이 없습니다.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {state.booths.map((booth) => {
            const tableTotal = booth.tables.reduce((s, t) => s + t.count, 0);
            return (
              <Card key={booth.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-amber-600 dark:text-amber-400">
                      {booth.department}
                    </div>
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {booth.name}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      {booth.ownerName}
                      {booth.ownerPhone ? ` · ${booth.ownerPhone}` : ""}
                    </div>
                  </div>
                  <Badge tone="amber">
                    최소 {booth.minOrder.toLocaleString()}원
                  </Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300">
                  {booth.descriptionText}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                  <span>메뉴 {booth.menus.length}개</span>
                  <span>테이블 {tableTotal}개</span>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    disabled={loadingEditId === booth.id}
                    onClick={() => handleEdit(booth.id)}
                  >
                    {loadingEditId === booth.id ? "불러오는 중..." : "수정"}
                  </Button>
                  <Button
                    variant="danger"
                    disabled={deletingId === booth.id}
                    onClick={() => handleDelete(booth)}
                  >
                    {deletingId === booth.id ? "삭제 중..." : "삭제"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
