"use client";

/** A <select> in a GET form that applies itself as soon as it changes. */
export function AutoSubmitSelect(props: React.ComponentProps<"select">) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
