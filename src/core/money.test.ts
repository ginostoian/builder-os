import { describe, expect, it } from "vitest";
import { applyBps, formatBps, formatGBP, parsePence } from "./money";

describe("money", () => {
  it("parses typed money", () => {
    expect(parsePence("1,850.00")).toBe(185_000);
    expect(parsePence("£14")).toBe(1_400);
    expect(parsePence(" 0.5 ")).toBe(50);
    expect(parsePence("-12.30")).toBe(-1_230);
    expect(parsePence(".5")).toBe(50);
    expect(parsePence("1850.")).toBe(185_000);
  });

  it("rejects anything that isn't a plain amount", () => {
    for (const bad of ["abc", "", "£", "1e9", "0x10", "Infinity", "NaN", "1.005", "12.3.4", "10000000.01", ".", "-", "1..2"]) {
      expect(parsePence(bad), bad).toBeNull();
    }
    expect(parsePence("10,000,000")).toBe(1_000_000_000);
  });

  it("formats GBP and basis points", () => {
    expect(formatGBP(3_485_136)).toBe("£34,851.36");
    expect(formatGBP(3_485_136, 0)).toBe("£34,851");
    expect(formatBps(2000)).toBe("20%");
    expect(formatBps(1250)).toBe("12.5%");
  });

  it("rounds percentages to the penny", () => {
    expect(applyBps(10_001, 2000)).toBe(2_000);
    expect(applyBps(10_003, 2000)).toBe(2_001);
  });
});
