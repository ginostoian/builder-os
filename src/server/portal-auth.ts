/**
 * The client portal's front door. `portalGate` is what every portal page and action calls instead of
 * looking the token up directly: it says whether this browser may see the portal, or must sign in first.
 *
 * Sign-in is needed when the company has it on (the default), the client has an email address, and email
 * is set up (so a code can reach them). Otherwise the private link alone opens the portal, as before.
 */
import "server-only";
import { cookies, headers } from "next/headers";
import { findPortalAccess, withTenant, type Tx } from "@/db";
import { PortalAuthError, accessForToken, checkPortalSession, createPortalSession, createSignInLink, maskEmail, portalSignInState, SESSION_DAYS } from "@/db/portal-auth";
import { emailConfigured } from "./email";

export type PortalAccess = { accessId: string; orgId: string; clientId: string };
export type PortalGate =
  | { state: "open"; access: PortalAccess; signedIn: boolean }
  | { state: "signin"; access: PortalAccess; emailHint: string; company: { name: string; logoUrl: string | null; brandColour: string | null } };

const cookieName = (accessId: string) => `bos_portal_${accessId.replaceAll("-", "")}`;
const cookiePath = (token: string) => `/portal/${token}`;

export async function portalGate(token: string): Promise<PortalGate | null> {
  const access = typeof token === "string" ? await findPortalAccess(token) : null;
  if (!access) return null;
  const secret = (await cookies()).get(cookieName(access.accessId))?.value;
  const result = await withTenant(access.orgId, async (tx) => {
    const state = await portalSignInState(tx, access.orgId, access.clientId);
    if (!state) return null;
    if (!state.required || !emailConfigured()) return { open: true as const, state };
    const ok = secret ? await checkPortalSession(tx, access.orgId, access.accessId, secret) : false;
    return { open: ok, state };
  });
  if (!result) return null;
  if (result.open) return { state: "open", access, signedIn: Boolean(secret) && result.state.required };
  return { state: "signin", access, emailHint: maskEmail(result.state.email!), company: result.state.company };
}

/** For actions: the access if this browser may use the portal, else null. */
export async function requirePortal(token: string): Promise<PortalAccess | null> {
  const gate = await portalGate(token);
  return gate?.state === "open" ? gate.access : null;
}

/** After a code or link checks out: remember this device for the link's pages. */
export async function startPortalSession(token: string, access: PortalAccess) {
  const ua = (await headers()).get("user-agent");
  const secret = await withTenant(access.orgId, (tx) => createPortalSession(tx, access.orgId, access.accessId, ua));
  (await cookies()).set(cookieName(access.accessId), secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: cookiePath(token),
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function portalCookie(token: string, accessId: string) {
  return { name: cookieName(accessId), path: cookiePath(token), value: (await cookies()).get(cookieName(accessId))?.value };
}

/**
 * A portal link for an email that also signs the client in once (on the first device that opens it, for
 * `minutes`). When sign-in isn't needed, or anything goes wrong, the plain link.
 */
export async function withSignIn(orgId: string, token: string, url: string, minutes = SIGN_IN_LINK_MINUTES): Promise<string> {
  if (!emailConfigured()) return url;
  return withTenant(orgId, (tx) => addSignIn(tx, orgId, token, url, minutes)).catch(() => url);
}

/** A week: emails about quotes and invoices are often opened days later. */
export const SIGN_IN_LINK_MINUTES = 7 * 24 * 60;

/** `withSignIn` inside a tenant transaction you already have. */
export async function addSignIn(tx: Tx, orgId: string, token: string, url: string, minutes = SIGN_IN_LINK_MINUTES): Promise<string> {
  if (!emailConfigured()) return url;
  try {
    const access = await accessForToken(tx, orgId, token);
    if (!access) return url;
    const state = await portalSignInState(tx, orgId, access.clientId);
    if (!state?.required) return url;
    const secret = await createSignInLink(tx, orgId, access.id, minutes);
    return `${url}${url.includes("?") ? "&" : "?"}signin=${secret}`;
  } catch (error) {
    // Over the hourly limit: the plain link still works (with a code).
    if (error instanceof PortalAuthError) return url;
    throw error;
  }
}
