"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { addTemplateAction, setAutomationEnabledAction } from "@/app/app/pipeline/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** On/off switch for an automation. */
export function AutomationSwitch({ id, enabled, disabled }: { id: string; enabled: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [on, setOn] = React.useOptimistic(enabled);
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-[12px] text-danger">{error}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? "Switch off" : "Switch on"}
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            if (on && !window.confirm("Switch this off? Leads part-way through it stop getting its emails.")) return;
            setOn(!on);
            const r = await setAutomationEnabledAction(id, !on);
            if (!r.ok) setError(r.message);
            router.refresh();
          })
        }
        className={cn("relative h-6 w-11 flex-none rounded-full transition-colors disabled:opacity-60", on ? "bg-success" : "bg-faint")}
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </span>
  );
}

/** Add a ready-made automation (switched off, to read through first). */
export function AddTemplateButton({ templateKey, added }: { templateKey: string; added: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending || added}
      onClick={() =>
        startTransition(async () => {
          const r = await addTemplateAction(templateKey);
          if (r.ok && r.id) router.push(`/app/pipeline/automations/${r.id}`);
        })
      }
    >
      {added ? (
        "Added"
      ) : (
        <>
          <Plus />
          Add
        </>
      )}
    </Button>
  );
}
