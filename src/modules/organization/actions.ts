"use server";

import { getOrgIdOrThrow } from "@/server/tenancy";

type OrgContextResult = {
  orgId: string;
};

export async function getOrgContextAction(): Promise<OrgContextResult> {
  const orgId = await getOrgIdOrThrow();

  return { orgId };
}
