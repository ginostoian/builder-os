/** App URLs. One place so the sidebar, screenshots and marketing links agree. */
export const appRoutes = {
  dashboard: "/app",
  quote: "/app/quotes/Q-1042",
  library: "/app/library",
  project: "/app/projects/elm-road",
  payments: "/app/payments",
  clients: "/app/clients",
  settings: "/app/settings",
  team: "/app/settings/team",
  clientQuote: "/q/hale-sons/1042",
  employee: "/m",
} as const;

export type AdminScreen = "dashboard" | "quote" | "templates" | "board" | "invoices" | "crm" | "settings";
export type ScreenId = Exclude<AdminScreen, "settings"> | "client" | "mobile";
