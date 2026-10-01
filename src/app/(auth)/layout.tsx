import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { AuthProvider } from "@/components/auth/auth-provider";

export const metadata: Metadata = { robots: { index: false } };

/** Sign-in, sign-up and company selection: the logo, one centred card, nothing else. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-dvh flex-col items-center bg-surface px-4 py-10">
        <Link href="/" aria-label="Builder OS home" className="mb-8">
          <Logo />
        </Link>
        <main className="flex w-full flex-1 justify-center">{children}</main>
      </div>
    </AuthProvider>
  );
}
