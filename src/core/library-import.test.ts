import { describe, expect, it } from "vitest";
import { csvField, parseCsv } from "./csv";
import { IMPORT_TEMPLATE, MAX_IMPORT_ROWS, duplicateKey, planImport } from "./library-import";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, newlines in fields, CRLF and a BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi""\nthere"\r\n\r\n')).toEqual({ ok: true, rows: [["a", "b"], ["x, y", 'say "hi"\nthere']] });
  });

  it("detects semicolon and tab separators", () => {
    expect(parseCsv("a;b\n1;2")).toEqual({ ok: true, rows: [["a", "b"], ["1", "2"]] });
    expect(parseCsv("a\tb\n1\t2")).toEqual({ ok: true, rows: [["a", "b"], ["1", "2"]] });
  });

  it("rejects an unclosed quote and too many rows", () => {
    expect(parseCsv('a,"b\n1,2').ok).toBe(false);
    expect(parseCsv("a\n1\n2\n3", { maxRows: 2 }).ok).toBe(false);
  });

  it("quotes generated fields only when needed", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField('a, "b"')).toBe('"a, ""b"""');
  });
});

describe("planImport", () => {
  it("reads the template", () => {
    const plan = planImport(IMPORT_TEMPLATE, new Set());
    expect(plan).toMatchObject({ ok: true, counts: { new: 2, duplicate: 0, error: 0 }, ignoredColumns: [] });
    if (plan.ok && plan.rows[0].status === "new") {
      expect(plan.rows[0].value).toEqual({ category: "Plastering", name: "Skim plaster, walls", unit: "m²", ratePence: 2200, description: "Bead, scrim and two-coat skim to existing walls.", kind: "service" });
    }
    if (plan.ok && plan.rows[1].status === "new") expect(plan.rows[1].value.defaultMarkupBps).toBe(1500);
  });

  it("matches common header names in any order and reports extra columns", () => {
    const plan = planImport("Price (ex VAT),Item,Trade,UOM,Supplier\n£1,250.00,Boiler swap,Heating,job,Acme", new Set());
    // "£1,250.00" is split by the comma separator: users must quote amounts with commas. The rate is "£1".
    expect(plan).toMatchObject({ ok: true, ignoredColumns: ["Supplier"] });
    const quoted = planImport('Price (ex VAT),Item,Trade,UOM\n"£1,250.00",Boiler swap,Heating,job', new Set());
    expect(quoted.ok && quoted.rows[0]).toMatchObject({ status: "new", value: { name: "Boiler swap", category: "Heating", unit: "job", ratePence: 125_000 } });
  });

  it("explains bad rows by line number and keeps the good ones", () => {
    const plan = planImport("category,name,unit,rate,markup\nA,Good,m²,10,\nA,,m²,abc,900\nA,Also good,job,0,", new Set());
    expect(plan).toMatchObject({ ok: true, counts: { new: 2, duplicate: 0, error: 1 } });
    expect(plan.ok && plan.rows[1]).toEqual({
      line: 3,
      status: "error",
      name: "",
      errors: ['Rate "abc" isn\'t an amount in pounds', 'Markup "900" isn\'t a percentage between 0 and 500', "Name is missing"],
    });
  });

  it("skips services already in the library and repeats within the file", () => {
    const existing = new Set([duplicateKey("Plastering", "Skim")]);
    const plan = planImport("category,name,unit,rate\nplastering , SKIM,m²,1\nTiling,Floor,m²,1\nTILING,floor,m²,2", existing);
    expect(plan.ok && plan.rows.map((r) => r.status)).toEqual(["duplicate", "new", "duplicate"]);
  });

  it("refuses files without the required columns, without rows, or too big", () => {
    expect(planImport("name,rate\nA,1", new Set())).toEqual({ ok: false, error: expect.stringContaining("Missing: category, unit") });
    expect(planImport("category,name,unit,rate\n", new Set())).toEqual({ ok: false, error: "The file has headings but no services." });
    expect(planImport("", new Set())).toEqual({ ok: false, error: "The file is empty." });
    const big = ["category,name,unit,rate", ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `A,S${i},m,1`)].join("\n");
    expect(planImport(big, new Set()).ok).toBe(false);
  });
});
