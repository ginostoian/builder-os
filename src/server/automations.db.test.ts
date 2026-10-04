/** The automation runner end to end: claim, fill merge fields, send through Resend (stubbed), log. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { appUrl } from "@/test/db-urls";
import { closeDb, withTenant } from "@/db";
import { addAutomationTemplate, createLead, getLead, setAutomationEnabled } from "@/db/pipeline";
import { runCompanyAutomations } from "./automations";

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "Builder OS <hello@example.com>";
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  await closeDb();
});

describe("automation runner", () => {
  it("replies to a web enquiry at once, in the company's words, with an unsubscribe link", async () => {
    const orgId = randomUUID();
    const memberId = await withTenant(orgId, async (tx) => {
      await tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${"org_" + orgId.replaceAll("-", "")}, 'Hale & Sons')`);
      return (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name, email) values (${orgId}, 'user_r1', 'admin', 'Dave Hale', 'dave@hale.example') returning id`))[0].id;
    });
    await withTenant(orgId, async (tx) => setAutomationEnabled(tx, orgId, await addAutomationTemplate(tx, orgId, "enquiry_reply"), true));
    const leadId = await withTenant(orgId, (tx) => createLead(tx, orgId, { name: "Sarah Hale", email: "sarah@example.com", source: "website", projectType: "Loft conversion", ownerMemberId: memberId }, { memberId: null, viaWebForm: true, today: "2026-10-05" }));
    const sent: { to: string[]; subject: string; text: string; reply_to?: string[]; headers?: Record<string, string> }[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return new Response("{}", { status: 200 });
    });
    expect(await runCompanyAutomations(orgId, "https://app.example")).toEqual({ sent: 1, failed: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(["sarah@example.com"]);
    expect(sent[0].reply_to).toEqual(["dave@hale.example"]);
    expect(sent[0].subject).toBe("Thanks for your enquiry, Sarah");
    expect(sent[0].text).toContain("Thanks for getting in touch about your loft conversion.");
    expect(sent[0].text).toContain("Dave\nHale & Sons");
    expect(sent[0].headers?.["List-Unsubscribe"]).toMatch(/^<https:\/\/app\.example\/api\/unsubscribe\/[A-Za-z0-9_-]+>$/);
    expect(sent[0].text).toMatch(/Unsubscribe: https:\/\/app\.example\/unsubscribe\//);
    // Nothing more to send; the email is in the lead's history.
    expect(await runCompanyAutomations(orgId, "https://app.example")).toEqual({ sent: 0, failed: 0 });
    const lead = (await withTenant(orgId, (tx) => getLead(tx, orgId, leadId)))!;
    expect(lead.activity[0]).toMatchObject({ kind: "automation_email" });
    expect(lead.activity[0].body).toMatch(/^Sent: Reply to new enquiries \(email 1 of 1\): Thanks for your enquiry, Sarah/);
  });
});
