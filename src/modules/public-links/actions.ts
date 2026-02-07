"use server";

import { z } from "zod";

import {
  createQuotePublicLink,
  createVariationPublicLink,
  revokeQuotePublicLink,
  revokeVariationPublicLink,
} from "@/server/public-links";

const createQuotePublicLinkSchema = z.object({
  quoteId: z.string().min(1),
  expiresAtIso: z.string().datetime().optional(),
});

const createVariationPublicLinkSchema = z.object({
  variationId: z.string().min(1),
  expiresAtIso: z.string().datetime().optional(),
});

const revokePublicLinkSchema = z.object({
  linkId: z.string().min(1),
});

export async function createQuotePublicLinkAction(input: unknown) {
  const parsed = createQuotePublicLinkSchema.parse(input);

  const link = await createQuotePublicLink({
    quoteId: parsed.quoteId,
    expiresAt: parsed.expiresAtIso ? new Date(parsed.expiresAtIso) : null,
  });

  return link;
}

export async function revokeQuotePublicLinkAction(input: unknown) {
  const parsed = revokePublicLinkSchema.parse(input);

  const result = await revokeQuotePublicLink(parsed.linkId);

  return {
    updatedCount: result.count,
  };
}

export async function createVariationPublicLinkAction(input: unknown) {
  const parsed = createVariationPublicLinkSchema.parse(input);

  const link = await createVariationPublicLink({
    variationId: parsed.variationId,
    expiresAt: parsed.expiresAtIso ? new Date(parsed.expiresAtIso) : null,
  });

  return link;
}

export async function revokeVariationPublicLinkAction(input: unknown) {
  const parsed = revokePublicLinkSchema.parse(input);

  const result = await revokeVariationPublicLink(parsed.linkId);

  return {
    updatedCount: result.count,
  };
}
