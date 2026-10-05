import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL } from "@/lib/content/legal";

export const metadata: Metadata = { title: "Cookie policy", description: "The cookies Builder OS uses: only the ones the site needs to work." };

const cookies: [string, string, string, string][] = [
  ["__session, __client_uat", "Clerk (our sign-in provider)", "Keeps you signed in to the Builder OS app", "While you're signed in"],
  ["bos_portal_…", "Builder OS", "Remembers that a client confirmed their email on this device, so the client portal opens without a new code", "90 days, or until signed out"],
  ["bos_cookies", "Builder OS", "Remembers that you've seen this notice", "12 months"],
];

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Cookie policy"
      updated={LEGAL.updated}
      intro={<p>Builder OS only uses cookies the site needs to work: to keep you signed in and to remember a few choices. We don&apos;t use advertising or tracking cookies.</p>}
    >
      <div>
        <h2>The cookies we set</h2>
        <div className="mt-3 overflow-x-auto rounded-xl bg-white shadow-ring">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-surface text-[13px] text-subtle">
              <tr>
                <th className="px-4 py-2.5 font-medium">Cookie</th>
                <th className="px-4 py-2.5 font-medium">Set by</th>
                <th className="px-4 py-2.5 font-medium">What it&apos;s for</th>
                <th className="px-4 py-2.5 font-medium">How long</th>
              </tr>
            </thead>
            <tbody>
              {cookies.map(([name, by, why, how]) => (
                <tr key={name} className="border-t border-line align-top">
                  <td className="px-4 py-3 font-mono text-[13px] text-ink">{name}</td>
                  <td className="px-4 py-3">{by}</td>
                  <td className="px-4 py-3">{why}</td>
                  <td className="px-4 py-3">{how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3">
          These are strictly necessary, so UK law (PECR) doesn&apos;t require consent for them. Blocking them in your browser will stop sign-in from working.
        </p>
      </div>
      <div>
        <h2>Other storage on your device</h2>
        <p>
          The app keeps a couple of conveniences in your browser&apos;s local storage: which getting-started chapters you&apos;ve already been congratulated on, and, in the client
          portal, the name you typed so you don&apos;t have to type it again. They never leave your device.
        </p>
      </div>
      <div>
        <h2>Payments</h2>
        <p>When you pay an invoice or a subscription, you do so on Stripe&apos;s own checkout pages, which set Stripe&apos;s cookies to prevent fraud. See Stripe&apos;s cookie policy.</p>
      </div>
      <div>
        <h2>Changes and questions</h2>
        <p>
          If we ever add cookies that aren&apos;t strictly necessary, such as analytics, we&apos;ll ask first and you&apos;ll be able to say no. Questions:{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>. See also our <Link href="/privacy">privacy policy</Link>.
        </p>
      </div>
    </LegalPage>
  );
}
