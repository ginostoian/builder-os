/**
 * Long-form blog articles that have a real body. This file is plain data (titles, dates, contents, FAQs,
 * sources), so the blog index, the sitemap and structured data can use it without pulling in the article
 * bodies, which live in src/components/blog/articles/{slug}.tsx.
 */
import type { BlogCategory } from "./blog";

export type BlogAuthor = {
  name: string;
  initials: string;
  role: string;
  /** Follows the name in the byline at the end of an article. */
  bio: string;
  /** One sentence for structured data. */
  description: string;
};

export type BlogArticle = {
  slug: string;
  /** The H1. */
  title: string;
  /** The <title>; " · Builder OS" is added, so keep this under about 47 characters. */
  seoTitle: string;
  /** Meta description, about 150–155 characters. */
  description: string;
  /** One or two sentences under the H1 and on cards. */
  excerpt: string;
  category: BlogCategory;
  /** Primary keyword first, then secondary keywords. */
  keywords: string[];
  author: BlogAuthor;
  /** ISO dates. */
  published: string;
  modified: string;
  readMins: number;
  /** The first infographic doubles as the card and social image. */
  hero: { src: string; alt: string; width: number; height: number };
  toc: { id: string; label: string }[];
  faqs: { q: string; a: string }[];
  references: { title: string; url: string; publisher?: string }[];
};

const GINO: BlogAuthor = {
  name: "Gino Stoian",
  initials: "GS",
  role: "Founder, Builder OS · 12 years running a UK renovation company",
  bio: "ran a UK home renovation company for 12 years before founding Builder OS, the software he wished he’d had. He writes about quoting, pricing and getting paid.",
  description: "Gino Stoian ran a UK home renovation company for 12 years before founding Builder OS.",
};

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: "best-quoting-software-for-builders-uk",
    title: "Best Quoting Software for UK Builders (2026)",
    seoTitle: "Best Quoting Software for Builders UK (2026)",
    description: "Nine quoting tools for UK builders compared on real costs for a 6-person team, e-signatures, variations, stage payments, CIS and VAT. Checked October 2026.",
    excerpt: "Nine tools compared on what a 3–15 person renovation firm actually needs, with what each one costs your whole team, not just one login.",
    category: "Choosing software",
    keywords: ["best quoting software for builders uk", "builders quoting software", "quoting app for builders", "estimating software uk"],
    author: GINO,
    published: "2026-10-12",
    modified: "2026-10-12",
    readMins: 17,
    hero: {
      src: "/blog/images/best-quoting-software-for-builders-uk/quoting-software-monthly-cost-6-person-firm.png",
      alt: "Monthly cost of quoting software for a six-person UK building firm, from £49 to about £845 before VAT",
      width: 1200,
      height: 880,
    },
    toc: [
      { id: "how-we-compared", label: "How we compared nine tools" },
      { id: "what-to-look-for", label: "What quoting software must do" },
      { id: "real-cost", label: "What it really costs" },
      { id: "the-tools", label: "The 9 best quoting tools" },
      { id: "comparison-table", label: "Side-by-side comparison" },
      { id: "which-fits", label: "Which one fits your firm" },
      { id: "cancellation-rule", label: "The 14-day cancellation rule" },
      { id: "trial-script", label: "Test it on one real job" },
      { id: "switching-mistakes", label: "Five switching mistakes" },
      { id: "conclusion", label: "The bottom line" },
      { id: "faqs", label: "FAQs" },
    ],
    faqs: [
      {
        q: "What is the best quoting app for builders in the UK?",
        a: "It depends on your work. Tradify and Powered Now suit reactive trade jobs, Buildxact and EstimatorXpress suit estimating from drawings, and Builder OS suits renovation firms of 3 to 15 people whose jobs run for weeks and are paid in stages.",
      },
      {
        q: "Is there free quoting software for builders?",
        a: "Builder OS has a Free plan with 3 quotes a month, the spreadsheet quote builder, a 25-item service library and client quote links, with no card needed. Most other tools offer a 14-day free trial rather than a free plan.",
      },
      {
        q: "How much does quoting software for builders cost in the UK?",
        a: "Per-user tools such as Tradify and Powered Now cost £28 to £40 per user a month, so about £170 to £240 for six people. Builder OS costs £49 or £119 per company. Buildxact is £99 to £179 a month, and Buildertrend is estimated at £230 to £845 a month. All prices are before VAT.",
      },
      {
        q: "Can I import my Excel price list into quoting software?",
        a: "Most tools import a CSV file, which Excel and Google Sheets can save. Import your 50 most-used rates first and add the rest as they come up on real quotes. Ask the vendor to do the import for you during the trial.",
      },
      {
        q: "Are quotes signed online legally binding in the UK?",
        a: "Yes. In 2019 the Law Commission confirmed that electronic signatures, including a typed name or a click to accept, can validly sign a contract in England and Wales when the person intends to sign. Keep a record of who signed, when, and which version they accepted.",
      },
      {
        q: "Do builders need a cancellation notice on quotes?",
        a: "Usually, for homeowners. A quote accepted at the client’s home or online is normally an off-premises or distance contract under the Consumer Contracts Regulations 2013, which gives a 14-day cancellation right. Without the cancellation information, that period can extend by up to 12 months.",
      },
      {
        q: "What is the difference between quoting software and estimating software?",
        a: "Estimating software works out quantities and costs, often from drawings. Quoting software turns those costs into a priced document the client accepts, then usually handles what follows: variations, payment plans and invoices.",
      },
    ],
    references: [
      { title: "Electronic execution of documents", url: "https://lawcom.gov.uk/project/electronic-execution-of-documents/", publisher: "Law Commission" },
      { title: "The Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013", url: "https://www.legislation.gov.uk/uksi/2013/3134/contents", publisher: "legislation.gov.uk" },
      { title: "Cancelling building or decorating work", url: "https://www.citizensadvice.org.uk/consumer/getting-home-improvements-done/cancelling-building-or-decorating-work/", publisher: "Citizens Advice" },
      { title: "Tradify reviews", url: "https://www.capterra.co.uk/reviews/152413/tradify", publisher: "Capterra UK" },
      { title: "Buildxact pricing and reviews", url: "https://www.capterra.co.uk/software/173135/buildxact", publisher: "Capterra UK" },
    ],
  },
  {
    slug: "tradify-alternatives-for-builders",
    title: "Tradify Alternatives for UK Builders (2026)",
    seoTitle: "Tradify Alternatives for UK Builders (2026)",
    description: "Six Tradify alternatives for UK builders, with costs at 2, 6 and 12 users, when to stay, and a four-week plan to switch without losing a job.",
    excerpt: "Why builders leave Tradify, when they shouldn’t, and six alternatives priced for real team sizes, plus a four-week plan to switch safely.",
    category: "Choosing software",
    keywords: ["tradify alternative", "tradify pricing", "tradify vs powered now"],
    author: GINO,
    published: "2026-10-12",
    modified: "2026-10-12",
    readMins: 13,
    hero: {
      src: "/blog/images/tradify-alternatives-for-builders/tradify-vs-alternatives-cost-by-team-size.png",
      alt: "Tradify vs alternatives: monthly cost at 2, 6 and 12 users before VAT",
      width: 1200,
      height: 860,
    },
    toc: [
      { id: "why-leave", label: "Why builders look for an alternative" },
      { id: "when-to-stay", label: "When Tradify is still right" },
      { id: "cost-by-team-size", label: "Cost at 2, 6 and 12 users" },
      { id: "alternatives", label: "The 6 best alternatives" },
      { id: "at-a-glance", label: "At a glance" },
      { id: "how-to-choose", label: "How to choose" },
      { id: "switching", label: "Switching in four weeks" },
      { id: "questions", label: "Five questions before you cancel" },
      { id: "conclusion", label: "The bottom line" },
      { id: "faqs", label: "FAQs" },
    ],
    faqs: [
      {
        q: "What is the cheapest alternative to Tradify in the UK?",
        a: "For one or two users, Powered Now (from £28 per user a month) and YourTradebase (from about £31 a month) cost less. From four users up, Builder OS Pro at £119 per company, or Essentials at £49, works out cheaper because it isn’t priced per user.",
      },
      {
        q: "How much does Tradify cost per user in the UK?",
        a: "UK listings show Tradify at £34 per user a month for Lite and £37 for Pro, before VAT, with lower per-user rates sometimes listed for larger teams. Check Tradify’s own pricing page for the current figure.",
      },
      {
        q: "Can I export my data from Tradify?",
        a: "Yes. Tradify’s help centre explains how to export all price list items as a CSV and download reports as CSV files. Export your price list and customers, and save PDFs of open quotes and unpaid invoices, before you cancel.",
      },
      {
        q: "Is there a Tradify alternative without per-user pricing?",
        a: "Yes. Builder OS charges one price per company: £49 a month on Essentials or £119 on Pro, plus VAT, whatever the size of your team. YourTradebase also lists flat monthly pricing for smaller firms.",
      },
      {
        q: "Does Tradify work for building and renovation companies?",
        a: "It works, especially for short jobs invoiced once. It can invoice a percentage of an accepted quote and take deposits. Firms doing long, multi-stage renovations often want faster spreadsheet-style quoting, client-signed variations and per-company pricing.",
      },
      {
        q: "Who owns Tradify?",
        a: "The Access Group, a UK business software company, agreed to buy Tradify in October 2024. At the time Tradify had around 20,000 trade customers across the UK, New Zealand and Australia.",
      },
    ],
    references: [
      {
        title: "The Access Group has entered into an agreement to acquire Tradify",
        url: "https://www.theaccessgroup.com/en-gb/about/news/the-access-group-has-entered-into-an-agreement-to-acquire-best-in-class-job-management-platform-tradify/",
        publisher: "The Access Group",
      },
      { title: "Tradify reviews", url: "https://www.capterra.co.uk/reviews/152413/tradify", publisher: "Capterra UK" },
      { title: "Invoicing software", url: "https://tradifyhq.com/uk/features/invoicing-software", publisher: "Tradify" },
      { title: "Price lists (help centre)", url: "https://help.tradifyhq.com/hc/en-us/sections/360002650893-Price-Lists", publisher: "Tradify" },
    ],
  },
  {
    slug: "buildertrend-uk",
    title: "Buildertrend UK: Is It Worth It for British Builders?",
    seoTitle: "Buildertrend UK: Pricing, Fit and Alternatives",
    description: "Can UK builders use Buildertrend? Estimated pricing in pounds, VAT on a US subscription, the CIS and reverse charge gap, who it suits, and UK alternatives.",
    excerpt: "Buildertrend’s pricing converted to pounds, what it does brilliantly, where it falls short on UK tax and terms, and which British firms it actually suits.",
    category: "Choosing software",
    keywords: ["buildertrend uk", "buildertrend alternative", "buildertrend pricing"],
    author: GINO,
    published: "2026-10-12",
    modified: "2026-10-12",
    readMins: 13,
    hero: {
      src: "/blog/images/buildertrend-uk/buildertrend-pricing-in-pounds.png",
      alt: "Buildertrend pricing converted to pounds at $1.30 per £1, from about £230 to £845 a month",
      width: 1200,
      height: 680,
    },
    toc: [
      { id: "what-it-is", label: "What Buildertrend is" },
      { id: "uk-availability", label: "Can you use it in the UK?" },
      { id: "pricing", label: "Pricing in pounds" },
      { id: "strengths", label: "What it does brilliantly" },
      { id: "uk-gaps", label: "Where it falls short in the UK" },
      { id: "who-fits", label: "Who it actually suits" },
      { id: "alternatives", label: "UK alternatives" },
      { id: "checklist", label: "UK compliance checklist" },
      { id: "conclusion", label: "The bottom line" },
      { id: "faqs", label: "FAQs" },
    ],
    faqs: [
      {
        q: "Is Buildertrend available in the UK?",
        a: "Yes, UK firms can sign up, but there is no separate UK edition. Pricing is agreed on a sales call and billed in US dollars, and the product uses US construction terms and tax assumptions.",
      },
      {
        q: "How much does Buildertrend cost in pounds?",
        a: "Buildertrend doesn’t publish prices. Third-party trackers put its plans at $299 to $1,099 a month, about £230 to £845 at $1.30 to the pound, plus reported onboarding fees of $400 to $1,500. That’s roughly £2,800 to £10,100 a year.",
      },
      {
        q: "Does Buildertrend handle CIS for UK subcontractors?",
        a: "CIS isn’t part of Buildertrend’s published feature set, so UK firms usually work out CIS deductions, monthly CIS300 returns and subcontractor statements in separate software or with their accountant.",
      },
      {
        q: "What is the best Buildertrend alternative for UK builders?",
        a: "For renovation firms of 3 to 15 people, a UK tool such as Builder OS (£49 or £119 a month per company) covers quoting, variations, stage payments and CIS. Buildxact suits estimating from drawings, and Archdesk suits larger main contractors.",
      },
      {
        q: "Do I pay VAT on a Buildertrend subscription?",
        a: "A US supplier won’t charge UK VAT. If you’re VAT-registered, you account for it under the reverse charge, usually at no net cost. If you aren’t registered, the subscription counts towards the £90,000 registration threshold.",
      },
      {
        q: "What do UK builders call a change order?",
        a: "A variation. Other US terms map across too: a punch list is a snagging list, allowances are PC or provisional sums, and draws or progress billing are stage payments.",
      },
    ],
    references: [
      { title: "Buildertrend reviews", url: "https://www.capterra.co.uk/reviews/70092/buildertrend", publisher: "Capterra UK" },
      { title: "Buildertrend pricing, features and reviews", url: "https://www.getapp.co.uk/software/90403/buildertrend", publisher: "GetApp UK" },
      { title: "Place of supply of services (VAT Notice 741A)", url: "https://www.gov.uk/guidance/vat-place-of-supply-of-services-notice-741a", publisher: "HMRC" },
      { title: "VAT domestic reverse charge technical guide", url: "https://www.gov.uk/guidance/vat-reverse-charge-technical-guide", publisher: "HMRC" },
      { title: "The Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013", url: "https://www.legislation.gov.uk/uksi/2013/3134/contents", publisher: "legislation.gov.uk" },
    ],
  },
];

export const blogArticlePath = (slug: string) => `/blog/${slug}`;

export function findBlogArticle(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((a) => a.slug === slug);
}

/** For article bodies, which always exist in the list. */
export function blogArticle(slug: string): BlogArticle {
  const article = findBlogArticle(slug);
  if (!article) throw new Error(`Unknown blog article: ${slug}`);
  return article;
}
