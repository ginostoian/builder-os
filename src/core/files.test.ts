import { describe, expect, it } from "vitest";
import { keyFromCdnUrl, orgFileKey, sniffImage } from "./files";

const org = "6f1c2b1e-8a4e-4b4b-9a51-1b2c3d4e5f60";

describe("sniffImage", () => {
  it("recognises PNG, JPEG and WebP by their bytes", () => {
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.ext).toBe("png");
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))?.ext).toBe("webp");
  });

  it("refuses SVG, HTML and anything pretending by name", () => {
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<html>"))).toBeNull();
    expect(sniffImage(new Uint8Array([]))).toBeNull();
  });
});

describe("storage keys", () => {
  it("builds company-scoped keys from safe parts only", () => {
    expect(orgFileKey(org, "logo", "abcdefghijklmnopqrstuvwx", "png")).toBe(`orgs/${org}/logo/abcdefghijklmnopqrstuvwx.png`);
    expect(() => orgFileKey("../x", "logo", "abcdefghijklmnopqrstuvwx", "png")).toThrow();
    expect(() => orgFileKey(org, "logo", "../../etc/passwd", "png")).toThrow();
  });

  it("only maps our own CDN URLs for this company back to keys", () => {
    const cdn = "https://builderos.b-cdn.net";
    expect(keyFromCdnUrl(`${cdn}/orgs/${org}/logo/a.png`, cdn, org)).toBe(`orgs/${org}/logo/a.png`);
    expect(keyFromCdnUrl(`${cdn}/orgs/other/logo/a.png`, cdn, org)).toBeNull();
    expect(keyFromCdnUrl("https://example.com/logo.png", cdn, org)).toBeNull();
    expect(keyFromCdnUrl(`${cdn}/orgs/${org}/../x`, cdn, org)).toBeNull();
    expect(keyFromCdnUrl(null, cdn, org)).toBeNull();
  });
});
