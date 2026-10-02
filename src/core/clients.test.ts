import { describe, expect, it } from "vitest";
import { formatAddress, likePattern, parseClientForm } from "./clients";
import { can } from "./roles";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("parseClientForm", () => {
  it("accepts a name on its own", () => {
    expect(parseClientForm(form({ name: "  Sarah Hale " }))).toEqual({ ok: true, value: { name: "Sarah Hale" } });
  });

  it("tidies a full record", () => {
    const result = parseClientForm(
      form({
        name: "Sarah Hale",
        email: "Sarah@Example.COM",
        phone: "07700 900123",
        line1: "14 Elm Road",
        line2: "",
        town: "Bristol",
        postcode: "bs7 8aa",
        source: "Referral",
        notes: "Prefers calls after 5pm.\nDog on site.",
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Sarah Hale",
        email: "sarah@example.com",
        phone: "07700 900123",
        address: { line1: "14 Elm Road", town: "Bristol", postcode: "BS7 8AA" },
        source: "Referral",
        notes: "Prefers calls after 5pm.\nDog on site.",
      },
    });
  });

  it("asks for the rest of a half-filled address", () => {
    const result = parseClientForm(form({ name: "Sarah", town: "Bristol" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.line1).toBe("Enter the first line of the address");
      expect(result.errors.postcode).toMatch(/UK postcode/);
      expect(result.errors.town).toBeUndefined();
    }
  });

  it("reports bad fields in plain English", () => {
    const result = parseClientForm(form({ name: " ", email: "nope", phone: "call me" }));
    expect(result).toEqual({
      ok: false,
      errors: { name: "Enter the client's name", email: "Enter an email address like name@example.com", phone: "Digits, spaces, +, ( ) and - only" },
    });
  });

  it("ignores fields it doesn't know, like a smuggled tenant", () => {
    const result = parseClientForm(form({ name: "Sarah", orgId: "00000000-0000-0000-0000-000000000000", id: "x" }));
    expect(result).toEqual({ ok: true, value: { name: "Sarah" } });
  });

  it("rejects control characters", () => {
    expect(parseClientForm(form({ name: "Sarah\u0000" })).ok).toBe(false);
  });
});

describe("formatAddress", () => {
  it("joins the parts on one line", () => {
    expect(formatAddress({ line1: "Flat 2", line2: "14 Elm Road", town: "Bristol", postcode: "BS7 8AA" })).toBe("Flat 2, 14 Elm Road, Bristol BS7 8AA");
    expect(formatAddress(null)).toBe("");
  });
});

describe("likePattern", () => {
  it("matches wildcards literally", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});

describe("client permissions", () => {
  it("lets site leads look up clients but not change them", () => {
    expect(can("site_lead", "clients.view")).toBe(true);
    expect(can("site_lead", "clients.manage")).toBe(false);
    expect(can("employee", "clients.view")).toBe(false);
    for (const role of ["admin", "office", "estimator"] as const) expect(can(role, "clients.manage")).toBe(true);
  });
});
