/**
 * What the "+ New" menu and the ⌘K search offer, and who may use each. `LiveAppShell` filters this by role
 * and passes the result down, so nobody is shown a shortcut to a page that would turn them away.
 */
import type { Feature } from "@/core/plans";
import { can, type Permission, type Role } from "@/core/roles";

export type QuickActionIcon = "quote" | "lead" | "client" | "project" | "order" | "person" | "calendar" | "page";
export type QuickAction = { id: string; label: string; href: string; icon: QuickActionIcon; group: "new" | "go"; keywords?: string; feature?: Feature };

const ACTIONS: (QuickAction & { needs: Permission })[] = [
  { id: "new-quote", label: "New quote", href: "/app/quotes/new", icon: "quote", group: "new", needs: "quotes.edit", keywords: "estimate price" },
  { id: "new-lead", label: "New lead", href: "/app/pipeline?new=1", icon: "lead", group: "new", feature: "pipeline", needs: "leads.edit", keywords: "enquiry prospect" },
  { id: "new-client", label: "New client", href: "/app/clients/new", icon: "client", group: "new", needs: "clients.manage", keywords: "customer" },
  { id: "new-project", label: "New project", href: "/app/projects/new", icon: "project", group: "new", feature: "projects", needs: "projects.edit", keywords: "job" },
  { id: "new-order", label: "New purchase order", href: "/app/purchases/orders/new", icon: "order", group: "new", feature: "costs", needs: "costs.edit", keywords: "po materials supplier" },
  { id: "new-person", label: "Add someone to the team", href: "/app/team/new", icon: "person", group: "new", feature: "team", needs: "team.edit", keywords: "worker subcontractor employee" },
  { id: "go-calendar", label: "Calendar", href: "/app/calendar", icon: "calendar", group: "go", feature: "calendar", needs: "projects.view", keywords: "diary schedule visits" },
  { id: "go-pipeline", label: "Pipeline", href: "/app/pipeline", icon: "page", group: "go", feature: "pipeline", needs: "leads.view", keywords: "leads sales" },
  { id: "go-quotes", label: "Quotes", href: "/app/quotes", icon: "page", group: "go", needs: "quotes.edit" },
  { id: "go-projects", label: "Projects", href: "/app/projects", icon: "page", group: "go", feature: "projects", needs: "projects.view", keywords: "jobs" },
  { id: "go-payments", label: "Invoices & payments", href: "/app/payments", icon: "page", group: "go", feature: "invoicing", needs: "invoices.manage", keywords: "money owed" },
  { id: "go-purchases", label: "Purchases & receipts", href: "/app/purchases", icon: "page", group: "go", feature: "costs", needs: "costs.view", keywords: "expenses" },
  { id: "go-reports", label: "Job costing report", href: "/app/reports", icon: "page", group: "go", feature: "reports", needs: "costs.view", keywords: "margin profit" },
  { id: "go-team", label: "Team", href: "/app/team", icon: "page", group: "go", feature: "team", needs: "team.view", keywords: "people certificates timesheets" },
  { id: "go-settings", label: "Settings", href: "/app/settings", icon: "page", group: "go", needs: "settings.view", keywords: "company branding" },
];

export function quickActionsFor(role: Role): QuickAction[] {
  return ACTIONS.filter((a) => can(role, a.needs)).map(({ needs: _, ...a }) => a);
}
