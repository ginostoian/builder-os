import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  ChartColumn,
  ChevronRight,
  ChevronsUpDown,
  Contact,
  FileDiff,
  FileSpreadsheet,
  Globe,
  HardHat,
  LayoutDashboard,
  Library,
  Plus,
  Receipt,
  Search,
  Settings,
  Smartphone,
  SquareKanban,
  type LucideIcon,
} from "lucide-react";
import { LogoMark, Avatar } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { company, currentUser } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { appRoutes, type AdminScreen } from "./routes";

type NavItem = { id: string; label: string; icon: LucideIcon; href: string; badge?: string; screen?: AdminScreen };

const nav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: appRoutes.dashboard, screen: "dashboard" },
  { id: "quote", label: "Quotes", icon: FileSpreadsheet, href: appRoutes.quote, badge: "4", screen: "quote" },
  { id: "templates", label: "Service library", icon: Library, href: appRoutes.library, screen: "templates" },
  { id: "variations", label: "Variations", icon: FileDiff, href: appRoutes.project, badge: "2" },
  { id: "board", label: "Projects", icon: SquareKanban, href: appRoutes.project, badge: "7", screen: "board" },
  { id: "invoices", label: "Payments", icon: Receipt, href: appRoutes.payments, screen: "invoices" },
  { id: "crm", label: "Clients", icon: Contact, href: appRoutes.clients, badge: "23", screen: "crm" },
  { id: "team", label: "Team", icon: HardHat, href: appRoutes.employee },
  { id: "reports", label: "Reports", icon: ChartColumn, href: appRoutes.dashboard },
];

const portals = [
  { label: "Client portal", icon: Globe, href: appRoutes.clientQuote },
  { label: "Employee app", icon: Smartphone, href: appRoutes.employee },
];

const crumbs: Record<AdminScreen, [string, string]> = {
  dashboard: [company.name, "Dashboard"],
  quote: ["Quotes", "Q-1042"],
  templates: ["Quotes", "Service library"],
  board: ["Projects", "14 Elm Road"],
  invoices: ["Payments", "14 Elm Road"],
  crm: ["Clients", "Pipeline"],
  settings: ["Settings", "Company"],
};

/** The signed-in account, rendered by `LiveAppShell`. Screenshots leave it out and show demo data. */
export type ShellAccount = { company: React.ReactNode; user: React.ReactNode; crumbs?: [string, string] };

/**
 * Admin app frame: 228px sidebar, 52px top bar. Dense by design (13px body, 32px controls).
 * `embedded` makes it fill its parent (used by marketing screenshots) instead of the viewport.
 */
export function AppShell({
  active,
  embedded = false,
  account,
  children,
}: {
  active: AdminScreen;
  embedded?: boolean;
  account?: ShellAccount;
  children: React.ReactNode;
}) {
  const [crumbA, crumbB] = account?.crumbs ?? crumbs[active];
  return (
    <div
      className={cn(
        "flex w-full overflow-hidden bg-white font-sans text-[13px] leading-[1.4] text-ink antialiased",
        embedded ? "h-full" : "h-[max(100vh,800px)] min-w-[1280px]",
      )}
    >
      <aside className="flex w-[228px] flex-none flex-col gap-3.5 border-r border-hairline bg-surface px-2.5 py-3">
        {account ? (
          account.company
        ) : (
          <button type="button" className="flex items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-accent">
            <LogoMark size="md" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold tracking-[-0.01em]">{company.name}</span>
              <span className="block text-[11.5px] text-subtle">{company.place}</span>
            </span>
            <ChevronsUpDown className="size-3.5 text-subtle" />
          </button>
        )}
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-md bg-white px-2.5 text-subtle shadow-ring"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded bg-line px-[5px] py-px font-mono text-[10.5px] text-ink-2">⌘K</kbd>
        </button>
        <nav className="flex flex-col gap-px" aria-label="Main">
          {nav.map((n) => {
            const isActive = n.screen === active;
            return (
              <Link
                key={n.id}
                href={n.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2.5 transition-colors duration-[120ms]",
                  isActive
                    ? "bg-white font-medium text-ink shadow-[0_0_0_1px_#E8E7E3,0_1px_2px_rgb(16_16_15/0.05)]"
                    : "text-ink-2 hover:bg-accent hover:text-ink",
                )}
              >
                <n.icon className="size-[15px] w-4" strokeWidth={1.75} />
                <span className="flex-1">{n.label}</span>
                {n.badge && <span className="text-[11px] text-subtle tabular">{n.badge}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-px">
          <div className="px-2.5 py-1 text-[11px] font-medium text-subtle">Portals</div>
          {portals.map((p) => (
            <Link key={p.label} href={p.href} className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-ink-2 hover:bg-accent hover:text-ink">
              <p.icon className="size-[15px] w-4" strokeWidth={1.75} />
              <span className="flex-1">{p.label}</span>
              <ArrowUpRight className="size-3 text-faint-2" />
            </Link>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2.5">
          <div className="rounded-[10px] bg-white p-3 shadow-ring">
            <div className="text-[12.5px] font-medium">Pro trial · 9 days left</div>
            <div className="my-2 h-1 rounded bg-line">
              <div className="h-1 w-[36%] rounded bg-ink" />
            </div>
            <div className="text-xs text-ink-2">Upgrade to keep CRM &amp; projects</div>
          </div>
          {account ? (
            account.user
          ) : (
            <div className="flex items-center gap-2.5 p-1.5">
              <Avatar initials={currentUser.initials} size={28} className="text-[11px]" />
              <div className="flex-1">
                <div className="text-[12.5px] font-medium">{currentUser.name}</div>
                <div className="text-[11.5px] text-subtle">{currentUser.role}</div>
              </div>
              <Settings className="size-[15px] text-subtle" />
            </div>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="flex h-[52px] flex-none items-center gap-2 border-b border-hairline px-5">
          <span className="text-subtle">{crumbA}</span>
          <ChevronRight className="size-[13px] text-faint" />
          <span className="font-medium">{crumbB}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            <button type="button" aria-label="Notifications" className="relative flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-accent">
              <Bell className="size-4" />
              <span className="absolute top-2 right-2 size-1.5 rounded-full bg-brand" />
            </button>
            <Button>
              <Plus />
              New
            </Button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

/** Page title block used at the top of most app screens. */
export function ScreenTitle({ title, subtitle, children }: { title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h1 className="text-[19px] font-semibold tracking-[-0.02em]">{title}</h1>
        {subtitle && <div className="mt-0.5 text-subtle">{subtitle}</div>}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}

/** White card with the 1px ring, the default container in the app. */
export function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-xl bg-white shadow-ring", className)} {...props} />;
}
