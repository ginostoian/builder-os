/**
 * Copies Clerk organizations and memberships into `organizations` and `members` (plan §3 "Identity model").
 * Called by the Clerk webhook and, on first sign-in, by the session (so local development works without
 * webhooks reaching the machine).
 *
 * Ordering: Svix retries and can deliver events out of order. Every write carries the Clerk time of the
 * change (`at`) and is skipped if the row already holds a newer one. The session's first-sign-in writes use
 * the epoch, so they only ever insert missing rows and never overwrite webhook data.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { companyName } from "@/core/clerk";
import type { Role } from "@/core/roles";
import { findOrgByClerkId, findOrgsForClerkUser, withTenant } from "@/db";
import { members, organizations } from "@/db/schema";

/** Time for writes that should only fill gaps, never overwrite synced data. */
export const FILL_ONLY = new Date(0);

export type OrgSnapshot = { clerkOrgId: string; name: string; at: Date };

/**
 * Create or update our organization for a Clerk organization. Returns its id, or null if it was deleted.
 * Inserts use the column list the app role is granted (migration 0005), so billing columns keep defaults.
 */
export async function syncOrganization({ clerkOrgId, name, at }: OrgSnapshot): Promise<string | null> {
  const existing = await findOrgByClerkId(clerkOrgId);
  if (existing) {
    if (existing.deleted) return null;
    await withTenant(existing.id, (tx) =>
      tx
        .update(organizations)
        .set({ name: companyName(name), clerkSyncedAt: at })
        .where(and(eq(organizations.id, existing.id), newerThanSynced(organizations.clerkSyncedAt, at))),
    );
    return existing.id;
  }
  const orgId = randomUUID();
  await withTenant(orgId, (tx) =>
    tx.execute(sql`
      insert into organizations (id, clerk_org_id, name, clerk_synced_at)
      values (${orgId}, ${clerkOrgId}, ${companyName(name)}, ${at.toISOString()})
      on conflict (clerk_org_id) do nothing`),
  );
  // Another delivery may have inserted it first; the lookup returns whichever row won.
  const created = await findOrgByClerkId(clerkOrgId);
  return created && !created.deleted ? created.id : null;
}

/**
 * Soft-delete. If the organization never reached us (deleted before its `created` event arrived), insert a
 * tombstone so a late `created` event can't bring it back.
 */
export async function deleteOrganization(clerkOrgId: string, at: Date): Promise<void> {
  const existing = await findOrgByClerkId(clerkOrgId);
  if (!existing) {
    const orgId = randomUUID();
    await withTenant(orgId, (tx) =>
      tx.execute(sql`
        insert into organizations (id, clerk_org_id, name, clerk_synced_at, deleted_at)
        values (${orgId}, ${clerkOrgId}, ${"Deleted company"}, ${at.toISOString()}, ${at.toISOString()})
        on conflict (clerk_org_id) do nothing`),
    );
    const raced = await findOrgByClerkId(clerkOrgId);
    if (raced && !raced.deleted) await deleteOrganization(clerkOrgId, at);
    return;
  }
  if (existing.deleted) return;
  await withTenant(existing.id, (tx) =>
    tx
      .update(organizations)
      .set({ deletedAt: at, clerkSyncedAt: at })
      .where(and(eq(organizations.id, existing.id), newerThanSynced(organizations.clerkSyncedAt, at))),
  );
}

export type MemberSnapshot = {
  org: OrgSnapshot;
  clerkUserId: string;
  role: Role;
  name: string;
  email: string | null;
  /** false when the membership was removed. The row is kept: clients and quotes may point at it. */
  active: boolean;
  at: Date;
};

/** Create or update a member. Also makes sure the organization exists, from the membership's copy of it. */
export async function syncMember(member: MemberSnapshot): Promise<string | null> {
  const orgId = await syncOrganization(member.org);
  if (!orgId) return null;
  return withTenant(orgId, async (tx) => {
    await tx
      .insert(members)
      .values({
        orgId,
        clerkUserId: member.clerkUserId,
        role: member.role,
        name: member.name,
        email: member.email,
        active: member.active,
        clerkSyncedAt: member.at,
      })
      .onConflictDoUpdate({
        target: [members.orgId, members.clerkUserId],
        set: {
          role: sql`excluded.role`,
          name: sql`excluded.name`,
          email: sql`excluded.email`,
          active: sql`excluded.active`,
          clerkSyncedAt: sql`excluded.clerk_synced_at`,
          updatedAt: sql`now()`,
        },
        setWhere: newerThanSynced(members.clerkSyncedAt, member.at),
      });
    const [row] = await tx
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.orgId, orgId), eq(members.clerkUserId, member.clerkUserId)));
    return row?.id ?? null;
  });
}

/**
 * Copy a user's name and email to every organization they belong to. Not ordered by `clerk_synced_at`:
 * that tracks the membership, and membership events carry the name too, so a stale name self-corrects.
 */
export async function syncUserProfile(clerkUserId: string, profile: { name: string; email: string | null }): Promise<void> {
  for (const orgId of await findOrgsForClerkUser(clerkUserId)) {
    await withTenant(orgId, (tx) =>
      tx.update(members).set(profile).where(and(eq(members.orgId, orgId), eq(members.clerkUserId, clerkUserId))),
    );
  }
}

/** User deleted in Clerk: deactivate every membership. */
export async function deactivateUser(clerkUserId: string, at: Date): Promise<void> {
  for (const orgId of await findOrgsForClerkUser(clerkUserId)) {
    await withTenant(orgId, (tx) =>
      tx
        .update(members)
        .set({ active: false, clerkSyncedAt: at })
        .where(and(eq(members.orgId, orgId), eq(members.clerkUserId, clerkUserId), newerThanSynced(members.clerkSyncedAt, at))),
    );
  }
}

const newerThanSynced = (column: typeof organizations.clerkSyncedAt | typeof members.clerkSyncedAt, at: Date) =>
  or(isNull(column), lte(column, at));
