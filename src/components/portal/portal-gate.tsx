import { Suspense } from "react";
import { notFound } from "next/navigation";
import { portalGate } from "@/server/portal-auth";
import { PortalSignInForm, PortalSignInFrame } from "./portal-sign-in";

/**
 * What a portal page shows when it couldn't load its content: the sign-in, if that's why, or not found.
 * Pages check `requirePortal` in their own loader (never only here or in a layout), so nothing private is
 * fetched for a browser that hasn't signed in.
 */
export async function PortalBlocked({ token }: { token: string }) {
  const gate = await portalGate(token);
  if (!gate || gate.state === "open") notFound();
  return (
    <PortalSignInFrame company={gate.company.name} logoUrl={gate.company.logoUrl}>
      <Suspense>
        <PortalSignInForm token={token} emailHint={gate.emailHint} company={gate.company.name} />
      </Suspense>
    </PortalSignInFrame>
  );
}
