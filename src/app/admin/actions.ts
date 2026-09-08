"use server";

import { redirect } from "next/navigation";
import {
  createAdminSession,
  destroyAdminSession,
  verifyAdminPassword,
} from "./_lib/auth";
import type { LoginState } from "./_lib/types";

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");

  if (!process.env.ADMIN_PASSWORD) {
    return {
      error:
        "서버에 ADMIN_PASSWORD가 설정되어 있지 않습니다. .env.local 파일을 확인해주세요.",
    };
  }

  if (!verifyAdminPassword(password)) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }

  await createAdminSession();
  redirect("/admin");
}

export async function logoutAction() {
  await destroyAdminSession();
  redirect("/admin");
}
