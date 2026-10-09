import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, groupKey, newTotpSecret, otpauthUrl, totpCode, totpStep, verifyTotp } from "./totp";

// RFC 6238 appendix B: the SHA-1 key is the ASCII "12345678901234567890".
const RFC_KEY = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("matches the RFC 6238 test vectors (last 6 digits)", () => {
    expect(totpCode(RFC_KEY, totpStep(59_000))).toBe("287082");
    expect(totpCode(RFC_KEY, totpStep(1_111_111_109_000))).toBe("081804");
    expect(totpCode(RFC_KEY, totpStep(1_234_567_890_000))).toBe("005924");
    expect(totpCode(RFC_KEY, totpStep(2_000_000_000_000))).toBe("279037");
  });

  it("round-trips base32 and accepts typed keys", () => {
    const s = newTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(groupKey(s).toLowerCase())!)).toBe(s);
    expect(base32Decode("not base32!")).toBeNull();
  });

  it("accepts the current code and a neighbouring step, not older ones", () => {
    const s = newTotpSecret();
    const now = 1_800_000_000_000;
    const step = totpStep(now);
    expect(verifyTotp(s, totpCode(s, step), now)).toBe(step);
    expect(verifyTotp(s, totpCode(s, step - 1).replace(/^(\d{3})/, "$1 "), now)).toBe(step - 1);
    expect(verifyTotp(s, totpCode(s, step + 1), now)).toBe(step + 1);
    expect(verifyTotp(s, totpCode(s, step - 3), now)).toBeNull();
    expect(verifyTotp(s, "12345", now)).toBeNull();
    expect(verifyTotp(s, "abcdef", now)).toBeNull();
  });

  it("refuses a code from a step already used", () => {
    const s = newTotpSecret();
    const now = 1_800_000_000_000;
    const step = totpStep(now);
    expect(verifyTotp(s, totpCode(s, step), now, step)).toBeNull();
    expect(verifyTotp(s, totpCode(s, step + 1), now, step)).toBe(step + 1);
  });

  it("builds the authenticator link", () => {
    const url = new URL(otpauthUrl("Builder OS admin", "a@b.co", "ABCD"));
    expect(url.protocol).toBe("otpauth:");
    expect(url.host).toBe("totp");
    expect(decodeURIComponent(url.pathname)).toBe("/Builder OS admin:a@b.co");
    expect(Object.fromEntries(url.searchParams)).toEqual({ secret: "ABCD", issuer: "Builder OS admin", algorithm: "SHA1", digits: "6", period: "30" });
  });
});
