/**
 * The VAT domestic reverse charge for building and construction services (in force since 1 March 2021),
 * as a short set of yes/no questions. Based on HMRC's technical guide: the reverse charge applies when a
 * VAT-registered supplier makes a standard or reduced-rated supply of construction services that are
 * reported under CIS, to a VAT and CIS registered customer who isn't an end user or intermediary
 * supplier. Supplies of staff only are excluded.
 */

export type Answer = "yes" | "no";
export type RateAnswer = "standard" | "reduced" | "zero";

export type DrcAnswers = {
  supplierVat?: Answer;
  customerVat?: Answer;
  cis?: Answer;
  rate?: RateAnswer;
  endUser?: Answer;
  staffOnly?: Answer;
};

export type DrcQuestionId = keyof DrcAnswers;

export type DrcQuestion = {
  id: DrcQuestionId;
  question: string;
  help: string;
  options: { value: string; label: string }[];
};

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const DRC_QUESTIONS: DrcQuestion[] = [
  {
    id: "supplierVat",
    question: "Are you (the one doing the work and sending the invoice) VAT registered?",
    help: "If you're not VAT registered you don't charge VAT at all, so the reverse charge can't apply.",
    options: YES_NO,
  },
  {
    id: "customerVat",
    question: "Is your customer VAT registered?",
    help: "Homeowners and other customers who aren't VAT registered always get a normal invoice.",
    options: YES_NO,
  },
  {
    id: "cis",
    question: "Is the work covered by CIS, and is your customer registered for CIS?",
    help: "The reverse charge only covers construction services that would be reported under the Construction Industry Scheme, such as building, alterations, repairs, decorating and installing heating or lighting. Your customer must be CIS registered (as a contractor) too.",
    options: YES_NO,
  },
  {
    id: "rate",
    question: "What rate of VAT would normally apply to the work?",
    help: "Most building work is standard rated (20%). Some is reduced rated (5%), such as certain energy-saving installations or converting buildings into homes. Zero-rated work, such as building a new home, is outside the reverse charge.",
    options: [
      { value: "standard", label: "Standard (20%)" },
      { value: "reduced", label: "Reduced (5%)" },
      { value: "zero", label: "Zero (0%)" },
    ],
  },
  {
    id: "endUser",
    question: "Has your customer told you in writing that they're an end user or an intermediary supplier?",
    help: "An end user is a business that uses the work itself rather than selling it on, for example a developer, a landlord or a business doing up its own premises. An intermediary supplier passes the work on to a connected or linked end user (in the same group, or a landlord and tenant). Either one must tell you in writing.",
    options: YES_NO,
  },
  {
    id: "staffOnly",
    question: "Are you only supplying workers, rather than doing the work yourself?",
    help: "Supplying staff or labour only (as an employment business does) is excluded from the reverse charge.",
    options: YES_NO,
  },
];

export type DrcOutcome =
  | { kind: "applies"; reason: string }
  | { kind: "normal_vat"; reason: string }
  | { kind: "no_vat"; reason: string }
  | { kind: "zero_rated"; reason: string };

/** The answer once enough questions are answered, or the next question to ask. */
export function drcStep(a: DrcAnswers): { outcome: DrcOutcome } | { next: DrcQuestion } {
  const q = (id: DrcQuestionId) => ({ next: DRC_QUESTIONS.find((x) => x.id === id)! });
  if (!a.supplierVat) return q("supplierVat");
  if (a.supplierVat === "no") return { outcome: { kind: "no_vat", reason: "You aren't VAT registered, so you don't charge VAT and the reverse charge doesn't apply. Your invoice shows no VAT. Keep an eye on the £90,000 registration threshold." } };
  if (!a.customerVat) return q("customerVat");
  if (a.customerVat === "no") return { outcome: { kind: "normal_vat", reason: "Your customer isn't VAT registered (a homeowner, for example), so charge VAT as normal." } };
  if (!a.cis) return q("cis");
  if (a.cis === "no") return { outcome: { kind: "normal_vat", reason: "The reverse charge only covers work reported under CIS, for customers registered for CIS. Charge VAT as normal." } };
  if (!a.rate) return q("rate");
  if (a.rate === "zero") return { outcome: { kind: "zero_rated", reason: "Zero-rated work is outside the reverse charge. Your invoice shows VAT at 0%." } };
  if (!a.endUser) return q("endUser");
  if (a.endUser === "yes") return { outcome: { kind: "normal_vat", reason: "Your customer has told you they're an end user or intermediary supplier, so the reverse charge doesn't apply. Charge VAT as normal, and keep their written notice on file." } };
  if (!a.staffOnly) return q("staffOnly");
  if (a.staffOnly === "yes") return { outcome: { kind: "normal_vat", reason: "Supplying workers only is excluded from the reverse charge. Charge VAT as normal." } };
  return { outcome: { kind: "applies", reason: "You're VAT registered, your customer is VAT and CIS registered and isn't an end user, and the work is standard or reduced rated construction work under CIS. Don't charge VAT: your customer accounts for it to HMRC." } };
}

/** The questions answered so far, in order, for showing the trail. */
export const answeredQuestions = (a: DrcAnswers) => DRC_QUESTIONS.filter((q) => a[q.id] !== undefined);

/** The wording HMRC accepts on a reverse charge invoice. */
export const DRC_WORDING = "Reverse charge: customer to pay the VAT to HMRC";

export type DrcInvoice = { netPence: number; vatRateBps: number; vatPence: number; customerPaysPence: number; vatToHmrcByCustomerPence: number };

/** What the invoice shows for a given net amount and outcome. */
export function drcInvoice(netPence: number, outcome: DrcOutcome, rate: RateAnswer | undefined): DrcInvoice {
  const net = Math.max(0, Math.round(netPence));
  const vatRateBps = outcome.kind === "no_vat" || outcome.kind === "zero_rated" ? 0 : rate === "reduced" ? 500 : 2000;
  const vatPence = Math.round((net * vatRateBps) / 10_000);
  if (outcome.kind === "applies") return { netPence: net, vatRateBps, vatPence, customerPaysPence: net, vatToHmrcByCustomerPence: vatPence };
  return { netPence: net, vatRateBps, vatPence, customerPaysPence: net + vatPence, vatToHmrcByCustomerPence: 0 };
}

/** Parse answers from a shared link (?a=yes,yes,yes,standard,no,no), ignoring anything unexpected. */
export function parseDrcAnswers(text: string | null | undefined): DrcAnswers {
  const out: DrcAnswers = {};
  if (!text) return out;
  const parts = text.split(",");
  DRC_QUESTIONS.forEach((q, i) => {
    const v = parts[i];
    if (v && q.options.some((o) => o.value === v)) (out as Record<string, string>)[q.id] = v;
  });
  // Only keep a continuous run of answers from the first question.
  const kept: DrcAnswers = {};
  for (const q of DRC_QUESTIONS) {
    if (out[q.id] === undefined) break;
    (kept as Record<string, string>)[q.id] = out[q.id]!;
  }
  return kept;
}

export const formatDrcAnswers = (a: DrcAnswers) =>
  DRC_QUESTIONS.map((q) => a[q.id])
    .filter(Boolean)
    .join(",");
