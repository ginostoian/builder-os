/** Writes to Clerk from our side. Kept here so nothing outside src/auth talks to Clerk directly. */
import "server-only";
import { clerkClient } from "@clerk/nextjs/server";

/** Keep Clerk's copy of the company name (switcher, invitation emails) in step with our settings. */
export async function renameClerkOrganization(clerkOrgId: string, name: string): Promise<void> {
  const client = await clerkClient();
  await client.organizations.updateOrganization(clerkOrgId, { name });
}
