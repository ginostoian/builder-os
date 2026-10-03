import { describe, expect, it } from "vitest";
import { renderEmail } from "./email-template";
import { invoiceEmail, type InvoiceEmailFacts } from "./invoice-email";

const facts: InvoiceEmailFacts = {
  ref: "INV-0007",
  company: { name: "Hale & Sons Ltd", tradingName: "Hale & Sons", brandColour: "#C2410C" },
  clientName: "Sarah",
  description: "Deposit: Kitchen (Q-0012)",
  totalPence: 312_500,
  dueDate: "2026-10-17",
  bank: { accountName: "Hale & Sons Ltd", sortCode: "123456", accountNumber: "12345678" },
  link: "https://app.example/portal/t/invoices/7",
};

describe("invoiceEmail", () => {
  it("gives bank details and the reference to pay with", () => {
    const { subject, content } = invoiceEmail("new", facts, "Jo");
    expect(subject).toBe("Invoice INV-0007 from Hale & Sons");
    expect(content.details).toEqual(expect.arrayContaining([["Amount due", "£3,125.00"], ["Sort code", "12-34-56"], ["Reference", "INV-0007"]]));
    const { text } = renderEmail(content);
    expect(text).toContain("17 October 2026");
    expect(text).toContain("Jo, Hale & Sons");
  });

  it("words each reminder for where the invoice stands", () => {
    expect(invoiceEmail("before", facts).subject).toMatch(/due on 17 October 2026/);
    expect(invoiceEmail("due", facts).subject).toMatch(/due today/);
    expect(invoiceEmail("overdue_3", facts).subject).toMatch(/overdue/);
    expect(invoiceEmail("overdue_7", facts).content.heading).toMatch(/a week overdue/);
  });
});
