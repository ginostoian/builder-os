import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL, SUBPROCESSORS } from "@/lib/content/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "Privacy policy", description: "How Builder OS collects, uses and protects personal data, and your rights under UK GDPR.", path: "/privacy" });

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy policy"
      updated={LEGAL.updated}
      intro={
        <p>
          Builder OS is software that building and renovation companies use to quote, run jobs and get paid. This policy explains what personal data we handle, why, who we share it with,
          how long we keep it, and your rights. It covers our website, the Builder OS app, the client portal and the emails the app sends.
        </p>
      }
    >
      <div>
        <h2>Who we are</h2>
        <p>
          {LEGAL.company} (company number {LEGAL.companyNumber}, registered office {LEGAL.registeredOffice}) runs Builder OS. We&apos;re registered with the Information
          Commissioner&apos;s Office (registration {LEGAL.icoNumber}). Questions about privacy, or a request about your data: <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>.
        </p>
      </div>

      <div>
        <h2>Two roles: controller and processor</h2>
        <p>
          <strong>We&apos;re the controller</strong> for data about the companies that use Builder OS and their team members: account details, billing, and how the app is used.
        </p>
        <p>
          <strong>We&apos;re a processor</strong> for the data a company keeps in Builder OS about its own clients, leads, workers and jobs. The company decides what to collect and why, and is the
          controller of it. If you&apos;re a homeowner who received a quote or invoice through Builder OS, the building company is responsible for your data: contact them first. We act only on
          their instructions, under our data processing terms, and will help them answer your request.
        </p>
      </div>

      <div>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account data</strong>: names, work email addresses, phone numbers, role and company details of people who sign up or are invited.
          </li>
          <li>
            <strong>Billing data</strong>: plan, subscription status and invoices. Card details go straight to Stripe; we never see or store them.
          </li>
          <li>
            <strong>Content companies add</strong>: clients and leads (names, contact details, addresses), quotes, invoices, projects, site diaries, photos, files, receipts, team members and
            their certificates, timesheets (with the phone&apos;s location at check-in and check-out, if the person allows it), messages and, for companies that use CIS, subcontractors&apos; tax
            references (UTR and HMRC verification number).
          </li>
          <li>
            <strong>Client portal and forms</strong>: what clients enter (comments, e-signatures with the name typed, time, IP address and browser, survey bookings, website enquiries), and
            a one-time code or link when they sign in.
          </li>
          <li>
            <strong>Messages to us</strong>: what you send through our support page or other forms (name, email, company and your message), to reply to you.
          </li>
          <li>
            <strong>Usage and technical data</strong>: how many pages each signed-in person views each day (counts only, not which pages), server logs, and error reports with personal details
            removed.
          </li>
        </ul>
      </div>

      <div>
        <h2>Why we use it, and our lawful basis</h2>
        <ul>
          <li>To provide the service a company signed up for, and to sign people in: <em>contract</em>.</li>
          <li>To bill subscriptions and keep accounting records: <em>contract</em> and <em>legal obligation</em>.</li>
          <li>To keep the service secure (rate limits, fraud and abuse prevention, error monitoring): <em>legitimate interests</em>.</li>
          <li>To understand how the product is used, in aggregate, and improve it: <em>legitimate interests</em>.</li>
          <li>To send service emails, such as sign-in codes, receipts and changes to these terms: <em>contract</em>. We don&apos;t sell data or use it for advertising.</li>
        </ul>
        <p>For the data companies keep about their clients, the company chooses its own lawful basis; we process it to provide the service to them.</p>
      </div>

      <div>
        <h2>Who we share it with</h2>
        <p>We use these providers (sub-processors) to run Builder OS. Each is bound by a data processing agreement.</p>
        <ul>
          {SUBPROCESSORS.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong>: {s.purpose}. {s.location}.
            </li>
          ))}
        </ul>
        <p>
          Where data leaves the UK, it&apos;s protected by UK adequacy regulations or the UK International Data Transfer Addendum to the EU Standard Contractual Clauses. We&apos;ll share data
          with authorities only when the law requires it.
        </p>
      </div>

      <div>
        <h2>How long we keep it</h2>
        <ul>
          <li>Company data is kept while the company has an account. When a company closes its account, or its admin asks us to, we delete its data within 90 days, except what we must keep by law.</li>
          <li>Invoices and billing records are kept for six years, as UK tax law requires.</li>
          <li>Sign-in codes and links expire within a week; device sign-ins last 90 days unless signed out sooner.</li>
          <li>Rate-limit counters are kept for a day, error reports for up to 90 days, and server logs for no more than 30 days.</li>
          <li>Messages to our support inbox are kept as long as we need them to help you, and no more than two years.</li>
        </ul>
      </div>

      <div>
        <h2>How we protect it</h2>
        <p>
          Data is encrypted in transit and at rest. Each company&apos;s data is kept apart by the database itself, not just by our code. Access is limited by role, sign-in is handled by a
          specialist provider, and our admin access needs two-step verification. Private files are served through links that expire, when a company has them switched on.
        </p>
      </div>

      <div>
        <h2>Your rights</h2>
        <p>
          Under UK GDPR you can ask for a copy of your data, ask us to correct or delete it, object to or restrict how we use it, and ask for it in a portable format. Company admins can
          export all of their company&apos;s data from Settings, and a copy of any one client&apos;s data from that client&apos;s page. To make a request, email{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>; we&apos;ll reply within one month.
        </p>
        <p>
          If you&apos;re unhappy with how we&apos;ve handled your data, you can complain to the Information Commissioner&apos;s Office at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a>
          , though we&apos;d appreciate the chance to put it right first.
        </p>
      </div>

      <div>
        <h2>On your phone</h2>
        <p>
          So the site app works with no signal, it keeps a copy of your jobs and anything you do offline (check-ins, task updates, site updates with photos, receipts) on your phone until it
          can be sent. That copy is deleted from the phone once it&apos;s sent, and the saved pages are cleared when someone else signs in on the same phone. Clearing the browser&apos;s site
          data removes everything.
        </p>
        <p>
          WhatsApp buttons open WhatsApp on your own device with a message ready to send. We don&apos;t send any data to WhatsApp ourselves; what you send there is between you and
          WhatsApp.
        </p>
      </div>

      <div>
        <h2>Cookies</h2>
        <p>
          We only use cookies that the site needs to work, such as keeping you signed in. See our <Link href="/cookies">cookie policy</Link> for the full list.
        </p>
      </div>

      <div>
        <h2>Changes</h2>
        <p>If we change this policy in a way that matters, we&apos;ll tell company admins by email before it takes effect. The date at the top shows when it last changed.</p>
      </div>
    </LegalPage>
  );
}
