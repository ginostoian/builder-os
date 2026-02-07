import "server-only";

import { db } from "@/server/db";
import { getOrgIdOrThrow } from "@/server/tenancy";

import {
  generatePublicLinkToken,
  hashPublicLinkToken,
  isPublicLinkTokenFormatValid,
} from "./token";

type CreateVariationPublicLinkInput = {
  variationId: string;
  expiresAt?: Date | null;
};

export async function createVariationPublicLink(
  input: CreateVariationPublicLinkInput,
) {
  const orgId = await getOrgIdOrThrow();
  const generated = generatePublicLinkToken();

  const link = await db.variationPublicLink.create({
    data: {
      orgId,
      variationId: input.variationId,
      tokenHash: generated.tokenHash,
      tokenPrefix: generated.tokenPrefix,
      expiresAt: input.expiresAt ?? null,
    },
    select: {
      id: true,
      expiresAt: true,
      isActive: true,
      tokenPrefix: true,
      variationId: true,
    },
  });

  return {
    ...link,
    token: generated.token,
  };
}

export async function getActiveVariationPublicLinkByToken(rawToken: string) {
  if (!isPublicLinkTokenFormatValid(rawToken)) {
    return null;
  }

  const now = new Date();

  return db.variationPublicLink.findFirst({
    where: {
      tokenHash: hashPublicLinkToken(rawToken),
      isActive: true,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      orgId: true,
      variationId: true,
      tokenPrefix: true,
      isActive: true,
      expiresAt: true,
      viewCount: true,
      firstViewedAt: true,
      lastViewedAt: true,
    },
  });
}

export async function trackVariationPublicLinkView(linkId: string) {
  const viewedAt = new Date();

  const [, updatedLink] = await db.$transaction([
    db.variationPublicLink.updateMany({
      where: { id: linkId, firstViewedAt: null },
      data: { firstViewedAt: viewedAt },
    }),
    db.variationPublicLink.update({
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

export async function revokeVariationPublicLink(linkId: string) {
  const orgId = await getOrgIdOrThrow();

  return db.variationPublicLink.updateMany({
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
