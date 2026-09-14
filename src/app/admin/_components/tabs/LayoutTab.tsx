"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminStore } from "../../_lib/store";
import { getLayoutAction, saveLayoutAction } from "../../_lib/layout-actions";
import type { SeasonLayout } from "../../_lib/types";
import { Badge, Button, Card, Input, Label, Select } from "../ui";

// 사용자 화면(모바일, 440px 안팎)에서 격자가 그대로 보여야 해서 상한을 둠 - 이보다 크면
// 칸이 너무 작아져 못 알아봄(BoothMap.tsx 참고)
const MAX_ROWS = 4;
const MAX_COLS = 8;

export function LayoutTab() {
  const { state } = useAdminStore();
  const [seasonId, setSeasonId] = useState<string>(
    () => state.seasons.find((s) => s.status === "ongoing")?.id ?? state.seasons[0]?.id ?? "",
  );

  const season = state.seasons.find((s) => s.id === seasonId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          주점 배치
        </h1>
        <label className="flex items-center gap-2">
          <Label>시즌</Label>
          <Select
            className="w-56"
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
          >
            {state.seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {!season ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          먼저 시즌 관리에서 시즌을 생성해주세요.
        </p>
      ) : (
        <LayoutEditor key={seasonId} seasonId={seasonId} />
      )}
    </div>
  );
}

function emptyCells(rows: number, cols: number): Record<string, string | null> {
  const cells: Record<string, string | null> = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells[`${r}-${c}`] = null;
    }
  }
  return cells;
}

function resizeCells(
  prev: Record<string, string | null>,
  rows: number,
  cols: number,
) {
  const cells: Record<string, string | null> = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r}-${c}`;
      cells[key] = prev[key] ?? null;
    }
  }
  return cells;
}

type LoadStatus = "loading" | "loaded" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";

function LayoutEditor({ seasonId }: { seasonId: string }) {
  const { state } = useAdminStore();
  const boothMap = useMemo(
    () => new Map(state.booths.map((b) => [b.id, b])),
    [state.booths],
  );

  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);
  const [cells, setCells] = useState<Record<string, string | null>>({});
  const [hasGrid, setHasGrid] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // 시즌이 바뀔 때(=이 컴포넌트가 새로 마운트될 때) Firestore에서 배치도를 불러옴.
  // loadStatus는 useState 초기값이 이미 "loading"이라 여기서 다시 set할 필요 없음
  // (이 컴포넌트는 시즌마다 key={seasonId}로 새로 마운트됨).
  useEffect(() => {
    let cancelled = false;
    getLayoutAction(seasonId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadStatus("error");
        setLoadError(result.error);
        return;
      }
      const saved = result.data;
      if (saved) {
        setRows(saved.rows);
        setCols(saved.cols);
        setCells(saved.cells);
        setHasGrid(true);
        setLastSavedAt(saved.updatedAt);
      }
      setLoadStatus("loaded");
    });
    return () => {
      cancelled = true;
    };
  }, [seasonId]);

  const placedBoothIds = useMemo(
    () => new Set(Object.values(cells).filter(Boolean) as string[]),
    [cells],
  );
  const availableBooths = state.booths.filter((b) => !placedBoothIds.has(b.id));

  function applyGrid() {
    setCells((prev) => resizeCells(hasGrid ? prev : emptyCells(rows, cols), rows, cols));
    setHasGrid(true);
    setDirty(true);
    setSaveStatus("idle");
  }

  function place(cellKey: string, boothId: string) {
    setCells((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key] === boothId) next[key] = null;
      }
      next[cellKey] = boothId;
      return next;
    });
    setDirty(true);
    setSaveStatus("idle");
  }

  function clearCell(cellKey: string) {
    setCells((prev) => ({ ...prev, [cellKey]: null }));
    setDirty(true);
    setSaveStatus("idle");
  }

  function resetAll() {
    setCells((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, null])));
    setDirty(true);
    setSaveStatus("idle");
  }

  function handleDrop(e: React.DragEvent, cellKey: string) {
    e.preventDefault();
    const boothId = e.dataTransfer.getData("text/plain");
    if (boothId) place(cellKey, boothId);
  }

  function handleCellClick(cellKey: string, occupantId: string | null) {
    if (selectedBoothId) {
      place(cellKey, selectedBoothId);
      setSelectedBoothId(null);
      return;
    }
    if (occupantId) clearCell(cellKey);
  }

  async function handleSave() {
    const layout: SeasonLayout = { rows, cols, cells, updatedAt: new Date().toISOString() };
    setSaveStatus("saving");
    try {
      const result = await saveLayoutAction(seasonId, layout);
      if (!result.ok) throw new Error(result.error);
      setSaveStatus("saved");
      setLastSavedAt(layout.updatedAt);
      setDirty(false);
    } catch {
      setSaveStatus("error");
    }
  }

  if (loadStatus === "loading") {
    return <p className="text-sm text-neutral-400 dark:text-neutral-500">불러오는 중...</p>;
  }

  if (loadStatus === "error") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
        배치도를 불러오지 못했습니다. {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <Label hint={`최대 ${MAX_ROWS}`}>행 (M)</Label>
          <Input
            className="mt-1.5 w-24"
            type="number"
            min={1}
            max={MAX_ROWS}
            value={rows}
            onChange={(e) =>
              setRows(Math.min(MAX_ROWS, Math.max(1, Number(e.target.value) || 1)))
            }
          />
        </label>
        <label className="block">
          <Label hint={`최대 ${MAX_COLS}`}>열 (N)</Label>
          <Input
            className="mt-1.5 w-24"
            type="number"
            min={1}
            max={MAX_COLS}
            value={cols}
            onChange={(e) =>
              setCols(Math.min(MAX_COLS, Math.max(1, Number(e.target.value) || 1)))
            }
          />
        </label>
        <Button variant="secondary" onClick={applyGrid}>
          격자 적용
        </Button>
        {hasGrid && (
          <Button variant="secondary" onClick={resetAll}>
            배치 초기화
          </Button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <SaveStatusLabel status={saveStatus} dirty={dirty} lastSavedAt={lastSavedAt} />
          <Button variant="primary" disabled={!hasGrid || !dirty || saveStatus === "saving"} onClick={handleSave}>
            {saveStatus === "saving" ? "저장 중..." : "저장하기"}
          </Button>
        </div>
      </Card>
      <p className="-mt-3 text-xs text-neutral-400 dark:text-neutral-500">
        드래그 앤 드롭이나 격자 편집은 화면에만 임시로 반영되며, &quot;저장하기&quot;를 눌러야
        Firestore에 실제로 반영됩니다.
      </p>

      {/* 팔레트 */}
      <div>
        <Label>배치 가능한 주점 (드래그하거나 클릭 후 칸을 선택하세요)</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {availableBooths.length === 0 && (
            <span className="text-sm text-neutral-400 dark:text-neutral-500">
              배치할 수 있는 주점이 없습니다.
            </span>
          )}
          {availableBooths.map((booth) => (
            <button
              key={booth.id}
              type="button"
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", booth.id)}
              onClick={() =>
                setSelectedBoothId((prev) => (prev === booth.id ? null : booth.id))
              }
              className={`cursor-grab rounded-xl border px-3 py-2 text-sm font-medium transition active:cursor-grabbing ${
                selectedBoothId === booth.id
                  ? "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "border-black/10 bg-white text-neutral-700 hover:border-amber-500/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-200"
              }`}
            >
              {booth.name}
            </button>
          ))}
        </div>
      </div>

      {/* 격자 */}
      {!hasGrid ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          위에서 행/열을 입력하고 &quot;격자 적용&quot;을 눌러 배치도를 생성하세요.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-400/40 text-xs font-medium tracking-[0.3em] text-neutral-400 dark:border-neutral-600/50 dark:text-neutral-500">
            <span aria-hidden>🎤</span>
            무대
          </div>
          <div
            className="grid gap-2 overflow-x-auto"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(110px, 1fr))` }}
          >
            {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const cellKey = `${r}-${c}`;
              const occupantId = cells[cellKey] ?? null;
              const occupant = occupantId ? boothMap.get(occupantId) : null;
              return (
                <div
                  key={cellKey}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, cellKey)}
                  onClick={() => handleCellClick(cellKey, occupantId)}
                  className={`flex h-24 flex-col items-center justify-center rounded-xl border p-2 text-center transition ${
                    occupant
                      ? "border-amber-500/40 bg-amber-500/10"
                      : "border-dashed border-black/15 bg-black/[0.02] hover:border-amber-500/40 dark:border-white/15 dark:bg-white/[0.02]"
                  } ${selectedBoothId ? "cursor-copy" : "cursor-pointer"}`}
                >
                  {occupant ? (
                    <>
                      <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {occupant.name}
                      </span>
                      <span className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                        클릭하여 제거
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      빈 자리
                    </span>
                  )}
                </div>
              );
            }),
            )}
          </div>
        </div>
      )}

      {hasGrid && (
        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <Badge tone="green">{placedBoothIds.size}개 배치됨</Badge>
          <Badge tone="neutral">{availableBooths.length}개 미배치</Badge>
        </div>
      )}
    </div>
  );
}

function SaveStatusLabel({
  status,
  dirty,
  lastSavedAt,
}: {
  status: SaveStatus;
  dirty: boolean;
  lastSavedAt: string | null;
}) {
  if (status === "error") {
    return <span className="text-xs text-red-500">저장에 실패했습니다. 다시 시도해주세요.</span>;
  }
  if (dirty) {
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400">
        저장되지 않은 변경사항이 있습니다
      </span>
    );
  }
  if (lastSavedAt) {
    return (
      <span className="text-xs text-neutral-400 dark:text-neutral-500">
        마지막 저장: {new Date(lastSavedAt).toLocaleString("ko-KR")}
      </span>
    );
  }
  return null;
}
