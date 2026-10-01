import { z } from "zod";

const postgresUrl = z
  .url({ protocol: /^postgres(ql)?$/ })
  .refine((url) => new URL(url).username !== "", "Missing database user");

/**
 * Runtime connection string (the app role). In production the connection must use TLS with certificate
 * checks: Neon strings carry `sslmode=require`, and `verify-full` is better still.
 */
export function databaseUrl(): string {
  const parsed = postgresUrl.safeParse(process.env.DATABASE_URL);
  if (!parsed.success) throw new Error("DATABASE_URL is missing or not a postgres:// URL");
  if (process.env.NODE_ENV === "production") {
    const sslmode = new URL(parsed.data).searchParams.get("sslmode");
    if (sslmode !== "require" && sslmode !== "verify-full") {
      throw new Error("DATABASE_URL must set sslmode=require or sslmode=verify-full in production");
    }
  }
  return parsed.data;
}
