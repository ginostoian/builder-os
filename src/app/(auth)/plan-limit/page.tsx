import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { findOrgByClerkId, withTenant } from "@/db";
import { hasSeat, seatHolderName } from "@/db/billing";
import { members, organizations } from "@/db/schema";
import { SELECT_COMPANY_PATH } from "@/auth/paths";

export const metadata: Metadata = { title: "Your company is on the Free plan" };

/**
 * Where everyone but the one login lands when their company is on Free: who has the login, and how to
 * get back in (the company chooses a plan). Their work is all still there.
 */
export default async function PlanLimitPage() {
  const { userId, orgId: clerkOrgId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
  if (!clerkOrgId) redirect(SELECT_COMPANY_PATH);
  const org = await findOrgByClerkId(clerkOrgId);
  if (!org || org.deleted) redirect(SELECT_COMPANY_PATH);
  const info = await withTenant(org.id, async (tx) => {
    const [me] = await tx.select({ id: members.id }).from(members).where(and(eq(members.orgId, org.id), eq(members.clerkUserId, userId)));
    const [company] = await tx.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, org.id));
    return { company: company?.name ?? "Your company", holder: await seatHolderName(tx, org.id), seated: me ? await hasSeat(tx, org.id, me.id) : false };
  });
  // Upgraded since: straight back in.
  if (info.seated) redirect("/app");
  return (
    <div className="w-full max-w-[440px] rounded-2xl bg-white p-6 text-[15px] text-ink shadow-ring sm:p-8">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{info.company} is on the Free plan</h1>
      <p className="mt-2 text-ink-2">
        The Free plan includes one login{info.holder ? `, which ${info.holder} uses` : ""}. To get back into Builder OS, ask {info.holder ?? "your company's Admin"} to choose a plan in{" "}
        <span className="font-medium text-ink">Settings → Plan &amp; billing</span>.
      </p>
      <p className="mt-2 text-ink-2">Nothing is lost: your quotes, jobs and everything else are all still there, and you&apos;ll go straight back in once the plan changes.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={SELECT_COMPANY_PATH} className="inline-flex h-10 items-center rounded-xl bg-ink px-4 font-semibold text-white hover:bg-ink/90">
          Switch company
        </Link>
        <SignOutButton redirectUrl="/">
          <button type="button" className="inline-flex h-10 items-center rounded-xl bg-white px-4 font-semibold text-ink shadow-ring hover:bg-surface">
            Sign out
          </button>
        </SignOutButton>
        <Link href="/help/plans-and-pricing" className="inline-flex h-10 items-center px-2 text-ink-2 underline underline-offset-2 hover:text-ink">
          About the plans
        </Link>
      </div>
    </div>
  );
}
