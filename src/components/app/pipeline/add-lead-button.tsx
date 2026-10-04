"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadDialog } from "./lead-dialog";
import type { Owner } from "./types";

export function AddLeadButton({ owners, meId }: { owners: Owner[]; meId: string }) {
  const [open, setOpen] = React.useState(false);
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
      {open && <LeadDialog key={key} open onOpenChange={setOpen} owners={owners} meId={meId} />}
    </>
  );
}
