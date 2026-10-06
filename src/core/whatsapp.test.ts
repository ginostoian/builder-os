import { describe, expect, it } from "vitest";
import { waNumber, whatsappUrl } from "./whatsapp";

describe("WhatsApp links", () => {
  it("turns UK numbers into international form", () => {
    expect(waNumber("07700 900123")).toBe("447700900123");
    expect(waNumber("+44 7700 900123")).toBe("447700900123");
    expect(waNumber("0044 7700 900123")).toBe("447700900123");
    expect(waNumber("+353 87 123 4567")).toBe("353871234567");
    expect(waNumber("123")).toBeNull();
    expect(waNumber(null)).toBeNull();
  });

  it("fills in the message, with or without a number", () => {
    expect(whatsappUrl("07700 900123", "Hi Sarah & co")).toBe("https://wa.me/447700900123?text=Hi%20Sarah%20%26%20co");
    expect(whatsappUrl(null, "Hi")).toBe("https://wa.me/?text=Hi");
  });
});
