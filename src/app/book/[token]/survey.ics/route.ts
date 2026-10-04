import { firstName } from "@/core/pipeline";
import { surveyIcs } from "@/core/surveys";
import { findLeadByLink, withTenant } from "@/db";
import { enquiryAlertContext } from "@/db/pipeline";
import { bookingPageContext, bookingSequence, visitPlace } from "@/db/surveys";
import { appOrigin, bookingUrl } from "@/server/origin";

export const dynamic = "force-dynamic";

/** The booked visit as a calendar file, for "Add to my calendar". */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findLeadByLink(token);
  if (!found) return new Response("Not found", { status: 404 });
  const data = await withTenant(found.orgId, async (tx) => {
    const ctx = await bookingPageContext(tx, found.orgId, found.leadId);
    return ctx && { ...ctx, sequence: await bookingSequence(tx, found.orgId, found.leadId), company: await enquiryAlertContext(tx, found.orgId) };
  });
  if (!data?.booking) return new Response("No visit booked", { status: 404 });
  const ics = surveyIcs({
    uid: `${found.leadId}@builderos`,
    startsAt: data.booking.startsAt,
    endsAt: data.booking.endsAt,
    summary: `Survey with ${data.company.company}${data.booking.memberName ? ` (${firstName(data.booking.memberName)})` : ""}`,
    location: visitPlace(data.lead),
    description: `Move or cancel: ${bookingUrl(await appOrigin(), token)}`,
    organizer: data.company.company,
    sequence: data.sequence,
  });
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="survey.ics"', "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
