import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL, SUBPROCESSORS } from "@/lib/content/legal";

export const metadata: Metadata = { title: "Terms of service", description: "The terms for using Builder OS, including how we look after the data you keep in it." };

/**
 * The agreement between Builder OS and the companies that use it, written to be read. The data processing
 * terms (UK GDPR article 28) are part of it, so customers don't need a separate DPA for the standard service.
 */
export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of service"
      updated={LEGAL.updated}
      intro={
        <p>
          These terms are the agreement between {LEGAL.company} (&ldquo;we&rdquo;) and the business that signs up for Builder OS (&ldquo;you&rdquo;). We&apos;ve tried to write them plainly. By
          creating an account, or using Builder OS for your business, you agree to them on your business&apos;s behalf. Builder OS is for businesses, not for personal use.
        </p>
      }
    >
      <div>
        <h2>1. The service</h2>
        <p>
          Builder OS is online software for building and renovation businesses: quotes, a client portal, variations, invoices and payments, projects, a site app for your team, job costing,
          a sales pipeline and, if you turn it on, CIS figures. We may improve and change features over time. If we remove something important you pay for, we&apos;ll tell you at least 30
          days before.
        </p>
      </div>

      <div>
        <h2>2. Your account</h2>
        <ul>
          <li>The person who creates the account is its first Admin and must be authorised to accept these terms for the business.</li>
          <li>You decide who on your team has a login and what role they have. You&apos;re responsible for what happens under your logins, so keep them to the right people.</li>
          <li>
            Keep your sign-in details safe and tell us straight away at <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> if you think an account has been misused.
          </li>
        </ul>
      </div>

      <div>
        <h2>3. Plans, trials and paying</h2>
        <ul>
          <li>
            Prices and what each plan includes are on our <Link href="/pricing">pricing page</Link>. Prices are per company per month, plus VAT.
          </li>
          <li>New companies get a free trial. When it ends you move to the Free plan unless you choose a paid plan. The Free plan has limits, including one login.</li>
          <li>Paid plans are billed monthly in advance by card through Stripe and renew each month until you cancel.</li>
          <li>You can cancel at any time in Settings. You keep your plan until the end of the month you&apos;ve paid for, then move to the Free plan. We don&apos;t refund part months.</li>
          <li>If a payment fails and isn&apos;t fixed within 14 days of us telling you, we may move you to the Free plan. Your data stays put.</li>
          <li>We may change prices with at least 30 days&apos; notice by email. The new price applies from your next renewal after that.</li>
        </ul>
      </div>

      <div>
        <h2>4. Your data</h2>
        <ul>
          <li>Everything you put into Builder OS (your clients, quotes, jobs, files and so on) is yours. You give us permission to store and use it only to provide the service to you.</li>
          <li>You can export all of it at any time from Settings, as spreadsheets and files.</li>
          <li>
            You&apos;re responsible for having the right to put personal data into Builder OS and for telling your clients and team how you use it. Our <Link href="/privacy">privacy policy</Link>{" "}
            explains how we handle data.
          </li>
          <li>If you close your account, we delete your data within 90 days, except records the law makes us keep. Export anything you need first.</li>
        </ul>
      </div>

      <div>
        <h2>5. Looking after personal data for you (data processing terms)</h2>
        <p>
          For the personal data you keep in Builder OS about your clients, leads and team, you&apos;re the controller and we&apos;re your processor. These terms are our data processing
          agreement under UK GDPR article 28. We will:
        </p>
        <ul>
          <li>
            process the data only to provide Builder OS, on your documented instructions (these terms and how you use the app), unless the law requires otherwise, in which case we&apos;ll
            tell you if we can;
          </li>
          <li>make sure everyone who can access it is bound to keep it confidential;</li>
          <li>keep it secure, with encryption, separation of each company&apos;s data in the database, role-based access, and two-step verification for our own admin access;</li>
          <li>
            use only the sub-processors listed in our privacy policy ({SUBPROCESSORS.map((s) => s.name).join(", ")}), each under a written agreement with the same protections, and tell you at
            least 14 days before adding or replacing one, so you can object;
          </li>
          <li>help you answer requests from people exercising their rights, and with security, breach notification and impact assessments, as far as is reasonable;</li>
          <li>tell you without undue delay, and within 48 hours, if we become aware of a personal data breach affecting your data;</li>
          <li>delete or return the data when you close your account, as set out above; and</li>
          <li>give you the information you need to show we meet these obligations, and allow reasonable audits on reasonable notice (usually by answering a questionnaire).</li>
        </ul>
        <p>Data is transferred outside the UK only with the safeguards described in the privacy policy.</p>
      </div>

      <div>
        <h2>6. Using Builder OS fairly</h2>
        <p>You agree not to:</p>
        <ul>
          <li>use it for anything unlawful, or to send spam or messages people haven&apos;t agreed to receive;</li>
          <li>upload anything that infringes someone else&apos;s rights, or that contains malware;</li>
          <li>try to get into other companies&apos; data, test our security without our written permission, or overload the service; or</li>
          <li>copy, resell or reverse-engineer Builder OS.</li>
        </ul>
        <p>If you break these rules, we may suspend access after telling you why, or straight away if it&apos;s needed to protect the service or other customers.</p>
      </div>

      <div>
        <h2>7. Payments from your clients</h2>
        <p>
          If you turn on online payments, your clients pay you through your own Stripe account, under Stripe&apos;s terms. The contract is between you and your client; we&apos;re not a party
          to it and don&apos;t hold the money. Stripe&apos;s fees are yours. Refunds and disputes are handled in your Stripe account.
        </p>
      </div>

      <div>
        <h2>8. Tax, CIS and your paperwork</h2>
        <p>
          Builder OS works out figures such as VAT, CIS deductions and job costs from what you enter. It&apos;s a tool, not tax or legal advice: you&apos;re responsible for checking the
          figures, verifying subcontractors with HMRC, and filing your returns and paying HMRC on time. Quotes, contracts and invoices you send are between you and your client.
        </p>
      </div>

      <div>
        <h2>9. WhatsApp and other services</h2>
        <p>
          Some buttons open other services, such as WhatsApp or Google Maps, on your own device. Messages you send there go through that service under its own terms, not through Builder
          OS.
        </p>
      </div>

      <div>
        <h2>10. Availability and support</h2>
        <p>
          We work hard to keep Builder OS running and backed up, but we can&apos;t promise it will never be interrupted, for example during maintenance or problems with our providers. We
          offer support by email; see our <Link href="/support">support page</Link>.
        </p>
      </div>

      <div>
        <h2>11. Our responsibility to you</h2>
        <ul>
          <li>Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else the law doesn&apos;t allow us to limit.</li>
          <li>We aren&apos;t liable for loss of profit, revenue, business or goodwill, or for indirect or consequential losses.</li>
          <li>Otherwise, our total liability to you in any 12 months is limited to the amount you paid us for Builder OS in those 12 months, or £100 if that&apos;s more.</li>
          <li>Because Builder OS is supplied to businesses, consumer protection rules for individuals don&apos;t apply.</li>
        </ul>
      </div>

      <div>
        <h2>12. Ending</h2>
        <p>
          You can stop using Builder OS and close your account at any time. We can end these terms with 30 days&apos; notice, or straight away if you seriously or repeatedly break them, or
          don&apos;t pay. Sections 4, 5, 11 and 14 keep applying after the end.
        </p>
      </div>

      <div>
        <h2>13. Changes to these terms</h2>
        <p>We may update these terms. If a change matters, we&apos;ll email your Admins at least 30 days before it takes effect. If you don&apos;t agree, you can cancel before then.</p>
      </div>

      <div>
        <h2>14. The legal bits</h2>
        <p>
          These terms, the privacy policy and the pricing page are the whole agreement between us. If a part of them can&apos;t be enforced, the rest still applies. They&apos;re governed by the
          law of England and Wales, and the courts of England and Wales deal with any dispute. {LEGAL.company}, company number {LEGAL.companyNumber}, registered office{" "}
          {LEGAL.registeredOffice}.
        </p>
      </div>
    </LegalPage>
  );
}
