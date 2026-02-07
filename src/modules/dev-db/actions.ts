"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createQuotePublicLink } from "@/server/public-links";
import { db } from "@/server/db";
import { getOrgIdOrThrow } from "@/server/tenancy";

type DevActionResult = {
  ok: boolean;
  message: string;
};

const emptyInputSchema = z.object({});

function result(ok: boolean, message: string): DevActionResult {
  return { ok, message };
}

function refreshDevRoute() {
  revalidatePath("/app/dev/db");
}

export async function ensureCompanySettingsAction(input: unknown): Promise<DevActionResult> {
  emptyInputSchema.parse(input ?? {});
  const orgId = await getOrgIdOrThrow();

  const existing = await db.companySettings.findUnique({
    where: { orgId },
    select: { id: true },
  });

  if (existing) {
    return result(true, `Company settings already exist (${existing.id}).`);
  }

  const created = await db.companySettings.create({
    data: {
      orgId,
      companyName: "BuilderOS Demo Company",
      defaultVatMode: "STANDARD",
      defaultVatRateBps: 2000,
    },
    select: { id: true },
  });

  refreshDevRoute();
  return result(true, `Created company settings (${created.id}).`);
}

export async function createClientAction(input: unknown): Promise<DevActionResult> {
  emptyInputSchema.parse(input ?? {});
  const orgId = await getOrgIdOrThrow();

  const clientCount = await db.client.count({ where: { orgId } });
  const nextNumber = clientCount + 1;

  const created = await db.client.create({
    data: {
      orgId,
      name: `Demo Client ${nextNumber}`,
      email: `demo-client-${nextNumber}@example.com`,
    },
    select: { id: true, name: true },
  });

  refreshDevRoute();
  return result(true, `Created client ${created.name} (${created.id}).`);
}

export async function createDraftQuoteAction(input: unknown): Promise<DevActionResult> {
  emptyInputSchema.parse(input ?? {});
  const orgId = await getOrgIdOrThrow();

  const client =
    (await db.client.findFirst({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    })) ??
    (await db.client.create({
      data: {
        orgId,
        name: "Demo Client 1",
        email: "demo-client-1@example.com",
      },
      select: { id: true, name: true },
    }));

  const quote = await db.quote.create({
    data: {
      orgId,
      clientId: client.id,
      title: `Demo Quote ${Date.now()}`,
      status: "DRAFT",
      currentVersion: 1,
      vatMode: "STANDARD",
      vatRateBps: 2000,
      depositType: "NONE",
      items: {
        create: [
          {
            rowType: "LINE_ITEM",
            title: "Demo Line Item",
            calcType: "SELL_ONLY",
            sellPricePence: 125000,
            isAllowance: false,
            sortOrder: 1,
          },
        ],
      },
    },
    select: { id: true, title: true },
  });

  refreshDevRoute();
  return result(true, `Created draft quote ${quote.title} (${quote.id}).`);
}

export async function sendLatestQuoteAction(input: unknown): Promise<DevActionResult> {
  emptyInputSchema.parse(input ?? {});
  const orgId = await getOrgIdOrThrow();

  const latestQuote = await db.quote.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      currentVersion: true,
    },
  });

  if (!latestQuote) {
    return result(false, "No quotes found. Create a draft quote first.");
  }

  if (latestQuote.status === "ACCEPTED") {
    return result(false, "Latest quote is already accepted and locked.");
  }

  const nextVersion =
    latestQuote.status === "SENT"
      ? latestQuote.currentVersion + 1
      : latestQuote.currentVersion;

  await db.quote.update({
    where: { id: latestQuote.id, orgId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      currentVersion: nextVersion,
    },
  });

  refreshDevRoute();
  return result(true, `Quote sent. Current version: v${nextVersion}.`);
}

export async function acceptLatestSentQuoteAction(input: unknown): Promise<DevActionResult> {
  emptyInputSchema.parse(input ?? {});
  const orgId = await getOrgIdOrThrow();

  const latestSentQuote = await db.quote.findFirst({
    where: { orgId, status: "SENT" },
    orderBy: { sentAt: "desc" },
    select: { id: true, title: true },
  });

  if (!latestSentQuote) {
    return result(false, "No sent quote found. Send a quote first.");
  }

  const alreadyAccepted = await db.quoteAcceptance.findFirst({
    where: { orgId, quoteId: latestSentQuote.id },
    select: { id: true },
  });

  if (alreadyAccepted) {
    return result(true, `Quote already accepted (${alreadyAccepted.id}).`);
  }

  const now = new Date();

  await db.$transaction([
    db.quoteAcceptance.create({
      data: {
        orgId,
        quoteId: latestSentQuote.id,
        acceptedName: "Demo Approver",
        acceptedEmail: "approver@example.com",
        acceptedAt: now,
      },
    }),
    db.quote.update({
      where: { id: latestSentQuote.id, orgId },
      data: {
        status: "ACCEPTED",
        acceptedAt: now,
      },
    }),
  ]);

  refreshDevRoute();
  return result(true, `Accepted quote ${latestSentQuote.title}.`);
}

export async function createVariationForLatestAcceptedQuoteAction(
  input: unknown,
): Promise<DevActionResult> {
  emptyInputSchema.parse(input ?? {});
  const orgId = await getOrgIdOrThrow();

  const latestAcceptedQuote = await db.quote.findFirst({
    where: { orgId, status: "ACCEPTED" },
    orderBy: { acceptedAt: "desc" },
    select: { id: true, title: true, vatMode: true, vatRateBps: true },
  });

  if (!latestAcceptedQuote) {
    return result(false, "No accepted quote found. Accept a quote first.");
  }

  const latestVariation = await db.variation.findFirst({
    where: { orgId, quoteId: latestAcceptedQuote.id },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const nextNumber = (latestVariation?.number ?? 0) + 1;

  const created = await db.variation.create({
    data: {
      orgId,
      quoteId: latestAcceptedQuote.id,
      number: nextNumber,
      title: `Variation #${nextNumber}`,
      description: "Demo post-acceptance scope change",
      status: "DRAFT",
      vatMode: latestAcceptedQuote.vatMode,
      vatRateBps: latestAcceptedQuote.vatRateBps,
      items: {
        create: [
          {
            rowType: "LINE_ITEM",
            title: "Extra works",
            calcType: "SELL_ONLY",
            sellPricePence: 35000,
            isAllowance: false,
            sortOrder: 1,
          },
        ],
      },
    },
    select: { id: true, number: true },
  });

  refreshDevRoute();
  return result(
    true,
    `Created variation #${created.number} (${created.id}) for quote ${latestAcceptedQuote.title}.`,
  );
}

export async function createPublicLinkForLatestQuoteAction(
  input: unknown,
): Promise<DevActionResult> {
  emptyInputSchema.parse(input ?? {});
  const orgId = await getOrgIdOrThrow();

  const latestQuote = await db.quote.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

  if (!latestQuote) {
    return result(false, "No quote found. Create a quote first.");
  }

  const link = await createQuotePublicLink({
    quoteId: latestQuote.id,
    expiresAt: null,
  });

  refreshDevRoute();
  return result(
    true,
    `Created quote public link ${link.id}. Raw token generated and returned once.`,
  );
}
