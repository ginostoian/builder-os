import type { Metadata } from "next";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { EstimatorSettingsForm } from "@/components/app/settings/estimator-settings";
import { SettingsFrame } from "@/components/app/settings/settings-frame";
import { can } from "@/core/roles";
import { planAllows } from "@/db/billing";
import { companyHeader } from "@/db/costs";
import { getEstimator } from "@/db/estimator";
import { requirePermission, withSession } from "@/auth/session";
import { appOrigin } from "@/server/origin";

export const metadata: Metadata = { title: "Website estimator" };

/** A cost estimator for the company's own website: homeowners price their project, then ask for a quote. */
export default async function EstimatorSettingsPage() {
  const session = await requirePermission("settings.view");
  const { state, pipeline, org } = await withSession(session, async (tx) => ({
    state: await getEstimator(tx, session.orgId),
    pipeline: await planAllows(tx, session.orgId, "pipeline"),
    org: await companyHeader(tx, session.orgId),
  }));
  const url = state.token ? `${await appOrigin()}/estimate/${state.token}` : null;
  return (
    <LiveAppShell active="settings" crumbs={["Settings", "Website estimator"]}>
      <SettingsFrame active="estimator" title="Website estimator" subtitle="A cost calculator for your own website. Homeowners get a guide price for their project, then ask you for a proper quote.">
        <EstimatorSettingsForm url={url} initial={state.settings} canEdit={can(session.role, "settings.manage")} companyName={org?.tradingName ?? org?.name ?? "Your company"} pipeline={pipeline} />
      </SettingsFrame>
    </LiveAppShell>
  );
}
