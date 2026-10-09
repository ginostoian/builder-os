/**
 * Clerk → database sync, against real Postgres as the app role. Covers the lookup functions, out-of-order
 * and duplicate deliveries, soft deletion, and the webhook event mapping end to end.
 */
import { randomUUID } from "node:crypto";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, findOrgByClerkId, findOrgsForClerkUser, withTenant } from "@/db";
import { members, organizations } from "@/db/schema";
import { listWorkers } from "@/db/team";
import { appUrl } from "@/test/db-urls";
import { FILL_ONLY, deactivateUser, deleteOrganization, syncMember, syncOrganization, syncUserProfile, type MemberSnapshot } from "./clerk-sync";
import { handleClerkEvent } from "./clerk-webhook";

const newClerkOrg = () => `org_${randomUUID().replaceAll("-", "")}`;
const newClerkUser = () => `user_${randomUUID().replaceAll("-", "")}`;
const t = (seconds: number) => new Date(Date.UTC(2026, 9, 1, 9, 0, seconds));

async function org(orgId: string) {
  return withTenant(orgId, async (tx) => (await tx.select().from(organizations).where(eq(organizations.id, orgId)))[0]);
}
async function member(orgId: string, clerkUserId: string) {
  return withTenant(orgId, async (tx) => (await tx.select().from(members).where(and(eq(members.orgId, orgId), eq(members.clerkUserId, clerkUserId))))[0]);
}
const memberSnapshot = (clerkOrgId: string, clerkUserId: string, overrides: Partial<MemberSnapshot> = {}): MemberSnapshot => ({
  org: { clerkOrgId, name: "Hale & Sons", at: t(0) },
  clerkUserId,
  role: "estimator",
  name: "Dan Hale",
  email: "dan@halesons.co.uk",
  active: true,
  at: t(10),
  ...overrides,
});

let raw: postgres.Sql;

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
  raw = postgres(appUrl(), { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  await raw?.end();
  await closeDb();
});

describe("lookups", () => {
  it("map Clerk IDs to ours and nothing else", async () => {
    const clerkOrgId = newClerkOrg();
    expect(await findOrgByClerkId(clerkOrgId)).toBeNull();
    const id = await syncOrganization({ clerkOrgId, name: "Hale & Sons", at: t(1) });
    expect(await findOrgByClerkId(clerkOrgId)).toEqual({ id, deleted: false });
  });

  it("reject anything that isn't a Clerk ID", async () => {
    await expect(findOrgByClerkId("x' or 1=1 --")).rejects.toThrow();
    await expect(findOrgsForClerkUser("org_notauser")).rejects.toThrow();
  });

  it("don't give the app role a way past RLS", async () => {
    // The app role can't become the lookup role, and the lookup role can't read anything but ids (and, for
    // the portal lookup, the token it matches on).
    await expect(raw`set role builderos_lookup`).rejects.toMatchObject({ code: "42501" });
    await expect(raw`set role builderos_billing`).rejects.toMatchObject({ code: "42501" });
    await expect(raw`set role builderos_metrics`).rejects.toMatchObject({ code: "42501" });
    const fns = await raw<{ name: string; owner: string; definer: boolean }[]>`
      select p.proname as name, r.rolname as owner, p.prosecdef as definer
      from pg_proc p join pg_roles r on r.oid = p.proowner
      where p.proname in ('app_billing_apply_subscription', 'app_billing_set_comped', 'app_billing_set_connect', 'app_billing_set_customer', 'app_enquiry_form_lookup', 'app_estimator_lookup', 'app_lead_unsubscribe_lookup', 'app_org_for_clerk', 'app_orgs_for_clerk_user', 'app_orgs_with_due_automations', 'app_orgs_with_due_invoices', 'app_orgs_with_due_survey_reminders', 'app_orgs_with_expiring_certificates', 'app_platform_companies', 'app_platform_company_stats', 'app_platform_daily_activity', 'app_platform_subscription_events', 'app_platform_user_signups', 'app_portal_by_email', 'app_portal_lookup') order by 1`;
    expect(fns).toEqual([
      { name: "app_billing_apply_subscription", owner: "builderos_billing", definer: true },
      { name: "app_billing_set_comped", owner: "builderos_billing", definer: true },
      { name: "app_billing_set_connect", owner: "builderos_billing", definer: true },
      { name: "app_billing_set_customer", owner: "builderos_billing", definer: true },
      { name: "app_enquiry_form_lookup", owner: "builderos_lookup", definer: true },
      { name: "app_estimator_lookup", owner: "builderos_lookup", definer: true },
      { name: "app_lead_unsubscribe_lookup", owner: "builderos_lookup", definer: true },
      { name: "app_org_for_clerk", owner: "builderos_lookup", definer: true },
      { name: "app_orgs_for_clerk_user", owner: "builderos_lookup", definer: true },
      { name: "app_orgs_with_due_automations", owner: "builderos_lookup", definer: true },
      { name: "app_orgs_with_due_invoices", owner: "builderos_lookup", definer: true },
      { name: "app_orgs_with_due_survey_reminders", owner: "builderos_lookup", definer: true },
      { name: "app_orgs_with_expiring_certificates", owner: "builderos_lookup", definer: true },
      { name: "app_platform_companies", owner: "builderos_billing", definer: true },
      { name: "app_platform_company_stats", owner: "builderos_metrics", definer: true },
      { name: "app_platform_daily_activity", owner: "builderos_metrics", definer: true },
      { name: "app_platform_subscription_events", owner: "builderos_metrics", definer: true },
      { name: "app_platform_user_signups", owner: "builderos_metrics", definer: true },
      { name: "app_portal_by_email", owner: "builderos_lookup", definer: true },
      { name: "app_portal_lookup", owner: "builderos_lookup", definer: true },
    ]);
    const visible = await raw<{ table: string; column: string }[]>`
      select c.relname as table, a.attname as column
      from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
        and has_column_privilege('builderos_lookup', c.oid, a.attnum, 'SELECT')
      order by 1, 2`;
    expect(visible).toEqual([
      { table: "automation_runs", column: "next_at" },
      { table: "automation_runs", column: "org_id" },
      { table: "automation_runs", column: "status" },
      { table: "clients", column: "archived_at" },
      { table: "clients", column: "email" },
      { table: "clients", column: "id" },
      { table: "clients", column: "org_id" },
      { table: "invoices", column: "due_date" },
      { table: "invoices", column: "org_id" },
      { table: "invoices", column: "status" },
      { table: "leads", column: "id" },
      { table: "leads", column: "org_id" },
      { table: "leads", column: "unsubscribe_token" },
      { table: "members", column: "clerk_user_id" },
      { table: "members", column: "org_id" },
      { table: "organizations", column: "clerk_org_id" },
      { table: "organizations", column: "deleted_at" },
      { table: "organizations", column: "enquiry_token" },
      { table: "organizations", column: "estimator_token" },
      { table: "organizations", column: "id" },
      { table: "organizations", column: "reminders_enabled" },
      { table: "portal_access", column: "client_id" },
      { table: "portal_access", column: "id" },
      { table: "portal_access", column: "org_id" },
      { table: "portal_access", column: "revoked_at" },
      { table: "portal_access", column: "token" },
      { table: "survey_bookings", column: "org_id" },
      { table: "survey_bookings", column: "reminder_sent_at" },
      { table: "survey_bookings", column: "starts_at" },
      { table: "survey_bookings", column: "status" },
      { table: "worker_certificates", column: "expires_on" },
      { table: "worker_certificates", column: "org_id" },
      { table: "worker_certificates", column: "reminded_at" },
      { table: "worker_certificates", column: "worker_id" },
      { table: "workers", column: "archived_at" },
      { table: "workers", column: "id" },
      { table: "workers", column: "org_id" },
    ]);
  });
});

describe("organizations", () => {
  it("creates once, even when two deliveries race", async () => {
    const clerkOrgId = newClerkOrg();
    const [first, second] = await Promise.all([
      syncOrganization({ clerkOrgId, name: "Hale & Sons", at: t(1) }),
      syncOrganization({ clerkOrgId, name: "Hale & Sons", at: t(1) }),
    ]);
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it("applies newer updates and ignores older ones", async () => {
    const clerkOrgId = newClerkOrg();
    const id = (await syncOrganization({ clerkOrgId, name: "Hale and Sons", at: t(5) }))!;
    await syncOrganization({ clerkOrgId, name: "Hale & Sons Ltd", at: t(9) });
    await syncOrganization({ clerkOrgId, name: "Stale name", at: t(7) });
    await syncOrganization({ clerkOrgId, name: "First sign-in", at: FILL_ONLY });
    expect((await org(id)).name).toBe("Hale & Sons Ltd");
  });

  it("starts new companies on the Free plan with default settings", async () => {
    const id = (await syncOrganization({ clerkOrgId: newClerkOrg(), name: "  Hale\u0007 &   Sons  ", at: t(1) }))!;
    expect(await org(id)).toMatchObject({ name: "Hale & Sons", plan: "free", defaultVatRateBps: 2000, deletedAt: null });
  });

  it("soft-deletes, and a late update or membership can't bring it back", async () => {
    const clerkOrgId = newClerkOrg();
    const id = (await syncOrganization({ clerkOrgId, name: "Hale & Sons", at: t(1) }))!;
    await deleteOrganization(clerkOrgId, t(20));
    expect(await findOrgByClerkId(clerkOrgId)).toEqual({ id, deleted: true });
    expect(await syncOrganization({ clerkOrgId, name: "Late update", at: t(15) })).toBeNull();
    expect(await syncMember(memberSnapshot(clerkOrgId, newClerkUser()))).toBeNull();
    expect((await org(id)).name).toBe("Hale & Sons");
  });

  it("records a deletion that arrives before the creation", async () => {
    const clerkOrgId = newClerkOrg();
    await deleteOrganization(clerkOrgId, t(20));
    expect(await syncOrganization({ clerkOrgId, name: "Hale & Sons", at: t(1) })).toBeNull();
    expect((await findOrgByClerkId(clerkOrgId))?.deleted).toBe(true);
  });
});

describe("members", () => {
  it("creates the organization from the membership if it arrives first", async () => {
    const clerkOrgId = newClerkOrg();
    const clerkUserId = newClerkUser();
    const memberId = await syncMember(memberSnapshot(clerkOrgId, clerkUserId));
    const orgId = (await findOrgByClerkId(clerkOrgId))!.id;
    expect(await member(orgId, clerkUserId)).toMatchObject({ id: memberId, role: "estimator", name: "Dan Hale", active: true });
    // Everyone with a login is on the team, once, however many times the membership is synced.
    await syncMember(memberSnapshot(clerkOrgId, clerkUserId, { at: new Date(Date.now() + 1_000) }));
    const team = await withTenant(orgId, (tx) => listWorkers(tx, orgId, { today: "2026-10-05" }));
    expect(team.map((w) => [w.name, w.memberId])).toEqual([["Dan Hale", memberId]]);
  });

  it("orders role changes and removal by Clerk time", async () => {
    const clerkOrgId = newClerkOrg();
    const clerkUserId = newClerkUser();
    await syncMember(memberSnapshot(clerkOrgId, clerkUserId, { role: "estimator", at: t(10) }));
    await syncMember(memberSnapshot(clerkOrgId, clerkUserId, { role: "admin", at: t(30) }));
    await syncMember(memberSnapshot(clerkOrgId, clerkUserId, { role: "employee", at: t(20) })); // late, older
    const orgId = (await findOrgByClerkId(clerkOrgId))!.id;
    expect((await member(orgId, clerkUserId)).role).toBe("admin");

    await syncMember(memberSnapshot(clerkOrgId, clerkUserId, { role: "admin", active: false, at: t(40) }));
    await syncMember(memberSnapshot(clerkOrgId, clerkUserId, { role: "office", at: t(35) })); // late update after removal
    expect(await member(orgId, clerkUserId)).toMatchObject({ active: false, role: "admin" });

    await syncMember(memberSnapshot(clerkOrgId, clerkUserId, { role: "office", at: t(50) })); // invited back
    expect(await member(orgId, clerkUserId)).toMatchObject({ active: true, role: "office" });
  });

  it("first sign-in fills gaps but never overwrites synced data", async () => {
    const clerkOrgId = newClerkOrg();
    const clerkUserId = newClerkUser();
    await syncMember(memberSnapshot(clerkOrgId, clerkUserId, { role: "site_lead", at: t(10) }));
    await syncMember(memberSnapshot(clerkOrgId, clerkUserId, { role: "admin", name: "Other", org: { clerkOrgId, name: "x", at: FILL_ONLY }, at: FILL_ONLY }));
    const orgId = (await findOrgByClerkId(clerkOrgId))!.id;
    expect(await member(orgId, clerkUserId)).toMatchObject({ role: "site_lead", name: "Dan Hale" });
  });

  it("copies profile changes to every company and deactivates deleted users", async () => {
    const clerkUserId = newClerkUser();
    const [orgA, orgB] = [newClerkOrg(), newClerkOrg()];
    await syncMember(memberSnapshot(orgA, clerkUserId));
    await syncMember(memberSnapshot(orgB, clerkUserId));
    const ids = await Promise.all([orgA, orgB].map(async (o) => (await findOrgByClerkId(o))!.id));
    expect((await findOrgsForClerkUser(clerkUserId)).sort()).toEqual([...ids].sort());

    await syncUserProfile(clerkUserId, { name: "Daniel Hale", email: "daniel@halesons.co.uk" });
    for (const id of ids) expect(await member(id, clerkUserId)).toMatchObject({ name: "Daniel Hale", email: "daniel@halesons.co.uk" });

    await deactivateUser(clerkUserId, t(59));
    for (const id of ids) expect((await member(id, clerkUserId)).active).toBe(false);
  });
});

describe("webhook events", () => {
  const orgJson = (id: string, name: string, updatedAt: number) => ({
    object: "organization",
    id,
    name,
    slug: null,
    image_url: "",
    has_image: false,
    created_at: updatedAt,
    updated_at: updatedAt,
    public_metadata: {},
    max_allowed_memberships: 5,
    admin_delete_enabled: true,
    members_count: 1,
    created_by: "user_x",
  });
  const membershipJson = (clerkOrgId: string, userId: string, role: string, updatedAt: number) => ({
    object: "organization_membership",
    id: `orgmem_${randomUUID().replaceAll("-", "")}`,
    role,
    permissions: [],
    public_metadata: {},
    created_at: updatedAt,
    updated_at: updatedAt,
    organization: orgJson(clerkOrgId, "Hale & Sons", updatedAt),
    public_user_data: { user_id: userId, identifier: "SITE@halesons.co.uk", first_name: "Sam", last_name: null, image_url: "", has_image: false },
  });
  const event = (type: string, data: unknown, timestamp = Date.now()) =>
    ({ type, data, object: "event", timestamp, instance_id: "ins_test", event_attributes: { http_request: { client_ip: "", user_agent: "" } } }) as unknown as WebhookEvent;

  it("syncs organization and membership events", async () => {
    const clerkOrgId = newClerkOrg();
    const userId = newClerkUser();
    expect(await handleClerkEvent(event("organization.created", orgJson(clerkOrgId, "Hale & Sons", t(1).getTime())))).toBe("synced");
    expect(await handleClerkEvent(event("organizationMembership.created", membershipJson(clerkOrgId, userId, "org:site_lead", t(2).getTime())))).toBe("synced");
    const orgId = (await findOrgByClerkId(clerkOrgId))!.id;
    expect(await member(orgId, userId)).toMatchObject({ role: "site_lead", name: "Sam", email: "site@halesons.co.uk", active: true });

    await handleClerkEvent(event("organizationMembership.deleted", membershipJson(clerkOrgId, userId, "org:site_lead", t(2).getTime()), t(3).getTime()));
    expect((await member(orgId, userId)).active).toBe(false);

    await handleClerkEvent(event("organization.deleted", { object: "organization", id: clerkOrgId, deleted: true }, t(4).getTime()));
    expect((await findOrgByClerkId(clerkOrgId))?.deleted).toBe(true);
  });

  it("gives unknown Clerk roles the least access", async () => {
    const clerkOrgId = newClerkOrg();
    const userId = newClerkUser();
    await handleClerkEvent(event("organizationMembership.created", membershipJson(clerkOrgId, userId, "org:member", t(2).getTime())));
    expect((await member((await findOrgByClerkId(clerkOrgId))!.id, userId)).role).toBe("employee");
  });

  it("acknowledges and ignores events it doesn't handle", async () => {
    expect(await handleClerkEvent(event("session.created", { id: "sess_x" }))).toBe("ignored");
  });
});
