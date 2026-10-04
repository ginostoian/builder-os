import { describe, expect, it } from "vitest";
import { daysBetween, isLate, progress, startOfWeek, timelineBar, timelineRange } from "./projects";

describe("projects", () => {
  it("measures progress by tasks done", () => {
    expect(progress([])).toEqual({ done: 0, total: 0, percent: 0 });
    expect(progress([{ status: "done" }, { status: "todo" }, { status: "waiting" }])).toEqual({ done: 1, total: 3, percent: 33 });
  });

  it("flags late tasks only when they aren't done", () => {
    expect(isLate({ status: "todo", dueDate: "2026-10-01" }, "2026-10-04")).toBe(true);
    expect(isLate({ status: "done", dueDate: "2026-10-01" }, "2026-10-04")).toBe(false);
    expect(isLate({ status: "todo", dueDate: null }, "2026-10-04")).toBe(false);
  });

  it("works in whole weeks from Monday", () => {
    expect(startOfWeek("2026-10-04")).toBe("2026-09-28"); // Sunday → the Monday before
    expect(startOfWeek("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
  });

  it("sizes the timeline to the dates and today, and places bars", () => {
    const r = timelineRange(["2026-10-07", "2026-12-20", null], "2026-10-04");
    expect(r.start).toBe("2026-09-28");
    expect(r.days % 7).toBe(0);
    expect(r.days).toBe(7 * 12); // 28 Sep → week of 14 Dec, 12 weeks
    expect(timelineRange([], "2026-10-04")).toEqual({ start: "2026-09-28", days: 42 });
    expect(timelineBar({ startDate: "2026-09-30", dueDate: "2026-10-02" }, "2026-09-28")).toEqual({ offset: 2, length: 3 });
    expect(timelineBar({ startDate: null, dueDate: "2026-10-02" }, "2026-09-28")).toEqual({ offset: 4, length: 1 });
    expect(timelineBar({ startDate: null, dueDate: null }, "2026-09-28")).toBeNull();
  });
});
