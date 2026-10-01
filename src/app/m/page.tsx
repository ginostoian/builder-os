import type { Metadata } from "next";
import { BackToAdmin } from "@/components/app/back-to-admin";
import { EmployeeAppScreen } from "@/components/app/screens/employee-app";
import { can } from "@/core/roles";
import { getSession } from "@/auth/session";

export const metadata: Metadata = { title: "Today", robots: { index: false } };

/** On a phone the app fills the screen; on a desktop it sits in a phone frame for demos. */
export default async function EmployeeAppPage() {
  // Every role can open the employee app; only office roles get the shortcut back to the admin app.
  const session = await getSession();
  return (
    <div className="flex min-h-dvh items-stretch justify-center bg-[#EDECE8] sm:items-center sm:py-8">
      <div className="h-dvh w-full overflow-hidden sm:h-[844px] sm:w-[390px] sm:rounded-[52px] sm:border-[11px] sm:border-ink sm:shadow-[0_30px_60px_-20px_rgb(0_0_0/0.35)]">
        <EmployeeAppScreen />
      </div>
      {can(session.role, "app.office") && <BackToAdmin />}
    </div>
  );
}
