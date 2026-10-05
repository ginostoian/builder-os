import type { HelpArticle } from "./types";

export const COST_ARTICLES: HelpArticle[] = [
  {
    slug: "expenses-and-receipts",
    title: "Expenses and receipts",
    summary: "Log receipts, supplier bills and subcontractor invoices against a job, with a photo of each.",
    category: "costs",
    plan: "pro",
    who: "Admins and the office add and change expenses. Estimators can see them.",
    keywords: ["expense", "receipt", "bill", "costs", "materials", "skip", "plant hire", "subcontractor", "purchases"],
    body: [
      {
        type: "p",
        text: "Every receipt and bill you log goes into its job's costs. That way you can see what a job is really costing while it's still running, not weeks after it's finished.",
      },
      { type: "h", text: "Where to find them" },
      {
        type: "p",
        text: "**Purchases** in the menu shows expenses across every job. Each project also has a **Costs** view with just that job's expenses. Costs belong to a job, so you'll need a project first.",
      },
      { type: "h", text: "Adding an expense" },
      {
        type: "steps",
        items: [
          "Click **Add expense**.",
          "Fill in **What for**, like \"Plasterboard and screws\", and pick the **Project** if you're on the Purchases page.",
          "Add the **Supplier**, the **Type** and the **Date**.",
          "Enter the **Total paid** as on the receipt, including any VAT, and the **VAT included**. The **20% VAT** and **No VAT** buttons fill it in for you.",
          "Click **Add photo or PDF** to attach the receipt. You can add up to 6.",
          "If it was for a purchase order, pick it under **Purchase order**.",
          "Click **Add**.",
        ],
      },
      {
        type: "p",
        text: "The types are Materials, Subcontractor, Plant and tool hire, Skips and waste, Agency or extra labour, and Other. They're used to show where the money's gone on the job.",
      },
      { type: "h", text: "Receipts from site" },
      {
        type: "p",
        text: "Your team can log receipts from the [site app](/help/site-app) with **Add a receipt** on the job. They go straight into the job's costs, and Admins and the office get a notification. Site receipts are logged as Materials, dated today, so check them over and change anything that needs it.",
      },
      { type: "h", text: "Keeping on top of them" },
      {
        type: "list",
        items: [
          "The **Missing receipts** view on the Purchases page lists every expense without a receipt attached.",
          "Click any expense to change it, add more receipts or **Delete** it.",
          "Tick **Bought for the client** for things the client will pay back. See [recharging costs](/help/recharging-costs).",
        ],
      },
      {
        type: "note",
        text: "If your company has a VAT number in Settings, costs are counted without VAT, as you reclaim it. If not, the VAT is part of the cost.",
      },
      {
        type: "tip",
        text: "Attach the receipt photo first. Builder OS can [read it for you](/help/reading-receipts) and fill in the details.",
      },
    ],
    related: ["reading-receipts", "purchase-orders", "recharging-costs", "job-costing-reports", "site-app"],
  },
  {
    slug: "reading-receipts",
    title: "Reading receipts automatically",
    summary: "Snap a receipt and Builder OS fills in the shop, what was bought, the date, the total and the VAT.",
    category: "costs",
    plan: "pro",
    who: "Anyone who logs receipts, in the office or on site",
    keywords: ["scan receipt", "photo", "auto fill", "read receipt", "OCR"],
    body: [
      {
        type: "p",
        text: "Typing in receipts at the end of a long day is a chore. Builder OS can read a photo or PDF of a receipt and fill in the form for you, so all you do is check it.",
      },
      { type: "h", text: "How it works" },
      {
        type: "steps",
        items: [
          "Start a new expense in the office, or tap **Add a receipt** on a job in the site app.",
          "Add the receipt: **Add photo or PDF** in the office, or **Photo of the receipt** on your phone, which opens the camera.",
          "You'll see \"Reading the receipt…\" for a moment.",
          "When it's done, the form is filled in and you'll see \"Filled in from the receipt. Check it before saving.\"",
          "Check the details, change anything that's wrong, and save.",
        ],
      },
      { type: "h", text: "What it fills in" },
      {
        type: "list",
        items: [
          "The supplier or shop, like Screwfix or Travis Perkins",
          "A short description of what was bought",
          "The total paid, including VAT",
          "The VAT, if the receipt shows it (on the site app, it ticks or unticks **The receipt shows VAT**)",
          "In the office, also the date and the type, like Materials or Plant and tool hire",
        ],
      },
      { type: "h", text: "Good to know" },
      {
        type: "list",
        items: [
          "Only the first receipt you add is read. Extra photos are just attached.",
          "It never overwrites anything you've already typed.",
          "It only reads what's printed. If a number isn't clear, it leaves it blank rather than guessing.",
          "If it can't read the receipt, you'll see \"Couldn't read that receipt. Fill it in by hand.\" Nothing is lost, just type it in.",
          "Nothing is saved until you save the expense yourself.",
        ],
      },
      {
        type: "tip",
        text: "Lay the receipt flat in good light and get the whole thing in the photo, especially the total at the bottom. Crumpled till receipts from the van read much better smoothed out.",
      },
    ],
    related: ["expenses-and-receipts", "site-app"],
  },
  {
    slug: "purchase-orders",
    title: "Purchase orders",
    summary: "Order materials from suppliers, email or print the order, then record their bill against it.",
    category: "costs",
    plan: "pro",
    who: "Admins and the office",
    keywords: ["PO", "order materials", "supplier", "builders merchant", "delivery"],
    body: [
      {
        type: "p",
        text: "A purchase order (PO) is a clear, numbered order to a supplier: what you need, how many, at what price, and where to deliver it. It also shows you money that's committed to a job before the bill arrives.",
      },
      { type: "h", text: "Raising an order" },
      {
        type: "steps",
        items: [
          "Click **New purchase order** on the Purchases page, or **New order** in a project's Costs view.",
          "Fill in the **Supplier**, their email under **Supplier's email**, the **Project** and when it's **Needed by**.",
          "Add **Delivery notes**, like access or who to call. They go on the order with the site address.",
          "Add each item with its quantity, unit and unit price. Click **Add a line** for more.",
          "Pick the VAT rate: 20%, 5% or None.",
          "Click **Save as draft**. The order gets a number like PO-0007.",
        ],
      },
      { type: "h", text: "Sending it" },
      {
        type: "list",
        items: [
          "**Email to supplier** sends the order to the supplier's email, asking them to quote the PO number on their invoice. Replies come to you.",
          "**Print** opens a printable copy you can save as a PDF.",
          "**Ordered another way** is for when you've phoned it through or ordered at the counter.",
        ],
      },
      {
        type: "p",
        text: "Each of these moves the order from Draft to **Ordered**. When the goods arrive, click **Mark as delivered**.",
      },
      { type: "h", text: "Recording the supplier's bill" },
      {
        type: "p",
        text: "When their invoice comes in, open the order and click **Record the bill**. The expense form opens already filled in with the supplier, the order and the total, so just check it against their invoice, attach a copy and save. It then counts in the job's costs.",
      },
      { type: "h", text: "Good to know" },
      {
        type: "list",
        items: [
          "Orders that are ordered or delivered but have no bill yet show on the job as \"Ordered, not billed yet\".",
          "You can delete a draft. Once it's been ordered, use **Cancel order** instead: it stays on record. **Back to draft** brings a cancelled order back.",
        ],
      },
    ],
    related: ["expenses-and-receipts", "job-costing-reports"],
  },
  {
    slug: "recharging-costs",
    title: "Billing purchases back to the client",
    summary: "Mark things you bought on the client's behalf, then add them to an invoice so you're paid back.",
    category: "costs",
    plan: "pro",
    who: "Admins and the office",
    keywords: ["recharge", "bill back", "on behalf", "client supplied", "handling charge", "pass through"],
    body: [
      {
        type: "p",
        text: "Sometimes you buy something for the client, like the boiler they picked or the tiles they chose. Marking it as bought for the client keeps it out of your job costs and makes sure it gets billed back, not forgotten.",
      },
      { type: "h", text: "Marking a purchase" },
      {
        type: "steps",
        items: [
          "Add or open the expense.",
          "Tick **Bought for the client**.",
          "If you like, add a handling charge as a percentage.",
          "Save.",
        ],
      },
      {
        type: "p",
        text: "On the site app, your team can tick **Bought for the client (they'll pay it back)** when they log a receipt.",
      },
      { type: "h", text: "Billing it" },
      {
        type: "p",
        text: "Open the job's accepted quote. Under the payment schedule you'll see the purchases made for the client that are waiting to be billed. Then either:",
      },
      {
        type: "list",
        items: [
          "Click **Bill to client** to put them on an invoice of their own, due after your payment terms, or",
          "Click **Create invoice** on the next payment and tick them under **Add purchases made for the client**, so they go on the same invoice.",
        ],
      },
      {
        type: "p",
        text: "Each one shows on the invoice as \"Purchased on your behalf\", with the supplier. The amount is what it cost you (without VAT if you're VAT registered), plus any handling charge, plus VAT at the quote's rate. See [raising invoices](/help/raising-invoices).",
      },
      { type: "h", text: "Paid back another way?" },
      {
        type: "p",
        text: "If the client paid you back directly, open the expense and click **Mark as paid back**. It won't be offered for invoicing again.",
      },
      { type: "h", text: "Good to know" },
      {
        type: "list",
        items: [
          "The **To bill to clients** view on the Purchases page lists everything still waiting to be billed.",
          "Once it's on an invoice, the amounts are locked. Cancel that invoice to change them.",
          "A job with no quote can't bill from a payment schedule, so invoice it yourself and mark it as paid back.",
        ],
      },
    ],
    related: ["expenses-and-receipts", "raising-invoices", "job-costing-reports"],
  },
  {
    slug: "job-costing-reports",
    title: "Job costing and the Reports page",
    summary: "See what each job earns against what it's costing, and where your margin is heading.",
    category: "costs",
    plan: "pro",
    who: "Admins, the office and estimators",
    keywords: ["profit", "margin", "job costing", "budget", "estimate", "over budget", "labour cost", "reports"],
    body: [
      {
        type: "p",
        text: "Job costing puts what a job sells for next to what it's costing, as it happens. You'll spot a job going over budget while there's still time to do something about it.",
      },
      { type: "h", text: "One job: the Costs view" },
      { type: "p", text: "Open a project and click **Costs**. At the top you'll see:" },
      {
        type: "list",
        items: [
          "**Contract (ex VAT)**: the accepted quote plus approved variations.",
          "**Estimated cost**: from the quote's cost prices, before markup.",
          "**Spent so far**: bills and receipts plus labour.",
          "**Left in the estimate** (or **Over estimate**), with the margin it's heading for.",
        ],
      },
      {
        type: "p",
        text: "Below that, **Where the money's gone** breaks costs down by type, with labour per person. Orders placed but not billed yet are shown separately.",
      },
      { type: "h", text: "All jobs: Reports" },
      {
        type: "p",
        text: "[Reports](/app/reports) shows every job in one table: contract value, estimated cost, spent so far, how much of the estimate is used, expected margin, and anything to bill back to the client. Filter by **Current jobs**, **Complete** or **All**, and click a job to open its Costs view.",
      },
      { type: "h", text: "How the numbers work" },
      {
        type: "list",
        items: [
          "Labour comes from site check-ins, at each person's day rate for an 8-hour day. Someone without a day rate shows \"no day rate\" and their time isn't costed, so add one on their Team page.",
          "Expected margin uses whichever is bigger: the estimate, or what's been spent so far. A job over budget shows it straight away.",
          "Purchases made for the client are left out of costs, as they're billed back.",
          "If you're VAT registered, everything is without VAT. If not, costs include VAT.",
          "The bar turns amber once 85% of the estimate is used, and red when it's over.",
        ],
      },
      {
        type: "tip",
        text: "Costs are only as good as what's logged. Get your team adding receipts from the [site app](/help/site-app) and checking in on site, and the figures look after themselves.",
      },
    ],
    related: ["expenses-and-receipts", "purchase-orders", "timesheets-and-check-ins", "markups-margins-and-vat"],
  },
];
