import type { HelpArticle } from "./types";

export const GETTING_PAID_ARTICLES: HelpArticle[] = [
  {
    slug: "payment-plans",
    title: "Payment plans: deposits, stages and instalments",
    summary: "Set out how your client pays, from a simple deposit and balance to weekly instalments.",
    category: "getting-paid",
    plan: "essentials",
    who: "Admins, the office and estimators",
    keywords: ["deposit", "stage payments", "instalments", "balance", "payment schedule", "milestones", "first fix"],
    body: [
      {
        type: "p",
        text: "A payment plan tells your client exactly when they pay and how much. It shows on the quote they accept, and once it's accepted each payment becomes an invoice with one click.",
      },
      { type: "h", text: "Where to find it" },
      {
        type: "p",
        text: "Open a draft quote and click the **Payment plan** tab, next to Items and Details. Amounts are what the client pays, VAT included, and they update live as you change the quote.",
      },
      { type: "h", text: "Start from a preset" },
      {
        type: "list",
        items: [
          "**Deposit and balance**: 25% to book, the rest on completion.",
          "**Three stages**: 30% deposit, 40% when first fix is complete, the balance on completion.",
          "**Weekly instalments**: an optional deposit, then the rest split into equal weekly payments from a start date you choose. Handy for a longer job like a full house renovation.",
        ],
      },
      { type: "p", text: "A preset replaces the current plan. You can change every payment afterwards." },
      { type: "h", text: "Set up each payment" },
      {
        type: "steps",
        items: [
          "Click **Add payment** and give it a name the client will understand, like \"Deposit\" or \"Roof watertight\".",
          "Under **Amount as**, pick **% of total**, **Fixed £** or **Remaining balance**. Only one payment can be the remaining balance, and it takes whatever is left.",
          "Under **Due**, pick **On acceptance**, **On a date** or **At a stage of work**.",
          "Use the arrows to reorder payments, or the bin to remove one.",
        ],
      },
      {
        type: "p",
        text: "The total at the bottom shows how much of the quote the plan covers. If the payments don't add up to the quote total you'll see a warning, and the quote can't be sent until they do.",
      },
      { type: "h", text: "Good to know" },
      {
        type: "list",
        items: [
          "Without a plan, the quote asks for the full amount on completion.",
          "\"On a date\" payments are invoiced for that date. Payments at a stage of work are due after your payment terms, counted from the day you raise the invoice. See [bank details and payment terms](/help/bank-details-and-payment-terms).",
          "Percentages can come out a penny or two off after rounding. The last payment soaks that up for you.",
          "Once the quote is sent, the plan is fixed. To change it, [revise the quote](/help/revising-a-quote).",
        ],
      },
      {
        type: "tip",
        text: "Use the remaining balance for your final payment. Then if you add or remove items, the plan still adds up without any fiddling.",
      },
    ],
    related: ["raising-invoices", "building-a-quote", "sending-a-quote", "bank-details-and-payment-terms"],
  },
  {
    slug: "raising-invoices",
    title: "Raising invoices from an accepted quote",
    summary: "Turn each payment in an accepted quote's plan into an invoice, and email it to your client.",
    category: "getting-paid",
    plan: "essentials",
    who: "Admins and the office",
    keywords: ["invoice", "create invoice", "bill", "payment schedule", "INV", "print invoice", "cancel invoice", "void"],
    body: [
      {
        type: "p",
        text: "Once your client accepts a quote, you invoice it one payment at a time, straight from the quote. No retyping: the amounts, VAT and your bank details are filled in for you.",
      },
      { type: "h", text: "Before you start" },
      {
        type: "p",
        text: "Add your bank details in [Settings → Payments](/app/settings/payments). Invoices are paid by bank transfer, so you can't raise one until they're saved.",
      },
      { type: "h", text: "Step by step" },
      {
        type: "steps",
        items: [
          "Open the accepted quote. On the right you'll see the **Payment schedule**, with each payment and how much of the job has been paid so far.",
          "Next to the payment you want to bill, say the deposit, click **Create invoice**.",
          "Tick any approved variations or purchases made for the client that you'd like to add to this invoice.",
          "Leave **Email it to** ticked to send it to the client now, or untick it to send it later.",
          "Click **Create and email** (or **Create invoice**).",
        ],
      },
      {
        type: "p",
        text: "The invoice gets the next number, like INV-0012. It appears in your client's portal and on the [Payments](/app/payments) page, and the schedule shows its status: Unpaid, Due soon, Due today, Overdue or Paid.",
      },
      { type: "h", text: "When it's due" },
      {
        type: "p",
        text: "A payment set for a date is due on that date, as long as it's still ahead. Anything else is due after your payment terms, counted from today.",
      },
      { type: "h", text: "On the invoice page" },
      {
        type: "list",
        items: [
          "**Email to client** (or **Email again**) sends it with a link to view it online.",
          "**Copy client link** gives you the link to send another way, like WhatsApp.",
          "**Print** gives you a paper or PDF copy.",
          "**Cancel invoice** voids it. It stays on record, disappears from the portal and gets no more reminders. You can then raise that payment again, for example with a different date.",
          "The **History** panel shows when it was raised, emailed, reminded and paid.",
        ],
      },
      {
        type: "note",
        text: "If email isn't set up or the client has no email address, create the invoice anyway and use **Copy client link** to send it yourself.",
      },
      {
        type: "tip",
        text: "Bought a boiler or tiles for the client? Add it to the next stage invoice instead of sending a separate bill. See [recharging costs](/help/recharging-costs).",
      },
    ],
    related: ["payment-plans", "marking-invoices-paid", "payment-reminders", "variations", "recharging-costs"],
  },
  {
    slug: "payment-reminders",
    title: "Automatic payment reminders",
    summary: "Builder OS emails clients polite reminders before and after an invoice is due, so you don't have to chase.",
    category: "getting-paid",
    plan: "essentials",
    who: "Admins turn them on or off",
    keywords: ["chase", "overdue", "late payment", "reminder email", "credit control"],
    body: [
      {
        type: "p",
        text: "Chasing money is nobody's favourite job. Automatic reminders do it for you, politely and on time, and stop the moment you're paid.",
      },
      { type: "h", text: "When reminders go out" },
      {
        type: "p",
        text: "For each unpaid invoice, your client gets an email:",
      },
      {
        type: "list",
        items: [
          "3 days before it's due",
          "on the day it's due",
          "3 days late",
          "7 days late (a second reminder, asking them to get in touch if there's a problem)",
        ],
      },
      {
        type: "p",
        text: "Each one is sent once at most. If an invoice is raised on its due date, the client just gets the \"due today\" email, not an early one as well. Every reminder includes the amount, the due date, your bank details, the invoice number to use as a reference and a link to view the invoice. If you take [payments online](/help/taking-payments-online), they can pay from that link too.",
      },
      {
        type: "p",
        text: "Replies go to the person who raised the invoice, so your client can answer as they would any email.",
      },
      { type: "h", text: "Turning them on or off" },
      {
        type: "steps",
        items: [
          "Go to [Settings → Payments](/app/settings/payments).",
          "Under **Invoices**, tick or untick **Email clients automatic reminders**.",
          "Click **Save changes**.",
        ],
      },
      { type: "p", text: "Reminders are on for new companies. Only an Admin can change this setting." },
      { type: "h", text: "Good to know" },
      {
        type: "list",
        items: [
          "Reminders stop as soon as you [mark the invoice paid](/help/marking-invoices-paid), or when the client pays online.",
          "Cancelled invoices never get reminders.",
          "A client without an email address can't get reminders. Add one on their client page.",
          "You can see which reminders have gone out in the **History** panel on each invoice.",
        ],
      },
      {
        type: "tip",
        text: "When a bank transfer lands, [mark the invoice paid](/help/marking-invoices-paid) straight away. That way nobody gets a reminder for money they've already sent.",
      },
    ],
    related: ["raising-invoices", "marking-invoices-paid", "bank-details-and-payment-terms"],
  },
  {
    slug: "bank-details-and-payment-terms",
    title: "Bank details and payment terms",
    summary: "Add the account clients pay into and choose how many days they have to pay.",
    category: "getting-paid",
    who: "Admins",
    keywords: ["sort code", "account number", "bank transfer", "terms", "due date", "days to pay", "settings"],
    body: [
      {
        type: "p",
        text: "Your bank details go on every invoice so clients know where to send the money. Your payment terms decide when each invoice is due.",
      },
      { type: "h", text: "Step by step" },
      {
        type: "steps",
        items: [
          "Go to [Settings → Payments](/app/settings/payments).",
          "Under **Bank details**, enter the **Account name**, the 6-digit **Sort code** (like 12-34-56) and the 8-digit **Account number**.",
          "Under **Invoices**, set your **Payment terms** in days, from 0 to 120. 0 means due on receipt.",
          "Click **Save changes**.",
        ],
      },
      { type: "h", text: "How payment terms work" },
      {
        type: "p",
        text: "New companies start with 14 days. When you raise an invoice, it's due that many days later, unless the payment in the plan has its own date that's still ahead. So if your terms are 7 days and you invoice the \"Plastering complete\" stage on a Monday, it's due the following Monday.",
      },
      { type: "h", text: "Good to know" },
      {
        type: "list",
        items: [
          "You can't raise an invoice until your bank details are saved. The Payments page reminds you if they're missing.",
          "Each invoice keeps the bank details it was raised with. If you change bank, new invoices use the new account, but older ones still show the old one.",
          "Only an Admin can change these settings. The office, estimators and site leads can see them but not edit.",
          "Invoicing needs the Essentials plan or above.",
        ],
      },
      {
        type: "tip",
        text: "Double check the sort code and account number with your bank statement. A typo here means money going astray.",
      },
    ],
    related: ["raising-invoices", "payment-reminders", "taking-payments-online", "company-settings"],
  },
  {
    slug: "taking-payments-online",
    title: "Taking payments online",
    summary: "Let clients pay invoices by card, Apple Pay, Google Pay or straight from their bank, with one tap.",
    category: "getting-paid",
    plan: "essentials",
    who: "Admins set it up",
    keywords: ["stripe", "card payments", "pay now", "apple pay", "google pay", "pay by bank", "online payment"],
    body: [
      {
        type: "p",
        text: "Online payments add a **Pay now** button to your invoices, so a client can pay the deposit from their phone in a minute. Paid invoices are marked paid for you.",
      },
      { type: "h", text: "How it works" },
      {
        type: "p",
        text: "Payments go through Stripe, into your own Stripe account and then on to your bank. You pay Stripe's fees only. Builder OS takes nothing and never holds your money.",
      },
      { type: "h", text: "Setting it up" },
      {
        type: "steps",
        items: [
          "Go to [Settings → Payments](/app/settings/payments) and find **Online payments**.",
          "Click **Set up online payments**. You'll go to Stripe to enter your business and bank details.",
          "When you come back, Stripe may take a few minutes to check your details. It switches on as soon as they're done.",
          "If you stopped part way, click **Finish setting up** to carry on.",
        ],
      },
      {
        type: "p",
        text: "Once it's on, **Stripe dashboard** takes you to your Stripe account to see payments and payouts.",
      },
      { type: "h", text: "What your client sees" },
      {
        type: "list",
        items: [
          "A **Pay now** button with the amount at the top of each unpaid invoice in their portal.",
          "Invoice emails and reminders get a **View and pay online** button. Your bank details stay on as well, so they can still pay by transfer.",
          "After paying, they see a thank you message. Bank payments can take a little while to confirm.",
        ],
      },
      { type: "h", text: "When a client pays" },
      {
        type: "p",
        text: "The invoice is marked paid with the reference \"Paid online (card or bank)\", reminders stop, and Admins and the office get a notification.",
      },
      { type: "h", text: "Good to know" },
      {
        type: "list",
        items: [
          "Clients pay the whole invoice online. Cancelled and paid invoices can't be paid.",
          "Refunds are done in your Stripe dashboard. Refund the whole payment and the invoice goes back to unpaid by itself, and Admins and the office get a notification. Refund part of it and the invoice stays paid, but you're still told about it.",
          "Only an Admin can set up online payments or open the Stripe dashboard.",
        ],
      },
    ],
    related: ["raising-invoices", "marking-invoices-paid", "client-portal", "bank-details-and-payment-terms"],
  },
  {
    slug: "marking-invoices-paid",
    title: "Marking invoices as paid",
    summary: "Record when a bank transfer arrives, so reminders stop and your figures stay right.",
    category: "getting-paid",
    plan: "essentials",
    who: "Admins and the office",
    keywords: ["paid", "record payment", "bank transfer", "received", "unpaid", "reconcile"],
    body: [
      {
        type: "p",
        text: "When a client pays by bank transfer, mark the invoice as paid. Reminders stop straight away and the job's payment schedule shows what's been received.",
      },
      { type: "h", text: "Step by step" },
      {
        type: "steps",
        items: [
          "Go to [Payments](/app/payments) and open the invoice. You can also open it from the quote's payment schedule.",
          "Click **Mark as paid**.",
          "Set **Date received** to the day the money reached your account (it starts on today).",
          "Optionally add the **Bank reference** as it appears on your statement.",
          "Click **Mark as paid**.",
        ],
      },
      {
        type: "p",
        text: "The invoice now shows as Paid, in your system and in the client's portal. Payments made online through [Stripe](/help/taking-payments-online) are marked paid for you, and marked unpaid again if you refund them in full.",
      },
      { type: "h", text: "Made a mistake?" },
      {
        type: "p",
        text: "Open the invoice and click **Mark as unpaid**. The payment date and reference are cleared, and if it's still due, reminders pick up again.",
      },
      { type: "h", text: "Keeping on top of it" },
      {
        type: "p",
        text: "The Payments page shows what's **Unpaid**, what's **Overdue**, what's due in the next 7 days and what's been paid this month. Use the filters (Unpaid, Overdue, Paid, All) to find an invoice quickly.",
      },
      { type: "h", text: "Good to know" },
      {
        type: "list",
        items: [
          "An invoice is either paid or unpaid. There's no part payment, so mark it paid once the full amount is in.",
          "Only unpaid invoices can be marked as paid or cancelled.",
          "The date received can't be in the future.",
        ],
      },
      {
        type: "tip",
        text: "Ask clients to use the invoice number, like INV-0012, as their payment reference. It makes matching your bank statement much quicker.",
      },
    ],
    related: ["raising-invoices", "payment-reminders", "taking-payments-online"],
  },
  {
    slug: "reverse-charge-vat",
    title: "The VAT reverse charge",
    summary: "Quote and invoice main contractors under the construction reverse charge, with the VAT shown and HMRC's wording, done for you.",
    category: "getting-paid",
    who: "Admins and the office",
    keywords: ["reverse charge", "drc", "domestic reverse charge", "vat", "main contractor", "subcontractor", "cis", "hmrc", "section 55a"],
    body: [
      {
        type: "p",
        text: "When you work for another builder or contractor who is VAT and CIS registered and passes your work on to their own customer, you usually don't charge them VAT. They pay it to HMRC instead. This is the **domestic reverse charge**, and Builder OS handles it for you.",
      },
      { type: "h", text: "Set it once on the client" },
      {
        type: "steps",
        items: [
          "Open the client in [Clients](/app/clients).",
          "Tick **Use the VAT reverse charge on their quotes**, then **Save changes**.",
          "New quotes for them use the reverse charge from the start.",
        ],
      },
      {
        type: "p",
        text: "You can also change it on any draft quote: open the quote, go to **Details**, and set **VAT treatment** to **Domestic reverse charge**. Not sure if it applies? Our free [reverse charge checker](/tools/reverse-charge-vat-checker) asks six questions and tells you.",
      },
      { type: "h", text: "What changes" },
      {
        type: "list",
        items: [
          "No VAT is added to the total, so payment stages and invoices are the net amounts.",
          "Quotes, variations and invoices still show the VAT rate and the VAT amount, marked **not charged**, with the wording HMRC needs: \"Reverse charge: customer to pay the VAT to HMRC\".",
          "Invoice emails explain it and show the VAT your client pays to HMRC.",
          "Variations on the job follow the quote, so they're reverse charge too.",
          "If you use [Xero](/help/xero), invoices go across with Xero's reverse charge VAT codes.",
        ],
      },
      { type: "h", text: "Before you send" },
      {
        type: "p",
        text: "A reverse charge invoice must show your VAT number, so add it in [Settings](/app/settings) first. The reverse charge also needs a VAT rate (20% or 5%), because the invoice shows the VAT even though it isn't charged.",
      },
      {
        type: "note",
        text: "The reverse charge doesn't apply to work for homeowners (end users) or to work that's zero-rated. If you're unsure, check with your accountant.",
      },
    ],
    related: ["raising-invoices", "cis", "xero"],
  },
  {
    slug: "xero",
    title: "Connecting Xero",
    summary: "Your invoices and payments go into Xero by themselves, with the right VAT codes and each job tagged, so you never type them in twice.",
    category: "getting-paid",
    plan: "essentials",
    who: "Admins set it up",
    keywords: ["xero", "accounting", "bookkeeping", "accountant", "sync", "reconcile", "tracking category", "profit per job"],
    body: [
      {
        type: "p",
        text: "Connect Xero once and your books keep themselves up to date. Raise an invoice here and it's in Xero within seconds. Get paid and the payment is there too, ready to match to your bank statement.",
      },
      { type: "h", text: "Connecting" },
      {
        type: "steps",
        items: [
          "Go to [Settings → Xero](/app/settings/xero) and click **Connect to Xero**.",
          "Sign in to Xero, choose your organisation and click **Allow access**.",
          "You come back to Builder OS. We pick sensible choices for you: your Sales account, your bank account, a Stripe account if you have one, and a **Jobs** tracking category. Check them and click **Save**.",
        ],
      },
      { type: "h", text: "What goes to Xero" },
      {
        type: "list",
        items: [
          "**Invoices**, as you raise them: the client (we use their existing Xero contact if there is one), every line, the VAT, and the job they're for.",
          "**Payments** you mark here, or that clients make online. Online payments go against your Stripe account in Xero, so the Stripe payout to your bank isn't counted twice.",
          "**Changes**: mark an invoice unpaid and our payment comes off in Xero; cancel an invoice and it's voided in Xero.",
        ],
      },
      { type: "h", text: "What comes back" },
      {
        type: "p",
        text: "When a client pays by bank transfer and you (or your bookkeeper) match it in Xero, the invoice is marked paid here and the reminders stop. You can switch this off in Settings → Xero.",
      },
      { type: "h", text: "Profit per job" },
      {
        type: "p",
        text: "Each invoice is tagged with its job in Xero. Ask your bookkeeper to tag supplier bills with the job too, and [Reports → Xero figures](/app/reports/xero) shows real profit for every job, alongside your cash in the bank and what you're owed.",
      },
      { type: "h", text: "If something can't go" },
      {
        type: "p",
        text: "Settings → Xero lists everything that's been sent. If Xero is busy, we try again by ourselves. If something needs you, like switching on Xero's reverse charge VAT rates, it says exactly what to do. Fix it and click **Retry**.",
      },
      { type: "h", text: "Good to know" },
      {
        type: "list",
        items: [
          "Only invoices from the start date you choose go to Xero. To send older ones, set the date and click **Send invoices from**. Anything already in Xero is matched, not copied twice.",
          "If Xero already has its own INV-0001, ours get a prefix (BOS-INV-0001) so they never clash. Searching INV-0001 in Xero still finds it.",
          "Using the reverse charge? In Xero, switch on its reverse charge rates once: Accounting, Advanced, Tax rates, **Add Domestic Reverse Charge Tax Rates**.",
          "Disconnecting never deletes anything in Xero.",
        ],
      },
    ],
    related: ["raising-invoices", "marking-invoices-paid", "taking-payments-online", "reverse-charge-vat"],
  },
];
