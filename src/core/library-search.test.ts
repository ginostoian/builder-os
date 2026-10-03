import { describe, expect, it } from "vitest";
import { pickLines, searchLibrary, type LibraryPickOption } from "./library-search";

const svc = (name: string, over: Partial<LibraryPickOption> = {}): LibraryPickOption => ({ id: name, kind: "service", category: "Electrical", name, description: null, unit: "item", ratePence: 6_000, defaultMarkupBps: null, items: [], ...over });

describe("library search", () => {
  it("matches every word and puts names that start with the query first", () => {
    const lib = [svc("Extra double socket"), svc("Double socket"), svc("Skim plaster", { category: "Plastering" })];
    expect(searchLibrary(lib, "double sock").map((s) => s.name)).toEqual(["Double socket", "Extra double socket"]);
    expect(searchLibrary(lib, "plastering")).toHaveLength(1);
    expect(searchLibrary(lib, "  ")).toEqual([]);
  });

  it("turns a bundle into one line per service and falls back to the given markup", () => {
    const bundle = svc("Bathroom first fix", {
      kind: "bundle",
      items: [
        { serviceId: "a", qty: 2, name: "Pipework", unit: "m", ratePence: 1_000, defaultMarkupBps: 2500 },
        { serviceId: "b", qty: 1, name: "Waste", unit: "item", ratePence: 4_000, defaultMarkupBps: null },
      ],
    });
    expect(pickLines(bundle, 1500).map((l) => [l.name, l.qty, l.markupBps])).toEqual([
      ["Pipework", 2, 2500],
      ["Waste", 1, 1500],
    ]);
    expect(pickLines(svc("Socket", { defaultMarkupBps: 3000 }), 1500)[0]).toMatchObject({ qty: 1, markupBps: 3000, serviceId: "Socket" });
  });
});
