"use client";

import { useRouter } from "next/navigation";
import { signOutPortalAction } from "@/app/portal/sign-in-actions";

/** Sign out on this device (a shared or work computer, say). */
export function PortalSignOut({ token }: { token: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOutPortalAction(token);
        router.refresh();
      }}
      className="rounded-md px-2.5 py-1.5 text-[12.5px] text-ink-2 hover:bg-accent hover:text-ink"
    >
      Sign out
    </button>
  );
}
