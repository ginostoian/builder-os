/**
 * Connection strings for the database tests, derived from TEST_DATABASE_URL_ADMIN (a superuser on a
 * throwaway database). The database name must end in `_test`: setup drops and recreates its schema.
 */
const OWNER = { user: "builderos_owner_test", password: "owner_test_only" };
const APP = { user: "builderos_app_test", password: "app_test_only" };

export function adminUrl(): string {
  const raw = process.env.TEST_DATABASE_URL_ADMIN;
  if (!raw) throw new Error("Set TEST_DATABASE_URL_ADMIN to run database tests (see docs/database.md)");
  const url = new URL(raw);
  if (!url.pathname.replace(/^\//, "").endsWith("_test")) {
    throw new Error("Refusing to run database tests: the database name in TEST_DATABASE_URL_ADMIN must end in _test");
  }
  return raw;
}

function withUser(credentials: { user: string; password: string }): string {
  const url = new URL(adminUrl());
  url.username = credentials.user;
  url.password = credentials.password;
  return url.toString();
}

export const ownerCredentials = OWNER;
export const appCredentials = APP;
export const ownerUrl = () => withUser(OWNER);
export const appUrl = () => withUser(APP);
