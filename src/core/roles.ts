/**
 * Roles and what each may do (plan §7.3). Identity and membership live in Clerk, which only says who is an
 * Admin (`org:admin`): custom roles are a paid Clerk feature, so every other role is kept in our own
 * `members.role` and set in Settings → Team. This file decides what each role allows.
 *
 * Site staff (site lead, employee) never see margins or cost prices.
 */
import { ROLES } from "./schemas";

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  office: "Office",
  estimator: "Estimator",
  site_lead: "Site lead",
  employee: "Employee",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Everything, including company settings, team and billing.",
  office: "Clients, quotes, invoices and payments. No company settings.",
  estimator: "Builds and sends quotes, manages the service library.",
  site_lead: "Runs jobs on site: projects, tasks, photos, variations. No prices or margins.",
  employee: "The employee app only: today's site, tasks, check-in and photos.",
};

/** Clerk role key for one of our roles, e.g. `org:site_lead` (only used by the development roles script). */
export const clerkRoleKey = (role: Role) => `org:${role}` as const;

/**
 * What a Clerk membership role says about us: Admin, or not. Everything else (Clerk's Member, or custom
 * roles left in an older instance) is "not Admin", stored as Employee until an Admin picks a role here.
 */
export function roleFromClerk(key: string | null | undefined): Role {
  return key === "org:admin" ? "admin" : "employee";
}

/**
 * The role a signed-in person has: Admin exactly when Clerk says so (Clerk's live session is the final word
 * on who can manage the company), otherwise the role chosen for them in Builder OS, never Admin.
 */
export function effectiveRole(clerkKey: string | null | undefined, stored: Role | null | undefined): Role {
  if (clerkKey === "org:admin") return "admin";
  return stored && stored !== "admin" && (ROLES as readonly string[]).includes(stored) ? stored : "employee";
}

/** The roles an Admin can give someone in Settings → Team (Admin itself is given in Clerk). */
export const ASSIGNABLE_ROLES = ["office", "estimator", "site_lead", "employee"] as const satisfies readonly Role[];

const OFFICE: readonly Role[] = ["admin", "office", "estimator", "site_lead"];

/** Permission → roles that hold it. Check with `can(role, permission)`, never by comparing role names. */
const PERMISSIONS = {
  /** The office app at /app. Employees use /m only. */
  "app.office": OFFICE,
  "settings.view": OFFICE,
  "settings.manage": ["admin"],
  "team.manage": ["admin"],
  /** Client names, contact details and addresses. Site leads need them to run jobs. */
  "clients.view": OFFICE,
  "clients.manage": ["admin", "office", "estimator"],
  /** The service library holds rates, so it follows costs.view. Estimators look after it. */
  "library.view": ["admin", "office", "estimator"],
  "library.manage": ["admin", "estimator"],
  /** Margins, markups and cost prices. */
  "costs.view": ["admin", "office", "estimator"],
  "quotes.edit": ["admin", "office", "estimator"],
  "invoices.manage": ["admin", "office"],
  /** Job costs: expenses and receipts, purchase orders, recharges. Seeing them follows costs.view. */
  "costs.edit": ["admin", "office"],
  /** Projects: tasks, diary and files. Site leads run jobs, so they can do all of it (without prices). */
  "projects.view": OFFICE,
  "projects.edit": OFFICE,
  /** The Team page: everyone who works for the company, their certificates, the week's plan, timesheets. */
  "team.view": OFFICE,
  "team.edit": ["admin", "office"],
  /** The sales pipeline: leads, follow-ups, emails to leads. Estimators win work too. */
  "leads.view": ["admin", "office", "estimator"],
  "leads.edit": ["admin", "office", "estimator"],
  /** The company's email automations and its web enquiry form. */
  "automations.manage": ["admin", "office"],
  /** The site app at /m: today's jobs and tasks, site updates, check in and out. Everyone. */
  "site.app": ["admin", "office", "estimator", "site_lead", "employee"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Where a role lands after sign-in. */
export const homePath = (role: Role) => (can(role, "app.office") ? "/app" : "/m");
