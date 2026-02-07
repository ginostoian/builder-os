# **BuilderOS — Product & Technical Context ( Reference)**

## **1\. Product Summary (What we are building)**

**BuilderOS** is a **multi-tenant SaaS** for **UK renovation and design-&-build companies** doing **£10k–£300k projects**.

The product solves two core problems:

1. **Underquoting** (forgetting scope, poor structure, inconsistent pricing)

2. **Unpaid variations** (changes after acceptance done for free)

BuilderOS is **not just a quote generator**.  
 It is a **Quote → Lock Scope → Manage Variations** system that protects margin.

The product lifecycle is:

**Draft Quote → Sent Quote (editable \+ versioned) → Accepted (locked) → Variations (approved changes)**

---

## **2\. Core Value Proposition**

* Build professional, hybrid quotes **fast**

* Prevent forgotten scope with templates & structure

* Lock scope on acceptance

* Force all post-acceptance changes into **approved variations**

* Provide a clean audit trail (versions, acceptance, variation approvals)

* Look premium to clients without exposing internal pricing logic

---

## **3\. Target User**

* UK renovation / design & build companies

* Typically 1–10 staff initially

* Single-user per company in MVP

* Multi-user teams later

* Technically non-savvy, speed-oriented, WhatsApp/email heavy

---

## **4\. Tech Stack (Non-Negotiable)**

* **Framework:** Next.js (App Router)

* **Language:** TypeScript

* **Stack:** T3-style architecture

* **Auth:** Clerk

* **Multi-tenancy:** Clerk Organizations

* **DB:** Postgres

* **ORM:** Prisma

* **UI:** Tailwind \+ shadcn/ui

* **PDF:** Server-side rendering

* **No Turborepo**

* **No payment processing (Stripe not used for payments)**

---

## **5\. Multi-Tenancy Model (Critical)**

* **Each company \= one Clerk Organization**

* Even if MVP is single-user, everything is org-scoped

* Every table includes `orgId`

* Every DB query is scoped by `orgId`

* Never trust orgId from client input without Clerk validation

### **Required rules:**

1. User must belong to an org

2. Org must be selected (auto if only one)

3. All CRUD queries include `where: { orgId }`

Public quote links are **unlisted**, token-based, and read-only.

---

## **6\. High-Level Architecture**

### **Frontend**

* Server Components where possible

* Client Components for quote grid editing

* No heavy client-side state libraries initially

### **Backend**

* Prisma for DB access

* Either tRPC or Server Actions (but must be typed)

* All business logic lives server-side

---

## **7\. Core Domain Objects (Mental Model)**

### **Organization (Clerk)**

Represents a company. Source of truth for membership.

### **Client**

Lightweight CRM entity.

### **Quote**

The main commercial document.

* Can be edited until accepted

* Versioned when resent

* Locks on acceptance

### **QuoteItem**

One row in a quote.  
 Supports multiple pricing calculation types.

### **TemplateSection**

Reusable section (e.g. Bathroom, Prelims).  
 Acts like a “lego block” inserted into quotes.

### **PriceBookItem**

Reusable single items/services.

### **Acceptance**

Proof that a quote was accepted.

### **Variation**

Post-acceptance change request that must be approved.

---

## **8\. Quote Lifecycle Rules (Very Important)**

### **Before Acceptance**

* Quote is editable

* Client can request changes

* Each resend increments version

* Client always sees latest version

### **On Acceptance**

* Quote locks (read-only)

* Acceptance name \+ date captured

* Accepted snapshot is baseline contract value

### **After Acceptance**

* Quote cannot be edited

* All changes must be **Variations**

* Variations update job total only after approval

---

## **9\. Pricing Engine (Hybrid by Design)**

Each QuoteItem has a `calcType`:

### **Supported calculation types:**

* **sell\_only** → fixed price

* **unit\_rate** → qty × unit price

* **labour\_hours** → hours × hourly rate

* **allowance** → provisional sum

### **Internal vs Client View**

* Builder may work with **cost \+ markup**

* Client **never sees** cost or markup

* Client sees **clean totals only**

* Builder can optionally show quantities/rates (default OFF)

---

## **10\. VAT Handling**

* VAT toggle per quote: **0% or 20%**

* VAT applies to subtotal

* VAT amount shown clearly

* Variations inherit VAT logic

---

## **11\. Deposit & Payment Schedule (Informational Only)**

* Builder can toggle **Deposit Required**

* Deposit can be:

  * fixed £ amount

  * % of total

* Deposit shown on web \+ PDF

* Optional payment schedule text/table

* **No payments collected by the platform**

---

## **12\. Client-Facing Quote Page**

### **Design principles:**

* Summary-first (premium feel)

* Expandable breakdown sections

* No overwhelming detail by default

* Mobile-friendly

### **Always visible:**

* Total (inc VAT)

* Deposit required

* Accept button

* Download PDF

### **Expandable:**

* Section breakdown

* Line items (if enabled)

---

## **13\. Terms & Conditions**

* Stored at company level

* Rich text (builder-written)

* Pre-filled into quotes

* Editable per quote

* Rendered on web \+ PDF

---

## **14\. Quote Versions**

* Quotes are versioned automatically

* Any edit after sending increments version

* Client sees:

  * “Updated on \[date/time\]”

  * Always latest version

* Older PDFs stored for audit

---

## **15\. Variations System (Profit Protection Core)**

* Variations only allowed **after acceptance**

* Each variation:

  * has its own items

  * has its own total

  * updates contract total on approval

* Client approves via link

* Generates a **Variation Order PDF**

* Variations cannot modify original quote items

---

## **16\. MVP Module Breakdown**

### **Module 1 — Auth & Org Selection**

* Clerk login

* Org creation / selection

* Enforced org context

### **Module 2 — Company Settings**

* Branding

* Defaults (VAT, grouping)

* Terms & Conditions

### **Module 3 — Clients**

* Simple CRUD

* Attach quotes

### **Module 4 — Quote Builder (Core)**

* Spreadsheet-style grid

* Keyboard-first UX

* Section headers

* Hybrid pricing inputs

* Live totals

### **Module 5 — Price Book**

* Saved items

* Search \+ favourites

* One-click add to quote

### **Module 6 — Template Sections**

* Insertable blocks

* Multiple items per section

* Customizable per company

### **Module 7 — Quote Preview & Public Link**

* Summary-first view

* Expandable breakdown

* View tracking

### **Module 8 — PDF Generation**

* Same layout as web

* Branded

* Versioned

### **Module 9 — Acceptance**

* Online acceptance

* Lock quote

### **Module 10 — Variations**

* Add → approve → update totals

* Variation PDFs

---

## **17\. Build Priorities (Strict Order)**

1. Auth \+ org scoping

2. Quote \+ QuoteItem schema

3. Quote builder grid

4. Pricing engine

5. Preview page

6. PDF rendering

7. Acceptance lock

8. Variations

9. Templates & price book

10. Polish & onboarding

---

## **18\. Non-Goals (For Now)**

* No AI estimating

* No supplier price feeds

* No payments

* No accounting

* No job scheduling

* No complex CRM automation

---

## **19\. Philosophy for Implementation**

* Bias toward **clarity over abstraction**

* Ship vertical slices

* Prefer explicit logic over “magic”

* BuilderOS should feel:

  * **Fast**

  * **Predictable**

  * **Trustworthy**

---

## **20\. Instruction Summary**

When generating code:

* Always assume **multi-tenant**

* Always include `orgId`

* Never expose cost/markup to client views

* Enforce lifecycle rules strictly

* Keep UI simple and keyboard-friendly

* Avoid premature abstractions

