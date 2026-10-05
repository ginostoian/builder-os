import { can } from "@/core/roles";
import { id } from "@/core/schemas";
import { ukToday } from "@/core/payment-plan";
import { exportClient } from "@/db/export";
import { getSession, withSession } from "@/auth/session";
import { exportZip, slug, zipResponse } from "@/server/data-export";
import { allow } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Everything held about one client, as a ZIP: for answering their subject access request (UK GDPR). The
 * company is the controller; this gives it the copy to send.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!can(session.role, "clients.manage")) return new Response("Your role can't export client data.", { status: 403 });
  const clientId = (await params).id;
  if (!id.safeParse(clientId).success) return new Response("Not found", { status: 404 });
  if (!(await allow({ bucket: "client_export", subject: session.memberId, max: 30, windowSeconds: 3_600 }))) return new Response("Please wait a while before exporting again.", { status: 429 });
  const tables = await withSession(session, (tx) => exportClient(tx, session.orgId, clientId));
  if (!tables) return new Response("Not found", { status: 404 });
  const name = String(tables.find((t) => t.name === "clients")?.rows[0]?.name ?? "client");
  return zipResponse(exportZip(`${name}: data held by ${session.orgName}`, tables), `${slug(name)}-data-${ukToday()}.zip`);
}
