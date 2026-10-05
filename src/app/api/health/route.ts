import { pingDb } from "@/db";

export const dynamic = "force-dynamic";

/**
 * For uptime monitors: 200 when the app is up and can reach its database, 503 when it can't. Says nothing
 * else (no versions, no error text), and is never cached.
 */
export async function GET() {
  const started = Date.now();
  try {
    await Promise.race([pingDb(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5_000))]);
    return Response.json({ ok: true, ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Health check failed", error instanceof Error ? error.message : error);
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const HEAD = GET;
