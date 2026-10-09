import Link from "next/link";
import { ArrowLeft, Building2, Gauge, Lock, ShieldCheck } from "lucide-react";
import { lockAdminAction } from "@/app/admin/two-step/actions";
import { LogoMark } from "@/components/brand";
import { cn } from "@/lib/utils";

const nav = [
  { id: "overview", label: "Overview", href: "/admin", icon: Gauge },
  { id: "companies", label: "Companies", href: "/admin/companies", icon: Building2 },
] as const;

export type AdminSection = (typeof nav)[number]["id"];

/**
 * The website owner's admin area: its own frame, outside every company. Nothing here belongs to one
 * company; it's Builder OS as a business.
 */
export function AdminShell({ active, who, children }: { active: AdminSection; who: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface-2 font-sans text-[13px] leading-[1.4] text-ink antialiased">
      <aside className="sticky top-0 flex h-screen w-[220px] flex-none flex-col gap-4 border-r border-night-line bg-ink px-3 py-4 text-white max-md:hidden">
        <div className="flex items-center gap-2.5 px-1.5">
          <LogoMark size="md" inverse />
          <span>
            <span className="block text-[13px] font-semibold">Builder OS</span>
            <span className="flex items-center gap-1 text-[11px] text-white/60">
              <ShieldCheck className="size-3" />
              Owner admin
            </span>
          </span>
        </div>
        <nav aria-label="Admin" className="flex flex-col gap-px">
          {nav.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              aria-current={n.id === active ? "page" : undefined}
              className={cn("flex h-8 items-center gap-2.5 rounded-md px-2.5", n.id === active ? "bg-white/10 font-medium text-white" : "text-white/70 hover:bg-white/5 hover:text-white")}
            >
              <n.icon className="size-[15px]" strokeWidth={1.75} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 px-1.5 text-[11.5px] text-white/60">
          <span className="truncate">{who}</span>
          <Link href="/app" className="flex items-center gap-1.5 text-white/80 hover:text-white">
            <ArrowLeft className="size-3" />
            Back to the app
          </Link>
          <form action={lockAdminAction}>
            <button type="submit" title="Ask for a code again before anyone opens the admin area on this browser" className="flex items-center gap-1.5 text-white/80 hover:text-white">
              <Lock className="size-3" />
              Lock admin
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <nav aria-label="Admin" className="flex gap-1 border-b border-hairline bg-white px-4 py-2 md:hidden">
          {nav.map((n) => (
            <Link key={n.id} href={n.href} aria-current={n.id === active ? "page" : undefined} className={cn("rounded-md px-2.5 py-1.5", n.id === active ? "bg-ink text-white" : "text-ink-2")}>
              {n.label}
            </Link>
          ))}
          <form action={lockAdminAction} className="ml-auto">
            <button type="submit" className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-ink-2">
              <Lock className="size-3.5" />
              Lock
            </button>
          </form>
        </nav>
        <main className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}
