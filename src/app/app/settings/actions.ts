"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { parseCompanySettingsForm, type SettingsErrors } from "@/core/company-settings";
import type { OrgSettingsInput } from "@/core/schemas";
import { can } from "@/core/roles";
import { organizations } from "@/db/schema";
import { renameClerkOrganization } from "@/auth/clerk-admin";
import { getSession, withSession } from "@/auth/session";

export type SaveSettingsState = {
  status: "idle" | "saved" | "error";
  errors?: SettingsErrors;
  message?: string;
  /** What was stored, after tidying (e.g. "gb 123 4567 89" → "GB123456789"). */
  saved?: OrgSettingsInput;
};

/**
 * Save company settings. Admin only. The tenant comes from the session; the form can't name one, and the
 * parser reads only the settings fields, so billing columns (plan, Stripe IDs) can't be reached from here.
 * The database enforces the same with column grants (migration 0005).
 */
export async function saveCompanySettings(form: FormData): Promise<SaveSettingsState> {
  const session = await getSession();
  if (!can(session.role, "settings.manage")) {
    return { status: "error", message: "Only an Admin can change company settings." };
  }
  const parsed = parseCompanySettingsForm(form);
  if (!parsed.ok) return { status: "error", errors: parsed.errors, message: "Check the highlighted fields." };

  const v = parsed.value;
  await withSession(session, (tx) =>
    tx
      .update(organizations)
      .set({
        name: v.name,
        tradingName: v.tradingName ?? null,
        vatNumber: v.vatNumber ?? null,
        logoUrl: v.logoUrl ?? null,
        brandColour: v.brandColour ?? null,
        defaultMarkupBps: v.defaultMarkupBps,
        defaultVatRateBps: v.defaultVatRateBps,
        quoteTerms: v.quoteTerms ?? null,
      })
      .where(eq(organizations.id, session.orgId)),
  );

  // Clerk shows the company name in the switcher and invitation emails, so keep it in step. Its
  // organization.updated webhook then writes the same name back, which is harmless.
  if (v.name !== session.orgName) {
    try {
      await renameClerkOrganization(session.clerkOrgId, v.name);
    } catch (error) {
      console.error("Couldn't rename the Clerk organization", error instanceof Error ? error.message : "unknown");
      revalidatePath("/app", "layout");
      return { status: "saved", saved: v, message: "Saved. The company switcher may show the old name for a moment." };
    }
  }
  revalidatePath("/app", "layout");
  return { status: "saved", saved: v, message: "Settings saved." };
}
