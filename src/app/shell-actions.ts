"use server";

import { getSession, withSession } from "@/auth/session";
import { id } from "@/core/schemas";
import { listNotifications, markRead } from "@/db/notifications";
import { search, type SearchHit } from "@/db/search";

/** What the bell and the ⌘K search ask for. Used in the office app and the site app alike. */

export type BellItem = { id: string; kind: string; title: string; body: string | null; href: string; read: boolean; at: string };

export async function bellAction(): Promise<{ items: BellItem[]; unread: number }> {
  const s = await getSession();
  const { items, unread } = await withSession(s, (tx) => listNotifications(tx, s.orgId, s.memberId));
  return {
    unread,
    items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, read: n.readAt !== null, at: n.createdAt.toISOString() })),
  };
}

/** Mark one notification read, or all of mine with no id. */
export async function markReadAction(notificationId?: string): Promise<void> {
  if (notificationId !== undefined && !id.safeParse(notificationId).success) return;
  const s = await getSession();
  await withSession(s, (tx) => markRead(tx, s.orgId, s.memberId, notificationId ?? null));
}

export async function searchAction(q: string): Promise<SearchHit[]> {
  if (typeof q !== "string") return [];
  const s = await getSession();
  return withSession(s, (tx) => search(tx, s.orgId, s.role, q));
}
