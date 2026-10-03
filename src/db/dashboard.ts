/**
 * Figures for the dashboard, all from real records in the tenant transaction. Money comes from the versions
 * clients were actually sent (`quote_versions.total_pence`), never from live drafts.
 */
import "server-only";
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Tx } from "./index";
import { clients, quoteDecisions, quoteEvents, quoteVersions, quotes } from "./schema";

/** Start of the current month in UK time, as a timestamp. */
export function startOfUkMonth(now = new Date()): Date {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit" }).format(now).split("-").map(Number);
  // Midnight UK on the 1st: try GMT and BST and keep the one that is the 1st at 00:00 in London.
  for (const offset of [0, 1]) {
    const candidate = new Date(Date.UTC(y, m - 1, 1, -offset));
    if (new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).format(candidate) === "00") return candidate;
  }
  return new Date(Date.UTC(y, m - 1, 1));
}

/** Latest sent version of each quote: total and when it was sent. */
const latestVersions = (tx: Tx, orgId: string) =>
  tx
    .selectDistinctOn([quoteVersions.quoteId], { quoteId: quoteVersions.quoteId, total: quoteVersions.totalPence, sentAt: quoteVersions.sentAt })
    .from(quoteVersions)
    .where(eq(quoteVersions.orgId, orgId))
    .orderBy(quoteVersions.quoteId, desc(quoteVersions.versionNo))
    .as("latest");

export async function dashboardData(tx: Tx, orgId: string, now = new Date()) {
  const latest = latestVersions(tx, orgId);
  const awaiting = await tx
    .select({ id: quotes.id, number: quotes.number, title: quotes.title, status: quotes.status, clientName: clients.name, total: latest.total, sentAt: latest.sentAt })
    .from(quotes)
    .innerJoin(latest, eq(latest.quoteId, quotes.id))
    .innerJoin(clients, and(eq(clients.orgId, quotes.orgId), eq(clients.id, quotes.clientId)))
    .where(and(eq(quotes.orgId, orgId), inArray(quotes.status, ["sent", "viewed"])))
    .orderBy(latest.sentAt);

  const views = awaiting.length
    ? await tx
        .select({ quoteId: quoteEvents.quoteId, n: count() })
        .from(quoteEvents)
        .where(and(eq(quoteEvents.orgId, orgId), eq(quoteEvents.kind, "viewed"), inArray(quoteEvents.quoteId, awaiting.map((q) => q.id))))
        .groupBy(quoteEvents.quoteId)
    : [];
  const viewMap = new Map(views.map((v) => [v.quoteId, v.n]));

  const monthStart = startOfUkMonth(now);
  const [won] = await tx
    .select({ n: count(), value: sql<number>`coalesce(sum(${quoteVersions.totalPence}), 0)`.mapWith(Number) })
    .from(quoteDecisions)
    .innerJoin(quoteVersions, and(eq(quoteVersions.orgId, quoteDecisions.orgId), eq(quoteVersions.id, quoteDecisions.versionId)))
    .where(and(eq(quoteDecisions.orgId, orgId), eq(quoteDecisions.decision, "accepted"), gte(quoteDecisions.createdAt, monthStart)));

  const since90 = new Date(now.getTime() - 90 * 86_400_000);
  const decided = await tx
    .select({ decision: quoteDecisions.decision, n: count() })
    .from(quoteDecisions)
    .where(and(eq(quoteDecisions.orgId, orgId), gte(quoteDecisions.createdAt, since90)))
    .groupBy(quoteDecisions.decision);
  const accepted90 = decided.find((d) => d.decision === "accepted")?.n ?? 0;
  const declined90 = decided.find((d) => d.decision === "declined")?.n ?? 0;

  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const [opened] = await tx
    .select({ n: sql<number>`count(distinct ${quoteEvents.quoteId})`.mapWith(Number) })
    .from(quoteEvents)
    .where(and(eq(quoteEvents.orgId, orgId), eq(quoteEvents.kind, "viewed"), gte(quoteEvents.createdAt, weekAgo)));

  const activity = await tx
    .select({ id: quoteEvents.id, kind: quoteEvents.kind, createdAt: quoteEvents.createdAt, quoteId: quotes.id, number: quotes.number, title: quotes.title, clientName: clients.name })
    .from(quoteEvents)
    .innerJoin(quotes, and(eq(quotes.orgId, quoteEvents.orgId), eq(quotes.id, quoteEvents.quoteId)))
    .innerJoin(clients, and(eq(clients.orgId, quotes.orgId), eq(clients.id, quotes.clientId)))
    .where(and(eq(quoteEvents.orgId, orgId), eq(quoteEvents.actor, "client")))
    .orderBy(desc(quoteEvents.createdAt))
    .limit(8);

  const drafts = await tx
    .select({ id: quotes.id, number: quotes.number, title: quotes.title, clientName: clients.name, updatedAt: quotes.updatedAt })
    .from(quotes)
    .innerJoin(clients, and(eq(clients.orgId, quotes.orgId), eq(clients.id, quotes.clientId)))
    .where(and(eq(quotes.orgId, orgId), eq(quotes.status, "draft")))
    .orderBy(desc(quotes.updatedAt))
    .limit(5);

  return {
    awaiting: awaiting.map((q) => ({ ...q, views: viewMap.get(q.id) ?? 0 })),
    awaitingValue: awaiting.reduce((sum, q) => sum + q.total, 0),
    wonThisMonth: { count: won?.n ?? 0, value: won?.value ?? 0 },
    winRate90: accepted90 + declined90 === 0 ? null : Math.round((accepted90 / (accepted90 + declined90)) * 100),
    decided90: accepted90 + declined90,
    openedThisWeek: opened?.n ?? 0,
    activity,
    drafts,
  };
}
