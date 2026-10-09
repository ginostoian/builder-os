"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { confirmAdminAppAction, verifyAdminCodeAction } from "@/app/admin/two-step/actions";
import { Input } from "@/components/ui/input";

/** The 6-digit code from the authenticator app: the first one when setting it up, then every 12 hours. */
export function AdminCodeForm(props: { mode: "setup"; secret: string; token: string } | { mode: "code" }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result =
        props.mode === "setup"
          ? await confirmAdminAppAction({
              secret: props.secret,
              token: props.token,
              code,
            })
          : await verifyAdminCodeAction(code);
      if (!result.ok) {
        setError(result.message);
        setCode("");
        return;
      }
      router.replace("/admin");
      router.refresh();
    });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium">Code from the app</span>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={props.mode === "code"}
          placeholder="123456"
          className="font-mono tracking-[0.2em]"
        />
      </label>
      <button type="submit" disabled={pending || code.length !== 6} className="h-10 rounded-[10px] bg-ink font-medium text-white disabled:opacity-60">
        {pending ? "Checking…" : props.mode === "setup" ? "Turn on and continue" : "Continue"}
      </button>
    </form>
  );
}
