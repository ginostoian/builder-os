import { OG_SIZE, ogImage } from "@/lib/og-image";

export const alt = "Free calculators for builders, from Builder OS";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return ogImage({ label: "Free tools · no sign-up", title: "Free calculators for UK builders." });
}
