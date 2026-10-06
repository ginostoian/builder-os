import { taxMonth } from "@/core/cis";
import { can } from "@/core/roles";
import { cisMonth } from "@/db/cis";
import { toCsv } from "@/db/export";
import { getSession, withSession } from "@/auth/session";

/** The tax month's CIS figures as a spreadsheet, one row per subcontractor (amounts in pounds). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!can(session.role, "costs.view")) return new Response("Not allowed", { status: 403 });
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(month) || Number.isNaN(Date.parse(`${month}T00:00:00Z`))) return new Response("Choose a month", { status: 400 });
  const m = taxMonth(month);
  const lines = await withSession(session, (tx) => cisMonth(tx, session.orgId, m.start, m.end));
  const pounds = (p: number) => (p / 100).toFixed(2);
  const csv = toCsv({
    name: "cis",
    columns: ["Subcontractor", "UTR", "Verification number", "Status", "Gross paid (before VAT)", "Materials", "Deducted", "Payments"],
    rows: lines.map((l) => ({
      Subcontractor: l.name,
      UTR: l.utr ?? "",
      "Verification number": l.verificationRef ?? "",
      Status: l.status ?? "not verified",
      "Gross paid (before VAT)": pounds(l.grossPence),
      Materials: pounds(l.materialsPence),
      Deducted: pounds(l.deductionPence),
      Payments: l.payments,
    })),
  });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cis-${m.start}-to-${m.end}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
