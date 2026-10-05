/**
 * The signed-in user and their company, for Server Components and Server Actions.
 *
 * This is where the tenant comes from: Clerk's verified session names the organization, and we map it to
 * our `organizations.id`. Request input never chooses the tenant. Use `withSession` for queries.
 */
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { emailOrNull, personName } from "@/core/clerk";
import { can, roleFromClerk, type Permission, type Role } from "@/core/roles";
import { findOrgByClerkId, withTenant, type Tx } from "@/db";
import { members, organizations } from "@/db/schema";
import { FILL_ONLY, syncMember, syncOrganization } from "./clerk-sync";
import { PLAN_LIMIT_PATH, SELECT_COMPANY_PATH } from "./paths";
import { hasSeat } from "@/db/billing";

export type Session = {
  /** Our tenant id (`organizations.id`). */
  orgId: string;
  orgName: string;
  clerkOrgId: string;
  clerkUserId: string;
  memberId: string;
  memberName: string;
  role: Role;
};

export { SELECT_COMPANY_PATH };

/**
 * The current session, or a redirect: to sign-in without a user, to company selection without an active
 * company (or if the company or membership was removed). Cached per request.
 */
export const getSession = cache(async (): Promise<Session> => {
  const { userId, orgId: clerkOrgId, orgRole, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
  if (!clerkOrgId) redirect(SELECT_COMPANY_PATH);
  const role = roleFromClerk(orgRole);

  const orgId = (await resolveOrg(clerkOrgId)) ?? redirect(SELECT_COMPANY_PATH);
  const member = await withTenant(orgId, async (tx) => {
    const [org] = await tx.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId));
    const found = await findMember(tx, orgId, userId);
    return { orgName: org?.name ?? "", found };
  });

  let found = member.found;
  if (!found) {
    // First request before the membership webhook arrived: create the member from Clerk's own records.
    const user = await currentUser();
    const primary = user?.primaryEmailAddress?.emailAddress;
    await syncMember({
      org: { clerkOrgId, name: member.orgName, at: FILL_ONLY },
      clerkUserId: userId,
      role,
      name: personName(user?.firstName, user?.lastName, primary ?? user?.username),
      email: emailOrNull(primary),
      active: true,
      at: FILL_ONLY,
    });
    found = await withTenant(orgId, (tx) => findMember(tx, orgId, userId));
  }
  // Clerk session tokens live up to 60 s, so a just-removed member can still present one. The database
  // (updated by the membership.deleted webhook) has the final word.
  if (!found?.active) redirect(SELECT_COMPANY_PATH);
  // Free includes one login (src/core/plans.ts): everyone else is asked to have the company upgrade.
  if (!(await withTenant(orgId, (tx) => hasSeat(tx, orgId, found.id)))) redirect(PLAN_LIMIT_PATH);

  return { orgId, orgName: member.orgName, clerkOrgId, clerkUserId: userId, memberId: found.id, memberName: found.name, role };
});

async function resolveOrg(clerkOrgId: string): Promise<string | null> {
  const existing = await findOrgByClerkId(clerkOrgId);
  if (existing) return existing.deleted ? null : existing.id;
  // First request before the organization webhook arrived.
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId: clerkOrgId });
  return syncOrganization({ clerkOrgId, name: org.name, at: FILL_ONLY });
}

async function findMember(tx: Tx, orgId: string, clerkUserId: string) {
  const [row] = await tx
    .select({ id: members.id, name: members.name, active: members.active })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.clerkUserId, clerkUserId)));
  return row;
}

/** The session, or a redirect to the right home if this role lacks `permission`. For pages. */
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await getSession();
  if (!can(session.role, permission)) redirect(can(session.role, "app.office") ? "/app" : "/m");
  return session;
}

/** Run `fn` in the session's tenant. The only way Server Components and Actions should query. */
export async function withSession<T>(session: Session, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withTenant(session.orgId, fn);
}
