import { auth } from "@clerk/nextjs/server";

export default async function AppHomePage() {
  const { orgId, userId } = await auth();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl border bg-white p-8 shadow-[var(--card-shadow)]">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          BuilderOS App
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          Main App View
        </h1>
        <p className="mt-4 max-w-2xl text-[1.05rem] text-[var(--muted-foreground)]">
          You are authenticated and inside the protected app route group.
        </p>
      </section>

      <section className="grid gap-4 rounded-3xl border bg-white p-6 shadow-[var(--card-shadow)] sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            User ID
          </p>
          <p className="mt-2 break-all text-sm text-[var(--foreground)]">{userId}</p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Org ID
          </p>
          <p className="mt-2 break-all text-sm text-[var(--foreground)]">
            {orgId ?? "No organization selected"}
          </p>
        </div>
      </section>
    </main>
  );
}
