"use client";

import * as React from "react";
import { setCompedAction } from "@/app/admin/actions";

export function CompToggle({ orgId, comped }: { orgId: string; comped: boolean }) {
  const [on, setOn] = React.useState(comped);
  const [pending, startTransition] = React.useTransition();
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          if (!next && !window.confirm("Stop complimentary Pro? They'll drop to whatever they pay for (or Free).")) return;
          setOn(next);
          startTransition(async () => {
            const r = await setCompedAction(orgId, next);
            if (!r.ok) setOn(!next);
          });
        }}
        className="size-4"
      />
      <span className="text-[12.5px] text-ink-2">{on ? "Pro, free" : "No"}</span>
    </label>
  );
}
