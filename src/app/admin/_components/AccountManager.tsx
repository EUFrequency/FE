"use client";

import { useState } from "react";
import { useAdminStore } from "../_lib/store";
import {
  deleteAccountAction,
  saveAccountAction,
  setDefaultAccountAction,
} from "../_lib/account-actions";
import { createId } from "../_lib/id";
import type { Account } from "../_lib/types";
import { Badge, Button, Card, Input, Label, SectionTitle } from "./ui";

type Selection = {
  selectedAccountId: string | null;
  onSelect: (id: string | null) => void;
};

type Props = {
  /** 이 값이 있으면(주점 등록 폼) 계좌마다 "이 주점에 사용" 선택지를 같이 보여줌 */
  selection?: Selection;
  title?: string;
};

export function AccountManager({ selection, title = "계좌 관리" }: Props) {
  const { state, dispatch, accountsError } = useAdminStore();
  const [mode, setMode] = useState<"list" | "add" | Account>("list");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const editing = typeof mode === "object" ? mode : null;
  const formOpen = mode === "add" || editing !== null;

  const accounts = [...state.accounts].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));

  async function handleSave(account: Account) {
    const result = await saveAccountAction(account);
    if (!result.ok) throw new Error(result.error);
    dispatch({ type: "accounts/upsert", payload: account });
    setMode("list");
    if (selection) selection.onSelect(account.id);
  }

  async function handleSetDefault(id: string) {
    setRowError(null);
    setBusyId(id);
    try {
      const result = await setDefaultAccountAction(id);
      if (!result.ok) throw new Error(result.error);
      dispatch({ type: "accounts/setDefault", payload: { id } });
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "대표 계좌 지정에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(account: Account) {
    if (account.isDefault) return;
    if (!confirm(`'${account.bank} ${account.accountNumber}' 계좌를 삭제할까요?`)) return;
    setRowError(null);
    setBusyId(account.id);
    try {
      const result = await deleteAccountAction(account.id);
      if (!result.ok) throw new Error(result.error);
      dispatch({ type: "accounts/delete", payload: { id: account.id } });
      if (selection?.selectedAccountId === account.id) selection.onSelect(null);
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>{title}</SectionTitle>
        {!formOpen && (
          <Button type="button" variant="secondary" onClick={() => setMode("add")}>
            + 새 계좌 등록
          </Button>
        )}
      </div>

      {accountsError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          {accountsError}
        </div>
      )}
      {rowError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
          {rowError}
        </div>
      )}

      {formOpen && (
        <AccountForm
          key={editing?.id ?? "new"}
          initial={editing}
          onCancel={() => setMode("list")}
          onSubmit={handleSave}
        />
      )}

      {selection && (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10">
          <input
            type="radio"
            name="booth-account"
            checked={selection.selectedAccountId === null}
            onChange={() => selection.onSelect(null)}
          />
          <span className="text-neutral-700 dark:text-neutral-200">
            시스템 대표 계좌 사용
          </span>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            (기본값 - 올해는 보통 이걸로 두면 됨)
          </span>
        </label>
      )}

      {accounts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/10 px-3 py-4 text-center text-xs text-neutral-400 dark:border-white/10 dark:text-neutral-500">
          등록된 계좌가 없습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <Card key={account.id} className="flex flex-col gap-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <label className="flex min-w-0 items-start gap-2">
                  {selection && (
                    <input
                      type="radio"
                      name="booth-account"
                      className="mt-1"
                      checked={selection.selectedAccountId === account.id}
                      onChange={() => selection.onSelect(account.id)}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">
                        {account.bank}
                      </span>
                      {account.isDefault && <Badge tone="amber">대표 계좌</Badge>}
                    </div>
                    <div className="truncate text-sm text-neutral-600 dark:text-neutral-300">
                      {account.accountNumber} · {account.holderName}
                    </div>
                  </div>
                </label>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {!account.isDefault && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busyId === account.id}
                    onClick={() => handleSetDefault(account.id)}
                  >
                    대표 계좌로 설정
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={() => setMode(account)}>
                  수정
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={account.isDefault || busyId === account.id}
                  title={account.isDefault ? "대표 계좌는 다른 계좌를 먼저 대표로 지정해야 삭제할 수 있어요" : undefined}
                  onClick={() => handleDelete(account)}
                >
                  삭제
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: Account | null;
  onCancel: () => void;
  onSubmit: (account: Account) => Promise<void>;
}) {
  const [bank, setBank] = useState(initial?.bank ?? "");
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? "");
  const [holderName, setHolderName] = useState(initial?.holderName ?? "");
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = bank.trim() && accountNumber.trim() && holderName.trim();

  async function submit() {
    if (!valid || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        id: initial?.id ?? createId("account"),
        bank: bank.trim(),
        accountNumber: accountNumber.trim(),
        holderName: holderName.trim(),
        isDefault,
        createdAt: initial?.createdAt ?? new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-3 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="block">
          <Label>은행</Label>
          <Input
            className="mt-1"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            placeholder="카카오뱅크"
          />
        </label>
        <label className="block">
          <Label>계좌번호</Label>
          <Input
            className="mt-1"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="3333-12-3456789"
          />
        </label>
        <label className="block">
          <Label>예금주명</Label>
          <Input
            className="mt-1"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="학생처"
          />
        </label>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          disabled={initial?.isDefault}
        />
        <span className="text-neutral-700 dark:text-neutral-200">
          이 계좌를 시스템 대표 계좌로 설정
        </span>
      </label>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={submitting} onClick={onCancel}>
          취소
        </Button>
        <Button type="button" variant="primary" disabled={!valid || submitting} onClick={submit}>
          {submitting ? "저장 중..." : initial ? "수정 저장" : "등록"}
        </Button>
      </div>
    </Card>
  );
}
