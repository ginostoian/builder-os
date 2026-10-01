/** The webhook route only lets correctly signed, fresh Clerk events through to the sync. */
import { createHmac, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const handleClerkEvent = vi.fn(async (_event: unknown) => "synced" as const);
vi.mock("@/auth/clerk-webhook", () => ({ handleClerkEvent: (event: unknown) => handleClerkEvent(event) }));

const { POST } = await import("./route");

const key = randomBytes(24);
process.env.CLERK_WEBHOOK_SIGNING_SECRET = `whsec_${key.toString("base64")}`;

/** Sign like Svix: base64 HMAC-SHA256 of "id.timestamp.body" with the decoded secret. */
function signedRequest(body: string, { secret = key, ageSeconds = 0 } = {}) {
  const id = `msg_${randomBytes(8).toString("hex")}`;
  const timestamp = String(Math.floor(Date.now() / 1000) - ageSeconds);
  const signature = createHmac("sha256", secret).update(`${id}.${timestamp}.${body}`).digest("base64");
  return new Request("http://localhost/api/webhooks/clerk", {
    method: "POST",
    headers: { "content-type": "application/json", "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` },
    body,
  }) as unknown as NextRequest;
}

const body = JSON.stringify({ type: "organization.created", object: "event", timestamp: Date.now(), data: { id: "org_abc", name: "Hale & Sons" } });

describe("POST /api/webhooks/clerk", () => {
  beforeEach(() => handleClerkEvent.mockClear());

  it("accepts a correctly signed event", async () => {
    const response = await POST(signedRequest(body));
    expect(response.status).toBe(200);
    expect(handleClerkEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "organization.created" }));
  });

  it("rejects a wrong signature, a tampered body, a stale delivery and missing headers", async () => {
    const tampered = signedRequest(body);
    const forged = new Request(tampered.url, { method: "POST", headers: tampered.headers, body: body.replace("Hale", "Evil") }) as unknown as NextRequest;
    const requests = [
      signedRequest(body, { secret: randomBytes(24) }),
      forged,
      signedRequest(body, { ageSeconds: 60 * 60 }),
      new Request("http://localhost/api/webhooks/clerk", { method: "POST", body }) as unknown as NextRequest,
    ];
    for (const request of requests) expect((await POST(request)).status).toBe(400);
    expect(handleClerkEvent).not.toHaveBeenCalled();
  });

  it("asks Svix to retry when the sync fails", async () => {
    handleClerkEvent.mockRejectedValueOnce(new Error("database down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect((await POST(signedRequest(body))).status).toBe(500);
  });
});
