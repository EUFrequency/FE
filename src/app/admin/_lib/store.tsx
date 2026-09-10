"use client";

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { Account, AdminBooth, Reservation, Season } from "./types";

type State = {
  seasons: Season[];
  reservations: Reservation[];
  accounts: Account[];
  /** 주점/시즌/예약/계좌 모두 원천은 Firestore. 여긴 화면에 보여주기 위한 로컬 캐시일 뿐 */
  booths: AdminBooth[];
};

type Action =
  | { type: "seasons/replaceAll"; payload: Season[] }
  | { type: "seasons/add"; payload: Season }
  | { type: "seasons/endEarly"; payload: { id: string; endDate: string } }
  | { type: "reservations/replaceAll"; payload: Reservation[] }
  | { type: "reservations/approve"; payload: { id: string } }
  | { type: "reservations/reject"; payload: { id: string } }
  | { type: "booths/replaceAll"; payload: AdminBooth[] }
  | { type: "booths/add"; payload: AdminBooth }
  | { type: "booths/update"; payload: AdminBooth }
  | { type: "booths/delete"; payload: { id: string } }
  | { type: "accounts/replaceAll"; payload: Account[] }
  | { type: "accounts/upsert"; payload: Account }
  | { type: "accounts/setDefault"; payload: { id: string } }
  | { type: "accounts/delete"; payload: { id: string } };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "seasons/replaceAll":
      return { ...state, seasons: action.payload };

    case "seasons/add":
      return { ...state, seasons: [action.payload, ...state.seasons] };

    case "seasons/endEarly": {
      const seasons = state.seasons.map((s) =>
        s.id === action.payload.id
          ? { ...s, endDate: action.payload.endDate, earlyEndedAt: action.payload.endDate, status: "ended" as const }
          : s,
      );
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

    case "accounts/replaceAll":
      return { ...state, accounts: action.payload };

    case "accounts/upsert": {
      const exists = state.accounts.some((a) => a.id === action.payload.id);
      const accounts = action.payload.isDefault
        ? state.accounts.map((a) => ({ ...a, isDefault: a.id === action.payload.id }))
        : state.accounts;
      return {
        ...state,
        accounts: exists
          ? accounts.map((a) => (a.id === action.payload.id ? action.payload : a))
          : [...accounts, action.payload],
      };
    }

    case "accounts/setDefault": {
      const accounts = state.accounts.map((a) => ({
        ...a,
        isDefault: a.id === action.payload.id,
      }));
      return { ...state, accounts };
    }

    case "accounts/delete": {
      const accounts = state.accounts.filter((a) => a.id !== action.payload.id);
      const booths = state.booths.map((b) =>
        b.accountId === action.payload.id ? { ...b, accountId: null } : b,
      );
      return { ...state, accounts, booths };
    }

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
  accountsError: string | null;
};

const AdminStoreContext = createContext<ContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  initialBooths: AdminBooth[];
  initialSeasons: Season[];
  initialReservations: Reservation[];
  initialAccounts: Account[];
  boothsError: string | null;
  seasonsError: string | null;
  reservationsError: string | null;
  accountsError: string | null;
};

export function AdminStoreProvider({
  children,
  initialBooths,
  initialSeasons,
  initialReservations,
  initialAccounts,
  boothsError,
  seasonsError,
  reservationsError,
  accountsError,
}: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    booths: initialBooths,
    seasons: initialSeasons,
    reservations: initialReservations,
    accounts: initialAccounts,
  });

  const value = useMemo(
    () => ({ state, dispatch, boothsError, seasonsError, reservationsError, accountsError }),
    [state, boothsError, seasonsError, reservationsError, accountsError],
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
