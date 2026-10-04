import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarCheck2, Phone } from "lucide-react";
import { BookingPicker, type SlotOption } from "@/components/public/booking-picker";
import { OPEN_STAGES, firstName, type LeadStage } from "@/core/pipeline";
import { postcodeCovered, slotLabels } from "@/core/surveys";
import { findLeadByLink, withTenant } from "@/db";
import { bookingPageContext, openSlots, visitPlace } from "@/db/surveys";

export const metadata: Metadata = { title: "Book your survey", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/**
 * Where a client books, moves or cancels their survey visit, from the link in their emails (or straight
 * after the enquiry form). Opening the page changes nothing, so link scanners in mail systems can't book or
 * cancel anything.
 */
export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findLeadByLink(token);
  if (!found) notFound();
  const now = new Date();
  const data = await withTenant(found.orgId, async (tx) => {
    const ctx = await bookingPageContext(tx, found.orgId, found.leadId);
    return ctx && { ...ctx, ...(await openSlots(tx, found.orgId, now, found.leadId)) };
  });
  if (!data) notFound();
  const { lead, booking, settings, slots } = data;
  const company = data.company.tradingName ?? data.company.name;
  const open = (OPEN_STAGES as readonly LeadStage[]).includes(lead.stage);
  const covered = postcodeCovered(lead.postcode, settings.postcodes);
  const upcoming = booking && booking.startsAt.getTime() > now.getTime() ? booking : null;
  const options: SlotOption[] = slots.slice(0, 400).map((s) => slotLabels(s.startsAt));
  const when = upcoming ? slotLabels(upcoming.startsAt) : null;
  const canBook = open && settings.enabled && covered;

  return (
    <main className="min-h-dvh bg-surface-2 px-4 py-8 font-sans text-[15px] text-ink sm:py-12">
      <div className="mx-auto w-full max-w-[640px] rounded-2xl bg-white p-6 shadow-ring sm:p-8">
        <header className="mb-5">
          {data.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- company logo
            <img src={data.company.logoUrl} alt={company} className="mb-4 max-h-12 max-w-[200px] object-contain" />
          ) : (
            <div className="mb-3 text-[13px] font-semibold text-ink-2">{company}</div>
          )}
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">{upcoming ? "Your survey" : "Book your free survey"}</h1>
          <p className="mt-1 text-ink-2">
            Hi {firstName(lead.name)}.{" "}
            {upcoming
              ? "Here's your visit. You can move it or cancel it here."
              : `Pick a time for ${company} to come and look at your ${(lead.projectType ?? "project").toLowerCase()}. It takes about ${settings.visitMinutes >= 60 ? `${Math.round((settings.visitMinutes / 60) * 10) / 10} hour${settings.visitMinutes > 60 ? "s" : ""}` : `${settings.visitMinutes} minutes`}.`}
          </p>
        </header>

        {upcoming && when && (
          <div className="mb-5 flex items-start gap-3 rounded-xl bg-success-soft p-4">
            <CalendarCheck2 className="mt-0.5 size-5 flex-none text-success" />
            <div>
              <div className="font-semibold">
                {when.day} at {when.time}
              </div>
              <div className="text-[14px] text-ink-2">
                {[upcoming.memberName ? `${firstName(upcoming.memberName)} from ${company}` : company, visitPlace(lead)].filter(Boolean).join(" · ")}
              </div>
              <a href={`/book/${token}/survey.ics`} className="mt-1 inline-block text-[14px] font-medium underline underline-offset-2">
                Add to my calendar
              </a>
            </div>
          </div>
        )}

        {!open ? (
          <p className="text-ink-2">This link can&apos;t book visits any more. If you&apos;d like {company} to come out, please get in touch with them.</p>
        ) : !settings.enabled ? (
          <p className="text-ink-2">{upcoming ? `To move your visit, please contact ${company}.` : `${company} will be in touch to arrange a time.`}</p>
        ) : !covered ? (
          <div className="flex items-start gap-3 rounded-xl bg-surface p-4 text-ink-2">
            <Phone className="mt-0.5 size-5 flex-none" />
            <p>Your postcode is outside the areas we can book online, so {company} will call you to arrange a visit.</p>
          </div>
        ) : null}

        {canBook || upcoming ? (
          <BookingPicker
            token={token}
            slots={canBook ? options : []}
            booked={Boolean(upcoming)}
            company={company}
            details={{ phone: lead.phone ?? "", addressLine: lead.address?.line1 ?? "", postcode: lead.postcode ?? lead.address?.postcode ?? "" }}
          />
        ) : null}
      </div>
      <p className="mt-4 text-center text-[12px] text-subtle">This page is just for you. Your details go to {company} only.</p>
    </main>
  );
}
