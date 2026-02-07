import { randomUUID } from "node:crypto";

import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

function logStep(message) {
  console.log(`\n[db-smoke] ${message}`);
}

async function expectFailure(label, fn) {
  try {
    await fn();
    throw new Error(`${label} unexpectedly succeeded`);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : "unknown";
    logStep(`${label} failed as expected (code: ${String(code)})`);
  }
}

async function run() {
  const keep = process.argv.includes("--keep");
  const orgA = `org_test_${randomUUID()}`;
  const orgB = `org_test_${randomUUID()}`;

  logStep(`Using orgA=${orgA}`);
  logStep(`Using orgB=${orgB}`);

  const clientA = await prisma.client.create({
    data: {
      orgId: orgA,
      name: "Smoke Client A",
      email: "client-a@example.com",
    },
  });
  logStep("Created client in orgA");

  const clientB = await prisma.client.create({
    data: {
      orgId: orgB,
      name: "Smoke Client B",
      email: "client-b@example.com",
    },
  });
  logStep("Created client in orgB");

  const quoteA = await prisma.quote.create({
    data: {
      orgId: orgA,
      clientId: clientA.id,
      title: "Smoke Quote A",
      status: "DRAFT",
      vatMode: "STANDARD",
      vatRateBps: 2000,
      depositType: "NONE",
      currentVersion: 1,
    },
  });
  logStep("Created valid quote in orgA");

  await expectFailure("Cross-tenant quote->client relation", async () => {
    await prisma.quote.create({
      data: {
        orgId: orgA,
        clientId: clientB.id,
        title: "Should Fail (Cross Tenant)",
        status: "DRAFT",
        vatMode: "STANDARD",
        vatRateBps: 2000,
        depositType: "NONE",
        currentVersion: 1,
      },
    });
  });

  await expectFailure("Invalid depositType NONE with amount", async () => {
    await prisma.quote.create({
      data: {
        orgId: orgA,
        title: "Should Fail (Deposit Check)",
        status: "DRAFT",
        vatMode: "STANDARD",
        vatRateBps: 2000,
        depositType: "NONE",
        depositAmountPence: 10000,
        currentVersion: 1,
      },
    });
  });

  await expectFailure("Negative sellPricePence on QuoteItem", async () => {
    await prisma.quoteItem.create({
      data: {
        orgId: orgA,
        quoteId: quoteA.id,
        rowType: "LINE_ITEM",
        title: "Should Fail (Negative Money)",
        calcType: "SELL_ONLY",
        sellPricePence: -100,
        isAllowance: false,
      },
    });
  });

  const publicLink = await prisma.quotePublicLink.create({
    data: {
      orgId: orgA,
      quoteId: quoteA.id,
      tokenHash: `v1_smoke_${randomUUID().replace(/-/g, "")}`,
      tokenPrefix: "smoke",
      isActive: true,
    },
  });
  logStep("Created quote public link row");

  await expectFailure("Negative viewCount on QuotePublicLink", async () => {
    await prisma.quotePublicLink.update({
      where: { id: publicLink.id },
      data: { viewCount: -1 },
    });
  });

  if (keep) {
    logStep("Keeping records in DB (--keep used).");
    return;
  }

  await prisma.quotePublicLink.deleteMany({ where: { orgId: { in: [orgA, orgB] } } });
  await prisma.quoteItem.deleteMany({ where: { orgId: { in: [orgA, orgB] } } });
  await prisma.quote.deleteMany({ where: { orgId: { in: [orgA, orgB] } } });
  await prisma.client.deleteMany({ where: { orgId: { in: [orgA, orgB] } } });
  logStep("Cleanup complete");
}

run()
  .then(() => {
    logStep("Smoke test passed");
  })
  .catch((error) => {
    console.error("\n[db-smoke] FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
