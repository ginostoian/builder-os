import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "@/env";

const TOKEN_VERSION = "v1";
const TOKEN_BYTES = 32;
const TOKEN_PREFIX_LENGTH = 12;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

function getTokenSecret(): string {
  return env.PUBLIC_LINK_TOKEN_SECRET ?? env.CLERK_SECRET_KEY;
}

export type GeneratedPublicLinkToken = {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
};

export function hashPublicLinkToken(rawToken: string): string {
  const digest = createHmac("sha256", getTokenSecret())
    .update(rawToken)
    .digest("hex");

  return `${TOKEN_VERSION}_${digest}`;
}

export function publicLinkTokenPrefix(rawToken: string): string {
  return rawToken.slice(0, TOKEN_PREFIX_LENGTH);
}

export function generatePublicLinkToken(): GeneratedPublicLinkToken {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");

  return {
    token,
    tokenHash: hashPublicLinkToken(token),
    tokenPrefix: publicLinkTokenPrefix(token),
  };
}

export function isPublicLinkTokenFormatValid(token: string): boolean {
  return token.length >= 32 && TOKEN_PATTERN.test(token);
}

export function verifyPublicLinkToken(rawToken: string, tokenHash: string): boolean {
  const expected = hashPublicLinkToken(rawToken);

  if (expected.length !== tokenHash.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(tokenHash));
}
