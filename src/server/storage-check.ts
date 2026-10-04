/**
 * "Check file storage": upload a tiny photo the way the app does, fetch it back through the CDN link the app
 * shows people, and say plainly what's wrong if it doesn't come back. Uploads that succeed but don't display
 * are always a CDN (pull zone) setting, which the upload itself can't detect.
 */
import "server-only";
import { orgFileKey } from "@/core/files";
import { deleteObject, publicUrl, putObject, randomName, storageConfigured } from "./storage";

/** A valid 1×1 JPEG. */
const TEST_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

export type StorageCheck = { ok: boolean; summary: string; fix?: string; steps: string[] };

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function checkStorage(orgId: string): Promise<StorageCheck> {
  const steps: string[] = [];
  if (!storageConfigured()) {
    return { ok: false, summary: "File storage isn't set up.", fix: "Add the BUNNY_* settings in Vercel (see the setup guide), then redeploy.", steps };
  }
  const cdn = (process.env.BUNNY_CDN_URL ?? "").trim();
  if (/storage\.bunnycdn\.com/i.test(cdn)) {
    return {
      ok: false,
      summary: "BUNNY_CDN_URL points at the storage API, not the CDN.",
      fix: "Set BUNNY_CDN_URL to your Pull Zone's hostname (Bunny → CDN → your pull zone → Hostnames, e.g. https://yourname.b-cdn.net), then redeploy.",
      steps,
    };
  }

  const key = orgFileKey(orgId, "photos", `check${randomName()}`, "jpg");
  const stored = await putObject(key, TEST_JPEG, "image/jpeg");
  if (!stored.ok) return { ok: false, summary: `Uploading failed: ${stored.message}`, fix: "See the storage error codes in the setup guide (401: password or region; 404: zone name).", steps };
  steps.push("Uploaded a test photo to storage.");

  const url = publicUrl(key);
  let status = 0;
  let type = "";
  let firstFail = 0;
  try {
    for (const wait of [0, 2_000, 5_000]) {
      if (wait) await pause(wait);
      try {
        // As a browser showing the photo would: no referrer, no cookies.
        const res = await fetch(`${url}?check=${Date.now()}`, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { Accept: "image/*" } });
        status = res.status;
        type = res.headers.get("content-type") ?? "";
        await res.arrayBuffer().catch(() => undefined);
      } catch {
        status = -1;
      }
      steps.push(status === -1 ? "The CDN link didn't answer." : `The CDN answered ${status}${type ? ` (${type.split(";")[0]})` : ""}.`);
      if (status === 200 && type.startsWith("image/")) break;
      if (!firstFail) firstFail = status;
    }
  } finally {
    await deleteObject(key);
  }

  if (status === 200 && type.startsWith("image/")) {
    return firstFail
      ? { ok: true, summary: "Storage works, but new photos take a few seconds to reach the CDN.", fix: "Nothing to change: straight after an upload the app shows your own copy and retries until the CDN has it.", steps }
      : { ok: true, summary: "Storage works: photos upload and show.", steps };
  }
  if (status === 200) {
    return { ok: false, summary: "The CDN link answers, but not with the photo.", fix: "BUNNY_CDN_URL is probably a website, not the Bunny pull zone in front of your storage zone. Use the pull zone's hostname (….b-cdn.net).", steps };
  }
  if (status === 401 || status === 403) {
    return {
      ok: false,
      summary: `The CDN refuses to show files (error ${status}).`,
      fix: "In Bunny, open the pull zone → Security: turn off Token Authentication, and under Hotlink protection remove any \"Allowed referrers\" and untick \"Block no referrer\". Then try again.",
      steps,
    };
  }
  if (status === 404) {
    return {
      ok: false,
      summary: "The CDN can't find files that were just uploaded.",
      fix: `The pull zone at ${cdn} isn't serving this storage zone. In Bunny, open the pull zone → Origin: the origin type must be "Storage zone" and the zone must be "${(process.env.BUNNY_STORAGE_ZONE ?? "").trim()}". Or BUNNY_CDN_URL points at another pull zone.`,
      steps,
    };
  }
  if (status === -1) return { ok: false, summary: "The CDN link doesn't answer.", fix: `Check BUNNY_CDN_URL (${cdn}) is your pull zone's hostname, then redeploy.`, steps };
  return { ok: false, summary: `The CDN answered with an unexpected error (${status}).`, fix: "Check the pull zone in Bunny, then try again.", steps };
}
