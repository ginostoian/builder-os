import { IMPORT_TEMPLATE } from "@/core/library-import";
import { requirePermission } from "@/auth/session";

/** The CSV template, as a download. */
export async function GET() {
  await requirePermission("library.manage");
  // The byte-order mark makes Excel read it as UTF-8, so "m²" survives.
  return new Response(`\uFEFF${IMPORT_TEMPLATE}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="builder-os-service-library.csv"',
      "Cache-Control": "no-store",
    },
  });
}
