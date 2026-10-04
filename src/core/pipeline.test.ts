import { describe, expect, it } from "vitest";
import { londonDay } from "./team";
import { AUTOMATION_TEMPLATES, fillMergeFields, followUpState, stepDueAt, unknownMergeFields, visitWhen } from "./pipeline";

describe("pipeline", () => {
  it("fills merge fields and tidies blanks", () => {
    expect(fillMergeFields("Hi {{first_name}}, about your {{ project }}.", { first_name: "Sarah", project: "loft" })).toBe("Hi Sarah, about your loft.");
    expect(fillMergeFields("Hi {{first_name}} , thanks {{nope}}!", { first_name: "Sam" })).toBe("Hi Sam, thanks!");
    expect(unknownMergeFields("{{first_name}} {{frist_name}} {{frist_name}}")).toEqual(["frist_name"]);
  });

  it("only uses known fields in the ready-made automations", () => {
    for (const t of AUTOMATION_TEMPLATES) for (const s of t.steps) expect(unknownMergeFields(s.subject + s.body)).toEqual([]);
  });

  it("sends same-day steps now and later ones at the start of that UK day", () => {
    const now = new Date("2026-10-04T15:30:00Z");
    expect(stepDueAt(now, 0, londonDay)).toEqual(now);
    // 7 October 00:00 in London (BST) is 6 October 23:00 UTC.
    expect(stepDueAt(now, 3, londonDay).toISOString()).toBe("2026-10-06T23:00:00.000Z");
    // In winter (GMT) it's midnight UTC.
    expect(stepDueAt(new Date("2026-12-01T10:00:00Z"), 2, londonDay).toISOString()).toBe("2026-12-03T00:00:00.000Z");
  });

  it("tracks follow-ups and formats visits", () => {
    expect(followUpState(null, "2026-10-04")).toBe("none");
    expect(followUpState("2026-10-03", "2026-10-04")).toBe("overdue");
    expect(followUpState("2026-10-04", "2026-10-04")).toBe("today");
    expect(followUpState("2026-10-05", "2026-10-04")).toBe("upcoming");
    expect(visitWhen(new Date("2026-10-08T09:00:00Z"))).toBe("Thursday 8 October at 10:00");
  });
});
