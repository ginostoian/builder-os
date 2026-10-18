import { describe, expect, it } from "vitest";
import { can, clerkRoleKey, effectiveRole, homePath, roleFromClerk } from "./roles";

describe("roleFromClerk", () => {
  it("only reads Admin or not from Clerk (custom roles are a paid Clerk feature)", () => {
    expect(roleFromClerk("org:admin")).toBe("admin");
    for (const key of ["org:member", "org:site_lead", clerkRoleKey("estimator"), "admin", "org:owner", "org:", "", null, undefined]) expect(roleFromClerk(key)).toBe("employee");
  });
});

describe("effectiveRole", () => {
  it("is Admin exactly when Clerk says so, otherwise the role chosen in Builder OS", () => {
    expect(effectiveRole("org:admin", "employee")).toBe("admin");
    expect(effectiveRole("org:member", "estimator")).toBe("estimator");
    expect(effectiveRole("org:member", "site_lead")).toBe("site_lead");
    // Our table can never make someone an Admin, and anything odd gets the least access.
    expect(effectiveRole("org:member", "admin")).toBe("employee");
    expect(effectiveRole(null, "office")).toBe("office");
    expect(effectiveRole("org:member", undefined)).toBe("employee");
    expect(effectiveRole("org:member", "owner" as never)).toBe("employee");
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
    expect(can("office", "costs.edit")).toBe(true);
    expect(can("estimator", "costs.edit")).toBe(false);
    expect(can("site_lead", "costs.view")).toBe(false);
  });

  it("sends employees to the employee app", () => {
    expect(homePath("employee")).toBe("/m");
    expect(homePath("site_lead")).toBe("/app");
  });
});
