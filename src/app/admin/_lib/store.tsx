"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  buildSeedBooths,
  buildSeedReservations,
  buildSeedSeasons,
} from "./mock-data";
import type { AdminBooth, Reservation, Season, SeasonLayout } from "./types";

const STORAGE_KEY = "frequency-admin-store-v2";

type State = {
  seasons: Season[];
  reservations: Reservation[];
  booths: AdminBooth[];
  layouts: Record<string, SeasonLayout>;
};

function seedState(): State {
  return {
    seasons: buildSeedSeasons(),
    reservations: buildSeedReservations(),
    booths: buildSeedBooths(),
    layouts: {},
  };
}

/** 시즌의 시작/종료일과 오늘 날짜를 비교해 자연스러운 상태를 계산 */
function deriveNaturalStatus(season: Pick<Season, "startDate" | "endDate">) {
  const today = new Date().toISOString().slice(0, 10);
  if (today < season.startDate) return "upcoming" as const;
  if (today > season.endDate) return "ended" as const;
  return "ongoing" as const;
}

type Action =
  | { type: "state/hydrate"; payload: State }
  | { type: "seasons/add"; payload: Season }
  | { type: "seasons/activate"; payload: { id: string } }
  | { type: "reservations/approve"; payload: { id: string } }
  | { type: "reservations/reject"; payload: { id: string } }
  | { type: "booths/add"; payload: AdminBooth }
  | { type: "booths/update"; payload: AdminBooth }
  | { type: "booths/delete"; payload: { id: string } }
  | { type: "layout/save"; payload: { seasonId: string; layout: SeasonLayout } };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "state/hydrate":
      return action.payload;

    case "seasons/add":
      return { ...state, seasons: [action.payload, ...state.seasons] };

    case "seasons/activate": {
      const seasons = state.seasons.map((s) => {
        if (s.id === action.payload.id) return { ...s, status: "ongoing" as const };
        if (s.status === "ongoing") return { ...s, status: deriveNaturalStatus(s) };
        return s;
      });
      return { ...state, seasons };
    }

    case "reservations/approve": {
      const reservations = state.reservations.map((r) =>
        r.id === action.payload.id ? { ...r, status: "approved" as const } : r,
      );
      return { ...state, reservations };
    }

    case "reservations/reject": {
      const reservations = state.reservations.map((r) =>
        r.id === action.payload.id ? { ...r, status: "rejected" as const } : r,
      );
      return { ...state, reservations };
    }

    case "booths/add":
      return { ...state, booths: [...state.booths, action.payload] };

    case "booths/update":
      return {
        ...state,
        booths: state.booths.map((b) =>
          b.id === action.payload.id ? action.payload : b,
        ),
      };

    case "booths/delete": {
      const booths = state.booths.filter((b) => b.id !== action.payload.id);
      // 삭제된 주점은 배치도에서도 함께 제거
      const layouts = Object.fromEntries(
        Object.entries(state.layouts).map(([seasonId, layout]) => [
          seasonId,
          {
            ...layout,
            cells: Object.fromEntries(
              Object.entries(layout.cells).map(([key, boothId]) => [
                key,
                boothId === action.payload.id ? null : boothId,
              ]),
            ),
          },
        ]),
      );
      return { ...state, booths, layouts };
    }

    case "layout/save": {
      const { seasonId, layout } = action.payload;
      return { ...state, layouts: { ...state.layouts, [seasonId]: layout } };
    }

    default:
      return state;
  }
}

type ContextValue = {
  state: State;
  dispatch: React.Dispatch<Action>;
};

const AdminStoreContext = createContext<ContextValue | null>(null);

export function AdminStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, seedState);

  // 최초 마운트 시 localStorage에 저장된 값이 있으면 시드 데이터 위에 덮어씀
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        dispatch({ type: "state/hydrate", payload: JSON.parse(raw) as State });
      }
    } catch {
      // 저장된 값이 손상된 경우 시드 데이터를 그대로 사용
    }
  }, []);

  // 상태가 바뀔 때마다 localStorage에 반영
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 저장 공간 부족 등은 무시 (이미지가 많으면 발생 가능)
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <AdminStoreContext.Provider value={value}>
      {children}
    </AdminStoreContext.Provider>
  );
}

export function useAdminStore() {
  const ctx = useContext(AdminStoreContext);
  if (!ctx) {
    throw new Error("useAdminStore는 AdminStoreProvider 내부에서만 사용할 수 있습니다.");
  }
  return ctx;
}
