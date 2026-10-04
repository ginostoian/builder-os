import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicUrl, putObject, signedUrl, storageConfigured } from "./storage";

beforeEach(() => {
  vi.stubEnv("BUNNY_STORAGE_ZONE", "builderos");
  vi.stubEnv("BUNNY_STORAGE_KEY", "secret-key");
  vi.stubEnv("BUNNY_STORAGE_HOST", "uk.storage.bunnycdn.com");
  vi.stubEnv("BUNNY_CDN_URL", "https://builderos.b-cdn.net/");
  vi.stubEnv("BUNNY_TOKEN_KEY", "token-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Bunny storage", () => {
  it("needs every setting, and an https CDN", () => {
    expect(storageConfigured()).toBe(true);
    vi.stubEnv("BUNNY_CDN_URL", "http://builderos.b-cdn.net");
    expect(storageConfigured()).toBe(false);
  });

  it("uploads with the access key and a checksum, to the zone's regional endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const body = new Uint8Array([1, 2, 3]);
    expect(await putObject("orgs/x/logo/a b.png", body, "image/png")).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://uk.storage.bunnycdn.com/builderos/orgs/x/logo/a%20b.png");
    expect(init.method).toBe("PUT");
    expect(init.headers).toMatchObject({ AccessKey: "secret-key", "Content-Type": "image/png", Checksum: createHash("sha256").update(body).digest("hex").toUpperCase() });
  });

  it("copes with settings pasted with spaces, slashes or an https:// prefix", async () => {
    vi.stubEnv("BUNNY_STORAGE_HOST", " https://uk.storage.bunnycdn.com/ ");
    vi.stubEnv("BUNNY_STORAGE_ZONE", " builderos/ ");
    vi.stubEnv("BUNNY_STORAGE_KEY", "secret-key\n");
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await putObject("orgs/x/logo/a.png", new Uint8Array([1]), "image/png")).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://uk.storage.bunnycdn.com/builderos/orgs/x/logo/a.png");
    expect(init.headers).toMatchObject({ AccessKey: "secret-key" });
  });

  it("reports a refused upload without leaking details", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await putObject("k", new Uint8Array([1]), "image/png")).toEqual({ ok: false, message: expect.stringMatching(/couldn't be stored \(storage error 401\)/) });
  });

  it("builds public and signed CDN URLs", () => {
    expect(publicUrl("orgs/x/logo/a.png")).toBe("https://builderos.b-cdn.net/orgs/x/logo/a.png");
    const now = Date.UTC(2026, 9, 3, 12, 0, 0);
    const expires = now / 1000 + 600;
    const token = createHash("sha256").update(`token-key/orgs/x/files/a.pdf${expires}`).digest("base64url");
    expect(signedUrl("orgs/x/files/a.pdf", 600, now)).toBe(`https://builderos.b-cdn.net/orgs/x/files/a.pdf?token=${token}&expires=${expires}`);
  });
});
