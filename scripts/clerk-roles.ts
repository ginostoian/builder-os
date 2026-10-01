/**
 * Create Builder OS roles in a Clerk instance: `pnpm clerk:roles`. Safe to run again.
 *
 * - Adds Office, Estimator, Site lead and Employee next to Clerk's built-in Admin (`org:admin`).
 * - Makes Employee the default role for new members (least access), and replaces Clerk's built-in
 *   Member role with it, moving anyone who had Member to Employee.
 * - Refuses to touch a production instance (sk_live_) unless run with --live.
 *
 * Permissions inside Builder OS come from src/core/roles.ts. The Clerk permissions set here only control
 * Clerk's own UI: everyone can see the member list, and only Admins can invite or change roles.
 */
import { existsSync } from "node:fs";
import { createClerkClient } from "@clerk/backend";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, clerkRoleKey, type Role } from "../src/core/roles";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set");
if (secretKey.startsWith("sk_live_") && !process.argv.includes("--live")) {
  throw new Error("This is a production Clerk key. Re-run with --live if you really mean to change production roles.");
}

const clerk = createClerkClient({ secretKey });
const NEW_ROLES: Role[] = ["office", "estimator", "site_lead", "employee"];
const DEFAULT_ROLE = clerkRoleKey("employee");

async function main() {
  const { data: permissions } = await clerk.organizationPermissions.getOrganizationPermissionList({ limit: 100 });
  const readMembers = permissions.find((p) => p.key === "org:sys_memberships:read");
  if (!readMembers) throw new Error("Clerk permission org:sys_memberships:read not found");

  const { data: existing } = await clerk.organizationRoles.getOrganizationRoleList({ limit: 100 });
  for (const role of NEW_ROLES) {
    const key = clerkRoleKey(role);
    if (existing.some((r) => r.key === key)) {
      console.log(`✓ ${key} exists`);
      continue;
    }
    await clerk.organizationRoles.createOrganizationRole({
      key,
      name: ROLE_LABELS[role],
      description: ROLE_DESCRIPTIONS[role],
      permissions: [readMembers.id],
      includeInInitialRoleSet: true,
    });
    console.log(`+ ${key} created`);
  }

  const { data: roleSets } = await clerk.roleSets.getRoleSetList({ limit: 100 });
  const initial = roleSets.find((s) => s.type === "initial");
  if (!initial) throw new Error("No initial role set found in this Clerk instance");

  const inSet = new Set(initial.roles.map((r) => r.key));
  const missing = NEW_ROLES.map(clerkRoleKey).filter((key) => !inSet.has(key));
  if (missing.length > 0) {
    await clerk.roleSets.addRolesToRoleSet({ roleSetKeyOrId: initial.key, roleKeys: missing });
    console.log(`+ added ${missing.join(", ")} to ${initial.key}`);
  }
  if (initial.defaultRole?.key !== DEFAULT_ROLE) {
    await clerk.roleSets.updateRoleSet({ roleSetKeyOrId: initial.key, defaultRoleKey: DEFAULT_ROLE });
    console.log(`+ default role for new members is now ${DEFAULT_ROLE}`);
  }
  if (inSet.has("org:member")) {
    await clerk.roleSets.replaceRoleInRoleSet({ roleSetKeyOrId: initial.key, roleKey: "org:member", toRoleKey: DEFAULT_ROLE });
    console.log(`+ replaced org:member with ${DEFAULT_ROLE}`);
  }

  const final = await clerk.roleSets.getRoleSet(initial.key);
  console.log(`\nRoles in ${final.key}: ${final.roles.map((r) => r.key).join(", ")}`);
  console.log(`Default: ${final.defaultRole?.key}. Creator: ${final.creatorRole?.key}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
