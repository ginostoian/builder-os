import type { Metadata } from "next";
import { UnsubscribeButton } from "@/components/public/unsubscribe-button";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** From the link in an automated email. A button, so link scanners in mail systems don't unsubscribe people. */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 text-center shadow-ring">
        <h1 className="text-lg font-semibold">Stop these emails?</h1>
        <p className="mt-1 text-ink-2">You won&apos;t get any more automatic follow-up emails about your enquiry. You can still contact the company any time.</p>
        <UnsubscribeButton token={token} />
      </div>
    </main>
  );
}
