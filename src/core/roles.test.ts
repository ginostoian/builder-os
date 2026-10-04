import { describe, expect, it } from "vitest";
import { can, clerkRoleKey, homePath, roleFromClerk } from "./roles";

describe("roleFromClerk", () => {
  it("maps our Clerk role keys", () => {
    expect(roleFromClerk("org:admin")).toBe("admin");
    expect(roleFromClerk("org:site_lead")).toBe("site_lead");
    expect(roleFromClerk(clerkRoleKey("estimator"))).toBe("estimator");
  });

  it("gives anything unknown the least access", () => {
    for (const key of ["org:member", "admin", "org:owner", "org:", "", null, undefined]) expect(roleFromClerk(key)).toBe("employee");
  });
});

describe("permissions", () => {
  it("keeps margins and cost prices away from site staff", () => {
    expect(can("estimator", "costs.view")).toBe(true);
    expect(can("site_lead", "costs.view")).toBe(false);
    expect(can("employee", "costs.view")).toBe(false);
  });

  it("only lets Admins change company settings and the team", () => {
    for (const role of ["office", "estimator", "site_lead", "employee"] as const) {
      expect(can(role, "settings.manage")).toBe(false);
      expect(can(role, "team.manage")).toBe(false);
    }
    expect(can("admin", "settings.manage")).toBe(true);
  });

  it("gives everyone the site app, but only office roles the team and projects", () => {
    expect(can("employee", "site.app")).toBe(true);
    expect(can("employee", "projects.view")).toBe(false);
    expect(can("employee", "team.view")).toBe(false);
    expect(can("site_lead", "team.view")).toBe(true);
    expect(can("site_lead", "team.edit")).toBe(false);
  });

  it("sends employees to the employee app", () => {
    expect(homePath("employee")).toBe("/m");
    expect(homePath("site_lead")).toBe("/app");
  });
});
