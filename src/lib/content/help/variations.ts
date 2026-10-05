import type { HelpArticle } from "./types";

export const VARIATION_ARTICLES: HelpArticle[] = [
  {
    slug: "variations",
    title: "Variations",
    summary: "Price extra work or work taken out of an accepted quote, and send it to your client to approve.",
    category: "variations",
    plan: "essentials",
    who: "Admins, the office and Estimators",
    keywords: ["variation", "change order", "extras", "additional work", "omission", "credit", "site changes", "photos"],
    body: [
      { type: "p", text: "Jobs change once you're on site. The client wants two more sockets, or decides to keep the old fireplace. A variation prices that change properly and gets it signed off, so there are no arguments when the final bill comes." },
      { type: "h", text: "Starting a variation" },
      {
        type: "steps",
        items: [
          "Open the accepted quote. Variations can only be added once a quote has been accepted.",
          "In the **Variations** panel on the right, click **New variation**.",
          "Give it a **Title** the client will understand, for example 'Two extra double sockets in the kitchen'.",
          "Fill in **Why it's needed** if it helps, such as what the client asked for or what you found on site. It's optional and shown to the client.",
          "Add lines. Use **Add from your service library**, or click **Custom line** and type your own.",
          "Click **Save draft** as you go.",
        ],
      },
      { type: "h", text: "Pricing the lines" },
      {
        type: "list",
        items: [
          "Each line has an item, quantity, unit, rate and markup, just like a quote. The rate is your cost before markup.",
          "Markup starts at the quote's default markup. Change it on any line.",
          "Set **Type** to **Extra** for added work, or **Taken out** for work you're no longer doing. Taken out lines are a credit to the client.",
          "VAT uses the same rate as the original quote.",
          "The summary shows your cost, the subtotal, VAT and the total (or credit), plus your gross margin. Only your team sees cost and margin.",
        ],
      },
      { type: "h", text: "Adding photos" },
      { type: "p", text: "Under **Photos**, add up to 12 site photos, such as the rotten joist you found under the floor. They're shown to the client with the variation, which makes it much easier for them to say yes." },
      { type: "h", text: "Keeping track" },
      { type: "p", text: "**Variations** in the menu lists every variation across your jobs. Filter by **In progress**, **Awaiting approval**, **Approved, not invoiced** or **All**. Each one has a reference based on its quote, like Q-0012-V2." },
      { type: "h", text: "Good to know" },
      {
        type: "list",
        items: [
          "A draft can be deleted at any time. It hasn't been sent, so the client never saw it.",
          "Variations need the Essentials plan or above.",
        ],
      },
      { type: "tip", text: "Raise a variation the same day the change is agreed, while everyone remembers the conversation. Then [send it for approval](/help/approving-variations)." },
    ],
    related: ["approving-variations", "accepted-quotes-and-signatures", "raising-invoices", "service-library"],
  },
  {
    slug: "approving-variations",
    title: "Sending and approving variations",
    summary: "Send a variation to your client, get it signed online, then invoice it or add it to a payment.",
    category: "variations",
    plan: "essentials",
    who: "Admins, the office and Estimators",
    keywords: ["approve", "sign", "signature", "send variation", "reject", "withdraw", "revise", "invoice variation", "credit"],
    body: [
      { type: "p", text: "Once a variation is priced, send it to your client. They approve it with a typed signature in their portal, and you get a clear record before the extra work starts." },
      { type: "h", text: "Sending it" },
      {
        type: "steps",
        items: [
          "Open the draft variation and click **Send to client**.",
          "Leave **Email it to** ticked to email your client, or untick it to send the link yourself.",
          "Click **Send variation**. You'll see the link, with a button to copy it.",
        ],
      },
      { type: "p", text: "The email asks them to approve it and shows the extra cost (or credit) including VAT. Once sent, a variation can't be edited, only withdrawn or revised." },
      { type: "h", text: "What your client does" },
      {
        type: "list",
        items: [
          "They see it in their [portal](/help/client-portal) marked **Needs your approval**, with the lines, photos and total.",
          "To approve, they click **Approve & sign**, type their name and signature, tick to agree and click **Sign and approve**.",
          "Or they click **Reject**, and can give a reason.",
        ],
      },
      { type: "p", text: "Whoever sent it gets a notification and an email either way. An approved variation shows the signature, name, time, IP address and a reference for the exact version signed." },
      { type: "h", text: "Changing your mind" },
      {
        type: "list",
        items: [
          "**Withdraw** a sent variation so the client can no longer approve it. It stays on record as withdrawn.",
          "**Revise** a sent variation to change it. The old one is withdrawn and a new draft opens with the same lines, as the next variation number.",
          "**Revise and resend** a rejected or withdrawn one in the same way.",
          "Approved variations are final.",
        ],
      },
      { type: "h", text: "Getting paid" },
      {
        type: "list",
        items: [
          "On an approved variation, click **Create invoice** to invoice it on its own. You'll need your bank details in Settings first.",
          "Or add it to the next payment's invoice from the payment schedule on the quote.",
          "A credit (a variation that takes money off) is added to a payment's invoice from the quote's payment schedule.",
        ],
      },
      { type: "note", text: "Only Admins and the office can create invoices. See [Raising invoices](/help/raising-invoices)." },
      { type: "tip", text: "Don't start the extra work until it's approved. The client's email says work starts once they've approved it." },
    ],
    related: ["variations", "raising-invoices", "payment-plans", "client-portal"],
  },
];
