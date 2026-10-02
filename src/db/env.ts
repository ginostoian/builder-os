/**
 * Runtime connection string (the app role). In production the connection must use TLS with certificate
 * checks: Neon strings carry `sslmode=require`, and `verify-full` is better still.
 *
 * Errors here must never include the value: it contains the database password, and Next.js logs the whole
 * error object (Node's own "Invalid URL" TypeError carries the raw input). So parse inside try/catch and
 * throw only our own messages.
 */
export function databaseUrl(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) throw new Error("DATABASE_URL is not set");
  if (/^['"]|['"]$/.test(raw)) throw new Error("DATABASE_URL is wrapped in quotes. Paste the value without them.");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL (value not shown: it contains the password)");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("DATABASE_URL must start with postgres:// or postgresql://");
  if (!url.username) throw new Error("DATABASE_URL has no database user");
  if (process.env.NODE_ENV === "production") {
    const sslmode = url.searchParams.get("sslmode");
    if (sslmode !== "require" && sslmode !== "verify-full") {
      throw new Error("DATABASE_URL must set sslmode=require or sslmode=verify-full in production");
    }
  }
  return raw;
}
