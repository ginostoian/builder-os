import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/db", () => ({ hitRateLimit: vi.fn() }));

const { checkFormToken, formToken, looksLikeSpam } = await import("./rate-limit");

describe("form tokens", () => {
  const t0 = 1_800_000_000_000;
  it("accepts a token from this form after a person's time, not before", () => {
    const token = formToken("enquiry:abc", t0);
    expect(checkFormToken("enquiry:abc", token, t0 + 1_000)).toBe("too_fast");
    expect(checkFormToken("enquiry:abc", token, t0 + 10_000)).toBe("ok");
    expect(checkFormToken("enquiry:abc", token, t0 + 25 * 3_600_000)).toBe("expired");
  });

  it("refuses forged, altered or other forms' tokens", () => {
    const token = formToken("enquiry:abc", t0);
    expect(checkFormToken("enquiry:other", token, t0 + 10_000)).toBe("invalid");
    expect(checkFormToken("enquiry:abc", `${t0 - 60_000}.${token.split(".")[1]}`, t0 + 10_000)).toBe("invalid");
    expect(checkFormToken("enquiry:abc", "123.abc", t0)).toBe("invalid");
    expect(checkFormToken("enquiry:abc", undefined, t0)).toBe("invalid");
    expect(checkFormToken("enquiry:abc", formToken("enquiry:abc", t0 + 60_000), t0)).toBe("invalid");
  });
});

describe("looksLikeSpam", () => {
  it("flags link lists and link markup, not ordinary enquiries", () => {
    expect(looksLikeSpam("Jo", "Kitchen extension, see www.example.com for the style")).toBe(false);
    expect(looksLikeSpam("Jo", "http://a.example http://b.example https://c.example")).toBe(true);
    expect(looksLikeSpam("[url=http://x.example]cheap[/url]")).toBe(true);
  });
});
