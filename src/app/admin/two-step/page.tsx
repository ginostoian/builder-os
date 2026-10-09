import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import qrcode from "qrcode-generator";
import { ShieldCheck } from "lucide-react";
import { setupToken } from "@/auth/admin-two-step";
import { platformAccess } from "@/auth/platform-admin";
import { AdminCodeForm } from "@/components/admin/admin-code-form";
import { groupKey, newTotpSecret, otpauthUrl } from "@/core/totp";

export const metadata: Metadata = { title: "Two-step verification" };

/**
 * Two-step verification for the admin area, which shows every customer's account: set up an
 * authenticator app the first time, then type its code every 12 hours.
 */
export default async function TwoStepPage() {
  const access = await platformAccess();
  if (access.ok) redirect("/admin");
  if (access.reason === "not_admin") notFound();

  let setup: {
    secret: string;
    token: string;
    qr: string;
    link: string;
    key: string;
  } | null = null;
  if (access.reason === "needs_setup") {
    const secret = newTotpSecret();
    const link = otpauthUrl("Builder OS admin", access.email, secret);
    const qr = qrcode(0, "M");
    qr.addData(link);
    qr.make();
    setup = {
      secret,
      token: setupToken(access.userId, secret),
      qr: qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }),
      link,
      key: groupKey(secret),
    };
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-2 p-4 font-sans text-[14px] leading-[1.45] text-ink antialiased">
      <div className="w-full max-w-[440px] rounded-xl bg-white p-6 shadow-ring">
        <ShieldCheck className="size-6 text-brand" />
        {setup ? (
          <>
            <h1 className="mt-3 text-[18px] font-semibold">Set up two-step verification</h1>
            <p className="mt-1.5 text-ink-2">
              The admin area shows every customer&apos;s account, so it needs a code from an authenticator app as well as your password. Any free app works, such as Google
              Authenticator or Microsoft Authenticator.
            </p>
            <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5 text-ink-2">
              <li>
                In the app, tap the + button and scan this code.
                <div
                  className="mt-2 w-[180px] rounded-lg bg-white p-1 shadow-ring"
                  role="img"
                  aria-label="QR code to scan with your authenticator app"
                  dangerouslySetInnerHTML={{ __html: setup.qr }}
                />
                <span className="mt-2 block text-[13px]">
                  On this phone already?{" "}
                  <a href={setup.link} className="font-medium text-ink underline underline-offset-2">
                    Open it in the app
                  </a>
                  , or type this key in: <code className="font-mono text-[12.5px] break-all text-ink select-all">{setup.key}</code>
                </span>
              </li>
              <li>Type the 6-digit code the app shows for Builder OS admin.</li>
            </ol>
            <p className="mt-3 text-[12.5px] text-subtle">Keep the app on your phone. If you lose it, the key can be reset in Clerk (see the setup guide).</p>
            <div className="mt-4">
              <AdminCodeForm mode="setup" secret={setup.secret} token={setup.token} />
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-[18px] font-semibold">Enter your code</h1>
            <p className="mt-1.5 text-ink-2">
              Open your authenticator app and type the 6-digit code for Builder OS admin. You won&apos;t be asked again on this browser for 12 hours.
            </p>
            <div className="mt-4">
              <AdminCodeForm mode="code" />
            </div>
          </>
        )}
        <a href="/app" className="mt-4 inline-block text-[13px] text-ink-2 underline underline-offset-2">
          Back to the app
        </a>
      </div>
    </main>
  );
}
