import { can } from "@/core/roles";
import { ukToday } from "@/core/payment-plan";
import { exportCompany } from "@/db/export";
import { getSession, withSession } from "@/auth/session";
import { exportZip, slug, zipResponse } from "@/server/data-export";
import { allow } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Everything the company holds in Builder OS, as a ZIP (UK GDPR data portability). Admins only. */
export async function GET() {
  const session = await getSession();
  if (!can(session.role, "settings.manage")) return new Response("Only an Admin can export the company's data.", { status: 403 });
  if (!(await allow({ bucket: "company_export", subject: session.memberId, max: 5, windowSeconds: 3_600 }))) return new Response("Please wait a while before exporting again.", { status: 429 });
  const tables = await withSession(session, (tx) => exportCompany(tx, session.orgId));
  const body = exportZip(`${session.orgName}: all data`, tables);
  return zipResponse(body, `builderos-${slug(session.orgName)}-${ukToday()}.zip`);
}
