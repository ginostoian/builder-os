/**
 * Talking to Xero: OAuth (connect, refresh, disconnect) and a small API client for one company's Xero
 * organisation. Access tokens last 30 minutes and are refreshed under a row lock, because each refresh
 * replaces the refresh token: two at once would leave one of them holding a dead token.
 */
import "server-only";
import { XERO_API, XERO_CONNECTIONS_URL, XERO_REVOKE_URL, XERO_SCOPES, XERO_TOKEN_URL, XERO_AUTHORIZE_URL, TOKEN_REFRESH_MARGIN_MS, explainXeroError } from "@/core/xero";
import { withTenant } from "@/db";
import { lockXeroConnection, markXeroReconnect, saveXeroTokens } from "@/db/xero";
import { openToken, sealToken } from "./tokens";

const TIMEOUT_MS = 20_000;

export const xeroConfigured = () => Boolean(process.env.XERO_CLIENT_ID?.trim() && process.env.XERO_CLIENT_SECRET?.trim());

export class XeroApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    readonly retryAfterSeconds?: number,
  ) {
    super(explainXeroError(status, body).message);
  }
}

export function authorizeUrl(redirectUri: string, state: string) {
  const url = new URL(XERO_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: process.env.XERO_CLIENT_ID!.trim(),
    redirect_uri: redirectUri,
    scope: XERO_SCOPES.join(" "),
    state,
  }).toString();
  return url.toString();
}

type TokenSet = { access_token: string; refresh_token: string; expires_in: number };

async function tokenRequest(params: Record<string, string>): Promise<TokenSet> {
  const basic = Buffer.from(`${process.env.XERO_CLIENT_ID!.trim()}:${process.env.XERO_CLIENT_SECRET!.trim()}`).toString("base64");
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.access_token || !body?.refresh_token) throw new XeroApiError(res.status === 400 ? 401 : res.status, body);
  return body as TokenSet;
}

export const exchangeCode = (code: string, redirectUri: string) => tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });

export type XeroTenant = { id: string; tenantId: string; tenantName: string; tenantType: string; authEventId?: string };

export async function listTenants(accessToken: string): Promise<XeroTenant[]> {
  const res = await fetch(XERO_CONNECTIONS_URL, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(body)) throw new XeroApiError(res.status, body);
  return (body as XeroTenant[]).filter((t) => t.tenantType === "ORGANISATION");
}

/** Remove our app from a Xero organisation. Best effort: a connection that's already gone is fine. */
export async function removeTenant(accessToken: string, connectionId: string) {
  await fetch(`${XERO_CONNECTIONS_URL}/${encodeURIComponent(connectionId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => undefined);
}

export async function revokeRefreshToken(refreshToken: string) {
  const basic = Buffer.from(`${process.env.XERO_CLIENT_ID!.trim()}:${process.env.XERO_CLIENT_SECRET!.trim()}`).toString("base64");
  await fetch(XERO_REVOKE_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => undefined);
}

/** The authentication event an access token belongs to (a JWT claim), to tell which organisations were just connected. */
export function authEventOf(accessToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8"));
    return typeof payload.authentication_event_id === "string" ? payload.authentication_event_id : null;
  } catch {
    return null;
  }
}

export const sealTokens = (t: TokenSet, now = Date.now()) => ({
  accessToken: sealToken(t.access_token),
  refreshToken: sealToken(t.refresh_token),
  accessExpiresAt: new Date(now + t.expires_in * 1000),
});

/**
 * A usable access token for the company, refreshing it if it's about to expire. Throws XeroApiError (401)
 * when there's no working connection; the connection is then marked as needing to be reconnected.
 */
async function accessToken(orgId: string, force = false): Promise<{ token: string; tenantId: string }> {
  const result = await withTenant(orgId, async (tx) => {
    const c = await lockXeroConnection(tx, orgId);
    if (!c) return { error: "Xero isn't connected." };
    if (c.status === "reconnect") return { error: c.lastError ?? "Xero needs you to connect again." };
    const current = openToken(c.accessToken);
    if (current && !force && c.accessExpiresAt.getTime() - Date.now() > TOKEN_REFRESH_MARGIN_MS) return { token: current, tenantId: c.tenantId };
    const refresh = openToken(c.refreshToken);
    if (!refresh) {
      await markXeroReconnect(tx, orgId, "Xero needs you to connect again (the saved sign-in couldn't be read).");
      return { error: "reconnect" };
    }
    try {
      const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
      // Nothing after this may throw: the new refresh token must be saved, or the connection is lost.
      await saveXeroTokens(tx, orgId, sealTokens(fresh));
      return { token: fresh.access_token, tenantId: c.tenantId };
    } catch (error) {
      const problem = error instanceof XeroApiError ? explainXeroError(error.status, error.body) : null;
      if (problem?.reconnect) await markXeroReconnect(tx, orgId, problem.message);
      return { error: problem?.message ?? (error instanceof Error ? error.message : "Xero isn't answering."), status: problem?.reconnect ? 401 : 503 };
    }
  });
  if ("token" in result && result.token) return { token: result.token, tenantId: result.tenantId };
  throw new XeroApiError("status" in result && result.status ? result.status : 401, { error: result.error });
}

export type XeroRequest = { query?: Record<string, string>; body?: unknown; idempotencyKey?: string; ifModifiedSince?: Date };

/** One company's Xero organisation. */
export class XeroClient {
  constructor(readonly orgId: string) {}

  async request<T = Record<string, unknown>>(method: "GET" | "PUT" | "POST" | "DELETE", path: string, opts: XeroRequest = {}, retried = false): Promise<T> {
    const { token, tenantId } = await accessToken(this.orgId, retried);
    const url = new URL(`${XERO_API}${path}`);
    if (opts.query) for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v);
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "xero-tenant-id": tenantId,
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey.slice(0, 128) } : {}),
        ...(opts.ifModifiedSince ? { "If-Modified-Since": opts.ifModifiedSince.toUTCString() } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401 && !retried) return this.request<T>(method, path, opts, true);
    if (res.status === 304) return {} as T;
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      // Not JSON (an HTML error page); keep the text.
    }
    if (!res.ok) {
      const retryAfter = Number(res.headers.get("retry-after"));
      if (res.status === 401) await withTenant(this.orgId, (tx) => markXeroReconnect(tx, this.orgId, explainXeroError(401, body).message));
      throw new XeroApiError(res.status, body, Number.isFinite(retryAfter) ? retryAfter : undefined);
    }
    return body as T;
  }
}
