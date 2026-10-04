/**
 * The website owner's team (Builder OS staff), named by email in PLATFORM_ADMIN_EMAILS. Checked against the
 * signed-in Clerk user's verified primary email, whatever company they're in (or none): the admin area at
 * /admin sits outside every company. Nobody else gets in, whatever their role in their own company.
 *
 * Two-step verification is required unless PLATFORM_ADMIN_ALLOW_NO_2FA=1 (for development).
 */
import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";

const admins = () =>
  new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

export type PlatformAccess = { ok: true; email: string; name: string } | { ok: false; reason: "not_admin" | "needs_2fa" };

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
  if (!user.twoFactorEnabled && process.env.PLATFORM_ADMIN_ALLOW_NO_2FA !== "1") return { ok: false, reason: "needs_2fa" };
  return { ok: true, email, name: [user.firstName, user.lastName].filter(Boolean).join(" ") || email };
});

export const isPlatformAdmin = async () => (await platformAccess()).ok;

/**
 * For every admin page and action: the admin, or a 404 for anyone else (the area doesn't announce itself).
 * An admin without two-step verification is sent to turn it on.
 */
export async function requirePlatformAdmin(): Promise<{ email: string; name: string }> {
  const access = await platformAccess();
  if (access.ok) return access;
  if (access.reason === "needs_2fa") redirect("/admin/two-step");
  notFound();
}
