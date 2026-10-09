"use server";

import { checkSetupToken, clearAdminPass, readTotp, saveTotp, setAdminPass } from "@/auth/admin-two-step";
import { platformAccess } from "@/auth/platform-admin";
import { verifyTotp } from "@/core/totp";
import { allow, perIp } from "@/server/rate-limit";
import { redirect } from "next/navigation";

export type TwoStepResult = { ok: true } | { ok: false; message: string };

const TOO_MANY = "That's a lot of tries. Please wait a few minutes and try again.";
const WRONG = "That code isn't right. Check the app shows Builder OS admin, and type the code it shows now.";

/** Per person and per caller, so guesses spread over many addresses still hit a wall. */
async function underLimit(userId: string) {
  return allow(await perIp("admin_2fa_ip", 20, 900), {
    bucket: "admin_2fa_user",
    subject: userId,
    max: 8,
    windowSeconds: 900,
  });
}

/** The first code from a newly added app: proves it's set up right, then saves the key. */
export async function confirmAdminAppAction(input: { secret: string; token: string; code: string }): Promise<TwoStepResult> {
  const access = await platformAccess();
  if (access.ok || access.reason !== "needs_setup") return { ok: false, message: "Reload the page and try again." };
  if (!checkSetupToken(input?.token, access.userId, input?.secret))
    return {
      ok: false,
      message: "This page has been open a while. Please reload it and scan the new code.",
    };
  if (!(await underLimit(access.userId))) return { ok: false, message: TOO_MANY };
  const step = verifyTotp(input.secret, String(input.code ?? ""), Date.now());
  if (step === null) return { ok: false, message: WRONG };
  await saveTotp(access.userId, {
    secret: input.secret,
    lastStep: step,
    addedAt: new Date().toISOString(),
  });
  await setAdminPass(access.userId, input.secret);
  return { ok: true };
}

/** The code from the app, every 12 hours. */
export async function verifyAdminCodeAction(code: string): Promise<TwoStepResult> {
  const access = await platformAccess();
  if (access.ok || access.reason !== "needs_code") return { ok: false, message: "Reload the page and try again." };
  if (!(await underLimit(access.userId))) return { ok: false, message: TOO_MANY };
  // The key, and the last code used (none is accepted twice).
  const totp = await readTotp();
  if (!totp) return { ok: false, message: "Reload the page and try again." };
  const step = verifyTotp(totp.secret, String(code ?? ""), Date.now(), totp.lastStep);
  if (step === null) return { ok: false, message: WRONG };
  await saveTotp(access.userId, { ...totp, lastStep: step });
  await setAdminPass(access.userId, totp.secret);
  return { ok: true };
}

/** Lock the admin area on this browser now, rather than in 12 hours. */
export async function lockAdminAction(): Promise<void> {
  await clearAdminPass();
  redirect("/app");
}
