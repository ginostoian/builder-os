/** The bell's notifications: created where things happen, read by one person at a time. */
import "server-only";
import { and, count, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { NOTIFICATIONS_SHOWN, NOTIFICATION_KEEP_DAYS, type NewNotification } from "@/core/notifications";
import type { Role } from "@/core/roles";
import type { Tx } from "./index";
import { members, notifications } from "./schema";

/**
 * Notify people (active members only; duplicates and `except`, usually whoever did it, are skipped).
 * Old notifications of the same people are cleared as new ones arrive.
 */
export async function notify(tx: Tx, orgId: string, memberIds: (string | null | undefined)[], n: NewNotification, except?: string | null) {
  const ids = [...new Set(memberIds.filter((m): m is string => Boolean(m) && m !== except))];
  if (ids.length === 0) return;
  const active = await tx.select({ id: members.id }).from(members).where(and(eq(members.orgId, orgId), inArray(members.id, ids), eq(members.active, true)));
  if (active.length === 0) return;
  await tx.insert(notifications).values(active.map((m) => ({ orgId, memberId: m.id, kind: n.kind, title: n.title.slice(0, 300), body: n.body ? n.body.slice(0, 600) : null, href: n.href })));
  await tx
    .delete(notifications)
    .where(and(eq(notifications.orgId, orgId), inArray(notifications.memberId, active.map((m) => m.id)), lt(notifications.createdAt, sql`now() - make_interval(days => ${NOTIFICATION_KEEP_DAYS})`)));
}

/** Active members with one of these roles (e.g. who hears about new enquiries). */
export async function membersWithRoles(tx: Tx, orgId: string, roles: Role[]): Promise<string[]> {
  const rows = await tx.select({ id: members.id }).from(members).where(and(eq(members.orgId, orgId), eq(members.active, true), inArray(members.role, roles)));
  return rows.map((r) => r.id);
}

export async function listNotifications(tx: Tx, orgId: string, memberId: string) {
  const items = await tx
    .select({ id: notifications.id, kind: notifications.kind, title: notifications.title, body: notifications.body, href: notifications.href, readAt: notifications.readAt, createdAt: notifications.createdAt })
    .from(notifications)
    .where(and(eq(notifications.orgId, orgId), eq(notifications.memberId, memberId)))
    .orderBy(desc(notifications.createdAt))
    .limit(NOTIFICATIONS_SHOWN);
  const [{ n }] = await tx
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.orgId, orgId), eq(notifications.memberId, memberId), isNull(notifications.readAt)));
  return { items, unread: n };
}

/** Mark one (or, with null, all) of my notifications as read. */
export async function markRead(tx: Tx, orgId: string, memberId: string, notificationId: string | null) {
  await tx
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.orgId, orgId), eq(notifications.memberId, memberId), isNull(notifications.readAt), notificationId ? eq(notifications.id, notificationId) : undefined));
}
