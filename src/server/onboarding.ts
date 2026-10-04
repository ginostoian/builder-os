/** The signed-in person's getting-started guide, worked out once per request. */
import "server-only";
import { cache } from "react";
import { guideFor, type Guide } from "@/core/onboarding";
import { onboardingState } from "@/db/onboarding";
import { getSession, withSession } from "@/auth/session";
import { getEntitlement } from "./plan";

export type MyGuide = Guide & { hidden: boolean; tourDone: boolean; firstName: string };

export const getGuide = cache(async (): Promise<MyGuide> => {
  const session = await getSession();
  const [state, ent] = await Promise.all([withSession(session, (tx) => onboardingState(tx, session.orgId, session.memberId)), getEntitlement()]);
  return {
    ...guideFor(session.role, ent.plan, state.signals, state.skipped),
    hidden: state.hidden,
    tourDone: state.tourAt !== null,
    firstName: session.memberName.split(/\s+/)[0] ?? "",
  };
});
