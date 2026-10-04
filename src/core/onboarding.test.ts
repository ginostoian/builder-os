import { describe, expect, it } from "vitest";
import { SIGNALS, guideFor, type Signals } from "./onboarding";

const none = Object.fromEntries(SIGNALS.map((s) => [s, false])) as Signals;

describe("guideFor", () => {
  it("starts at level 1 with the tour up next", () => {
    const g = guideFor("admin", "pro", none, []);
    expect(g).toMatchObject({ level: 1, done: 0, percent: 0, complete: false });
    expect(g.next?.id).toBe("tour");
    expect(g.levels).toBe(g.chapters.length);
  });

  it("ticks steps off from data, counts skips as done and moves up a level", () => {
    const g = guideFor("admin", "pro", { ...none, tour: true, company_details: true, logo: true, bank_details: true }, ["team"]);
    expect(g.chapters[0].complete).toBe(true);
    expect(g.chapters[1]).toMatchObject({ id: "company", complete: true, done: 4 });
    expect(g.chapters[1].steps.find((s) => s.id === "team")?.state).toBe("skipped");
    expect(g.level).toBe(3);
    expect(g.next?.id).toBe("library");
  });

  it("locks what the plan doesn't include and leaves it out of the count", () => {
    const g = guideFor("admin", "free", none, []);
    expect(g.chapters.find((c) => c.id === "jobs")).toMatchObject({ locked: true, total: 0 });
    expect(g.chapters.find((c) => c.id === "company")?.steps.find((s) => s.id === "logo")?.state).toBe("locked");
    const all = guideFor("admin", "free", Object.fromEntries(SIGNALS.map((s) => [s, true])) as Signals, []);
    expect(all).toMatchObject({ complete: true, percent: 100, next: null });
  });

  it("only shows a role what it can do", () => {
    const lead = guideFor("site_lead", "pro", none, []);
    const ids = lead.chapters.flatMap((c) => c.steps.map((s) => s.id));
    expect(ids).toContain("project");
    expect(ids).not.toContain("quote_created");
    expect(ids).not.toContain("bank_details");
  });
});
