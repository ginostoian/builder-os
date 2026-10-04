import { ImageResponse } from "next/og";

/** The site app's home-screen icon: the brick-course mark on a full-bleed tile (safe for maskable icons). */
export function GET(request: Request) {
  const asked = Number(new URL(request.url).searchParams.get("size"));
  const size = [180, 192, 512].includes(asked) ? asked : 192;
  const u = size / 56; // scale from the 56px mark
  const bar = { height: 6.5 * u, background: "#FFFFFF", borderRadius: 2 * u };
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#111110", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 30 * u, display: "flex", flexDirection: "column", gap: 4.5 * u }}>
          <div style={{ ...bar, display: "flex" }} />
          <div style={{ display: "flex", gap: 4.5 * u }}>
            <div style={{ ...bar, flex: 1 }} />
            <div style={{ ...bar, flex: 2 }} />
          </div>
          <div style={{ ...bar, display: "flex", background: "#E3672E" }} />
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
