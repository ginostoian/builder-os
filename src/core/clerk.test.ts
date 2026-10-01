import { describe, expect, it } from "vitest";
import { clerkOrgId, cleanText, emailOrNull, personName } from "./clerk";

describe("Clerk profile data", () => {
  it("cleans names", () => {
    expect(personName("Dan", "Hale")).toBe("Dan Hale");
    expect(personName(null, null, "dan@halesons.co.uk")).toBe("dan@halesons.co.uk");
    expect(personName("  ", null, "")).toBe("Team member");
    expect(cleanText("a\u0000b\nc", 200, "x")).toBe("a b c");
    expect(cleanText("x".repeat(300), 200, "")).toHaveLength(200);
  });

  it("keeps only real email addresses", () => {
    expect(emailOrNull("Dan@HaleSons.co.uk")).toBe("dan@halesons.co.uk");
    expect(emailOrNull("+447700900123")).toBeNull();
    expect(emailOrNull(undefined)).toBeNull();
  });

  it("validates Clerk IDs", () => {
    expect(clerkOrgId.safeParse("org_2abcDEF123").success).toBe(true);
    expect(clerkOrgId.safeParse("org_1' or 1=1").success).toBe(false);
  });
});
