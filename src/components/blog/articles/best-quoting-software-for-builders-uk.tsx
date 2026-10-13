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

const article = blogArticle("best-quoting-software-for-builders-uk");
const img = (file: string) => `/blog/images/${article.slug}/${file}`;

export default function BestQuotingSoftwareForBuildersUk() {
  return (
    <>
      <AnswerCapsule>
        For a UK renovation firm with 3 to 15 people, the best quoting software turns your price list into a signed quote, stage payments and invoices without retyping
        anything. Tradify and Powered Now suit reactive trade work at £28 to £40 per user a month. Buildxact and EstimatorXpress suit takeoff-heavy estimating. Builder OS
        charges £49 or £119 per company.
      </AnswerCapsule>

      <TakeawayList
        title="Key takeaways"
        items={[
          "Per-user pricing hides the real cost: six logins on a £37 per-user plan is £222 a month before VAT.",
          "Quoting tools split into two camps. Some are built for lots of small reactive jobs, others for big projects priced from drawings. Pick the one that matches how you work.",
          "For renovation work, variations and stage payments matter as much as the quote itself. Test both before you commit.",
          "A quote signed at the client’s kitchen table or through a link can carry a 14-day cancellation right. Your quote terms need to cover it.",
          "Run any trial on one real job you’re pricing this week, not on demo data.",
          "No tool on this list does everything. Takeoffs, certificates and accounting sync are where they differ most.",
        ]}
      />

      <TocGrid items={article.toc} />

      <h2 id="how-we-compared" className={styles.h2}>
        How we compared nine quoting tools
      </h2>
      <p className={styles.lead}>
        We looked at nine tools UK builders actually shortlist. We scored them on how a 3 to 15 person renovation firm quotes, not on how many features they list. One of them
        is ours, so we say where Builder OS isn’t the right choice too.
      </p>
      <p className={styles.p}>
        Most “best quoting software” lists ranking on Google are written by a vendor that puts itself first and buries the price comparison. We make Builder OS, so treat our
        enthusiasm for it with the same suspicion. I ran a UK home renovation company for 12 years before building it, so I’ve quoted, priced variations and
        chased stage payments the hard way. That’s the lens here, and we show our working. Prices below come from each vendor’s published pricing or UK listings on Capterra, GetApp
        and the Sage marketplace, checked in October 2026, and they’re shown before VAT. Where a vendor doesn’t publish UK prices we say so rather than guess.
      </p>
      <p className={styles.p}>We judged every tool against the same five questions:</p>
      <p className={styles.p}>
        <strong>1. How fast can you price a real extension?</strong> That means a 40-line quote with labour, materials, markup and a few provisional sums, built from your own
        rates. <strong>2. What does the client see?</strong> A PDF attachment, or a link they can read on a phone and sign? <strong>3. What happens after they say yes?</strong>{" "}
        Deposits, stage payments, variations and the final invoice. <strong>4. Does it understand UK money rules?</strong> VAT, CIS and the domestic reverse charge.{" "}
        <strong>5. What will a six-person firm actually pay?</strong>
      </p>
      <p className={styles.p}>
        That last question gets the least attention and changes the ranking the most. A tool that looks cheap for a sole trader can cost four times as much once the office
        manager, two site leads and an estimator all need a login.
      </p>

      <h2 id="what-to-look-for" className={styles.h2}>
        What quoting software must do for a UK renovation firm
      </h2>
      <p className={styles.lead}>
        Renovation quotes are long, change after they’re signed, and get paid in stages. Good builders quoting software handles all three. A tool built for one-visit callouts
        usually handles only the first.
      </p>
      <p className={styles.p}>
        A plumber quoting a boiler swap sends one price, does the job in a day and invoices once. You’re quoting a £68,000 rear extension that runs for eleven weeks, picks up
        six variations and gets paid in five instalments. The software has to handle that longer job.
      </p>

      <h3 id="speed-and-library" className={styles.h3}>
        Spreadsheet speed and a proper price list
      </h3>
      <p className={styles.p}>
        Most firms we speak to price in an Excel sheet they’ve refined for years. Any replacement has to be at least as quick: type a quantity, tab across, see the total move.
        It also needs a service library, so your rate for a square metre of block-and-beam floor sits in one place and drops into every quote. Check whether you can import your
        existing rates from a CSV. Retyping 300 rates is how trials die.
      </p>

      <h3 id="client-quote-and-signature" className={styles.h3}>
        A quote the client can read and sign on their phone
      </h3>
      <p className={styles.p}>
        Homeowners compare three quotes, usually on the sofa, usually on a phone. A clear link with sections, photos and an “accept” button beats a PDF that needs pinching and
        zooming. Electronic signatures are valid under English law. The{" "}
        <Cite href="https://lawcom.gov.uk/project/electronic-execution-of-documents/">Law Commission confirmed in 2019</Cite> that a typed name or a click can sign a contract
        when the person intends it to. What matters in a dispute is the record: who signed, when, and which version of the quote they saw.
      </p>

      <h3 id="variations-and-stages" className={styles.h3}>
        Variations and stage payments
      </h3>
      <p className={styles.p}>
        Look for a way to price a change on site, show the client photos and get their signature before the work goes in. Then check the money side: can you attach a payment
        plan to the quote (deposit, groundworks, watertight, completion) and raise each invoice from it in one click? Our{" "}
        <In href="/tools/retention-calculator">retention calculator</In> shows how much a 5% holdback ties up on a typical job. That money is easy to lose track of without a
        schedule.
      </p>

      <h3 id="uk-tax" className={styles.h3}>
        VAT, CIS and the domestic reverse charge
      </h3>
      <p className={styles.p}>
        US and Australian tools handle sales tax and GST well and UK rules less well. You need standard and reduced VAT rates, the{" "}
        <In href="/tools/reverse-charge-vat-checker">domestic reverse charge</In> for work you do for other VAT-registered contractors, and{" "}
        <In href="/tools/cis-calculator">CIS deductions</In> on what you pay subbies. If the tool can’t handle these, you’ll end up fixing the figures in a spreadsheet anyway.
      </p>

      <Figure
        src={img("quoting-software-checklist-uk-builders.png")}
        height={1000}
        alt="Checklist of eight things quoting software must do for a UK renovation firm: spreadsheet-speed pricing, a service library with CSV import, mobile quote links, e-signatures with an audit trail, variations signed by the client, stage payment plans, VAT, CIS and reverse charge handling, and full data export."
        caption="The eight checks we ran on every tool."
      />

      <h2 id="real-cost" className={styles.h2}>
        What it really costs: per-user vs per-company pricing
      </h2>
      <p className={styles.lead}>
        Most quoting software for builders charges per user, so the price climbs every time you hire. For a firm where six people need a login, monthly bills run from £49 to
        more than £800 before VAT, depending on the tool.
      </p>
      <p className={styles.p}>
        The headline price on a pricing page is usually for one person. Very few renovation firms are one person for long. Picture a typical six-person setup: you, an office
        manager, an estimator or second PM, and three site leads who need to log photos, timesheets and snags. Here’s what that team pays if everyone needs access.
      </p>

      <Figure
        src={img("quoting-software-monthly-cost-6-person-firm.png")}
        height={880}
        alt="Bar chart of monthly cost for a six-person UK building firm, excluding VAT: Builder OS Essentials £49, Builder OS Pro £119, Buildxact £99 to £179, Fergus about £160 to £230, Powered Now £168 to £240, Tradify £204 to £222, Buildertrend about £230 to £845."
        caption="Six logins, monthly, before VAT. Ranges show the vendor’s cheapest and most expensive plans. Buildertrend is converted from US dollars at $1.30 to £1; Fergus is estimated from Australian list prices."
      />

      <p className={styles.p}>
        Two things stand out. First, the per-user tools land within a few pounds of each other, around £200 a month for six people. The bill rises in steps as you grow, so
        hiring your seventh person costs you another £30 to £40 a month. Second, the platforms that charge per company or per tier (Builder OS, Buildxact) don’t punish you for
        giving site staff a login. That changes behaviour more than you’d think. When logins are free, the site team actually uses the app instead of sending photos on
        WhatsApp for someone in the office to file.
      </p>
      <p className={styles.p}>
        Then there are the hidden costs. Some platforms charge onboarding fees, and Buildertrend’s are reported at $400 to $1,500. Desktop estimating software like EstimatorXpress
        sells annual licences of £899 to £1,099 per seat. And every tool costs you the hours it takes to load your rates. Ask each vendor whether they import your price list for
        you.
      </p>

      <h2 id="the-tools" className={styles.h2}>
        The 9 best quoting software tools for UK builders
      </h2>
      <p className={styles.lead}>
        Here are the nine quoting software tools in rough order of fit for a 3 to 15 person renovation firm. Each one gets what it does best, who it suits, what it costs, and where it falls
        short.
      </p>

      <h3 id="builder-os" className={styles.h3}>
        1. Builder OS: best for renovation firms with 3 to 15 people
      </h3>
      <p className={styles.p}>
        Full disclosure: this is ours. We built Builder OS for firms doing extensions, lofts, kitchens and full refurbs. The quote builder is a spreadsheet-style grid fed by your{" "}
        <In href="/features#library">service library</In>, which you can import from Excel. Clients get a link they can read on a phone and sign with a typed signature. We record
        their name, the time, their IP address and the exact version they accepted. After that, the same quote drives everything else. You attach a payment plan, raise stage
        invoices from it, take card or bank payments, and send automatic reminders. Variations are priced on site, carry photos and get signed by the client in their portal.
      </p>
      <p className={styles.p}>
        <strong>Price:</strong> Free (3 quotes a month, 1 user), Essentials £49 or Pro £119 a month per company, plus VAT. <strong>Where it falls short:</strong> it’s new, so
        it has fewer reviews than the established names. It doesn’t do digital takeoffs from drawings, and it doesn’t sync with Xero yet. If you need gas or electrical
        certificates, look at Powered Now or YourTradebase.
      </p>

      <h3 id="tradify" className={styles.h3}>
        2. Tradify: best for reactive trade teams
      </h3>
      <p className={styles.p}>
        Tradify is the name that comes up most in UK trade circles, and for good reason. It’s easy to learn. It takes a job from quote to schedule to invoice cleanly, and its
        Xero and QuickBooks integrations are mature. You can invoice a percentage of an accepted quote, take deposits and add optional line items. It’s rated 4.7 out of 5 from
        152 reviews on <Cite href="https://www.capterra.co.uk/reviews/152413/tradify">Capterra UK</Cite>. The Access Group bought it in 2024.
      </p>
      <p className={styles.p}>
        <strong>Price:</strong> £34 to £37 per user a month on UK listings. <strong>Where it falls short:</strong> it’s built around high-volume jobs. Renovation builders find
        line-by-line quoting slower than a spreadsheet, and reviewers mention limited reporting and customisation. We compare it in detail in{" "}
        <In href="/blog/tradify-alternatives-for-builders">Tradify alternatives for builders</In>.
      </p>

      <h3 id="powered-now" className={styles.h3}>
        3. Powered Now: best low-cost UK option with certificates
      </h3>
      <p className={styles.p}>
        Powered Now is UK-built and has been around since 2013. It covers quotes, invoices, scheduling, digital forms and certificates, and connects to the main accounting
        packages. It claims more than 4,000 trade businesses and holds 4.7 out of 5 from 137 reviews on Capterra UK. For a small firm that also does compliance work, the forms
        alone can justify it.
      </p>
      <p className={styles.p}>
        <strong>Price:</strong> £28, £32 or £40 per user a month plus VAT. <strong>Where it falls short:</strong> the interface feels older than newer tools, and it’s shaped
        around smaller jobs rather than multi-stage projects.
      </p>

      <h3 id="yourtradebase" className={styles.h3}>
        4. YourTradebase: best for sole-trader builders
      </h3>
      <p className={styles.p}>
        YourTradebase started in 2010, when a builder and his web-developer cousin got fed up with paperwork. It still feels like it: simple quotes, jobs, invoices and
        certificates, with no clutter. Its 4.9 out of 5 rating is the highest here, though from a smaller pool of 59 reviews. <strong>Price:</strong> listed from about £31 a
        month. <strong>Where it falls short:</strong> growing teams outgrow it. There’s less depth on stage payments, variations and team management.
      </p>

      <h3 id="fergus" className={styles.h3}>
        5. Fergus: best for job costing
      </h3>
      <p className={styles.p}>
        Fergus came out of a New Zealand plumbing firm and is strongest at what happens after the quote. It tracks real-time job costs, work in progress, and what each job is
        actually making. It’s rated 4.6 out of 5 from 155 reviews, and reviewers praise its Xero link. <strong>Price:</strong> per user; Australian list prices of A$53 to A$75
        suggest roughly £27 to £38 per user in the UK, so ask for a UK quote. <strong>Where it falls short:</strong> reviewers mention a clumsy calendar and limited
        customisation. Its quoting is solid rather than fast.
      </p>

      <h3 id="buildxact" className={styles.h3}>
        6. Buildxact: best for takeoffs from drawings
      </h3>
      <p className={styles.p}>
        If you price new builds or big extensions from architect’s drawings, Buildxact’s digital takeoff saves real time. You measure walls, floors and roofs on screen and they
        flow into your estimate, backed by a supplier price catalogue. It launched in the UK in 2022. <strong>Price:</strong> £99 a month for estimating, £179 for Pro, on{" "}
        <Cite href="https://www.capterra.co.uk/software/173135/buildxact">Capterra UK</Cite>. <strong>Where it falls short:</strong> there’s a learning curve, and its UK price
        data is thinner than in its home market.
      </p>

      <h3 id="estimatorxpress" className={styles.h3}>
        7. EstimatorXpress: best for detailed bills of quantities
      </h3>
      <p className={styles.p}>
        EstimatorXpress, from Bristol-based HBXL, is the long-standing UK desktop estimating package. It has deep UK pricing libraries and outputs that quantity surveyors
        recognise. <strong>Price:</strong> roughly £899 to £1,099 a year per licence, or a one-off perpetual licence from about £1,999. <strong>Where it falls short:</strong>{" "}
        it estimates and stops there. There’s no client portal, no payment plans and no team app, and it has a real learning curve. Many firms pair it with something else for
        the rest.
      </p>

      <h3 id="houzz-pro" className={styles.h3}>
        8. Houzz Pro: best if you want Houzz leads and mood boards
      </h3>
      <p className={styles.p}>
        Houzz Pro bundles estimates, proposals, mood boards and a 3D floor planner with a profile on Houzz’s homeowner marketplace. Kitchen, bathroom and interiors firms like the
        visual side, and it’s rated 4.3 out of 5 from about 1,087 reviews. <strong>Price:</strong> listed from about £54 a month, with add-ons per user. <strong>Where it falls
        short:</strong> reviews repeatedly mention billing and contract disputes and patchy support. Read the cancellation terms before you sign an annual deal.
      </p>

      <h3 id="buildertrend" className={styles.h3}>
        9. Buildertrend: best for large design-and-build firms that want everything
      </h3>
      <p className={styles.p}>
        Buildertrend is the heavyweight of US residential construction software: estimates, proposals, Gantt schedules, selections, change orders, budgets and a client portal.
        It’s rated 4.5 out of 5 from nearly 2,500 reviews. <strong>Price:</strong> not published. Third-party trackers put it between $299 and $1,099 a month, plus onboarding.{" "}
        <strong>Where it falls short:</strong> it’s priced in dollars and written in US terms, and CIS isn’t part of its feature set. We cover it properly in{" "}
        <In href="/blog/buildertrend-uk">Buildertrend in the UK</In>.
      </p>

      <h2 id="comparison-table" className={styles.h2}>
        Quoting software compared side by side
      </h2>
      <p className={styles.lead}>
        The table puts the deciding factors in one place: price model, what clients see, stage payments and UK tax. Tick marks mean the feature is a core part of the product, not
        an add-on or a workaround.
      </p>
      <DataTable
        caption="Checked October 2026 from vendor sites and UK listings. Prices per month, before VAT."
        head={["Tool", "Price model", "Online acceptance", "Stage payments", "CIS / reverse charge", "Best for"]}
        rows={[
          ["Builder OS", "£0 / £49 / £119 per company", "✓ typed signature", "✓ payment plans", "CIS ✓", "Renovation firms, 3–15 people"],
          ["Tradify", "£34–£37 per user", "✓", "✓ % of quote", "Check in trial", "Reactive trade teams"],
          ["Powered Now", "£28–£40 per user", "✓", "Check in trial", "Check in trial", "Small UK trade firms, certificates"],
          ["YourTradebase", "From ~£31", "✓ optional signature", "Check in trial", "Check in trial", "Sole-trader builders"],
          ["Fergus", "Per user (~£27–£38)", "Check in trial", "Check in trial", "Check in trial", "Job costing"],
          ["Buildxact", "£99–£179", "✓", "Check in trial", "Check in trial", "Takeoffs from drawings"],
          ["EstimatorXpress", "£899–£1,099 a year per licence", "—", "—", "—", "Detailed UK estimating"],
          ["Houzz Pro", "From ~£54 + users", "✓", "Check in trial", "Check in trial", "Design-led kitchen and bath firms"],
          ["Buildertrend", "Unpublished, USD", "✓", "✓", "Not in feature list", "Large design-and-build"],
        ]}
      />
      <p className={styles.p}>
        “Check in trial” means we couldn’t confirm it from the vendor’s public pages. It doesn’t mean the feature is missing. Ask the vendor to show you a CIS deduction, a
        reverse-charge invoice and a three-stage payment plan on a real example. Tax features are where marketing pages and real software most often disagree.
      </p>

      <h2 id="which-fits" className={styles.h2}>
        Which quoting software fits your firm?
      </h2>
      <p className={styles.lead}>
        The right quoting software depends on job shape more than headcount. Lots of small reactive jobs point to Tradify, Powered Now or YourTradebase. Projects priced from drawings point to Buildxact
        or EstimatorXpress. Multi-week renovation work paid in stages points to Builder OS.
      </p>
      <Figure
        src={img("which-quoting-software-fits-your-firm.png")}
        height={820}
        alt="Decision guide for UK builders choosing quoting software: mostly reactive jobs under £5,000 points to Tradify, Powered Now or YourTradebase; projects priced from architect drawings point to Buildxact or EstimatorXpress; renovation projects of £15,000 to £150,000 paid in stages point to Builder OS; £1 million plus design-and-build points to Buildertrend."
      />
      <p className={styles.p}>
        Ask yourself three questions. <strong>What does a typical job look like?</strong> If most of your work is under £5,000 and done within a week, you want speed of
        scheduling and invoicing, not a deep quote builder. <strong>Where do you lose money today?</strong> If it’s in estimating (missed quantities, wrong takeoffs), buy an
        estimating tool. If it’s after the quote (unpriced extras, late final payments), buy something that handles variations and stage payments. <strong>Who else needs
        it?</strong> If only you will ever touch it, per-user pricing is fine. If the office and site need it too, price it for the whole team.
      </p>
      <p className={styles.p}>
        For most renovation firms the answer isn’t the most powerful tool. It’s the one your office manager will still be using in March. Ease of use beats feature count, every
        time.
      </p>

      <h2 id="cancellation-rule" className={styles.h2}>
        The 14-day cancellation rule most quoting tools ignore
      </h2>
      <p className={styles.lead}>
        When a homeowner accepts your quote in their own home, or through a link without meeting you at your premises, they usually get 14 days to cancel. Leave the cancellation
        information out and that window can stretch to a year. Your quoting software should make it easy to include.
      </p>
      <p className={styles.p}>
        This catches more builders than any software bug. Under the{" "}
        <Cite href="https://www.legislation.gov.uk/uksi/2013/3134/contents">Consumer Contracts Regulations 2013</Cite>, a contract agreed away from your business premises (an
        “off-premises” contract) or entirely at a distance (a quote accepted by email or link) gives a consumer a 14-day right to cancel. You must give them the cancellation
        information and a cancellation form before they’re bound. Skip that and the period extends by up to 12 months. A client who cancels inside that longer window may owe you
        nothing for the work already done.
      </p>
      <Figure
        src={img("consumer-contracts-14-day-cancellation-quotes.png")}
        height={700}
        alt="Flow chart of the Consumer Contracts Regulations for builders: a quote accepted at the client’s home or online gives the client 14 days to cancel; with cancellation information given, the window closes after 14 days; without it, the window extends by up to 12 months; to start work sooner, get the client’s express request in writing."
      />
      <p className={styles.p}>
        Want to start within the 14 days, because the skip is booked for Monday? Get the client’s express request in writing. If they then cancel, they pay a proportionate
        amount for the work done. Urgent repairs the client called you out for are treated differently. The{" "}
        <Cite href="https://www.citizensadvice.org.uk/consumer/getting-home-improvements-done/cancelling-building-or-decorating-work/">Citizens Advice guide</Cite> sets out
        the consumer side clearly; read it once, because that’s exactly what your client will read.
      </p>
      <Callout title="In Builder OS:">
        put your cancellation notice and model form in your standard quote terms (Settings → Company), so every quote link carries it. Each acceptance records the signer, time,
        IP address and the version they saw.
      </Callout>

      <h2 id="trial-script" className={styles.h2}>
        How to test quoting software on one real job
      </h2>
      <p className={styles.lead}>
        Quoting software trials fail when you click around demo data. Pick a job you’re pricing this week and push it all the way through, from rates to a signed quote to a deposit invoice.
        It takes about 30 minutes and tells you more than any sales demo.
      </p>
      <p className={styles.p}>
        <strong>Minutes 0 to 10: load your rates.</strong> Import 20 to 30 of the rates you use most from your spreadsheet. If importing is painful now, it’ll be painful
        forever. <strong>Minutes 10 to 20: build the quote.</strong> Group it how you’ll build it: strip-out, groundworks, structure, first fix, second fix, finishes. Add one
        provisional sum. Set your markup, and use our <In href="/tools/markup-margin-calculator">markup vs margin calculator</In> if you’re unsure which figure you’re actually
        setting.
      </p>
      <p className={styles.p}>
        <strong>Minutes 20 to 25: send it to yourself.</strong> Open it on your phone, as your client would. Is it readable without zooming? Can you accept it in under a minute?{" "}
        <strong>Minutes 25 to 30: get paid.</strong> Attach a payment plan, raise the deposit invoice and pay it with a test card. Then price a variation and sign it on your
        phone.
      </p>
      <p className={styles.p}>
        Score each step out of five. Any tool that can’t do all four steps without a support call isn’t the one. If you’d rather compare against a blank page first, our free{" "}
        <In href="/tools/builders-quote-template">builder’s quote template</In> gives you a baseline layout.
      </p>

      <h2 id="switching-mistakes" className={styles.h2}>
        Five mistakes builders make when switching from Excel
      </h2>
      <p className={styles.lead}>
        Most switches to new quoting software fail for avoidable reasons: moving mid-job, rebuilding every rate at once, or buying for the business you hope to be in five years. Avoid these five and
        you’ll still be using the tool in a year.
      </p>
      <p className={styles.p}>
        <strong>Switching mid-job.</strong> Run live jobs to completion in your old system, and put every new quote into the new one. Within three months the old system goes
        quiet on its own. <strong>Rebuilding the whole price list on day one.</strong> Import your top 50 rates, then add the rest as they come up on real quotes.
      </p>
      <p className={styles.p}>
        <strong>Buying for the firm you’ll be in five years.</strong> A platform built for a £20 million contractor will slow a six-person firm down. You can move up later;
        your data should come with you. Check the export before you sign up. <strong>Leaving the office manager out.</strong> They’ll use it more than you, so let them run
        the trial. <strong>Ignoring the client side.</strong> The software your client sees is part of your sales pitch. A clean, signable quote link makes a firm look
        established before anyone has met you.
      </p>

      <TakeawayList
        title="Quick takeaways"
        items={[
          "Choose by job shape: reactive work, drawing-led estimating or staged renovation projects.",
          "Price the software for your whole team, not one login.",
          "Check variations, stage payments and CIS in the trial, not just the quote builder.",
          "Put your Consumer Contracts cancellation notice into your standard quote terms.",
          "Trial it on a live job and let your office manager make the final call.",
          "Make sure you can export everything before you commit.",
        ]}
      />

      <h2 id="conclusion" className={styles.h2}>
        The bottom line
      </h2>
      <p className={styles.p}>
        There is no single best quoting software for builders in the UK, only the best fit for how your firm wins and runs work. If you do lots of small reactive jobs, Tradify
        and Powered Now are proven, affordable and easy to learn. If you estimate from drawings, Buildxact or EstimatorXpress will pay for themselves in saved hours. If you run
        a design-and-build operation turning over several million, Buildertrend has the depth, at a price to match.
      </p>
      <p className={styles.p}>
        Most of the firms we talk to sit in between: three to fifteen people doing extensions, lofts and refurbs worth £15,000 to £150,000, quoting in a spreadsheet and
        chasing stage payments by text. That’s the firm we built Builder OS for. It gives you one quote that becomes the contract, the variations, the stage invoices and the
        payment reminders, at one price for the whole company. If that sounds like you, price your next real job in it. The Free plan needs no card, and if it doesn’t beat
        your spreadsheet you’ve lost half an hour.
      </p>

      <ArticleCta title="Price your next job in Builder OS" body="Free plan, no card. Import your rates from Excel and send a signable quote in under half an hour." />

      <p className={styles.p}>
        <strong>Over to you:</strong> what are you quoting in right now, and what would make you switch? Tell us at{" "}
        <a className={styles.link} href={`mailto:${LEGAL.supportEmail}`}>
          {LEGAL.supportEmail}
        </a>
        . We read every reply, and the best answers end up shaping this guide.
      </p>

      <FaqList faqs={article.faqs} />
      <References items={article.references} />
      <AuthorBio author={article.author} />
    </>
  );
}
