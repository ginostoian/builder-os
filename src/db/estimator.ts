/**
 * The cost estimator for a company's own website: its settings, and the public link that turns it on.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { DEFAULT_ESTIMATOR, estimatorSettings, type EstimatorSettings } from "@/core/estimator";
import type { Tx } from "./index";
import { organizations } from "./schema";

export type EstimatorState = { token: string | null; settings: EstimatorSettings };

export async function getEstimator(tx: Tx, orgId: string): Promise<EstimatorState> {
  const [o] = await tx.select({ token: organizations.estimatorToken, settings: organizations.estimator }).from(organizations).where(eq(organizations.id, orgId));
  // Settings saved by an older version might not match today's rules: fall back to the defaults.
  const parsed = estimatorSettings.safeParse(o?.settings);
  return { token: o?.token ?? null, settings: parsed.success ? parsed.data : DEFAULT_ESTIMATOR };
}

export async function saveEstimatorSettings(tx: Tx, orgId: string, settings: EstimatorSettings): Promise<void> {
  await tx.update(organizations).set({ estimator: settings, updatedAt: new Date() }).where(eq(organizations.id, orgId));
}

/** Turn the estimator on (new link), change its link (old embeds stop working), or turn it off. */
export async function setEstimatorLink(tx: Tx, orgId: string, on: boolean): Promise<string | null> {
  const token = on ? randomBytes(24).toString("base64url") : null;
  await tx.update(organizations).set({ estimatorToken: token, updatedAt: new Date() }).where(eq(organizations.id, orgId));
  return token;
}
