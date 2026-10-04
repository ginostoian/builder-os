"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { setPortalSignInAction } from "@/app/app/settings/actions";
import { Panel } from "../app-shell";

/** Company-wide: do clients confirm their email before their portal opens on a new device? */
export function PortalSecuritySetting({ on, canEdit, emailEnabled, portalHome }: { on: boolean; canEdit: boolean; emailEnabled: boolean; portalHome: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(on);
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  return (
    <Panel className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="size-4 text-ink-2" />
        Client portal sign-in
      </h2>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={value}
          disabled={!canEdit || pending}
          onChange={(e) => {
            const next = e.target.checked;
            setValue(next);
            startTransition(async () => {
              const r = await setPortalSignInAction(next);
              if (!r.ok) {
                setValue(!next);
                setError(r.message);
              } else router.refresh();
            });
          }}
          className="mt-0.5 size-4"
        />
        <span>
          <span className="block font-medium">Ask clients to confirm their email (recommended)</span>
          <span className="block text-[12.5px] text-ink-2">
            The first time a client opens their portal on a phone or computer, we email them a 6-digit code. That device is then remembered for 90 days. Links in your emails sign them in with one tap. A forwarded or leaked link on its own
            isn&apos;t enough.
          </span>
        </span>
      </label>
      {!emailEnabled && <p className="text-[12.5px] text-warning">Email isn&apos;t set up yet, so codes can&apos;t be sent: for now the private link alone opens a portal.</p>}
      <p className="text-[12.5px] text-ink-2">
        Clients can always find their portal at <span className="font-medium text-ink">{portalHome}</span>: they enter their email and we send them a sign-in link. Put it on your website as &ldquo;Client login&rdquo;.
      </p>
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
    </Panel>
  );
}
