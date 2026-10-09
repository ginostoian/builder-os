import { toolBySlug } from "@/lib/content/tools";
import { OG_SIZE, ogImage } from "@/lib/og-image";

const tool = toolBySlug("renovation-cost-calculator")!;

export const alt = `${tool.name}: guide prices for UK home projects, from Builder OS`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return ogImage({ label: "Free calculator · UK 2026 prices", title: "How much will your project cost?" });
}
