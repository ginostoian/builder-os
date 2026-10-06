"use client";

import * as React from "react";

/** Subcontractors who can be paid under CIS, and the rate their status gives. */
export type CisSubcontractor = { id: string; name: string; rateBps: number };

const Ctx = React.createContext<CisSubcontractor[] | null>(null);

/** Turns on the CIS part of the expense form (the company uses CIS). */
export function CisProvider({ subcontractors, children }: { subcontractors: CisSubcontractor[] | null; children: React.ReactNode }) {
  return <Ctx.Provider value={subcontractors}>{children}</Ctx.Provider>;
}

/** The subcontractors to pay under CIS, or null when the company doesn't use CIS. */
export const useCis = () => React.useContext(Ctx);
