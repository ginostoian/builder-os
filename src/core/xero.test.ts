import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  bankBalances,
  explainXeroError,
  nextAttemptAt,
  profitAndLoss,
  profitByOption,
  salesTaxType,
  trackingOptionName,
  validationMessages,
  validWebhookSignature,
  whereString,
  xeroContact,
  xeroDate,
  xeroInvoice,
  xeroPayment,
  xeroSettings,
  XeroMappingError,
} from "./xero";

const src = {
  ref: "INV-0007",
  issueDate: "2026-10-17",
  dueDate: "2026-10-31",
  description: "Deposit: Kitchen (Q-0012)",
  quote: { ref: "Q-0012", title: "Kitchen" },
  vatRateBps: 2000,
  lines: [
    { description: "Deposit", net: 150_000, vat: 30_000 },
    { description: "Variation V1: Extra socket", net: 12_345, vat: 2_469 },
  ],
};
const ctx = { contactId: "c-1", accountCode: "200", status: "AUTHORISED" as const, vatRegistered: true };

describe("Xero VAT codes", () => {
  it("maps UK rates and the domestic reverse charge to Xero's tax types", () => {
    expect(salesTaxType(2000, "standard", true)).toBe("OUTPUT2");
    expect(salesTaxType(500, undefined, true)).toBe("RROUTPUT");
    expect(salesTaxType(0, "standard", true)).toBe("ZERORATEDOUTPUT");
    expect(salesTaxType(2000, "reverse_charge", true)).toBe("DRCHARGESUPPLY20");
    expect(salesTaxType(500, "reverse_charge", true)).toBe("DRCHARGESUPPLY5");
    expect(salesTaxType(1750, "standard", true)).toBeNull();
    expect(salesTaxType(2000, "standard", false)).toBe("NONE");
  });
});

describe("Xero invoices", () => {
  it("sends net lines with our VAT to the penny, our number and the job tracking", () => {
    const inv = xeroInvoice(src, { ...ctx, url: "https://app.example/app/invoices/1", tracking: { name: "Jobs", option: "Q-0012 Kitchen" } });
    expect(inv).toMatchObject({
      Type: "ACCREC",
      Contact: { ContactID: "c-1" },
      InvoiceNumber: "INV-0007",
      Reference: "Q-0012 Kitchen",
      Date: "2026-10-17",
      DueDate: "2026-10-31",
      LineAmountTypes: "Exclusive",
      Status: "AUTHORISED",
    });
    expect(inv.LineItems).toEqual([
      { Description: "Deposit", Quantity: 1, UnitAmount: 1500, AccountCode: "200", TaxType: "OUTPUT2", TaxAmount: 300, Tracking: [{ Name: "Jobs", Option: "Q-0012 Kitchen" }] },
      {
        Description: "Variation V1: Extra socket",
        Quantity: 1,
        UnitAmount: 123.45,
        AccountCode: "200",
        TaxType: "OUTPUT2",
        TaxAmount: 24.69,
        Tracking: [{ Name: "Jobs", Option: "Q-0012 Kitchen" }],
      },
    ]);
  });

  it("uses the reverse charge codes with no VAT charged, and a prefix when Xero has its own numbers", () => {
    const inv = xeroInvoice(
      { ...src, vatTreatment: "reverse_charge", lines: [{ description: "Deposit", net: 150_000, vat: 0 }] },
      { ...ctx, numberPrefix: "BOS-", status: "DRAFT" },
    );
    expect(inv.InvoiceNumber).toBe("BOS-INV-0007");
    expect(inv.Status).toBe("DRAFT");
    expect(inv.LineItems[0]).toMatchObject({ TaxType: "DRCHARGESUPPLY20", TaxAmount: 0, UnitAmount: 1500 });
    expect("Tracking" in inv.LineItems[0]).toBe(false);
  });

  it("refuses a VAT rate Xero has no code for", () => {
    expect(() => xeroInvoice({ ...src, vatRateBps: 1750 }, ctx)).toThrow(XeroMappingError);
  });

  it("credits go across as negative lines", () => {
    const inv = xeroInvoice({ ...src, lines: [{ description: "Omission", net: -5_000, vat: -1_000 }] }, ctx);
    expect(inv.LineItems[0]).toMatchObject({ UnitAmount: -50, TaxAmount: -10 });
  });
});

describe("contacts, payments and filters", () => {
  it("keeps our client id on the contact so it can always be found again", () => {
    expect(
      xeroContact({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Main Contractor Ltd",
        email: "a@b.co",
        phone: "0117 000 0000",
        address: { line1: "1 High St", town: "Bristol", postcode: "BS1 1AA" },
      }),
    ).toEqual({
      Name: "Main Contractor Ltd",
      ContactNumber: "11111111-1111-4111-8111-111111111111",
      EmailAddress: "a@b.co",
      Addresses: [{ AddressType: "POBOX", AddressLine1: "1 High St", City: "Bristol", PostalCode: "BS1 1AA", Country: "United Kingdom" }],
      Phones: [{ PhoneType: "DEFAULT", PhoneNumber: "0117 000 0000" }],
    });
    expect(xeroContact({ id: "x", name: "Sam", email: null, phone: null, address: null })).toEqual({ Name: "Sam", ContactNumber: "x" });
  });

  it("builds payments and safe where filters", () => {
    expect(xeroPayment({ invoiceId: "i", accountId: "a", date: "2026-10-17", amountPence: 180_000, reference: "INV-0007" })).toEqual({
      Invoice: { InvoiceID: "i" },
      Account: { AccountID: "a" },
      Date: "2026-10-17",
      Amount: 1800,
      Reference: "INV-0007",
    });
    expect(whereString('O"Brien \\ Sons')).toBe('"O\\"Brien \\\\ Sons"');
    expect(trackingOptionName("Q-0012", "  Kitchen   and   utility ")).toBe("Q-0012 Kitchen and utility");
    expect(trackingOptionName("Q-0012", "x".repeat(200))).toHaveLength(100);
  });

  it("reads Xero's dates in UK time", () => {
    expect(xeroDate("/Date(1760659200000+0000)/")).toBe("2025-10-17");
    expect(xeroDate("2026-03-29T00:00:00")).toBe("2026-03-29");
    expect(xeroDate("soon")).toBeNull();
    expect(xeroDate(undefined)).toBeNull();
  });
});

describe("settings", () => {
  it("fills in sensible defaults", () => {
    expect(xeroSettings.parse({ salesAccountCode: "200", syncFrom: "2026-10-17" })).toEqual({
      salesAccountCode: "200",
      syncFrom: "2026-10-17",
      invoiceStatus: "AUTHORISED",
      trackJobs: true,
      pullPayments: true,
      numberPrefix: "",
    });
    expect(xeroSettings.safeParse({ salesAccountCode: "200", syncFrom: "2026-10-17", numberPrefix: "BOS <script>" }).success).toBe(false);
    expect(xeroSettings.safeParse({ salesAccountCode: "200", syncFrom: "2026-10-17", smuggled: 1 }).success).toBe(false);
  });
});

describe("webhooks", () => {
  it("accepts only Xero's signature over the exact body", () => {
    const body = '{"events":[],"firstEventSequence":1}';
    const sig = createHmac("sha256", "hook-key").update(body).digest("base64");
    expect(validWebhookSignature(body, sig, "hook-key")).toBe(true);
    expect(validWebhookSignature(`${body} `, sig, "hook-key")).toBe(false);
    expect(validWebhookSignature(body, sig, "other")).toBe(false);
    expect(validWebhookSignature(body, null, "hook-key")).toBe(false);
    expect(validWebhookSignature(body, sig, "")).toBe(false);
  });
});

describe("plain-English errors", () => {
  const v = (Message: string) => ({ Elements: [{ ValidationErrors: [{ Message }] }] });
  it("tells a builder what to do", () => {
    expect(explainXeroError(400, v("The TaxType code 'DRCHARGESUPPLY20' does not exist or cannot be used for this type of transaction.")).message).toMatch(
      /Add Domestic Reverse Charge Tax Rates/,
    );
    expect(explainXeroError(400, v("Account code '999' is not a valid code for this document.")).message).toMatch(/sales account/);
    expect(explainXeroError(400, v("The document date cannot be before the end of year lock date")).message).toMatch(/lock date/);
    expect(explainXeroError(400, v("Payments can only be made against Authorised documents")).message).toMatch(/draft/);
    expect(explainXeroError(401, { error: "invalid_grant" })).toMatchObject({ reconnect: true, needsAction: true });
    expect(explainXeroError(429, {})).toMatchObject({ needsAction: false });
    expect(explainXeroError(503, "<html>")).toMatchObject({ needsAction: false });
    expect(explainXeroError(400, v("Something new")).message).toBe("Xero didn't accept it: Something new");
  });

  it("finds validation messages wherever Xero puts them", () => {
    expect(validationMessages({ Invoices: [{ ValidationErrors: [{ Message: "A" }, { Message: "B" }] }], Detail: "C" })).toEqual(["C", "A", "B"]);
  });
});

describe("reports", () => {
  const row = (label: string, ...values: string[]) => ({ RowType: "Row", Cells: [{ Value: label }, ...values.map((Value) => ({ Value }))] });
  const sum = (label: string, ...values: string[]) => ({ RowType: "SummaryRow", Cells: [{ Value: label }, ...values.map((Value) => ({ Value }))] });
  const pnl = {
    Reports: [
      {
        Rows: [
          { RowType: "Header", Cells: [{ Value: "" }, { Value: "Q-0001 Kitchen" }, { Value: "Q-0002 Loft" }, { Value: "Unassigned" }, { Value: "Total" }] },
          {
            RowType: "Section",
            Title: "Income",
            Rows: [row("Sales", "10000.00", "25000.00", "0.00", "35000.00"), sum("Total Income", "10000.00", "25000.00", "0.00", "35000.00")],
          },
          {
            RowType: "Section",
            Title: "Less Cost of Sales",
            Rows: [row("Subcontractors", "6000.00", "21000.00", "0.00", "27000.00"), sum("Total Cost of Sales", "6000.00", "21000.00", "0.00", "27000.00")],
          },
          { RowType: "Section", Rows: [sum("Gross Profit", "4000.00", "4000.00", "0.00", "8000.00")] },
          {
            RowType: "Section",
            Title: "Less Operating Expenses",
            Rows: [row("Van", "0.00", "0.00", "1,500.50", "1,500.50"), sum("Total Operating Expenses", "0.00", "0.00", "1,500.50", "1,500.50")],
          },
          { RowType: "Section", Rows: [row("Net Profit", "4000.00", "4000.00", "-1500.50", "6499.50")] },
        ],
      },
    ],
  };

  it("reads the totals from a Profit and Loss report", () => {
    expect(profitAndLoss(pnl)).toEqual({ income: 1_000_000, costOfSales: 600_000, grossProfit: 400_000, overheads: 0, netProfit: 400_000 });
    expect(profitAndLoss({})).toEqual({ income: 0, costOfSales: 0, grossProfit: 0, overheads: 0, netProfit: 0 });
  });

  it("splits it by job", () => {
    expect(profitByOption(pnl)).toEqual([
      { option: "Q-0001 Kitchen", income: 1_000_000, costs: 600_000, profit: 400_000 },
      { option: "Q-0002 Loft", income: 2_500_000, costs: 2_100_000, profit: 400_000 },
      { option: "Unassigned", income: 0, costs: 150_050, profit: -150_050 },
    ]);
  });

  it("reads closing balances from a Bank Summary", () => {
    const bank = {
      Reports: [
        {
          Rows: [
            { RowType: "Header", Cells: [] },
            { RowType: "Section", Rows: [row("Business Current", "1000.00", "500.00", "200.00", "1300.00"), sum("Total", "1300.00")] },
          ],
        },
      ],
    };
    expect(bankBalances(bank)).toEqual([{ account: "Business Current", balance: 130_000 }]);
  });
});

describe("retries", () => {
  it("backs off, honours Retry-After, and gives up after six tries", () => {
    const now = new Date("2026-10-17T10:00:00Z");
    expect(nextAttemptAt(1, now)!.toISOString()).toBe("2026-10-17T10:01:00.000Z");
    expect(nextAttemptAt(3, now)!.toISOString()).toBe("2026-10-17T10:30:00.000Z");
    expect(nextAttemptAt(1, now, 600)!.toISOString()).toBe("2026-10-17T10:10:00.000Z");
    expect(nextAttemptAt(6, now)).toBeNull();
  });
});
