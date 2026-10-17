import { NextResponse } from "next/server";
import { can } from "@/core/roles";
import { getSession } from "@/auth/session";
import { appOrigin } from "@/server/origin";
import { hasFeature } from "@/server/plan";
import { xeroConfigured } from "@/server/xero/client";
import { completeConnection, XeroTakenError } from "@/server/xero/setup";
import { checkXeroState, xeroRedirectUri } from "@/server/xero/state";

export const dynamic = "force-dynamic";

/** Xero sends the person back here after they allow (or cancel) the connection. */
export async function GET(request: Request) {
  const origin = await appOrigin();
  const back = (query: string) => NextResponse.redirect(`${origin}/app/settings/xero?${query}`);
  const session = await getSession();
  const url = new URL(request.url);
  if (!(await checkXeroState(url.searchParams.get("state"), session.orgId))) return back("error=state");
  if (url.searchParams.get("error")) return back("error=cancelled");
  if (!can(session.role, "settings.manage") || !xeroConfigured() || !(await hasFeature("invoicing"))) return back("error=not_allowed");
  const code = url.searchParams.get("code");
  if (!code) return back("error=cancelled");
  try {
    const r = await completeConnection(session.orgId, session.memberId, code, xeroRedirectUri(origin));
    return back(`connected=1${r.extra ? "&extra=1" : ""}`);
  } catch (error) {
    if (error instanceof XeroTakenError) return back("error=taken");
    console.error("Xero connection failed", error instanceof Error ? error.message : error);
    return back("error=failed");
  }
}
