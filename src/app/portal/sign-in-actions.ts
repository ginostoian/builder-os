"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { firstName } from "@/core/pipeline";
import { email as emailSchema } from "@/core/schemas";
import { findPortalAccess, findPortalAccessesByEmail, withTenant } from "@/db";
import { PortalAuthError, createSignInCode, createSignInLink, endPortalSession, portalSignInState, spendSignInCode, spendSignInLink, CODE_MINUTES } from "@/db/portal-auth";
import { clients, portalAccess } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { emailConfigured, sendEmail } from "@/server/email";
import { appOrigin, isBot, portalUrl } from "@/server/origin";
import { portalCookie, startPortalSession } from "@/server/portal-auth";
import { allow, checkFormToken, perIp } from "@/server/rate-limit";

/**
 * Signing in to the client portal: a code by email, a one-time link from an email, signing out, and "find
 * my portal" from the memorable address (/portal). Nothing here says whether an email address is known.
 */

export type SignInResult = { ok: true } | { ok: false; message: string };

const MESSAGES: Record<PortalAuthError["reason"] | "bad_link" | "email", string> = {
  bad_link: "This link no longer works. Ask the company for a new one.",
  too_many: "That's a lot of codes in a short time. Please wait a while and try again.",
  wrong_code: "That code isn't right. Check the latest email and try again.",
  expired: "That code has expired or been used. Ask for a new one.",
  no_email: "We don't have an email address for you. Please contact the company.",
  email: "We couldn't send the email just now. Please try again in a minute.",
};

async function clientName(orgId: string, clientId: string) {
  return withTenant(orgId, async (tx) => (await tx.select({ name: clients.name }).from(clients).where(and(eq(clients.orgId, orgId), eq(clients.id, clientId))))[0]?.name ?? "");
}

/** Email a 6-digit code to the client's address on file. */
export async function sendPortalCodeAction(token: string): Promise<SignInResult> {
  if (!(await allow(await perIp("portal_code_ip", 15, 3_600)))) return { ok: false, message: MESSAGES.too_many };
  const access = typeof token === "string" ? await findPortalAccess(token) : null;
  if (!access) return { ok: false, message: MESSAGES.bad_link };
  if (!emailConfigured()) return { ok: false, message: MESSAGES.email };
  let sent: { code: string; to: string; company: { name: string; brandColour: string | null } };
  try {
    sent = await withTenant(access.orgId, async (tx) => {
      const state = await portalSignInState(tx, access.orgId, access.clientId);
      if (!state?.email) throw new PortalAuthError("no_email");
      return { code: await createSignInCode(tx, access.orgId, access.accessId), to: state.email, company: state.company };
    });
  } catch (error) {
    if (error instanceof PortalAuthError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  const name = await clientName(access.orgId, access.clientId);
  const result = await sendEmail({
    to: sent.to,
    subject: `${sent.code} is your code for ${sent.company.name}`,
    fromName: sent.company.name,
    content: {
      company: { name: sent.company.name, brandColour: sent.company.brandColour },
      preheader: `Your sign-in code is ${sent.code}. It works for ${CODE_MINUTES} minutes.`,
      heading: sent.code,
      paragraphs: [`Hi ${firstName(name)},`, `Use this code to open your quotes and invoices from ${sent.company.name}. It works for ${CODE_MINUTES} minutes, once.`, "If you didn't ask for it, you can ignore this email: nobody can get in without it."],
    },
  });
  return result.ok ? { ok: true } : { ok: false, message: MESSAGES.email };
}

const codeInput = z.string().regex(/^\s*\d{3}\s*-?\s*\d{3}\s*$/);

export async function verifyPortalCodeAction(token: string, code: string): Promise<SignInResult> {
  if (!codeInput.safeParse(code).success) return { ok: false, message: "Enter the 6 digits from the email." };
  if (!(await allow(await perIp("portal_verify_ip", 30, 600)))) return { ok: false, message: MESSAGES.too_many };
  const access = typeof token === "string" ? await findPortalAccess(token) : null;
  if (!access) return { ok: false, message: MESSAGES.bad_link };
  const result = await withTenant(access.orgId, (tx) => spendSignInCode(tx, access.orgId, access.accessId, code));
  if (result !== "ok") return { ok: false, message: MESSAGES[result] };
  await startPortalSession(token, access);
  return { ok: true };
}

/** A one-time link from an email. A button press, not the page load, spends it (mail scanners load links). */
export async function spendSignInLinkAction(token: string, secret: string): Promise<SignInResult> {
  if (typeof secret !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(secret)) return { ok: false, message: MESSAGES.expired };
  if (!(await allow(await perIp("portal_link_ip", 30, 600)))) return { ok: false, message: MESSAGES.too_many };
  const access = typeof token === "string" ? await findPortalAccess(token) : null;
  if (!access) return { ok: false, message: MESSAGES.bad_link };
  if (await isBot()) return { ok: false, message: MESSAGES.expired };
  try {
    await withTenant(access.orgId, (tx) => spendSignInLink(tx, access.orgId, access.accessId, secret));
  } catch (error) {
    if (error instanceof PortalAuthError) return { ok: false, message: "That sign-in link has been used or has expired. We can email you a code instead." };
    throw error;
  }
  await startPortalSession(token, access);
  return { ok: true };
}

export async function signOutPortalAction(token: string): Promise<void> {
  const access = typeof token === "string" ? await findPortalAccess(token) : null;
  if (!access) return;
  const c = await portalCookie(token, access.accessId);
  if (c.value) await withTenant(access.orgId, (tx) => endPortalSession(tx, access.orgId, access.accessId, c.value!));
  (await cookies()).set(c.name, "", { path: c.path, maxAge: 0 });
}

/**
 * "Find my portal": email a sign-in link for every company this address is a client of. Always answers the
 * same way, so it can't be used to find out who is whose client.
 */
export async function requestPortalLinksAction(input: { email: string; website?: string; formToken?: string }): Promise<SignInResult> {
  const parsed = emailSchema.safeParse(input?.email?.trim());
  if (!parsed.success) return { ok: false, message: "Check your email address." };
  const form = checkFormToken("find_portal", input.formToken);
  if (form === "expired" || input.formToken === undefined) return { ok: false, message: "This page has been open a while. Please reload it and try again." };
  if (form !== "ok" || input.website || (await isBot()) || !emailConfigured()) return { ok: true };
  // Nobody can flood an inbox from here: a few links per address, and per caller, an hour.
  if (!(await allow(await perIp("find_portal_ip", 10, 3_600), { bucket: "find_portal_email", subject: parsed.data, max: 3, windowSeconds: 3_600 }))) {
    return { ok: false, message: "That's a lot of requests in a short time. Please check your inbox, or try again in an hour." };
  }
  const origin = await appOrigin();
  for (const access of await findPortalAccessesByEmail(parsed.data)) {
    try {
      const prepared = await withTenant(access.orgId, async (tx) => {
        const state = await portalSignInState(tx, access.orgId, access.clientId);
        if (!state?.email) return null;
        const [link] = await tx.select({ token: portalAccess.token }).from(portalAccess).where(and(eq(portalAccess.orgId, access.orgId), eq(portalAccess.id, access.accessId)));
        if (!link) return null;
        return { state, token: link.token, secret: await createSignInLink(tx, access.orgId, access.accessId, 30) };
      });
      if (!prepared) continue;
      const link = `${portalUrl(origin, prepared.token)}?signin=${prepared.secret}`;
      await sendEmail({
        to: prepared.state.email!,
        subject: `Your link to ${prepared.state.company.name}`,
        fromName: prepared.state.company.name,
        content: {
          company: { name: prepared.state.company.name, brandColour: prepared.state.company.brandColour },
          preheader: "Open your quotes, invoices and job progress.",
          heading: "Here's your link",
          paragraphs: [`Your quotes, invoices and job updates from ${prepared.state.company.name} are one tap away. The button signs you in on this device; it works once, for 30 minutes.`, "Didn't ask for this? You can ignore it."],
          button: { label: "Open my portal", href: link },
          footer: `Bookmark ${origin}/portal to find your link again any time.`,
        },
      });
    } catch (error) {
      if (!(error instanceof PortalAuthError)) console.error("Portal link email failed", error instanceof Error ? error.message : error);
    }
  }
  return { ok: true };
}
