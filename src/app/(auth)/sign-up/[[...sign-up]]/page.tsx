import type { Metadata } from "next";
import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center gap-4">
      <SignUp />
      <p className="max-w-[400px] text-center text-[12.5px] text-subtle">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="text-ink-2 underline underline-offset-2">
          terms of service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-ink-2 underline underline-offset-2">
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
