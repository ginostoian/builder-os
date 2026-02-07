import "server-only";

import { db } from "@/server/db";
import { getOrgIdOrThrow } from "@/server/tenancy";

import {
  generatePublicLinkToken,
  hashPublicLinkToken,
  isPublicLinkTokenFormatValid,
} from "./token";

type CreateQuotePublicLinkInput = {
  quoteId: string;
  expiresAt?: Date | null;
};

export async function createQuotePublicLink(input: CreateQuotePublicLinkInput) {
  const orgId = await getOrgIdOrThrow();
  const generated = generatePublicLinkToken();

  const link = await db.quotePublicLink.create({
    data: {
      orgId,
      quoteId: input.quoteId,
      tokenHash: generated.tokenHash,
      tokenPrefix: generated.tokenPrefix,
      expiresAt: input.expiresAt ?? null,
    },
    select: {
      id: true,
      expiresAt: true,
      isActive: true,
      quoteId: true,
      tokenPrefix: true,
    },
  });

  return {
    ...link,
    token: generated.token,
  };
}

export async function getActiveQuotePublicLinkByToken(rawToken: string) {
  if (!isPublicLinkTokenFormatValid(rawToken)) {
    return null;
  }

  const now = new Date();

  return db.quotePublicLink.findFirst({
    where: {
      tokenHash: hashPublicLinkToken(rawToken),
      isActive: true,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      orgId: true,
      quoteId: true,
      tokenPrefix: true,
      isActive: true,
      expiresAt: true,
      viewCount: true,
      firstViewedAt: true,
      lastViewedAt: true,
    },
  });
}

export async function trackQuotePublicLinkView(linkId: string) {
  const viewedAt = new Date();

  const [, updatedLink] = await db.$transaction([
    db.quotePublicLink.updateMany({
      where: { id: linkId, firstViewedAt: null },
      data: { firstViewedAt: viewedAt },
    }),
    db.quotePublicLink.update({
      where: { id: linkId },
      data: {
        lastViewedAt: viewedAt,
        viewCount: { increment: 1 },
      },
      select: {
        id: true,
        firstViewedAt: true,
        lastViewedAt: true,
        viewCount: true,
      },
    }),
  ]);

  return updatedLink;
}

export async function revokeQuotePublicLink(linkId: string) {
  const orgId = await getOrgIdOrThrow();

  return db.quotePublicLink.updateMany({
    where: {
      id: linkId,
      orgId,
      isActive: true,
    },
    data: {
      isActive: false,
      revokedAt: new Date(),
    },
  });
}
