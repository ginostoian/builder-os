import { toolBySlug } from "@/lib/content/tools";
import { OG_SIZE, ogImage } from "@/lib/og-image";

const tool = toolBySlug("retention-calculator")!;

export const alt = `${tool.name}: a free tool from Builder OS`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return ogImage({ label: "Free tool for UK builders", title: tool.name });
}
