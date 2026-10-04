import { describe, expect, it } from "vitest";
import { certState, formatMinutes, londonDay, taskOnDay, timesheet, visitMinutes } from "./team";

describe("team", () => {
  it("flags certificates expiring within 30 days, and expired ones", () => {
    expect(certState(null, "2026-10-04")).toBe("no_expiry");
    expect(certState("2026-10-03", "2026-10-04")).toBe("expired");
    expect(certState("2026-11-03", "2026-10-04")).toBe("expiring");
    expect(certState("2026-11-04", "2026-10-04")).toBe("ok");
  });

  it("measures site visits and formats hours", () => {
    expect(visitMinutes(new Date("2026-10-04T07:30:00Z"), new Date("2026-10-04T16:05:30Z"))).toBe(515);
    expect(formatMinutes(515)).toBe("8h 35m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
    expect(visitMinutes(new Date("2026-10-04T08:00:00Z"), null, new Date("2026-10-04T09:00:00Z"))).toBe(60);
  });

  it("knows which days a task covers", () => {
    expect(taskOnDay({ startDate: "2026-10-05", dueDate: "2026-10-07" }, "2026-10-06")).toBe(true);
    expect(taskOnDay({ startDate: null, dueDate: "2026-10-07" }, "2026-10-07")).toBe(true);
    expect(taskOnDay({ startDate: "2026-10-05", dueDate: null }, "2026-10-06")).toBe(false);
    expect(taskOnDay({ startDate: null, dueDate: null }, "2026-10-06")).toBe(false);
  });

  it("adds up a week's timesheet by UK day", () => {
    // 23:30 UTC on 4 Oct is 00:30 on 5 Oct in London (BST).
    expect(londonDay(new Date("2026-10-04T23:30:00Z"))).toBe("2026-10-05");
    const days = ["2026-10-05", "2026-10-06"];
    const now = new Date("2026-10-06T10:00:00Z");
    const sheet = timesheet(
      [
        { workerId: "a", checkedInAt: new Date("2026-10-05T07:00:00Z"), checkedOutAt: new Date("2026-10-05T15:00:00Z") },
        { workerId: "a", checkedInAt: new Date("2026-10-06T08:00:00Z"), checkedOutAt: null },
        { workerId: "a", checkedInAt: new Date("2026-09-30T08:00:00Z"), checkedOutAt: new Date("2026-09-30T09:00:00Z") },
      ],
      days,
      now,
    );
    expect(sheet.get("a")).toEqual({ byDay: [480, 120], total: 600, open: true });
  });
});
