import { ClerkProvider } from "@clerk/nextjs";
import { SELECT_COMPANY_PATH } from "@/auth/paths";

/**
 * Clerk, styled with the Design Guidelines tokens. Mounted only by the signed-in surfaces (/app, /m and the
 * auth pages), so the marketing site never loads Clerk's script.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      taskUrls={{ "choose-organization": SELECT_COMPANY_PATH }}
      appearance={{
        variables: {
          colorPrimary: "#111110",
          colorPrimaryForeground: "#FFFFFF",
          colorForeground: "#111110",
          colorMutedForeground: "#5C5B57",
          colorBackground: "#FFFFFF",
          colorInput: "#FAFAF9",
          colorInputForeground: "#111110",
          colorBorder: "#E8E7E3",
          colorRing: "#111110",
          colorDanger: "#B13B22",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          borderRadius: "0.5rem",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
