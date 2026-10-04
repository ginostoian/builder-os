import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { platformAccess } from "@/auth/platform-admin";

/** Admins must use two-step verification: everything about every customer is one click away in here. */
export default async function TwoStepPage() {
  const access = await platformAccess();
  if (access.ok || access.reason !== "needs_2fa") notFound();
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 p-6 text-[13px] text-ink">
      <div className="max-w-[420px] rounded-xl bg-white p-6 shadow-ring">
        <ShieldAlert className="size-6 text-warning" />
        <h1 className="mt-3 text-[17px] font-semibold">Turn on two-step verification</h1>
        <p className="mt-1.5 text-ink-2">
          The admin area shows every customer&apos;s account, so it needs two-step verification on your login. Open your account (your picture in the app, then Manage account → Security),
          add an authenticator app, then come back.
        </p>
        <a href="/app" className="mt-4 inline-flex h-8 items-center rounded-md bg-ink px-3 font-medium text-white">
          Back to the app
        </a>
      </div>
    </div>
  );
}
