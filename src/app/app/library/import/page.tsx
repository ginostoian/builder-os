import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { ScreenTitle } from "@/components/app/app-shell";
import { LibraryImport } from "@/components/app/library/library-import";
import { requirePermission } from "@/auth/session";

export const metadata: Metadata = { title: "Import services" };

export default async function ImportPage() {
  await requirePermission("library.manage");
  return (
    <LiveAppShell active="templates" crumbs={["Service library", "Import"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-[18px]">
        <div className="flex flex-col gap-2">
          <Link href="/app/library" className="flex w-fit items-center gap-1 text-ink-2 hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Service library
          </Link>
          <ScreenTitle title="Import services" subtitle="Bring in your price list from a spreadsheet." />
        </div>
        <div className="max-w-[860px]">
          <LibraryImport />
        </div>
      </div>
    </LiveAppShell>
  );
}
