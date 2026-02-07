import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <SignIn
        fallbackRedirectUrl="/app"
        forceRedirectUrl="/app"
        signUpFallbackRedirectUrl="/app"
        signUpForceRedirectUrl="/app"
      />
    </main>
  );
}
