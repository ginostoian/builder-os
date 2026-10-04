"use server";

import { after } from "next/server";
import { clientBookingInput } from "@/core/schemas";
import { findLeadByLink, withTenant } from "@/db";
import { SurveyError, cancelSurvey, clientBookSurvey, currentBooking, updateVisitDetails, type SurveyErrorReason } from "@/db/surveys";
import { appOrigin } from "@/server/origin";
import { emailSurveyChange } from "@/server/surveys";

/**
 * The client's booking page. No login: the lead's private link (sent only to them) is the key, like the
 * unsubscribe link. They can book one of the times on offer, move it, or cancel it.
 */

export type BookingResult = { ok: true } | { ok: false; message: string };

const MESSAGES: Record<SurveyErrorReason | "bad_link" | "invalid", string> = {
  bad_link: "This link no longer works. Please contact the company.",
  invalid: "Check your details and try again.",
  not_found: "This link no longer works. Please contact the company.",
  closed: "Visits can't be booked from this link any more. Please contact the company.",
  taken: "Someone has just booked that time. Please pick another.",
  unavailable: "That time isn't available any more. Please pick another.",
  unknown_member: "That time isn't available any more. Please pick another.",
  no_booking: "There's no visit booked to cancel.",
};

export async function bookVisitAction(token: string, input: unknown): Promise<BookingResult> {
  const parsed = clientBookingInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: MESSAGES.invalid };
  const lead = typeof token === "string" ? await findLeadByLink(token) : null;
  if (!lead) return { ok: false, message: MESSAGES.bad_link };
  const d = parsed.data;
  try {
    const booked = await withTenant(lead.orgId, async (tx) => {
      await updateVisitDetails(tx, lead.orgId, lead.leadId, { phone: d.phone, addressLine: d.addressLine, postcode: d.postcode?.toUpperCase() });
      const b = await clientBookSurvey(tx, lead.orgId, lead.leadId, new Date(d.startsAt));
      return { ...b, visit: (await currentBooking(tx, lead.orgId, lead.leadId))! };
    });
    const origin = await appOrigin();
    after(() => emailSurveyChange(lead.orgId, lead.leadId, booked.visit, booked.moved ? "moved" : "booked", origin));
    return { ok: true };
  } catch (error) {
    if (error instanceof SurveyError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
}

export async function cancelVisitAction(token: string): Promise<BookingResult> {
  const lead = typeof token === "string" ? await findLeadByLink(token) : null;
  if (!lead) return { ok: false, message: MESSAGES.bad_link };
  try {
    const visit = await withTenant(lead.orgId, (tx) => cancelSurvey(tx, lead.orgId, lead.leadId, "client", null));
    const origin = await appOrigin();
    after(() => emailSurveyChange(lead.orgId, lead.leadId, visit, "cancelled", origin));
    return { ok: true };
  } catch (error) {
    if (error instanceof SurveyError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
}
