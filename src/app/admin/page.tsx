import { Suspense } from "react";
import type { Metadata } from "next";
import { isAdminAuthenticated } from "./_lib/auth";
import { LoginForm } from "./_components/LoginForm";
import { AdminApp } from "./_components/AdminApp";
import { listBoothsLight } from "./_lib/firestore-booths";
import { listSeasons } from "./_lib/firestore-seasons";
import { listReservations } from "./_lib/firestore-reservations";
import { listAccounts } from "./_lib/firestore-accounts";
import { FirebaseNotConfiguredError } from "@/lib/firebase/admin";
import type { Account, AdminBooth, Reservation, Season } from "./_lib/types";

export const metadata: Metadata = {
  title: "관리자 - Frequency",
};

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof FirebaseNotConfiguredError) return e.message;
  if (e instanceof Error) return e.message;
  return fallback;
}

export default async function AdminPage() {
  const authed = await isAdminAuthenticated();

  if (!authed) {
    return <LoginForm />;
  }

  let initialBooths: AdminBooth[] = [];
  let boothsError: string | null = null;
  let initialSeasons: Season[] = [];
  let seasonsError: string | null = null;
  let initialReservations: Reservation[] = [];
  let reservationsError: string | null = null;
  let initialAccounts: Account[] = [];
  let accountsError: string | null = null;

  await Promise.all([
    listBoothsLight()
      .then((r) => (initialBooths = r))
      .catch((e) => (boothsError = errorMessage(e, "주점 목록을 불러오지 못했습니다."))),
    listSeasons()
      .then((r) => (initialSeasons = r))
      .catch((e) => (seasonsError = errorMessage(e, "시즌 목록을 불러오지 못했습니다."))),
    listReservations()
      .then((r) => (initialReservations = r))
      .catch((e) => (reservationsError = errorMessage(e, "예약 목록을 불러오지 못했습니다."))),
    listAccounts()
      .then((r) => (initialAccounts = r))
      .catch((e) => (accountsError = errorMessage(e, "계좌 목록을 불러오지 못했습니다."))),
  ]);

  return (
    <Suspense fallback={null}>
      <AdminApp
        initialBooths={initialBooths}
        boothsError={boothsError}
        initialSeasons={initialSeasons}
        seasonsError={seasonsError}
        initialReservations={initialReservations}
        reservationsError={reservationsError}
        initialAccounts={initialAccounts}
        accountsError={accountsError}
      />
    </Suspense>
  );
}
