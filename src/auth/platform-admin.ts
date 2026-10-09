/**
 * The website owner's team (Builder OS staff), named by email in PLATFORM_ADMIN_EMAILS. Checked against the
 * signed-in Clerk user's verified primary email, whatever company they're in (or none): the admin area at
 * /admin sits outside every company. Nobody else gets in, whatever their role in their own company.
 *
 * Two-step verification is required: a code from an authenticator app, checked by us every 12 hours (see
 * admin-two-step.ts, which works on Clerk's free plan), or Clerk's own two-step if the login has it.
 * PLATFORM_ADMIN_ALLOW_NO_2FA=1 skips it (development only).
 */
import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { hasAdminPass, storedTotp } from "./admin-two-step";

const admins = () =>
  new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

export type PlatformAccess =
  | { ok: true; email: string; name: string }
  | { ok: false; reason: "not_admin" }
  /** An admin who hasn't added an authenticator app yet, or hasn't typed a code in the last 12 hours. */
  | { ok: false; reason: "needs_setup" | "needs_code"; userId: string; email: string };

/** Cached per request. */
export const platformAccess = cache(async (): Promise<PlatformAccess> => {
  // Read the session first, always: it also keeps these pages per-request (never prerendered at build).
  const { userId } = await auth();
  const list = admins();
  if (!userId || list.size === 0) return { ok: false, reason: "not_admin" };
  const user = await currentUser();
  const primary = user?.primaryEmailAddress;
  const email = primary?.emailAddress?.toLowerCase();
  if (!user || !email || primary?.verification?.status !== "verified" || !list.has(email)) return { ok: false, reason: "not_admin" };
  const ok = { ok: true as const, email, name: [user.firstName, user.lastName].filter(Boolean).join(" ") || email };
  if (user.twoFactorEnabled || process.env.PLATFORM_ADMIN_ALLOW_NO_2FA === "1") return ok;
  const totp = storedTotp(user.privateMetadata);
  if (!totp) return { ok: false, reason: "needs_setup", userId, email };
  return (await hasAdminPass(userId, totp.secret)) ? ok : { ok: false, reason: "needs_code", userId, email };
});

export const isPlatformAdmin = async () => (await platformAccess()).ok;

/** Whether to show the link to the admin area: admins, including those who still need to type a code. */
export const showsAdminLink = async () => {
  const access = await platformAccess();
  return access.ok || access.reason !== "not_admin";
};

/**
 * For every admin page and action: the admin, or a 404 for anyone else (the area doesn't announce itself).
 * An admin who still needs to set up an authenticator app, or type its code, is sent to do that first.
 */
export async function requirePlatformAdmin(): Promise<{ email: string; name: string }> {
  const access = await platformAccess();
  if (access.ok) return access;
  if (access.reason !== "not_admin") redirect("/admin/two-step");
  notFound();
}
