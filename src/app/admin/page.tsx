import { Suspense } from "react";
import type { Metadata } from "next";
import { isAdminAuthenticated } from "./_lib/auth";
import { LoginForm } from "./_components/LoginForm";
import { AdminApp } from "./_components/AdminApp";

export const metadata: Metadata = {
  title: "관리자 - Frequency",
};

export default async function AdminPage() {
  const authed = await isAdminAuthenticated();

  if (!authed) {
    return <LoginForm />;
  }

  return (
    <Suspense fallback={null}>
      <AdminApp />
    </Suspense>
  );
}
