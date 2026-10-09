import { OG_SIZE, ogImage } from "@/lib/og-image";

export const alt = "Builder OS: quotes that win the job, built in minutes";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return ogImage({ label: "The operating system for renovation companies", title: "Quotes that win the job, built in minutes." });
}
