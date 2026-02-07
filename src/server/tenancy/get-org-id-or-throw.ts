import "server-only";

import { auth } from "@clerk/nextjs/server";

export async function getOrgIdOrThrow(): Promise<string> {
  const { userId, orgId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized: user must be signed in.");
  }

  if (!orgId) {
    throw new Error("Organization context required: select an organization.");
  }

  return orgId;
}
