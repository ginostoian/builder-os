import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: vi.fn() }));
vi.mock("@/db", () => ({ hitRateLimit: vi.fn() }));

const { adminPass, checkAdminPass, checkSetupToken, setupToken, storedTotp } = await import("./admin-two-step");
const { newTotpSecret } = await import("@/core/totp");

const t0 = 1_800_000_000_000;

describe("admin pass cookie", () => {
  const secret = newTotpSecret();
  it("works for 12 hours, for this person and key only", () => {
    const pass = adminPass("user_a", secret, t0);
    expect(checkAdminPass(pass, "user_a", secret, t0 + 60_000)).toBe(true);
    expect(checkAdminPass(pass, "user_a", secret, t0 + 12 * 3_600_000 + 1)).toBe(false);
    expect(checkAdminPass(pass, "user_b", secret, t0 + 60_000)).toBe(false);
    expect(checkAdminPass(pass, "user_a", newTotpSecret(), t0 + 60_000)).toBe(false);
  });

  it("refuses altered or missing cookies", () => {
    const [, sig] = adminPass("user_a", secret, t0).split(".");
    expect(checkAdminPass(`${t0 + 48 * 3_600_000}.${sig}`, "user_a", secret, t0)).toBe(false);
    expect(checkAdminPass(undefined, "user_a", secret, t0)).toBe(false);
    expect(checkAdminPass("garbage", "user_a", secret, t0)).toBe(false);
  });
});

describe("setup token", () => {
  it("vouches for the key we made, for this person, for 30 minutes", () => {
    const secret = newTotpSecret();
    const token = setupToken("user_a", secret, t0);
    expect(checkSetupToken(token, "user_a", secret, t0 + 60_000)).toBe(true);
    expect(checkSetupToken(token, "user_a", secret, t0 + 31 * 60_000)).toBe(false);
    expect(checkSetupToken(token, "user_b", secret, t0 + 60_000)).toBe(false);
    expect(checkSetupToken(token, "user_a", newTotpSecret(), t0 + 60_000)).toBe(false);
    expect(checkSetupToken(token, "user_a", "short", t0 + 60_000)).toBe(false);
  });
});

describe("storedTotp", () => {
  it("reads the key from private metadata and ignores anything else", () => {
    const secret = newTotpSecret();
    expect(storedTotp({ adminTotp: { secret, lastStep: 5, addedAt: "x" } })).toEqual({ secret, lastStep: 5, addedAt: "x" });
    expect(storedTotp({ adminTotp: { secret } })?.lastStep).toBe(-1);
    expect(storedTotp({ adminTotp: { secret: "not a key" } })).toBeNull();
    expect(storedTotp({})).toBeNull();
    expect(storedTotp(null)).toBeNull();
  });
});
