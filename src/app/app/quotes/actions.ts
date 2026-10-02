"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/roles";
import { id, newQuoteInput, quoteSave } from "@/core/schemas";
import { QuoteError, createQuote, deleteDraft, saveQuote, type QuoteErrorReason } from "@/db/quotes";
import { getSession, withSession, type Session } from "@/auth/session";
import type { RecordActionResult } from "@/components/app/archive-panel";

export type NewQuoteState = { status: "idle" | "error"; errors?: { clientId?: string; title?: string }; message?: string };
export type SaveQuoteResult = { ok: true; version: number } | { ok: false; reason: QuoteErrorReason | "invalid" | "not_allowed"; message: string };

const NOT_ALLOWED = "Your role can't change quotes.";

const MESSAGES: Record<QuoteErrorReason, string> = {
  conflict: "This quote was changed somewhere else, maybe in another tab. Reload to see the latest version.",
  not_editable: "This quote has been sent, so it can't be changed.",
  not_found: "This quote no longer exists.",
  unknown_client: "That client no longer exists or has been archived.",
  unknown_section: "Part of this quote was removed somewhere else. Reload to see the latest version.",
  unknown_line: "Part of this quote was removed somewhere else. Reload to see the latest version.",
  unknown_service: "A service you added is no longer in the library.",
  too_many_lines: "A quote can have up to 2,000 lines.",
  empty: "Add at least one line before sending.",
  not_sent: "This quote hasn't been sent yet.",
};

async function editor(): Promise<Session | null> {
  const session = await getSession();
  return can(session.role, "quotes.edit") ? session : null;
}

/** Start a draft from the "New quote" form, then open it. */
export async function startQuote(form: FormData): Promise<NewQuoteState> {
  const session = await editor();
  if (!session) return { status: "error", message: NOT_ALLOWED };
  const title = form.get("title");
  const clientId = form.get("clientId");
  const parsed = newQuoteInput.safeParse({ clientId, title: typeof title === "string" ? title.trim() : title });
  if (!parsed.success) {
    const errors: NewQuoteState["errors"] = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "clientId") errors.clientId = "Choose a client";
      if (issue.path[0] === "title") errors.title = issue.code === "too_small" ? "Give the quote a title, e.g. Kitchen extension" : issue.message;
    }
    return { status: "error", errors, message: "Check the highlighted fields." };
  }
  let quoteId: string;
  try {
    quoteId = await withSession(session, (tx) => createQuote(tx, session.orgId, parsed.data));
  } catch (error) {
    if (error instanceof QuoteError) return { status: "error", errors: { clientId: MESSAGES[error.reason] }, message: "Check the highlighted fields." };
    throw error;
  }
  revalidatePath("/app/quotes");
  redirect(`/app/quotes/${quoteId}`);
}

/**
 * One autosave from the builder. The input is validated here (never trusted from the browser), and the whole
 * save is applied in one transaction or not at all.
 */
export async function saveQuoteChanges(input: unknown): Promise<SaveQuoteResult> {
  const session = await editor();
  if (!session) return { ok: false, reason: "not_allowed", message: NOT_ALLOWED };
  const parsed = quoteSave.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid", message: "Some of these changes weren't valid, so they weren't saved. Reload and try again." };
  try {
    const version = await withSession(session, (tx) => saveQuote(tx, session.orgId, parsed.data));
    return { ok: true, version };
  } catch (error) {
    if (error instanceof QuoteError) return { ok: false, reason: error.reason, message: MESSAGES[error.reason] };
    throw error;
  }
}

export async function removeDraft(quoteId: string): Promise<RecordActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  if (!id.safeParse(quoteId).success) return { ok: false, message: MESSAGES.not_found };
  const result = await withSession(session, (tx) => deleteDraft(tx, session.orgId, quoteId));
  if (result === "not_draft") return { ok: false, message: "Only drafts can be deleted." };
  if (result === "was_sent") return { ok: false, message: "This quote has been sent before, so it's kept as a record and can't be deleted." };
  if (result === "not_found") return { ok: false, message: MESSAGES.not_found };
  revalidatePath("/app/quotes");
  redirect("/app/quotes");
}
