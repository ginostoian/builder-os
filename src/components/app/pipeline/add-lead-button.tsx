"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadDialog } from "./lead-dialog";
import type { Owner } from "./types";

/** `startOpen` comes from `?new=1` (the top bar's New menu). */
export function AddLeadButton({ owners, meId, startOpen = false }: { owners: Owner[]; meId: string; startOpen?: boolean }) {
  const [open, setOpen] = React.useState(startOpen);
  const [key, setKey] = React.useState(0);
  return (
    <>
      <Button
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <Plus />
        Add lead
      </Button>
      {open && (
        <LeadDialog
          key={key}
          open
          onOpenChange={(next) => {
            setOpen(next);
            // Don't reopen on refresh.
            if (!next && startOpen) window.history.replaceState(null, "", window.location.pathname);
          }}
          owners={owners}
          meId={meId}
        />
      )}
    </>
  );
}
