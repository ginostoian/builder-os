/**
 * The emails a client gets about an invoice: when it's raised, and the automatic reminders (3 days before,
 * on the day, 3 and 7 days late). Pure, so the wording is tested and shared by the app and the reminder job.
 */
import type { EmailContent } from "./email-template";
import { formatGBP } from "./money";
import { formatSortCode, type ReminderKind } from "./payment-plan";
import { longDate } from "./quote-snapshot";

export type InvoiceEmailFacts = {
  ref: string;
  company: { name: string; tradingName: string | null; brandColour: string | null };
  clientName: string;
  description: string;
  totalPence: number;
  dueDate: string;
  bank: { accountName: string; sortCode: string; accountNumber: string };
  link: string;
};

const COPY: Record<"new" | ReminderKind, { subject: (f: InvoiceEmailFacts, c: string) => string; heading: (f: InvoiceEmailFacts) => string; intro: (f: InvoiceEmailFacts, c: string) => string }> = {
  new: {
    subject: (f, c) => `Invoice ${f.ref} from ${c}`,
    heading: (f) => `Invoice ${f.ref}`,
    intro: (f, c) => `${c} has sent you an invoice for ${f.description}. It's due by ${longDate(f.dueDate)}.`,
  },
  before: {
    subject: (f) => `Reminder: invoice ${f.ref} is due on ${longDate(f.dueDate)}`,
    heading: (f) => `Invoice ${f.ref} is due soon`,
    intro: (f) => `Just a reminder that invoice ${f.ref} for ${f.description} is due on ${longDate(f.dueDate)}.`,
  },
  due: {
    subject: (f) => `Invoice ${f.ref} is due today`,
    heading: (f) => `Invoice ${f.ref} is due today`,
    intro: (f) => `Invoice ${f.ref} for ${f.description} is due today. If you've already paid, thank you, and please ignore this email.`,
  },
  overdue_3: {
    subject: (f) => `Invoice ${f.ref} is overdue`,
    heading: (f) => `Invoice ${f.ref} is overdue`,
    intro: (f) => `We haven't received payment for invoice ${f.ref} (${f.description}), which was due on ${longDate(f.dueDate)}. If you've paid in the last few days, thank you, and please ignore this email.`,
  },
  overdue_7: {
    subject: (f) => `Second reminder: invoice ${f.ref} is overdue`,
    heading: (f) => `Invoice ${f.ref} is a week overdue`,
    intro: (f, c) => `Invoice ${f.ref} (${f.description}) was due on ${longDate(f.dueDate)} and is still unpaid. Please pay it as soon as you can, or reply to this email if there's a problem, and ${c} will help.`,
  },
};

export function invoiceEmail(kind: "new" | ReminderKind, f: InvoiceEmailFacts, signOff?: string): { subject: string; content: EmailContent } {
  const company = f.company.tradingName ?? f.company.name;
  const copy = COPY[kind];
  return {
    subject: copy.subject(f, company),
    content: {
      company: { name: company, brandColour: f.company.brandColour },
      preheader: `${formatGBP(f.totalPence)} due ${longDate(f.dueDate)}. Pay by bank transfer.`,
      heading: copy.heading(f),
      paragraphs: [`Hi ${f.clientName},`, copy.intro(f, company), `Please pay by bank transfer, using ${f.ref} as the payment reference so we can match it.`],
      details: [
        ["Amount due", formatGBP(f.totalPence)],
        ["Due date", longDate(f.dueDate)],
        ["Account name", f.bank.accountName],
        ["Sort code", formatSortCode(f.bank.sortCode)],
        ["Account number", f.bank.accountNumber],
        ["Reference", f.ref],
      ],
      button: { label: "View invoice", href: f.link },
      footer: `${signOff ? `${signOff}, ` : ""}${company}. Reply to this email to reach us.`,
    },
  };
}
