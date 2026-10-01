import type { Metadata } from "next";
import { OrganizationList, TaskChooseOrganization } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export const metadata: Metadata = { title: "Choose your company" };

/**
 * Every session works inside one company. New users create theirs here (they become its Admin) and invited
 * staff pick the company that invited them. Also where we send anyone whose company or membership is gone.
 *
 * Not protected by the proxy: a user who hasn't chosen a company yet has a *pending* session, which the
 * proxy treats as signed out, and that would bounce between here and sign-in.
 */
export default async function SelectCompanyPage() {
  const { userId, sessionStatus, redirectToSignIn } = await auth({ treatPendingAsSignedOut: false });
  if (!userId) return redirectToSignIn();
  if (sessionStatus === "pending") return <TaskChooseOrganization redirectUrlComplete="/app" />;
  return <OrganizationList hidePersonal afterSelectOrganizationUrl="/app" afterCreateOrganizationUrl="/app" />;
}
