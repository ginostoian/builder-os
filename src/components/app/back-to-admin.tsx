import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { appRoutes } from "./routes";

/** Demo-only shortcut from the client and employee surfaces back to the admin app. */
export function BackToAdmin() {
  return (
    <Link
      href={appRoutes.quote}
      className="fixed bottom-4 left-4 z-20 hidden h-[34px] items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13px] font-medium text-white shadow-[0_8px_24px_-8px_rgb(0_0_0/0.4)] hover:text-white sm:flex"
    >
      <ArrowLeft className="size-3.5" />
      Back to admin
    </Link>
  );
}
