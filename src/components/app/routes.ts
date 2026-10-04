/** App URLs. One place so the sidebar, screenshots and marketing links agree. */
export const appRoutes = {
  dashboard: "/app",
  quote: "/app/quotes",
  library: "/app/library",
  /** The demo project in marketing screenshots. The app's own list is `projects`. */
  project: "/app/projects/elm-road",
  projects: "/app/projects",
  variations: "/app/variations",
  payments: "/app/payments",
  clients: "/app/clients",
  settings: "/app/settings",
  /** Logins and roles (Clerk). The people list is `people`. */
  team: "/app/settings/team",
  people: "/app/team",
  purchases: "/app/purchases",
  pipeline: "/app/pipeline",
  reports: "/app/reports",
  paymentSettings: "/app/settings/payments",
  clientQuote: "/q/hale-sons/1042",
  employee: "/m",
} as const;

export type AdminScreen = "dashboard" | "quote" | "templates" | "variations" | "board" | "invoices" | "crm" | "people" | "purchases" | "reports" | "pipeline" | "settings";
export type ScreenId = Exclude<AdminScreen, "settings" | "variations" | "people" | "purchases" | "reports" | "pipeline"> | "client" | "mobile";
