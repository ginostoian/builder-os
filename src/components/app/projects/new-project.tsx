"use client";

import type { Address } from "@/core/schemas";
import { ProjectForm } from "./project-form";
import type { Member } from "./types";

export function NewProject({ clients, members, clientId }: { clients: { id: string; name: string; address: Address | null }[]; members: Member[]; clientId: string }) {
  return <ProjectForm initial={{ name: "", clientId, status: "booked", startDate: null, endDate: null, managerMemberId: null, siteAddress: null, shareProgress: true }} clients={clients} members={members} />;
}
