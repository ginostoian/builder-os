import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseUrl } from "./env";

const SECRET = "npg_s3cretPassw0rd";
const good = `postgresql://builderos_app_prod:${SECRET}@ep-x-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require`;

function errorFor(value: string | undefined): unknown {
  vi.stubEnv("DATABASE_URL", value);
  try {
    databaseUrl();
  } catch (error) {
    return error;
  }
  return undefined;
}

afterEach(() => vi.unstubAllEnvs());

describe("databaseUrl", () => {
  it("accepts a normal connection string", () => {
    vi.stubEnv("DATABASE_URL", good);
    expect(databaseUrl()).toBe(good);
  });

  it("never puts the connection string (or password) in an error", () => {
    for (const bad of [`'${good}'`, `"${good}"`, `not a url ${SECRET}`, `http://user:${SECRET}@host/db`, `postgresql://:${SECRET}@host/db`]) {
      const error = errorFor(bad);
      expect(error, bad).toBeInstanceOf(Error);
      // Everything Next.js would log: message, stack and any extra fields such as Node's `input`.
      const logged = JSON.stringify(error, Object.getOwnPropertyNames(error));
      expect(logged).not.toContain(SECRET);
    }
  });

  it("explains quotes, which is the usual copy-paste mistake", () => {
    expect((errorFor(`'${good}'`) as Error).message).toMatch(/quotes/);
  });

  it("requires TLS in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((errorFor(good.replace("sslmode=require", "sslmode=disable")) as Error).message).toMatch(/sslmode/);
  });
});
