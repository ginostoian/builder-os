import { timingSafeEqual } from "node:crypto";
import { appOrigin } from "@/server/origin";
import { runReminders } from "@/server/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily payment reminders. Vercel Cron calls this (vercel.json) with `Authorization: Bearer $CRON_SECRET`;
 * anything else is refused. Without CRON_SECRET the endpoint is off.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Reminders aren't set up (CRON_SECRET is missing)." }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const run = await runReminders(await appOrigin());
  return Response.json(run);
}
