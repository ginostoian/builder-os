import { blogArticle } from "@/lib/content/articles";
import { LEGAL } from "@/lib/content/legal";
import {
  AnswerCapsule,
  ArticleCta,
  AuthorBio,
  Callout,
  Cite,
  DataTable,
  FaqList,
  Figure,
  In,
  References,
  TakeawayList,
  TocGrid,
  styles,
} from "@/components/blog/article-kit";

const article = blogArticle("buildertrend-uk");
const img = (file: string) => `/blog/images/${article.slug}/${file}`;

export default function BuildertrendUk() {
  return (
    <>
      <AnswerCapsule>
        You can use Buildertrend in the UK, but it’s built for American home builders. Third-party trackers put its plans at $299 to $1,099 a month, roughly £230 to £845
        at $1.30 to the pound, plus reported onboarding fees. It’s powerful for large design-and-build firms. CIS and domestic reverse charge VAT aren’t part of its feature
        set.
      </AnswerCapsule>

      <TakeawayList
        title="Key takeaways"
        items={[
          "Buildertrend doesn’t publish prices. It’s sold through a sales call and billed in US dollars.",
          "Estimated cost: about £2,800 to £10,100 a year before onboarding, so your bill moves with the exchange rate.",
          "It shines at scheduling, selections, change orders and client communication on big projects.",
          "UK essentials like CIS deductions and the domestic reverse charge aren’t in its feature list, so expect to handle them elsewhere.",
          "A US subscription is an imported service. VAT-registered firms account for it under the reverse charge.",
          "UK alternatives cost a fraction of the price and speak the language: variations, snagging, stage payments.",
        ]}
      />

      <TocGrid items={article.toc} />

      <h2 id="what-it-is" className={styles.h2}>
        What Buildertrend is, and who it’s built for
      </h2>
      <p className={styles.lead}>
        Buildertrend is a full construction management platform for residential builders and remodelers, based in Omaha, Nebraska. It covers estimates and proposals through
        scheduling, change orders, selections, budgets and a client portal. Its home market is American custom home builders.
      </p>
      <p className={styles.p}>
        The scale is real. Buildertrend holds 4.5 out of 5 from nearly 2,500 reviews on{" "}
        <Cite href="https://www.capterra.co.uk/reviews/70092/buildertrend">Capterra UK</Cite>, and third-party estimates put its revenue at around $170 million to $180 million a
        year. Few residential construction tools have had more years of development.
      </p>
      <p className={styles.p}>
        Picture its typical customer: a US firm building eight to twenty custom homes a year. Every house has hundreds of homeowner selections (tile, fixtures, cabinet
        finishes) tracked against allowances. A project manager runs a Gantt chart across a dozen subcontractor trades, and the client logs in weekly to approve change orders.
        For that firm, Buildertrend replaces a pile of separate systems.
      </p>
      <p className={styles.p}>
        A six-person London firm doing rear extensions and loft conversions looks different. The jobs are shorter, the selections fewer, the money moves in stages, and HMRC wants
        CIS returns every month. You can still use Buildertrend for that work. The question is whether it fits well enough to justify the price.
      </p>

      <h2 id="uk-availability" className={styles.h2}>
        Can you use Buildertrend in the UK?
      </h2>
      <p className={styles.lead}>
        Yes. Nothing stops a UK firm signing up, and some do. But pricing is set on a sales call and quoted in US dollars, the product speaks American construction English, and
        UK tax features are absent from its feature list.
      </p>
      <p className={styles.p}>
        Buildertrend doesn’t run a separate UK edition. You request a demo, a salesperson scopes your business, and you get a quote. Reviewers on{" "}
        <Cite href="https://www.getapp.co.uk/software/90403/buildertrend">GetApp UK</Cite> flag two consistent frustrations: the cost, and price increases at renewal. The
        upside of a sales-led process is real onboarding help. The downside is that you can’t compare prices without sitting through a call.
      </p>
      <p className={styles.p}>
        If you work across the UK, check the practical details before you commit. Ask when support is staffed in UK time, how dates and currency are formatted on client
        documents, and whether quotes can show VAT the way UK homeowners expect: a net total, VAT at 20% and a gross figure. Small mismatches like a dollar sign on a quote
        undermine the polish you’re paying for.
      </p>

      <h2 id="pricing" className={styles.h2}>
        Buildertrend pricing in pounds
      </h2>
      <p className={styles.lead}>
        At $1.30 to the pound, third-party estimates put Buildertrend at about £230 to £385 a month for its entry plan and up to around £845 for its top plan. That’s
        roughly £2,800 to £10,100 a year, before reported onboarding fees of £300 to £1,150.
      </p>
      <Figure
        src={img("buildertrend-pricing-in-pounds.png")}
        height={680}
        alt="Buildertrend monthly pricing converted to pounds at $1.30 per £1: entry plan $299 to $499, about £230 to £384; middle plan $499 to $799, about £384 to £615; top plan $829 to $1,099, about £638 to £845. For comparison, Builder OS Pro is £119 a month per company."
        caption="Third-party estimates of US list prices, converted at $1.30 per £1. Onboarding fees come on top. Buildertrend doesn’t publish its prices, so get a written quote."
      />
      <DataTable
        caption="Estimated from third-party trackers (Projul, CostBench, OneCrew), October 2026. Before VAT."
        head={["Plan (US naming)", "Per month (USD)", "Per month (GBP, est.)", "Per year (GBP, est.)"]}
        rows={[
          ["Entry (Essential)", "$299–$499", "£230–£384", "£2,760–£4,606"],
          ["Middle (Advanced)", "$499–$799", "£384–£615", "£4,606–£7,375"],
          ["Top (Complete)", "$829–$1,099", "£638–£845", "£7,652–£10,145"],
          ["Onboarding (one-off, reported)", "$400–$1,500", "£308–£1,154", "—"],
        ]}
      />

      <h3 id="exchange-rate" className={styles.h3}>
        Your bill moves with the exchange rate
      </h3>
      <p className={styles.p}>
        Paying in dollars means a 10% fall in sterling is a 10% price rise you didn’t agree to. On a $799 plan, the swing between $1.20 and $1.40 to the pound is about £95 a
        month, or more than £1,100 a year. Many business cards also add a foreign transaction fee of around 3%.
      </p>

      <h3 id="vat-on-us-software" className={styles.h3}>
        VAT on a US software subscription
      </h3>
      <p className={styles.p}>
        A US company selling software to a UK business doesn’t charge you UK VAT. Instead, if you’re VAT-registered, you account for it yourself under the reverse charge for
        services bought from abroad. You add output VAT and reclaim it as input VAT on the same return, so for most builders the net cost is zero. The catch is for firms{" "}
        <em>not</em> registered for VAT. The value of those imported services counts towards the £90,000 VAT registration threshold. HMRC’s{" "}
        <Cite href="https://www.gov.uk/guidance/vat-place-of-supply-of-services-notice-741a">place of supply guidance</Cite> covers the detail, and your accountant will want to
        know.
      </p>

      <h2 id="strengths" className={styles.h2}>
        What Buildertrend does brilliantly
      </h2>
      <p className={styles.lead}>
        Buildertrend is excellent at running complex projects with lots of moving parts. It handles detailed scheduling across many trades, homeowner selections against
        allowances, formal change orders and polished client communication. If those are your daily headaches, little else does it as well.
      </p>
      <p className={styles.p}>
        <strong>Scheduling.</strong> Gantt charts with dependencies, baselines and subcontractor notifications. When the steel is delayed three days, everything downstream moves
        and the trades are told. <strong>Selections and allowances.</strong> Clients choose finishes in a portal against budgets you set, and overspends flow automatically into
        change orders. This is where Buildertrend earns its fee on high-spec projects.
      </p>
      <p className={styles.p}>
        <strong>Client portal.</strong> Homeowners see photos, schedules, documents and approvals in one place. Reviewers consistently rate the customer support highly (4.7 out of
        5 on Capterra UK). <strong>Financials.</strong> Budgets, purchase orders, bills and accounting integrations give larger firms a proper job-cost picture.
      </p>
      <p className={styles.p}>
        If you’re a UK design-and-build firm running £500,000-plus projects with a selections-heavy client journey, those strengths can outweigh everything in the next
        section. Be honest about whether that describes your work, though. Most UK renovation firms use a fraction of what Buildertrend offers and pay for all of it.
      </p>

      <h2 id="uk-gaps" className={styles.h2}>
        Where Buildertrend falls short for UK builders
      </h2>
      <p className={styles.lead}>
        The gaps aren’t bugs. They come from a product built for the US. CIS deductions, the domestic reverse charge and UK construction vocabulary don’t feature, so UK firms
        end up running those in a spreadsheet next to an £800-a-month platform.
      </p>

      <h3 id="cis" className={styles.h3}>
        CIS deductions and monthly returns
      </h3>
      <p className={styles.p}>
        If you pay subcontractors, the Construction Industry Scheme means deducting 20% or 30% from their labour, filing a monthly CIS300 return by the 19th and issuing payment
        and deduction statements. We found no CIS handling in Buildertrend’s feature list. That leaves you calculating deductions elsewhere. Our free{" "}
        <In href="/tools/cis-calculator">CIS deduction calculator</In> does one invoice at a time, but you need something that does every payment, every month.
      </p>

      <h3 id="reverse-charge" className={styles.h3}>
        The domestic reverse charge
      </h3>
      <p className={styles.p}>
        Since March 2021, work you do as a subcontractor for another VAT-registered contractor usually falls under the{" "}
        <Cite href="https://www.gov.uk/guidance/vat-reverse-charge-technical-guide">VAT domestic reverse charge</Cite>. Your invoice shows no VAT and carries specific wording,
        and the customer accounts for it. Software that only knows “add tax” makes those invoices by hand. Check yours with our{" "}
        <In href="/tools/reverse-charge-vat-checker">reverse charge VAT checker</In>.
      </p>

      <h3 id="us-terms" className={styles.h3}>
        US construction vocabulary
      </h3>
      <Figure
        src={img("us-vs-uk-construction-terms.png")}
        height={780}
        alt="Translation table of US construction software terms to UK equivalents: change order means variation; punch list means snagging list; allowances means PC sums and provisional sums; draws or progress billing means stage payments; 1099 subcontractors means CIS subcontractors; sales tax means VAT; bid means quote or tender; remodel means renovation or refurbishment."
      />
      <p className={styles.p}>
        Your client will see “change order” where they expect “variation”, and “punch list” instead of “snagging list”. Some terms can be relabelled, and some can’t. Every
        mismatch is something you explain on the phone, and it chips away at the professional impression the software is supposed to create.
      </p>

      <h3 id="data-support" className={styles.h3}>
        Data, support and contracts
      </h3>
      <p className={styles.p}>
        Before signing, ask where your clients’ data is hosted and how international transfers are covered under UK GDPR. Ask when support is staffed in UK hours. Get the
        renewal terms in writing, because annual contracts and renewal price rises come up repeatedly in reviews.
      </p>

      <h2 id="who-fits" className={styles.h2}>
        Who in the UK Buildertrend actually suits
      </h2>
      <p className={styles.lead}>
        Buildertrend suits UK firms turning over £3 million or more, running large high-spec projects with heavy client selections and an in-house finance team that handles CIS
        separately. For a typical 3 to 15 person renovation firm it’s more platform, and more cost, than the work needs.
      </p>
      <Figure
        src={img("buildertrend-uk-fit-scorecard.png")}
        height={760}
        alt="Scorecard showing Buildertrend’s fit for UK firm types: strong fit for £3 million plus design-and-build firms with high-spec projects and heavy selections; possible fit for £1 million to £3 million firms with a finance team handling CIS; weak fit for 3 to 15 person renovation firms doing extensions, lofts and refurbishments; poor fit for sole traders and reactive repair businesses."
      />
      <p className={styles.p}>
        Run a quick test. Add up your projects from last year and divide your turnover by the number of jobs. If your average job is above £250,000 and clients make dozens of
        finish selections, book the demo. If your average is £25,000 to £80,000 (a single-storey rear extension, a dormer loft, a full kitchen-diner), you’ll use perhaps a fifth
        of the platform. At £5,000-plus a year, that fifth is expensive.
      </p>
      <p className={styles.p}>
        Also consider who runs the software. Buildertrend rewards a dedicated project coordinator who lives in it. In a firm where the director quotes on Sunday night and the
        office manager does everything else, a lighter tool that gets used every day beats a powerful one that gets used on Mondays.
      </p>

      <h2 id="alternatives" className={styles.h2}>
        Buildertrend alternatives for UK builders
      </h2>
      <p className={styles.lead}>
        The best Buildertrend alternative for most UK renovation firms is a UK-built tool priced in pounds. Builder OS is built for renovation firms with 3 to 15 people. Buildxact
        is strongest at estimating from drawings. JobTread is the closest US equivalent at a lower price, and Archdesk suits larger main contractors.
      </p>
      <DataTable
        caption="Prices before VAT, October 2026. Check current pricing with each vendor."
        head={["Tool", "Built in", "Price", "Best for", "Watch out for"]}
        rows={[
          ["Builder OS", "UK", "£49 or £119 a month per company", "Renovation firms, 3–15 people: quotes, variations, stage payments, CIS", "No Xero sync yet; no takeoffs"],
          ["Buildxact", "Australia (UK since 2022)", "£99–£179 a month", "Estimating and takeoffs from drawings", "Learning curve"],
          ["JobTread", "US", "From about $199 a month plus users (third-party estimate)", "US-style remodeler workflow at lower cost", "USD pricing, US terms"],
          ["Houzz Pro", "US", "From about £54 a month plus users", "Design-led kitchen and bath firms who want Houzz leads", "Billing and contract complaints"],
          ["Archdesk", "UK / Poland", "On request", "Main contractors from about £5m turnover", "Built for commercial contracting"],
        ]}
      />
      <p className={styles.p}>
        <strong>Builder OS</strong> (ours) covers the parts of Buildertrend a UK renovation firm uses daily: a spreadsheet-fast{" "}
        <In href="/features#quoting">quote builder</In>, client e-signatures, variations signed in the client portal,{" "}
        <In href="/features#payments">stage payments that invoice themselves</In>, CIS for subcontractors, a project board and a site app. It costs one price per company: £119 a
        month on Pro, or £1,428 a year, about the same as six months of Buildertrend’s entry plan. It doesn’t do Gantt dependencies or selections management at
        Buildertrend’s depth.
      </p>
      <p className={styles.p}>
        If you’re comparing quoting tools more broadly, our{" "}
        <In href="/blog/best-quoting-software-for-builders-uk">best quoting software for UK builders</In> guide covers nine options side by side.
      </p>

      <h2 id="checklist" className={styles.h2}>
        A UK compliance checklist for any US platform
      </h2>
      <p className={styles.lead}>
        Before you sign up to any American construction platform, check five UK requirements: CIS, the domestic reverse charge, Making Tax Digital, UK GDPR and the Consumer
        Contracts Regulations. If the software can’t handle one of them, you’ll be doing that job by hand.
      </p>
      <Figure
        src={img("uk-compliance-checklist-construction-software.png")}
        height={820}
        alt="UK compliance checklist for construction software: CIS deductions, monthly CIS300 returns and statements; domestic reverse charge VAT invoices; Making Tax Digital records and accounting software sync; UK GDPR data hosting, transfers and client data export; Consumer Contracts Regulations cancellation notice on quotes signed at home or online; quotes in sterling showing net, VAT at 20% and gross."
      />
      <p className={styles.p}>
        <strong>Making Tax Digital</strong> matters even for limited companies, because your VAT returns already go through MTD-compatible software. Sole traders earning over
        £50,000 have also kept digital records and sent quarterly updates for income tax since April 2026, and the threshold drops to £30,000 in April 2027. Whatever holds your
        invoices has to get them to your accountant cleanly.
      </p>
      <p className={styles.p}>
        <strong>Consumer Contracts Regulations</strong> catch out more builders than any software bug. A quote accepted at the client’s home, or online, usually gives them 14
        days to cancel. Leave out the cancellation information and that can stretch by up to 12 months. Whatever tool sends your quotes, make sure your terms carry the notice.
        The <Cite href="https://www.legislation.gov.uk/uksi/2013/3134/contents">regulations</Cite> are short enough to read in an evening.
      </p>
      <Callout title="Worth knowing:">
        Builder OS records the signer’s name, time, IP address and the exact quote version on every acceptance, and lets you export all your company’s data, or one client’s,
        whenever you like.
      </Callout>

      <TakeawayList
        title="Quick takeaways"
        items={[
          "Buildertrend works in the UK, but it’s priced in dollars and built around US practice.",
          "Budget about £2,800 to £10,100 a year plus onboarding, and expect it to move with the exchange rate.",
          "It’s worth it for large, selections-heavy design-and-build firms with a finance team.",
          "CIS and reverse-charge invoicing will happen outside it.",
          "UK renovation firms with 3 to 15 people usually get more from a UK tool at a fraction of the cost.",
        ]}
      />

      <h2 id="conclusion" className={styles.h2}>
        The bottom line
      </h2>
      <p className={styles.p}>
        Buildertrend is one of the most complete residential construction platforms anywhere, and its reviews show it. For a UK firm, though, price is only half the decision.
        The other half is fit. You’ll pay in dollars, through a sales process, for a product that calls variations change orders, doesn’t run your CIS, and assumes a project
        coordinator who lives in the software all day.
      </p>
      <p className={styles.p}>
        If you’re a large design-and-build firm with high-spec projects and a finance team, that trade can make sense. Book the demo and get the quote in writing. If you’re one
        of the thousands of UK firms doing £20,000 to £150,000 extensions, lofts and refurbs with a small office, you need the core of what Buildertrend does, done the UK way:
        quotes clients can sign, variations agreed before the work goes in, stage payments that invoice themselves, and CIS handled. That’s what Builder OS is for, at £119 a
        month for the whole company, with a Free plan to try it on a real job first.
      </p>

      <ArticleCta title="See the UK way of doing it" body="Price your next extension in Builder OS. Free plan, no card, no sales call." />

      <p className={styles.p}>
        <strong>Over to you:</strong> are you running Buildertrend from the UK? Tell us what works and what you work around at{" "}
        <a className={styles.link} href={`mailto:${LEGAL.supportEmail}`}>
          {LEGAL.supportEmail}
        </a>
        . We’ll fold the best insights into this guide.
      </p>

      <FaqList faqs={article.faqs} />
      <References items={article.references} />
      <AuthorBio author={article.author} />
    </>
  );
}
