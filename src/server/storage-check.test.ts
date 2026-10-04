import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkStorage } from "./storage-check";

const ORG = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  vi.stubEnv("BUNNY_STORAGE_ZONE", "builderos");
  vi.stubEnv("BUNNY_STORAGE_KEY", "secret-key");
  vi.stubEnv("BUNNY_STORAGE_HOST", "uk.storage.bunnycdn.com");
  vi.stubEnv("BUNNY_CDN_URL", "https://builderos.b-cdn.net");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Storage calls succeed; CDN calls answer with the given statuses in turn. */
function bunny(cdn: { status: number; type?: string }[]) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: { method?: string }) => {
    calls.push(`${init?.method ?? "GET"} ${url.split("?")[0]}`);
    if (url.includes("storage.bunnycdn.com")) return new Response(null, { status: 201 });
    const next = cdn.shift() ?? { status: 200, type: "image/jpeg" };
    return new Response("x", { status: next.status, headers: next.type ? { "content-type": next.type } : {} });
  });
  return calls;
}

async function run() {
  const p = checkStorage(ORG);
  await vi.runAllTimersAsync();
  return p;
}

describe("storage check", () => {
  it("passes when the CDN serves the test photo, and cleans it up", async () => {
    const calls = bunny([{ status: 200, type: "image/jpeg" }]);
    const r = await run();
    expect(r).toMatchObject({ ok: true, summary: "Storage works: photos upload and show." });
    expect(calls[0]).toMatch(/^PUT https:\/\/uk\.storage\.bunnycdn\.com\/builderos\/orgs\/.+\/photos\/check.+\.jpg$/);
    expect(calls.at(-1)).toMatch(/^DELETE /);
  });

  it("spots token authentication or hotlink protection", async () => {
    bunny([{ status: 403 }, { status: 403 }, { status: 403 }]);
    const r = await run();
    expect(r.ok).toBe(false);
    expect(r.summary).toBe("The CDN refuses to show files (error 403).");
    expect(r.fix).toMatch(/Token Authentication/);
  });

  it("spots a pull zone that isn't connected to the storage zone", async () => {
    bunny([{ status: 404 }, { status: 404 }, { status: 404 }]);
    expect((await run()).fix).toMatch(/origin type must be "Storage zone" and the zone must be "builderos"/);
  });

  it("notices a slow CDN that gets there in the end", async () => {
    bunny([{ status: 404 }, { status: 200, type: "image/jpeg" }]);
    expect(await run()).toMatchObject({ ok: true, summary: "Storage works, but new photos take a few seconds to reach the CDN." });
  });

  it("catches a CDN URL that's really the storage API", async () => {
    vi.stubEnv("BUNNY_CDN_URL", "https://uk.storage.bunnycdn.com/builderos");
    expect((await run()).summary).toBe("BUNNY_CDN_URL points at the storage API, not the CDN.");
  });
});
