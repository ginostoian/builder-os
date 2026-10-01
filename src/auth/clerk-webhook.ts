/**
 * Clerk webhook events → sync. The route verifies the Svix signature first; this only maps verified events.
 * Unknown event types are acknowledged and ignored, so enabling more events in Clerk can't break delivery.
 */
import "server-only";
import type { OrganizationJSON, OrganizationMembershipJSON, WebhookEvent } from "@clerk/nextjs/server";
import { emailOrNull, personName } from "@/core/clerk";
import { roleFromClerk } from "@/core/roles";
import { deactivateUser, deleteOrganization, syncMember, syncOrganization, syncUserProfile, type OrgSnapshot } from "./clerk-sync";

export type HandleResult = "synced" | "ignored";

const orgSnapshot = (org: OrganizationJSON): OrgSnapshot => ({ clerkOrgId: org.id, name: org.name, at: new Date(org.updated_at) });

function memberSnapshot(m: OrganizationMembershipJSON, active: boolean, at: Date) {
  const user = m.public_user_data;
  return {
    org: orgSnapshot(m.organization),
    clerkUserId: user.user_id,
    role: roleFromClerk(m.role),
    name: personName(user.first_name, user.last_name, user.identifier),
    email: emailOrNull(user.identifier),
    active,
    at,
  };
}

export async function handleClerkEvent(event: WebhookEvent): Promise<HandleResult> {
  // Svix's delivery time. Used for deletions, which carry no newer `updated_at` of their own.
  const eventTime = new Date(event.timestamp);
  switch (event.type) {
    case "organization.created":
    case "organization.updated":
      await syncOrganization(orgSnapshot(event.data));
      return "synced";
    case "organization.deleted":
      if (!event.data.id) return "ignored";
      await deleteOrganization(event.data.id, eventTime);
      return "synced";
    case "organizationMembership.created":
    case "organizationMembership.updated":
      await syncMember(memberSnapshot(event.data, true, new Date(event.data.updated_at)));
      return "synced";
    case "organizationMembership.deleted":
      await syncMember(memberSnapshot(event.data, false, eventTime));
      return "synced";
    case "user.updated": {
      const user = event.data;
      const primary = user.email_addresses.find((e) => e.id === user.primary_email_address_id);
      await syncUserProfile(user.id, {
        name: personName(user.first_name, user.last_name, primary?.email_address ?? user.username),
        email: emailOrNull(primary?.email_address),
      });
      return "synced";
    }
    case "user.deleted":
      if (!event.data.id) return "ignored";
      await deactivateUser(event.data.id, eventTime);
      return "synced";
    default:
      return "ignored";
  }
}
