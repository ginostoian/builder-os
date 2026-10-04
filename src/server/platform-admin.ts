/**
 * The platform team (Builder OS staff), named by email in PLATFORM_ADMIN_EMAILS. They can see every
 * company's plan and make one complimentary. Nobody else, whatever their role in their own company.
 */
import "server-only";
import { cache } from "react";
import { getSession, withSession } from "@/auth/session";
import { memberEmail } from "@/db/sending";

const admins = () =>
  new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

/** Cached per request: the app frame and the page both ask. */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const list = admins();
  if (list.size === 0) return false;
  const s = await getSession();
  const email = await withSession(s, (tx) => memberEmail(tx, s.orgId, s.memberId));
  return Boolean(email && list.has(email.toLowerCase()));
});
