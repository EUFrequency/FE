"use client";

import { useState } from "react";
import { useAdminStore } from "../../_lib/store";
import type { AdminBooth } from "../../_lib/types";
import { Modal } from "../Modal";
import { Badge, Button, Card, EmptyState } from "../ui";
import { BoothForm } from "./BoothForm";

export function BoothsTab() {
  const { state, dispatch } = useAdminStore();
  const [mode, setMode] = useState<"list" | "add" | AdminBooth>("list");

  const editing = typeof mode === "object" ? mode : null;
  const formOpen = mode === "add" || editing !== null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          주점 등록
        </h1>
        <Button variant="primary" onClick={() => setMode("add")}>
          + 새 주점 등록
        </Button>
      </div>

      <Modal open={formOpen} onClose={() => setMode("list")}>
        {formOpen && (
          <BoothForm
            key={editing?.id ?? "new"}
            initial={editing}
            onCancel={() => setMode("list")}
            onSubmit={(booth) => {
              dispatch({
                type: editing ? "booths/update" : "booths/add",
                payload: booth,
              });
              setMode("list");
            }}
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
                  <Button variant="secondary" onClick={() => setMode(booth)}>
                    수정
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(`'${booth.name}'을(를) 삭제할까요?`)) {
                        dispatch({
                          type: "booths/delete",
                          payload: { id: booth.id },
                        });
                      }
                    }}
                  >
                    삭제
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
