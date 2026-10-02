import "server-only";
import { eq } from "drizzle-orm";
import { organizations } from "@/db/schema";
import type { Tx } from "@/db";

/** The company's default markup, shown as the placeholder and "On a quote" preview in library forms. */
export async function companyMarkup(tx: Tx, orgId: string): Promise<number> {
  const [org] = await tx.select({ bps: organizations.defaultMarkupBps }).from(organizations).where(eq(organizations.id, orgId));
  return org?.bps ?? 0;
}
