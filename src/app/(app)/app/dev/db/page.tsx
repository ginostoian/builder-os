import { notFound } from "next/navigation";

import { DevDbControls } from "./_components/dev-db-controls";

import { env } from "@/env";
import { db } from "@/server/db";
import { getOrgIdOrThrow } from "@/server/tenancy";

type DbConnectionFingerprint = {
  host: string;
  endpointId: string;
  databaseFromUrl: string;
  isPooler: boolean;
  sslMode: string;
  channelBinding: string;
};

function parseConnectionFingerprint(databaseUrl: string): DbConnectionFingerprint {
  const normalized = databaseUrl.replace(/^['"]|['"]$/g, "");
  const parsed = new URL(normalized);
  const host = parsed.hostname;

  return {
    host,
    endpointId: host.split(".")[0] ?? "unknown",
    databaseFromUrl: parsed.pathname.replace(/^\//, "") || "unknown",
    isPooler: host.includes("-pooler."),
    sslMode: parsed.searchParams.get("sslmode") ?? "not-set",
    channelBinding: parsed.searchParams.get("channel_binding") ?? "not-set",
  };
}

export default async function DevDbPage() {
  if (env.NODE_ENV === "production") {
    notFound();
  }

  const orgId = await getOrgIdOrThrow();
  const fingerprint = parseConnectionFingerprint(env.DATABASE_URL);

  const [
    clientCount,
    quoteCount,
    acceptedQuoteCount,
    variationCount,
    latestQuote,
    runtimeDbInfo,
  ] =
    await Promise.all([
      db.client.count({ where: { orgId } }),
      db.quote.count({ where: { orgId } }),
      db.quote.count({ where: { orgId, status: "ACCEPTED" } }),
      db.variation.count({ where: { orgId } }),
      db.quote.findFirst({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          currentVersion: true,
          createdAt: true,
          acceptedAt: true,
          sentAt: true,
        },
      }),
      db.$queryRaw<Array<{ database: string; schema: string }>>`
        SELECT current_database() AS database, current_schema() AS schema
      `,
    ]);
  const runtimeInfo = runtimeDbInfo[0];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <section className="rounded-3xl border bg-white p-8 shadow-[var(--card-shadow)]">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          BuilderOS Internal
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          Dev DB Flows
        </h1>
        <p className="mt-4 text-[1.05rem] text-[var(--muted-foreground)]">
          Protected internal page to test database lifecycle actions before the full
          app UI is built.
        </p>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Active org: <span className="font-mono">{orgId}</span>
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-[var(--card-shadow)]">
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
          DB Connection Fingerprint
        </h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Use this to verify the app and your dashboard are pointed at the same Neon
          database.
        </p>
        <dl className="mt-4 grid gap-2 text-sm text-[var(--foreground)] sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Host</dt>
            <dd className="break-all font-mono">{fingerprint.host}</dd>
          </div>
          <div>
            <dt className="font-semibold">Endpoint ID</dt>
            <dd className="font-mono">{fingerprint.endpointId}</dd>
          </div>
          <div>
            <dt className="font-semibold">Database (URL)</dt>
            <dd className="font-mono">{fingerprint.databaseFromUrl}</dd>
          </div>
          <div>
            <dt className="font-semibold">Database (Runtime)</dt>
            <dd className="font-mono">{runtimeInfo?.database ?? "unknown"}</dd>
          </div>
          <div>
            <dt className="font-semibold">Schema</dt>
            <dd className="font-mono">{runtimeInfo?.schema ?? "unknown"}</dd>
          </div>
          <div>
            <dt className="font-semibold">Connection Pooling</dt>
            <dd>{fingerprint.isPooler ? "On (pooler host)" : "Off (direct host)"}</dd>
          </div>
          <div>
            <dt className="font-semibold">sslmode</dt>
            <dd className="font-mono">{fingerprint.sslMode}</dd>
          </div>
          <div>
            <dt className="font-semibold">channel_binding</dt>
            <dd className="font-mono">{fingerprint.channelBinding}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-[var(--card-shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Clients
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {clientCount}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-[var(--card-shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Quotes
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {quoteCount}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-[var(--card-shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Accepted Quotes
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {acceptedQuoteCount}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-[var(--card-shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Variations
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {variationCount}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-[var(--card-shadow)]">
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
          Latest Quote Snapshot
        </h2>
        {!latestQuote ? (
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            No quotes yet.
          </p>
        ) : (
          <dl className="mt-3 grid gap-2 text-sm text-[var(--foreground)] sm:grid-cols-2">
            <div>
              <dt className="font-semibold">ID</dt>
              <dd className="break-all font-mono">{latestQuote.id}</dd>
            </div>
            <div>
              <dt className="font-semibold">Title</dt>
              <dd>{latestQuote.title}</dd>
            </div>
            <div>
              <dt className="font-semibold">Status</dt>
              <dd>{latestQuote.status}</dd>
            </div>
            <div>
              <dt className="font-semibold">Version</dt>
              <dd>v{latestQuote.currentVersion}</dd>
            </div>
            <div>
              <dt className="font-semibold">Sent At</dt>
              <dd>{latestQuote.sentAt ? latestQuote.sentAt.toISOString() : "-"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Accepted At</dt>
              <dd>
                {latestQuote.acceptedAt ? latestQuote.acceptedAt.toISOString() : "-"}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <DevDbControls />
    </main>
  );
}
