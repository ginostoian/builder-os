/**
 * Retention money: the share of each payment (usually 3% to 5%) a client or main contractor holds back
 * until the work is finished. Typically half is released at practical completion and the rest at the end
 * of the defects period (often 12 months later), and it often arrives later than that, or never.
 *
 * Money is pence; percentages are plain numbers (5 means 5%).
 */
import { addDaysIso, addMonthsIso } from "./dates";

export type RetentionJob = {
  contractPence: number;
  retentionPct: number;
  /** Share of the retention released at practical completion, %. The rest follows the defects period. */
  firstReleasePct: number;
  /** How long the build takes, in months: retention builds up over it. */
  buildMonths: number;
  defectsMonths: number;
  /** Days after each release falls due until the money actually arrives. */
  delayDays: number;
  /** What the money costs you while it's held (overdraft or loan rate), % a year. */
  borrowingPct: number;
  /** Expected practical completion, to put dates on the releases. */
  completion?: string;
};

export type RetentionResult = {
  retentionPence: number;
  firstReleasePence: number;
  secondReleasePence: number;
  /** Average days each part is held, counting from the middle of the build. */
  firstHeldDays: number;
  secondHeldDays: number;
  /** Interest the held money would cost at the borrowing rate. */
  costPence: number;
  firstReleaseDate: string | null;
  secondReleaseDate: string | null;
};

const MONTH_DAYS = 365 / 12;

export function retentionForJob(j: RetentionJob): RetentionResult | null {
  if (!(j.contractPence > 0) || !(j.retentionPct >= 0) || j.retentionPct > 100 || j.firstReleasePct < 0 || j.firstReleasePct > 100) return null;
  const retention = Math.round((j.contractPence * j.retentionPct) / 100);
  const first = Math.round((retention * j.firstReleasePct) / 100);
  const second = retention - first;
  // Retention is deducted from each payment as the job goes on, so on average it's been held since halfway through.
  const halfBuild = (Math.max(0, j.buildMonths) / 2) * MONTH_DAYS;
  const delay = Math.max(0, j.delayDays);
  const firstHeldDays = Math.round(halfBuild + delay);
  const secondHeldDays = Math.round(halfBuild + Math.max(0, j.defectsMonths) * MONTH_DAYS + delay);
  const rate = Math.max(0, j.borrowingPct) / 100;
  const costPence = Math.round((first * rate * firstHeldDays) / 365 + (second * rate * secondHeldDays) / 365);
  const completion = j.completion && /^\d{4}-\d{2}-\d{2}$/.test(j.completion) ? j.completion : null;
  return {
    retentionPence: retention,
    firstReleasePence: first,
    secondReleasePence: second,
    firstHeldDays,
    secondHeldDays,
    costPence,
    firstReleaseDate: completion ? addDaysIso(completion, delay) : null,
    secondReleaseDate: completion ? addDaysIso(addMonthsIso(completion, Math.max(0, Math.round(j.defectsMonths))), delay) : null,
  };
}

/**
 * Across a year of work: how much is held at any one time on average (what comes in each day × how long
 * it stays), and what that costs a year.
 */
export function retentionForYear(turnoverPence: number, j: Omit<RetentionJob, "contractPence" | "completion">) {
  const job = retentionForJob({ ...j, contractPence: turnoverPence });
  if (!job || !(turnoverPence > 0)) return null;
  const perDay = 1 / 365;
  const averageHeldPence = Math.round(job.firstReleasePence * perDay * job.firstHeldDays + job.secondReleasePence * perDay * job.secondHeldDays);
  return {
    heldEachYearPence: job.retentionPence,
    averageHeldPence,
    yearlyCostPence: Math.round(averageHeldPence * (Math.max(0, j.borrowingPct) / 100)),
  };
}
