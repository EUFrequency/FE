"use client";

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { AdminBooth, Reservation, Season } from "./types";

type State = {
  seasons: Season[];
  reservations: Reservation[];
  /** 주점/시즌/예약 모두 원천은 Firestore. 여긴 화면에 보여주기 위한 로컬 캐시일 뿐 */
  booths: AdminBooth[];
};

/** 시즌의 시작/종료일과 오늘 날짜를 비교해 자연스러운 상태를 계산 (서버와 동일 로직) */
function deriveNaturalStatus(season: Pick<Season, "startDate" | "endDate">) {
  const today = new Date().toISOString().slice(0, 10);
  if (today < season.startDate) return "upcoming" as const;
  if (today > season.endDate) return "ended" as const;
  return "ongoing" as const;
}

type Action =
  | { type: "seasons/replaceAll"; payload: Season[] }
  | { type: "seasons/add"; payload: Season }
  | { type: "seasons/activate"; payload: { id: string } }
  | { type: "reservations/replaceAll"; payload: Reservation[] }
  | { type: "reservations/approve"; payload: { id: string } }
  | { type: "reservations/reject"; payload: { id: string } }
  | { type: "booths/replaceAll"; payload: AdminBooth[] }
  | { type: "booths/add"; payload: AdminBooth }
  | { type: "booths/update"; payload: AdminBooth }
  | { type: "booths/delete"; payload: { id: string } };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "seasons/replaceAll":
      return { ...state, seasons: action.payload };

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

    case "reservations/replaceAll":
      return { ...state, reservations: action.payload };

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

    case "booths/replaceAll":
      return { ...state, booths: action.payload };

    case "booths/add":
      return { ...state, booths: [...state.booths, action.payload] };

    case "booths/update":
      return {
        ...state,
        booths: state.booths.map((b) =>
          b.id === action.payload.id ? action.payload : b,
        ),
      };

    case "booths/delete":
      return { ...state, booths: state.booths.filter((b) => b.id !== action.payload.id) };

    default:
      return state;
  }
}

type ContextValue = {
  state: State;
  dispatch: React.Dispatch<Action>;
  /** 서버(page.tsx)에서 최초 데이터를 가져오다 실패한 경우의 안내 메시지 */
  boothsError: string | null;
  seasonsError: string | null;
  reservationsError: string | null;
};

const AdminStoreContext = createContext<ContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  initialBooths: AdminBooth[];
  initialSeasons: Season[];
  initialReservations: Reservation[];
  boothsError: string | null;
  seasonsError: string | null;
  reservationsError: string | null;
};

export function AdminStoreProvider({
  children,
  initialBooths,
  initialSeasons,
  initialReservations,
  boothsError,
  seasonsError,
  reservationsError,
}: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    booths: initialBooths,
    seasons: initialSeasons,
    reservations: initialReservations,
  });

  const value = useMemo(
    () => ({ state, dispatch, boothsError, seasonsError, reservationsError }),
    [state, boothsError, seasonsError, reservationsError],
  );

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
