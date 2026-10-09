import { ImageResponse } from "next/og";
import { IconTile } from "./site-icon/mark";

/** The favicon, also shown next to the site in Google's results. */
export const size = { width: 48, height: 48 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<IconTile size={48} />, size);
}
