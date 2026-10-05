import Link from "next/link";

/** Help text with **bold** and [links](/help/slug). Nothing else is interpreted. */
export function RichText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) parts.push(<strong key={i++} className="font-semibold text-ink">{m[1]}</strong>);
    else {
      const href = m[3];
      parts.push(
        href.startsWith("/") ? (
          <Link key={i++} href={href} className="font-medium text-ink underline decoration-faint underline-offset-2 hover:decoration-ink">
            {m[2]}
          </Link>
        ) : (
          <a key={i++} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline decoration-faint underline-offset-2 hover:decoration-ink">
            {m[2]}
          </a>
        ),
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
