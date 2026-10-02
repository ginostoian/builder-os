import { cn } from "@/lib/utils";

/** Classes for a 32px text input, select or textarea in the app's forms. */
export const control =
  "h-8 w-full min-w-0 rounded-md bg-white px-2.5 text-[13px] text-ink shadow-ring-input outline-none placeholder:text-subtle focus-visible:shadow-[0_0_0_1.5px_var(--color-ink),0_0_0_4px_rgb(16_16_15/0.08)] disabled:bg-surface disabled:text-ink-2";

export function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-[13.5px] font-semibold">{title}</h2>
      {hint && <p className="text-subtle">{hint}</p>}
    </div>
  );
}

/** Label, control, and a hint line that turns into the error message when there is one. */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium">
          {label}
          {required && <span className="text-subtle"> (required)</span>}
        </span>
        <span className={cn("contents", error && "[&_input]:shadow-[0_0_0_1.5px_var(--color-danger)] [&_select]:shadow-[0_0_0_1.5px_var(--color-danger)] [&_textarea]:shadow-[0_0_0_1.5px_var(--color-danger)]")}>
          {children}
        </span>
      </label>
      {(error ?? hint) && <p className={cn("text-[12px]", error ? "text-danger" : "text-subtle")}>{error ?? hint}</p>}
    </div>
  );
}
