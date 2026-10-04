/**
 * Getting started: each person's tour and checklist state (on `members`), and what the company has done,
 * read from its own data so the checklist ticks itself off. One query; every check is an `exists`.
 */
import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { SIGNALS, STEP_IDS, type Signals } from "@/core/onboarding";
import type { Tx } from "./index";
import { members } from "./schema";

export type OnboardingState = { tourAt: Date | null; hidden: boolean; skipped: string[]; signals: Signals };

export async function onboardingState(tx: Tx, orgId: string, memberId: string): Promise<OnboardingState> {
  const [r] = await tx.execute<Record<string, unknown>>(sql`
    select
      m.onboarding_tour_at as tour_at,
      m.onboarding_hidden as hidden,
      m.onboarding_seen as skipped,
      (o.vat_number is not null or o.trading_name is not null or o.quote_terms is not null) as company_details,
      (o.logo_url is not null) as logo,
      (o.bank_account_number is not null) as bank_details,
      ((select count(*) from members x where x.org_id = o.id and x.active) > 1) as team,
      exists (select 1 from services s where s.org_id = o.id) as library,
      exists (select 1 from services s where s.org_id = o.id and s.kind = 'bundle') as bundle,
      exists (select 1 from quotes q where q.org_id = o.id) as quote_created,
      exists (select 1 from quote_versions v where v.org_id = o.id) as quote_sent,
      exists (select 1 from quote_decisions d where d.org_id = o.id and d.decision = 'accepted') as quote_accepted,
      exists (select 1 from quotes q where q.org_id = o.id and q.payment_plan is not null and jsonb_array_length(q.payment_plan) > 0) as payment_plan,
      exists (select 1 from invoices i where i.org_id = o.id) as invoice,
      o.connect_charges_enabled as online_payments,
      exists (select 1 from projects p where p.org_id = o.id) as project,
      exists (select 1 from member_activity a where a.org_id = o.id and a.site_views > 0) as site_app,
      exists (select 1 from variations v where v.org_id = o.id) as variation,
      (exists (select 1 from expenses e where e.org_id = o.id) or exists (select 1 from purchase_orders po where po.org_id = o.id)) as costs,
      exists (select 1 from leads l where l.org_id = o.id) as lead,
      (o.enquiry_token is not null) as enquiry_form,
      exists (select 1 from survey_settings ss where ss.org_id = o.id and ss.enabled) as online_booking,
      exists (select 1 from automations au where au.org_id = o.id and au.enabled) as automation
    from members m join organizations o on o.id = m.org_id
    where m.org_id = ${orgId}::uuid and m.id = ${memberId}::uuid`);
  if (!r) throw new Error("Member not found");
  const tourAt = r.tour_at ? new Date(String(r.tour_at)) : null;
  const signals = Object.fromEntries(SIGNALS.map((k) => [k, k === "tour" ? tourAt !== null : r[k] === true])) as Signals;
  return { tourAt, hidden: r.hidden === true, skipped: (r.skipped as string[] | null) ?? [], signals };
}

export type OnboardingChange = { op: "tour_done" } | { op: "tour_reset" } | { op: "hide" } | { op: "show" } | { op: "skip"; step: string } | { op: "unskip"; step: string } | { op: "reset_skipped" };

/** One person's tour and checklist choices. Unknown step ids are ignored. */
export async function changeOnboarding(tx: Tx, orgId: string, memberId: string, change: OnboardingChange): Promise<void> {
  const me = and(eq(members.orgId, orgId), eq(members.id, memberId));
  switch (change.op) {
    case "tour_done":
      await tx.update(members).set({ onboardingTourAt: new Date() }).where(me);
      return;
    case "tour_reset":
      await tx.update(members).set({ onboardingTourAt: null }).where(me);
      return;
    case "hide":
    case "show":
      await tx.update(members).set({ onboardingHidden: change.op === "hide" }).where(me);
      return;
    case "reset_skipped":
      await tx.update(members).set({ onboardingSeen: [] }).where(me);
      return;
    case "skip":
    case "unskip": {
      if (!(STEP_IDS as string[]).includes(change.step)) return;
      const step = change.step;
      await tx
        .update(members)
        .set({
          onboardingSeen:
            change.op === "skip"
              ? sql`case when ${step} = any(${members.onboardingSeen}) then ${members.onboardingSeen} else array_append(${members.onboardingSeen}, ${step}) end`
              : sql`array_remove(${members.onboardingSeen}, ${step})`,
        })
        .where(me);
      return;
    }
  }
}
