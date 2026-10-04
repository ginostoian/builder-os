import type { Metadata } from "next";
import { FindMyPortal } from "@/components/portal/find-my-portal";

export const metadata: Metadata = { title: { absolute: "Your quotes and invoices" }, robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * The address clients can remember (or bookmark): enter the email your builder has for you and we email
 * you a sign-in link to your portal. Companies can link to it from their website ("Client login").
 */
export default function FindMyPortalPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted px-4 py-10 font-sans text-[15px] text-ink antialiased">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-ring sm:p-8">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Your quotes and invoices</h1>
        <p className="mt-1 mb-4 text-ink-2">Enter the email address your builder has for you. We&apos;ll email you a link that signs you in.</p>
        <FindMyPortal />
      </div>
    </main>
  );
}
