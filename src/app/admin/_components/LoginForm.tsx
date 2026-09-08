"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";
import type { LoginState } from "../_lib/types";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-neutral-100 px-6 dark:bg-[#0b0805]">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-2xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-white/[0.03]"
      >
        <div className="text-xs font-medium tracking-wide text-amber-600 dark:text-amber-400">
          Frequency
        </div>
        <h1 className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
          관리자 페이지
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          비밀번호를 입력하면 관리자 페이지로 이동합니다.
        </p>

        <label className="mt-6 block">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            비밀번호
          </span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            placeholder="••••••••"
            className="mt-1.5 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-100"
          />
        </label>

        {state.error && !pending && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 h-11 w-full rounded-xl bg-amber-500 text-sm font-semibold text-neutral-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "확인 중..." : "입장하기"}
        </button>
      </form>
    </main>
  );
}
