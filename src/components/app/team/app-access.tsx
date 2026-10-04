"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";
import { linkWorkerAction } from "@/app/app/team/actions";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type Role } from "@/core/roles";
import { control } from "../form-fields";

/** Whether this person can sign in (and so use the site app), and linking them to a login. */
export function AppAccess({
  workerId,
  linked,
  logins,
  canEdit,
}: {
  workerId: string;
  linked: { name: string; email: string | null; role: Role; active: boolean } | null;
  logins: { id: string; name: string; email: string | null }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [choice, setChoice] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const run = (memberId: string | null) =>
    startTransition(async () => {
      const r = await linkWorkerAction(workerId, memberId);
      if (!r.ok) setError(r.message);
      else router.refresh();
    });
  if (linked) {
    return (
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 size-4 text-success" />
        <div className="flex-1">
          <div className="font-medium">
            Signs in as {linked.name} · {ROLE_LABELS[linked.role]}
            {!linked.active && <span className="ml-1.5 text-danger">(removed from the company)</span>}
          </div>
          <div className="text-[12.5px] text-subtle">{linked.email ?? "No email"} · uses the site app to see their tasks, post updates and check in.</div>
        </div>
        {canEdit && (
          <Button variant="ghost" disabled={pending} onClick={() => run(null)}>
            Unlink
          </Button>
        )}
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-ink-2">
        No login yet: you can still give them tasks, and the office sees everything. To use the site app on their phone, invite them in{" "}
        <Link href="/app/settings/team" className="underline underline-offset-2">
          Settings → Team
        </Link>{" "}
        with the role <span className="font-medium">Employee</span> (or Site lead). If their email matches, they link up automatically.
      </p>
      {canEdit && logins.length > 0 && (
        <div className="flex items-center gap-2">
          <select aria-label="Link to an existing login" value={choice} onChange={(e) => setChoice(e.target.value)} className={`${control} max-w-[320px]`}>
            <option value="">Link to an existing login…</option>
            {logins.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.email ? ` (${l.email})` : ""}
              </option>
            ))}
          </select>
          <Button variant="secondary" disabled={!choice || pending} onClick={() => run(choice)}>
            Link
          </Button>
        </div>
      )}
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}
