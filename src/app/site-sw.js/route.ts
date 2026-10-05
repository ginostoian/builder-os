/**
 * The site app's service worker: keeps a copy of the site app's pages (and the scripts and styles they
 * need) on the phone, so it opens and works with no signal. Changes made offline are queued by the page
 * itself (see components/site/offline) and sent when the signal comes back; this only serves pages.
 *
 * Served outside /m so the browser can fetch it without the sign-in check; `Service-Worker-Allowed` lets
 * it look after /m. It never caches anything outside /m and the build's static files, and it drops the
 * saved pages when a different person signs in on the same phone.
 */
const SCRIPT = String.raw`
const PAGES = "site-pages-v1";
const ASSETS = "site-assets-v1";
const META = "site-meta-v1";
const KEEP = [PAGES, ASSETS, META];
const NETWORK_TIMEOUT_MS = 6000;

const OFFLINE_PAGE = '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Site app</title><style>body{font:15px/1.45 system-ui,sans-serif;background:#FAFAF9;color:#111110;margin:0;display:grid;place-items:center;min-height:100dvh;padding:24px;box-sizing:border-box}main{max-width:340px;text-align:center}a{display:inline-block;margin-top:16px;background:#111110;color:#fff;border-radius:12px;padding:12px 20px;text-decoration:none;font-weight:600}</style></head><body><main><h1 style="font-size:20px">No signal</h1><p>This page isn’t saved on your phone yet. Your Today screen and jobs you’ve opened work offline.</p><a href="/m">Go to Today</a></main></body></html>';

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name.startsWith("site-") && !KEEP.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

const isPage = (url) => url.pathname === "/m" || url.pathname.startsWith("/m/");
const isAsset = (url) => url.pathname.startsWith("/_next/static/") || url.pathname === "/site-icon" || url.pathname === "/site.webmanifest";

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") cache.put(request, res.clone());
  return res;
}

const savable = (res) => res.ok && !res.redirected && res.type === "basic" && (res.headers.get("content-type") || "").includes("text/html");

async function page(request, url) {
  const cache = await caches.open(PAGES);
  const key = url.pathname;
  try {
    const res = await Promise.race([fetch(request), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS))]);
    if (savable(res)) cache.put(key, res.clone());
    return res;
  } catch {
    const hit = await cache.match(key);
    if (hit) return hit;
    return new Response(OFFLINE_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isAsset(url)) return event.respondWith(cacheFirst(request));
  if (isPage(url) && request.mode === "navigate") return event.respondWith(page(request, url));
});

/** Save a page (and every script and style it loads) so it opens offline, even if never visited. */
async function warm(path) {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!savable(res)) return;
  const html = await res.clone().text();
  await (await caches.open(PAGES)).put(path, res);
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []);
  const cache = await caches.open(ASSETS);
  for (const a of assets) {
    if (await cache.match(a)) continue;
    try {
      const r = await fetch(a);
      if (r.ok) await cache.put(a, r);
    } catch {}
  }
}

self.addEventListener("message", (event) => {
  if (event.origin && event.origin !== self.location.origin) return;
  const data = event.data || {};
  if (data.type === "identity" && typeof data.memberId === "string") {
    event.waitUntil(
      (async () => {
        const meta = await caches.open(META);
        const prev = await meta.match("/identity");
        const was = prev ? await prev.text() : null;
        // Someone else signed in on this phone: forget the last person's pages.
        if (was !== data.memberId) {
          await caches.delete(PAGES);
          await meta.put("/identity", new Response(data.memberId));
        }
      })(),
    );
  } else if (data.type === "warm" && Array.isArray(data.paths)) {
    const paths = data.paths.filter((p) => typeof p === "string" && /^\/m(\/jobs\/[0-9a-f-]{36})?$/.test(p)).slice(0, 40);
    event.waitUntil((async () => { for (const p of paths) { try { await warm(p); } catch {} } })());
  } else if (data.type === "clear") {
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(META)]));
  }
});
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/m",
      "Cache-Control": "no-cache",
    },
  });
}
