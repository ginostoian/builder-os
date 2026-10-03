import { describe, expect, it } from "vitest";
import { fromWithName, renderEmail } from "./email-template";

describe("renderEmail", () => {
  const base = { company: { name: "Hale & Sons", brandColour: "#E8590C" }, preheader: "Your quote", heading: "Kitchen <extension>", paragraphs: ["Hi Sarah,", "Line one\nline two"] };

  it("escapes everything a client or company typed", () => {
    const { html } = renderEmail({ ...base, button: { label: "View", href: 'https://x.test/?a=1&b="2"' }, details: [["Total", "£1 <b>"]] });
    expect(html).toContain("Hale &amp; Sons");
    expect(html).toContain("Kitchen &lt;extension&gt;");
    expect(html).toContain("Line one<br>line two");
    expect(html).toContain('href="https://x.test/?a=1&amp;b=&quot;2&quot;"');
    expect(html).toContain("£1 &lt;b&gt;");
    expect(html).not.toMatch(/<b>/);
  });

  it("only uses a brand colour that is a plain hex value", () => {
    expect(renderEmail(base).html).toContain("background:#E8590C");
    expect(renderEmail({ ...base, company: { name: "X", brandColour: "red;background:url(x)" } }).html).not.toContain("url(x)");
  });

  it("has a readable plain-text version", () => {
    const { text } = renderEmail({ ...base, button: { label: "View your quote", href: "https://x.test/q" }, details: [["Due", "3 October 2026"]] });
    expect(text).toContain("Due: 3 October 2026");
    expect(text).toContain("View your quote: https://x.test/q");
    expect(text.startsWith("Hale & Sons")).toBe(true);
  });
});

describe("fromWithName", () => {
  it("puts the company name in front of the verified address", () => {
    expect(fromWithName("Builder OS <quotes@builderos.app>", "Hale & Sons")).toBe('"Hale & Sons" <quotes@builderos.app>');
    expect(fromWithName("quotes@builderos.app", 'Evil" <x@y.z>')).toBe('"Evil x@y.z" <quotes@builderos.app>');
    expect(fromWithName("quotes@builderos.app", "")).toBe("quotes@builderos.app");
  });
});
