import "server-only";
import { headers } from "next/headers";

/**
 * The app's public origin for links we hand out (portal links in emails and "copy link"). APP_URL wins when
 * set (production's own domain); otherwise the request's host, which is right on previews and locally.
 */
export async function appOrigin(): Promise<string> {
  const configured = process.env.APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const portalUrl = (origin: string, token: string, number?: number) => `${origin}/portal/${token}${number ? `/quotes/${number}` : ""}`;

/** The client's IP and browser, kept as evidence with an e-signature. */
export async function requestEvidence(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent") };
}

/** Link-preview bots and crawlers. Their fetches never count as a client opening a quote. */
export async function isBot(): Promise<boolean> {
  const ua = (await headers()).get("user-agent") ?? "";
  return ua === "" || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|slack|discord|telegram|skype|linkedin|embedly|headless|python|curl|wget/i.test(ua);
}

export const portalInvoiceUrl = (origin: string, token: string, number: number) => `${origin}/portal/${token}/invoices/${number}`;
