import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// By default tailwind-merge drops a `leading-*` class when a later `text-*` size appears.
// Our headings set size and leading separately, so keep both.
const twMerge = extendTailwindMerge({ override: { conflictingClassGroups: { "font-size": [] } } });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
