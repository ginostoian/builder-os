"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/roles";
import { id } from "@/core/schemas";
import { parseBundleForm, parseServiceForm, type ServiceErrors } from "@/core/services";
import { planImport, type ImportPlan } from "@/core/library-import";
import { BundleError, createBundle, createService, deleteService, importServices, libraryKeys, setServiceArchived, updateBundle, updateService } from "@/db/services";
import { getSession, withSession, type Session } from "@/auth/session";
import type { RecordActionResult } from "@/components/app/archive-panel";

export type ServiceFormState = { status: "idle" | "saved" | "error"; errors?: ServiceErrors; message?: string };

const NOT_ALLOWED = "Only Admins and Estimators can change the service library.";
const NOT_FOUND = "This item no longer exists. Refresh the page.";

const BUNDLE_ERRORS: Record<BundleError["reason"], ServiceFormState> = {
  unknown_service: { status: "error", errors: { items: "One of these services no longer exists. Refresh the page." }, message: "Check the services." },
  nested_bundle: { status: "error", errors: { items: "A bundle can't contain another bundle." }, message: "Check the services." },
  too_expensive: { status: "error", message: "That would make a bundle cost more than £10m. Check the rates and quantities." },
};

async function manager(): Promise<Session | null> {
  const session = await getSession();
  return can(session.role, "library.manage") ? session : null;
}

function revalidate(serviceId?: string) {
  revalidatePath("/app/library");
  if (serviceId) revalidatePath(`/app/library/${serviceId}`);
}

/** Bundle rules are enforced in the query layer; turn its errors into form messages. */
async function bundleSafe(run: () => Promise<ServiceFormState>): Promise<ServiceFormState> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof BundleError) return BUNDLE_ERRORS[error.reason];
    throw error;
  }
}

/** Create (`serviceId` null) or update a service. Changing a rate reprices the bundles that contain it. */
export async function saveService(serviceId: string | null, form: FormData): Promise<ServiceFormState> {
  const session = await manager();
  if (!session) return { status: "error", message: NOT_ALLOWED };
  if (serviceId !== null && !id.safeParse(serviceId).success) return { status: "error", message: NOT_FOUND };
  const parsed = parseServiceForm(form);
  if (!parsed.ok) return { status: "error", errors: parsed.errors, message: "Check the highlighted fields." };

  if (serviceId === null) {
    const created = await withSession(session, (tx) => createService(tx, session.orgId, parsed.value));
    revalidate();
    redirect(`/app/library/${created}`);
  }
  return bundleSafe(async () => {
    const found = await withSession(session, (tx) => updateService(tx, session.orgId, serviceId, parsed.value));
    if (!found) return { status: "error", message: NOT_FOUND };
    revalidatePath("/app/library", "layout");
    return { status: "saved", message: "Service saved." };
  });
}

/** Create (`bundleId` null) or update a bundle. Its price is worked out from its items on the server. */
export async function saveBundle(bundleId: string | null, form: FormData): Promise<ServiceFormState> {
  const session = await manager();
  if (!session) return { status: "error", message: NOT_ALLOWED };
  if (bundleId !== null && !id.safeParse(bundleId).success) return { status: "error", message: NOT_FOUND };
  const parsed = parseBundleForm(form);
  if (!parsed.ok) return { status: "error", errors: parsed.errors, message: "Check the highlighted fields." };

  let created: string | undefined;
  const result = await bundleSafe(async () => {
    if (bundleId === null) {
      created = await withSession(session, (tx) => createBundle(tx, session.orgId, parsed.value));
      return { status: "saved" };
    }
    const found = await withSession(session, (tx) => updateBundle(tx, session.orgId, bundleId, parsed.value));
    if (!found) return { status: "error", message: NOT_FOUND };
    revalidate(bundleId);
    return { status: "saved", message: "Bundle saved." };
  });
  if (created) {
    revalidate();
    redirect(`/app/library/${created}`);
  }
  return result;
}

export async function archiveService(serviceId: string, archived: boolean): Promise<RecordActionResult> {
  const session = await manager();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  if (!id.safeParse(serviceId).success) return { ok: false, message: NOT_FOUND };
  const found = await withSession(session, (tx) => setServiceArchived(tx, session.orgId, serviceId, archived));
  if (!found) return { ok: false, message: NOT_FOUND };
  revalidate(serviceId);
  return { ok: true };
}

export async function removeService(serviceId: string): Promise<RecordActionResult> {
  const session = await manager();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  if (!id.safeParse(serviceId).success) return { ok: false, message: NOT_FOUND };
  const result = await withSession(session, (tx) => deleteService(tx, session.orgId, serviceId));
  if (result === "on_quotes") return { ok: false, message: "This is used on quotes, so it can't be deleted. Archive it instead." };
  if (result === "in_bundles") return { ok: false, message: "This is part of a bundle. Remove it from the bundle first, or archive it." };
  if (result === "not_found") return { ok: false, message: NOT_FOUND };
  revalidate();
  redirect("/app/library");
}

export type ImportResult = { ok: true; added: number; skipped: number; failed: number } | { ok: false; message: string };

/** Check a CSV against the library without writing anything. */
export async function previewImport(text: string): Promise<ImportPlan> {
  const session = await manager();
  if (!session) return { ok: false, error: NOT_ALLOWED };
  if (typeof text !== "string") return { ok: false, error: "That file couldn't be read." };
  const existing = await withSession(session, (tx) => libraryKeys(tx, session.orgId));
  return planImport(text, existing);
}

/**
 * Import a CSV: re-validated here (never trust the preview the browser saw), then every new row is added in
 * one transaction. Duplicates and rows with errors are skipped.
 */
export async function importLibrary(text: string): Promise<ImportResult> {
  const session = await manager();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  if (typeof text !== "string") return { ok: false, message: "That file couldn't be read." };
  const result = await withSession(session, async (tx) => {
    const plan = planImport(text, await libraryKeys(tx, session.orgId));
    if (!plan.ok) return { ok: false as const, message: plan.error };
    const added = await importServices(tx, session.orgId, plan.rows.flatMap((r) => (r.status === "new" ? [r.value] : [])));
    return { ok: true as const, added, skipped: plan.counts.duplicate, failed: plan.counts.error };
  });
  if (result.ok) revalidatePath("/app/library", "layout");
  return result;
}
