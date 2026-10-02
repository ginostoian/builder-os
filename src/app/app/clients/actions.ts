"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseClientForm, type ClientErrors } from "@/core/clients";
import { can } from "@/core/roles";
import { id, type ClientInput } from "@/core/schemas";
import { createClient, deleteClient, setClientArchived, updateClient } from "@/db/clients";
import { getSession, withSession } from "@/auth/session";
import type { RecordActionResult } from "@/components/app/archive-panel";

export type ClientFormState = {
  status: "idle" | "saved" | "error";
  errors?: ClientErrors;
  message?: string;
  /** What was stored, after tidying (e.g. "bs7 8aa" → "BS7 8AA"). */
  saved?: ClientInput;
};
export type ClientActionResult = RecordActionResult;

const NOT_ALLOWED = "Your role can view clients but not change them.";
const NOT_FOUND = "This client no longer exists. Refresh the page.";

/**
 * Create a client (`clientId` null) or update one. The tenant comes from the session and the parser reads
 * only the client fields, so the form can't choose the company or the row's id.
 */
export async function saveClient(clientId: string | null, form: FormData): Promise<ClientFormState> {
  const session = await getSession();
  if (!can(session.role, "clients.manage")) return { status: "error", message: NOT_ALLOWED };
  if (clientId !== null && !id.safeParse(clientId).success) return { status: "error", message: NOT_FOUND };

  const parsed = parseClientForm(form);
  if (!parsed.ok) return { status: "error", errors: parsed.errors, message: "Check the highlighted fields." };

  if (clientId === null) {
    const created = await withSession(session, (tx) => createClient(tx, session.orgId, parsed.value));
    revalidatePath("/app/clients");
    redirect(`/app/clients/${created}`);
  }

  const found = await withSession(session, (tx) => updateClient(tx, session.orgId, clientId, parsed.value));
  if (!found) return { status: "error", message: NOT_FOUND };
  revalidatePath("/app/clients");
  revalidatePath(`/app/clients/${clientId}`);
  return { status: "saved", saved: parsed.value, message: "Client saved." };
}

export async function archiveClient(clientId: string, archived: boolean): Promise<ClientActionResult> {
  const session = await getSession();
  if (!can(session.role, "clients.manage")) return { ok: false, message: NOT_ALLOWED };
  if (!id.safeParse(clientId).success) return { ok: false, message: NOT_FOUND };

  const found = await withSession(session, (tx) => setClientArchived(tx, session.orgId, clientId, archived));
  if (!found) return { ok: false, message: NOT_FOUND };
  revalidatePath("/app/clients");
  revalidatePath(`/app/clients/${clientId}`);
  return { ok: true };
}

/** Permanently delete a client with no quotes. Anyone with quotes must be archived instead. */
export async function removeClient(clientId: string): Promise<ClientActionResult> {
  const session = await getSession();
  if (!can(session.role, "clients.manage")) return { ok: false, message: NOT_ALLOWED };
  if (!id.safeParse(clientId).success) return { ok: false, message: NOT_FOUND };

  const result = await withSession(session, (tx) => deleteClient(tx, session.orgId, clientId));
  if (result === "has_quotes") return { ok: false, message: "This client has quotes, so they can't be deleted. Archive them instead." };
  if (result === "not_found") return { ok: false, message: NOT_FOUND };
  revalidatePath("/app/clients");
  redirect("/app/clients");
}
