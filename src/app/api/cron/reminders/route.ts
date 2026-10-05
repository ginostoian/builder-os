import { timingSafeEqual } from "node:crypto";
import { sweepRateLimits } from "@/db";
import { appOrigin } from "@/server/origin";
import { runAutomations } from "@/server/automations";
import { runCertificateReminders, runReminders } from "@/server/reminders";
import { runSurveyReminders } from "@/server/surveys";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The daily run: payment reminders to clients, expiring team certificates to the office, and the
 * pipeline's automation emails due today, and reminders for tomorrow's survey visits. Vercel Cron calls this (vercel.json) with `Authorization: Bearer $CRON_SECRET`;
 * anything else is refused. Without CRON_SECRET the endpoint is off.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Reminders aren't set up (CRON_SECRET is missing)." }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const origin = await appOrigin();
  const payments = await runReminders(origin);
  const certificates = await runCertificateReminders(origin);
  const automations = await runAutomations(origin);
  const surveys = await runSurveyReminders(origin);
  const rateLimitsSwept = await sweepRateLimits().catch(() => 0);
  const result = { ...payments, certificates, automations, surveys, rateLimitsSwept };
  await heartbeat(result);
  return Response.json(result);
}

/**
 * Tell the uptime monitor the daily job ran (CRON_HEARTBEAT_URL, e.g. a Better Stack heartbeat or a
 * healthchecks.io check). If it doesn't hear from us by its deadline, it alerts: the job stopped running.
 */
async function heartbeat(result: object) {
  const url = process.env.CRON_HEARTBEAT_URL?.trim();
  if (!url?.startsWith("https://")) return;
  try {
    await fetch(url, { method: "POST", body: JSON.stringify(result), headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(5_000) });
  } catch (error) {
    console.error("Cron heartbeat failed", error instanceof Error ? error.message : error);
  }
}
