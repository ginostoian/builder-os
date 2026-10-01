/**
 * Blog index content. Only the featured article has a body so far (see the article page);
 * Phase 1 moves posts to MDX in the repo (Technical Implementation Plan §2).
 */
export const blogCategories = ["Quoting", "Cash flow", "Running a team", "Client experience", "Guides", "Product updates"] as const;
export type BlogCategory = (typeof blogCategories)[number];

export type Post = {
  category: BlogCategory;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  read: string;
  image: string;
};

export const featuredPost = {
  slug: "how-to-quote-a-kitchen-extension",
  category: "Quoting" as BlogCategory,
  title: "How to quote a kitchen extension without leaving money on the table",
  excerpt:
    "A line-by-line walkthrough of a real £35k extension quote: where firms under-price, how to show provisional sums, and the payment plan that protects your cash flow.",
  author: "Tom Ashworth",
  authorInitials: "TA",
  authorRole: "Co-founder, ex-renovation firm owner",
  date: "24 Sep 2026",
  longDate: "24 September 2026",
  read: "9 min read",
  image: "feature image · kitchen extension site",
};

const p = (category: BlogCategory, title: string, excerpt: string, author: string, date: string, mins: number, image: string): Post => ({
  category,
  title,
  excerpt,
  author,
  date,
  read: `${mins} min read`,
  image,
});

export const posts: Post[] = [
  p("Cash flow", "The payment plan that stopped us chasing the last 10%", "Why we moved retention into a snagging stage, and the wording clients actually agree to.", "Tom Ashworth", "17 Sep 2026", 6, "site handover"),
  p("Quoting", "Provisional sums vs PC sums: how to show them so clients get it", "Two terms clients never understand, and a simple way to present both on a quote.", "Hannah Cole", "10 Sep 2026", 5, "worktop samples"),
  p("Running a team", "Daily site diaries your lads will actually fill in", "Three questions, one photo, done before the van leaves. Here's the template.", "Marcus Reid", "3 Sep 2026", 4, "site diary on phone"),
  p("Client experience", "What homeowners really read in your quote", "We looked at how clients scroll through 2,000 quotes. They skip more than you'd think.", "Hannah Cole", "27 Aug 2026", 7, "homeowner on sofa"),
  p("Product updates", "New: variations clients sign from their phone", "Capture changes on site with photos, get a signature in minutes, and bill it automatically.", "Builder OS team", "20 Aug 2026", 3, "variation screen"),
  p("Guides", "Setting your day rates for 2027", "A simple method for working out labour rates that actually cover your overheads.", "Tom Ashworth", "13 Aug 2026", 8, "calculator & notebook"),
  p("Cash flow", "Deposits: how much is fair, and how to ask for it", "Typical deposit sizes for UK renovation work, and how to explain yours without awkwardness.", "Priya Nair", "6 Aug 2026", 5, "signed contract"),
  p("Quoting", "Five lines every bathroom quote forgets", "Small items that turn a good margin into a break-even job. Add them to your library now.", "Marcus Reid", "30 Jul 2026", 4, "bathroom strip-out"),
  p("Running a team", "Hiring your first project manager", "When it makes sense, what to pay, and how to hand over without losing control.", "Tom Ashworth", "23 Jul 2026", 9, "team on site"),
  p("Client experience", "Weekly progress updates in ten minutes", "A Friday routine that keeps clients calm and cuts the \"just checking in\" calls.", "Hannah Cole", "16 Jul 2026", 4, "progress photos"),
  p("Product updates", "Service bundles are here", "Group the services you always quote together and drop them in as one line.", "Builder OS team", "9 Jul 2026", 2, "service library"),
  p("Guides", "Domestic reverse charge VAT, explained for renovators", "When it applies to your subcontractors, and how to show it on an invoice.", "Priya Nair", "2 Jul 2026", 6, "invoice close-up"),
];
