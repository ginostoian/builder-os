"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink } from "lucide-react";
import { setEnquiryFormAction } from "@/app/app/pipeline/actions";
import { Button } from "@/components/ui/button";

/** Turn the website enquiry form on, copy its link or the embed code, change the link, or turn it off. */
export function FormSettings({ url }: { url: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string>();
  const set = (on: boolean, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      const r = await setEnquiryFormAction(on);
      if (!r.ok) setError(r.message);
      router.refresh();
    });
  };
  if (!url) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-ink-2">The form is off. Turn it on to get a link for your website, Google profile, Facebook page or email signature.</p>
        <Button onClick={() => set(true)} disabled={pending}>
          {pending ? "Turning on…" : "Turn on the enquiry form"}
        </Button>
        {error && <p className="text-danger">{error}</p>}
      </div>
    );
  }
  const embed = `<iframe src="${url}?embed=1" title="Enquiry form" style="width:100%;max-width:600px;height:760px;border:0"></iframe>`;
  return (
    <div className="flex flex-col gap-4">
      <CopyRow label="Link to the form" value={url} open={url} />
      <CopyRow label="Embed it on your website (paste into the page's HTML)" value={embed} mono />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={pending} onClick={() => set(true, "Make a new link? The old link (and any embed using it) stops working.")}>
          New link
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => set(false, "Turn the form off? People using the link will see that it isn't taking enquiries.")}>
          Turn off
        </Button>
      </div>
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}

function CopyRow({ label, value, open, mono }: { label: string; value: string; open?: string; mono?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div>
      <div className="mb-1 text-[12.5px] font-medium">{label}</div>
      <div className="flex gap-2">
        <input readOnly value={value} onFocus={(e) => e.target.select()} className={`h-8 min-w-0 flex-1 rounded-md bg-surface px-2.5 text-[12.5px] shadow-ring-input outline-none ${mono ? "font-mono" : ""}`} />
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
        {open && (
          <Button asChild variant="ghost">
            <a href={open} target="_blank" rel="noreferrer">
              <ExternalLink />
              Open
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
