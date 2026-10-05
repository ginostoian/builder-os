import { Info, Lightbulb } from "lucide-react";
import type { HelpBlock } from "@/lib/content/help";
import { RichText } from "./rich-text";

/** An article's blocks, set for comfortable reading. */
export function ArticleBody({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <div className="flex flex-col gap-4 text-[16px] leading-[1.7] text-ink-2">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h":
            return (
              <h2 key={i} id={b.text.toLowerCase().replace(/[^a-z0-9]+/g, "-")} className="mt-5 text-[20px] font-semibold tracking-[-0.01em] text-ink">
                {b.text}
              </h2>
            );
          case "p":
            return (
              <p key={i}>
                <RichText text={b.text} />
              </p>
            );
          case "list":
            return (
              <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-faint-2">
                {b.items.map((t, j) => (
                  <li key={j}>
                    <RichText text={t} />
                  </li>
                ))}
              </ul>
            );
          case "steps":
            return (
              <ol key={i} className="flex flex-col gap-2.5">
                {b.items.map((t, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="mt-[3px] flex size-6 flex-none items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-white tabular">{j + 1}</span>
                    <span className="min-w-0">
                      <RichText text={t} />
                    </span>
                  </li>
                ))}
              </ol>
            );
          case "tip":
          case "note":
            return (
              <div key={i} className={b.type === "tip" ? "flex gap-3 rounded-xl bg-brand/[0.07] p-4 text-[15px]" : "flex gap-3 rounded-xl bg-surface p-4 text-[15px] shadow-ring"}>
                {b.type === "tip" ? <Lightbulb className="mt-1 size-4 flex-none text-brand" /> : <Info className="mt-1 size-4 flex-none text-subtle" />}
                <p>
                  <span className="font-semibold text-ink">{b.type === "tip" ? "Tip: " : "Good to know: "}</span>
                  <RichText text={b.text} />
                </p>
              </div>
            );
        }
      })}
    </div>
  );
}
