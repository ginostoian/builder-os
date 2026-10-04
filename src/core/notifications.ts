/**
 * In-app notifications: the bell in the top bar. Each one is for one person, about something they should
 * know or act on, with a link to it. Emails stay as they are; these are the in-app copy.
 */
export const NOTIFICATION_KINDS = [
  "quote_opened",
  "quote_comment",
  "quote_accepted",
  "quote_declined",
  "variation_approved",
  "variation_rejected",
  "enquiry",
  "lead_assigned",
  "task_assigned",
  "receipt_added",
  "certificate_expiring",
  "survey_booked",
  "survey_cancelled",
  "invoice_paid",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type NewNotification = { kind: NotificationKind; title: string; body?: string | null; href: string };

/** How many the bell shows; older ones are still kept for a while but not listed. */
export const NOTIFICATIONS_SHOWN = 30;
/** Notifications older than this are cleared out by the daily run. */
export const NOTIFICATION_KEEP_DAYS = 90;
