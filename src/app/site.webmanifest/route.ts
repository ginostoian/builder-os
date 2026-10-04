/**
 * Lets people add the site app to their phone's home screen. Served outside /m (which needs a login)
 * because browsers fetch manifests without cookies.
 */
export function GET() {
  return Response.json(
    {
      name: "Builder OS site app",
      short_name: "Site app",
      start_url: "/m",
      scope: "/m",
      display: "standalone",
      background_color: "#FAFAF9",
      theme_color: "#111110",
      icons: [
        { src: "/site-icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/site-icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/site-icon?size=512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
