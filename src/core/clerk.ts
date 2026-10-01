/**
 * Clerk identifiers and the profile data we copy from Clerk. Clerk payloads are signed, but names and
 * emails are still user-entered text, so they are cleaned and length-capped before they reach the database.
 */
import { z } from "zod";
import { TEXT } from "./limits";
import { email } from "./schemas";

export const clerkOrgId = z.string().regex(/^org_[A-Za-z0-9]{1,64}$/, "Not a Clerk organization ID");
export const clerkUserId = z.string().regex(/^user_[A-Za-z0-9]{1,64}$/, "Not a Clerk user ID");

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/** Single-line text: control characters removed, whitespace collapsed, capped at `max`, or `fallback` if empty. */
export function cleanText(input: string | null | undefined, max: number, fallback: string): string {
  const cleaned = (input ?? "").replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
  return cleaned || fallback;
}

export const companyName = (name: string | null | undefined) => cleanText(name, TEXT.name, "My company");

/** "Dan Hale", else the sign-in identifier, else "Team member". */
export function personName(first: string | null | undefined, last: string | null | undefined, identifier?: string | null): string {
  const full = cleanText(`${first ?? ""} ${last ?? ""}`, TEXT.name, "");
  return full || cleanText(identifier, TEXT.name, "Team member");
}

/** A valid, lower-cased email, or null (Clerk identifiers can also be phone numbers or usernames). */
export function emailOrNull(input: string | null | undefined): string | null {
  const parsed = email.safeParse(input ?? "");
  return parsed.success ? parsed.data : null;
}
