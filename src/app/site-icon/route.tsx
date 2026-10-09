import { ImageResponse } from "next/og";
import { IconTile } from "./mark";

/** The site app's home-screen icon: the brick-course mark on a full-bleed tile (safe for maskable icons). */
export function GET(request: Request) {
  const asked = Number(new URL(request.url).searchParams.get("size"));
  const size = [180, 192, 512].includes(asked) ? asked : 192;
  return new ImageResponse(<IconTile size={size} />, { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } });
}
