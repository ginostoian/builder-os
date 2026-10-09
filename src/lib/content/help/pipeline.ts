import type { HelpArticle } from "./types";

export const PIPELINE_ARTICLES: HelpArticle[] = [
  {
    slug: "pipeline",
    title: "Your sales pipeline",
    summary: "Every enquiry in one place, from the first phone call to won or lost, so no job slips through the cracks.",
    category: "pipeline",
    plan: "pro",
    who: "Admins, the office and estimators",
    keywords: ["sales", "enquiries", "board", "kanban", "stages", "won", "lost", "crm"],
    body: [
      {
        type: "p",
        text: "The [Pipeline](/app/pipeline) holds every enquiry (we call them leads) from the moment someone asks about work until you win the job or lose it. It shows at a glance who needs a call, who's waiting on a quote, and how much work is in the pot.",
      },
      { type: "h", text: "The stages" },
      { type: "p", text: "Each lead sits in one stage. Each column on the board shows a hint about what usually happens next." },
      {
        type: "list",
        items: [
          "**New enquiry**: call them back. The first to reply usually wins.",
          "**Contacted**: you've spoken. Book a site visit.",
          "**Site visit**: measure up, then start the quote.",
          "**Quoting**: finish and send the quote.",
          "**Quote sent**: follow up until they decide.",
          "**Won** and **Lost**: the job is closed, one way or the other.",
        ],
      },
      {
        type: "p",
        text: "Some moves happen on their own. Sending a quote that started from a lead moves it to Quote sent. When the client accepts, it moves to Won; if they decline, it moves to Lost with the reason \"Declined the quote\".",
      },
      { type: "h", text: "Board, List and Insights" },
      {
        type: "list",
        items: [
          "**Board**: a column for each open stage, with the value of the work in it. Won and Lost show leads closed in the last 30 days. Drag a card to move it.",
          "**List**: a table of every lead with stage, source, owner, next step, quote and value. Filter by stage with the buttons along the top.",
          "**Insights**: where your work comes from and what wins it. See [Pipeline insights](/help/pipeline-insights).",
        ],
      },
      {
        type: "p",
        text: "Tap **Mine** to see only the leads you own. The search box finds leads by name, email, phone or postcode.",
      },
      { type: "h", text: "Moving a lead" },
      {
        type: "p",
        text: "Drag a card to another column on the board, or open the lead and click a stage on the track at the top. Two moves ask for a detail first: dropping on **Site visit** opens the visit booking (you can also choose **Move without a date**), and **Lost** asks why.",
      },
      {
        type: "tip",
        text: "Admins and the office also see buttons for the **Web form**, **Online booking** and **Automations** at the top of the pipeline. Those three are where you set up enquiries coming in and follow-ups going out on their own.",
      },
      {
        type: "note",
        text: "The pipeline is part of the Pro plan. Site leads and employees don't see it, though a site lead can still own a lead or go on survey visits.",
      },
    ],
    related: ["leads", "follow-ups", "pipeline-insights", "automations", "building-a-quote"],
  },
  {
    slug: "leads",
    title: "Adding and working a lead",
    summary: "Add a lead, give it an owner, keep notes and calls, email them, and turn it into a client and a quote.",
    category: "pipeline",
    plan: "pro",
    who: "Admins, the office and estimators",
    keywords: ["new lead", "enquiry", "owner", "notes", "log a call", "start a quote", "lost reason", "delete lead"],
    body: [
      {
        type: "p",
        text: "A lead is anyone who's asked about work: a phone call, a referral from a past client, a message on Facebook. Each one has its own page with their details, what's next and everything that's happened.",
      },
      { type: "h", text: "Adding a lead" },
      {
        type: "steps",
        items: [
          "Go to [Pipeline](/app/pipeline) and click **Add lead** (or use the New menu in the top bar).",
          "Enter their **Name**. A name and a number is enough to start.",
          "Add what you know: **Phone**, **Email**, **Postcode**, **The work** (say \"Loft conversion\"), a **Rough value**, **Details**, **Budget**, and **Where they came from**, with a **Source detail** such as who referred them.",
          "Choose the **Owner**: the person chasing it. You're picked by default.",
          "Click **Add lead**. The lead's page opens.",
        ],
      },
      {
        type: "p",
        text: "Every new lead gets a \"Call back\" follow-up for today, so nobody forgets. The owner gets a notification when a lead is given to them.",
      },
      {
        type: "tip",
        text: "Add their email address if you can. Automatic follow-up emails need it, and the owner's first name is how those emails sign off.",
      },
      { type: "h", text: "On the lead's page" },
      {
        type: "list",
        items: [
          "**Note**, **Log a call** and **Email**: write a note, record what you talked about, or send them an email. Everything lands in the **History**, newest first.",
          "**Next step**: what to do next and when. See [Follow-ups](/help/follow-ups).",
          "**Survey visit**: book, move or cancel their site visit, or copy their booking link.",
          "**Quote**: start their quote from here.",
          "**Automatic emails**: which automations are running for them, how many emails have gone, and when the next one is due.",
          "**Edit details** changes their details or owner. The bin button deletes the lead and its history; their client record and quote (if any) stay.",
        ],
      },
      { type: "h", text: "Turning a lead into a client and a quote" },
      {
        type: "p",
        text: "Click **Start a quote** on the Quote card. Builder OS makes a client record from the lead's details (if there isn't one already), opens a new draft quote for them, and moves the lead to Quoting. When you send that quote, the lead moves to Quote sent, and any follow-up automations for that stage start on their own.",
      },
      { type: "h", text: "Marking a lead as lost" },
      {
        type: "p",
        text: "Click **Lost** and pick a reason: Price too high, Went with someone else, Timing didn't work, Stopped replying, Not a job for us, or Other. Add a note if it helps (\"went with a firm £4k cheaper\"), then click **Mark as lost**. Any upcoming site visit comes out of the diary. The reasons add up on the [Insights](/help/pipeline-insights) view.",
      },
      {
        type: "note",
        text: "Won and lost leads have nothing left to chase, so their next step is cleared.",
      },
    ],
    related: ["pipeline", "follow-ups", "building-a-quote", "clients", "search-and-new-menu"],
  },
  {
    slug: "follow-ups",
    title: "Follow-ups and next steps",
    summary: "Give every lead a next step and a date, and see who needs chasing today.",
    category: "pipeline",
    plan: "pro",
    who: "Admins, the office and estimators",
    keywords: ["call back", "chase", "reminder", "overdue", "next action", "due today"],
    body: [
      {
        type: "p",
        text: "Most jobs are won by whoever keeps in touch. A next step on each lead (\"Call back\", \"Chase the quote\") with a date means nothing goes cold just because you were busy on site.",
      },
      { type: "h", text: "Setting a next step" },
      {
        type: "steps",
        items: [
          "Open the lead from the [Pipeline](/app/pipeline).",
          "In the **Next step** card, type what needs doing, for example \"Chase the quote\".",
          "Tap a quick pick: **Today**, **Tomorrow**, **In 3 days**, **Next week** or **In 2 weeks**. Or choose a date and click **Set**.",
        ],
      },
      { type: "p", text: "To clear it, click the cross next to **Set**." },
      { type: "h", text: "Seeing what's due" },
      {
        type: "list",
        items: [
          "At the top of the pipeline, a panel lists follow-ups due today or overdue. Overdue ones show in red, with the date they were due.",
          "Each card on the board shows its next step and date: amber when it's today, red when it's overdue.",
          "The List view has a **Next** column with the same colours.",
          "Your home page shows **Follow-ups due** too.",
          "Tap **Mine** to see only the follow-ups for leads you own.",
        ],
      },
      { type: "h", text: "Good to know" },
      {
        type: "list",
        items: [
          "Every new lead starts with \"Call back\" for today.",
          "When a client cancels their own survey visit online, the lead gets \"Rebook the site visit\" for today.",
          "Won and lost leads have their next step cleared, because there's nothing left to chase.",
        ],
      },
      {
        type: "tip",
        text: "Pair next steps with [automations](/help/automations). The automatic emails keep in touch, and your follow-ups remind you when it's time to pick up the phone.",
      },
    ],
    related: ["leads", "pipeline", "automations", "notifications"],
  },
  {
    slug: "web-enquiry-form",
    title: "Your web enquiry form",
    summary: "A form for your website that drops every enquiry straight into your pipeline as a new lead.",
    category: "pipeline",
    plan: "pro",
    who: "Admins and the office",
    keywords: ["website", "contact form", "embed", "iframe", "enquiry link", "get a quote form"],
    body: [
      {
        type: "p",
        text: "The web enquiry form gives you a ready-made \"Tell us about your project\" page. Link to it or put it on your website, and every enquiry lands in your pipeline with its details, any time of day.",
      },
      { type: "h", text: "Turning it on" },
      {
        type: "steps",
        items: [
          "Go to [Pipeline](/app/pipeline) and click **Web form**.",
          "Click **Turn on the enquiry form**.",
          "Copy the **Link to the form** with **Copy**, or click **Open** to see it as your customers will.",
        ],
      },
      {
        type: "p",
        text: "Put the link anywhere people find you: your website, your Google profile, your Facebook page or your email signature.",
      },
      { type: "h", text: "Putting it on your website" },
      {
        type: "p",
        text: "Under **Embed it on your website**, click **Copy** and paste the code into your web page's HTML, where you want the form to appear. The embedded version leaves out your logo and heading, so it sits neatly inside your own page. If someone else looks after your website, just send them the code.",
      },
      { type: "h", text: "What the form asks" },
      {
        type: "p",
        text: "Their name, email and phone, what the work is, the postcode of the property, a few words about the job, a rough budget and how they heard about you. On the link version, your company name or logo shows at the top.",
      },
      { type: "h", text: "What happens with an enquiry" },
      {
        type: "list",
        items: [
          "It appears in your pipeline as a New enquiry, with the source **Website form** and a follow-up for today. How they heard about you is saved as the source detail.",
          "Admins and the office get an email straight away. Reply to that email to answer the customer directly.",
          "If you've switched on the **Reply to new enquiries** [automation](/help/automations), they get a thank-you at once.",
          "If you take [survey bookings online](/help/online-survey-booking) and have times free in their area, they see a **Book your free survey** button straight after sending.",
        ],
      },
      { type: "h", text: "Changing or turning off the form" },
      {
        type: "p",
        text: "**New link** gives the form a fresh address. The old link, and any embed using it, stops working, so update your website too. **Turn off** stops the form; anyone using the link sees that it isn't taking enquiries.",
      },
      {
        type: "note",
        text: "Spam bots are turned away quietly, and there are limits on how many enquiries can arrive at once. The form only takes enquiries while you're on Pro.",
      },
    ],
    related: ["pipeline", "leads", "automations", "online-survey-booking"],
  },
  {
    slug: "online-survey-booking",
    title: "Online survey booking",
    summary: "Let enquiries book a survey visit themselves, straight into your surveyors' diaries.",
    category: "pipeline",
    plan: "pro",
    who: "Admins and the office set it up; estimators can book visits too",
    keywords: ["site visit", "survey", "appointment", "booking link", "calendar invite", "surveyor hours", "postcode", "reminder"],
    body: [
      {
        type: "p",
        text: "Online booking lets a customer pick a time for you to come and look at their job, without the back and forth of phone calls. Times are only offered when one of your surveyors is free, with travel time either side.",
      },
      { type: "h", text: "Setting it up" },
      {
        type: "steps",
        items: [
          "Go to [Pipeline](/app/pipeline) and click **Online booking**.",
          "Tick **Let clients book online**.",
          "Choose how long **A visit takes** (30 minutes to 2 hours) and the **Travel time before and after** (none up to 1.5 hours).",
          "Set the **Earliest booking** (from no notice up to 1 week from now) and how **Furthest ahead** people can book (1 week up to 60 days).",
          "Under **Postcode areas you cover**, type areas such as LS, BD1, HX. \"LS\" covers every LS postcode; \"BD1\" covers only BD1. Leave it empty to cover anywhere. Click **Save**.",
          "Under **Who does surveys, and when**, pick a person, add their hours for each day (you can add more than one window a day), and click **Save** for their hours. A quick button fills in Monday to Friday, 9 to 5. Repeat for each surveyor.",
        ],
      },
      {
        type: "p",
        text: "Visits start on the half hour. When two surveyors are free at the same time, the booking goes to whoever has fewer visits that day. Admins, the office, estimators and site leads can do surveys.",
      },
      { type: "h", text: "How customers book" },
      {
        type: "list",
        items: [
          "Straight after sending your [web enquiry form](/help/web-enquiry-form), if their postcode is covered and you have times free.",
          "From a link in an automation email: add {{booking_link}}.",
          "From a link you send yourself: on the lead's page, click **Booking link** in the Survey visit card to copy it, then text or WhatsApp it.",
        ],
      },
      {
        type: "p",
        text: "They choose a day and time, check the address, postcode and phone number, and click **Book this time**. Outside your areas, they're told you'll call them to arrange it.",
      },
      { type: "h", text: "After a booking" },
      {
        type: "list",
        items: [
          "A lead at New enquiry or Contacted moves to Site visit. The surveyor gets a notification, and the visit shows in the [calendar](/help/calendar) and their [site app](/help/site-app).",
          "The customer gets a confirmation email with a calendar invite, and a reminder the day before.",
          "They can move or cancel it from the same link. If they cancel, the surveyor is told and the lead gets a \"Rebook the site visit\" follow-up for today.",
        ],
      },
      { type: "h", text: "Booking a visit yourself" },
      {
        type: "p",
        text: "On the lead's page, click **Book a visit** (or **Move**). Pick one of the **Next free times** or any date and time, choose **Who's going**, and leave the box ticked to email them a confirmation with a calendar invite. You can book outside the online hours; the only rule is that nobody can be in two places at once. **Cancel it** cancels the visit and emails them to say so.",
      },
      {
        type: "note",
        text: "Visit emails go even to people who unsubscribed from automatic follow-ups, because they're about a visit they arranged. Marking a lead as lost takes any upcoming visit out of the diary.",
      },
    ],
    related: ["leads", "web-enquiry-form", "automations", "calendar", "site-app"],
  },
  {
    slug: "automations",
    title: "Automatic follow-up emails",
    summary: "Emails that go to your leads on their own, in your words, and stop as soon as the lead moves on.",
    category: "pipeline",
    plan: "pro",
    who: "Admins and the office",
    keywords: ["automation", "email sequence", "follow up", "merge fields", "placeholders", "templates", "unsubscribe"],
    body: [
      {
        type: "p",
        text: "Automations send emails to your leads for you, so no enquiry goes cold while you're on site. A thank-you the moment an enquiry arrives, a nudge if you haven't spoken, gentle check-ins after a quote: you write them once and they run themselves.",
      },
      { type: "h", text: "Start with a ready-made one" },
      {
        type: "p",
        text: "Go to [Pipeline](/app/pipeline), click **Automations**, and look under **Ready-made automations**: Reply to new enquiries, Nudge if we haven't spoken yet, Confirm the site visit, Follow up a sent quote, Welcome a new client, and Check back on lost leads. Click **Add**. It's added switched off, so you can read it through and change the wording to sound like you. Then flip the switch to turn it on.",
      },
      { type: "h", text: "Making your own" },
      {
        type: "steps",
        items: [
          "Click **New automation** and give it a **Name**.",
          "Choose when it **Starts**: when an enquiry comes in from your website form, when any new lead is added, or when a lead moves to a stage (then pick the **Stage**).",
          "Write **Email 1**: the number of days to wait (0 sends straight away), a **Subject** and the email.",
          "Click **Add another email** for more, up to 10. Each one waits a number of days after the one before.",
          "Use **Preview** to see it with example details, or **Send me a test** to email it to yourself.",
          "Click **Create (switched off)**, then switch it on when you're happy.",
        ],
      },
      { type: "h", text: "Placeholders" },
      { type: "p", text: "Click a placeholder under the email to fill in each lead's details:" },
      {
        type: "list",
        items: [
          "{{first_name}} and {{name}}: their first name and full name.",
          "{{project}}: what they want done, such as \"kitchen extension\".",
          "{{company}}: your company name.",
          "{{my_name}}: the first name of the lead's owner (your company name if there's no owner).",
          "{{visit_date}}: the site visit date and time.",
          "{{quote_link}}: a link to their quote, once it's been sent.",
          "{{booking_link}}: a link to book or move their survey online, when [online booking](/help/online-survey-booking) is on.",
        ],
      },
      { type: "p", text: "A placeholder with nothing to fill it is left blank, and you're warned about anything that isn't a placeholder." },
      { type: "h", text: "When emails go and stop" },
      {
        type: "list",
        items: [
          "Same-day emails go at once. Later ones go out at the start of the working day.",
          "They stop as soon as the lead leaves the stage. A quote follow-up stops when the quote is accepted or declined; enquiry emails stop once the lead moves past New enquiry.",
          "Leads with no email address, or who unsubscribed, are skipped. Replies go to the lead's owner.",
          "Switching on applies to leads from then on. Switching off stops everyone part-way through. Edits apply to the next email each lead gets.",
          "Each email sent shows in the lead's History. To stop one lead's emails, click the stop button in its **Automatic emails** card.",
        ],
      },
      {
        type: "note",
        text: "Every automatic email ends with an unsubscribe link. See [Unsubscribing](/help/unsubscribing-from-emails).",
      },
    ],
    related: ["unsubscribing-from-emails", "follow-ups", "web-enquiry-form", "online-survey-booking", "sending-a-quote"],
  },
  {
    slug: "unsubscribing-from-emails",
    title: "When a lead unsubscribes",
    summary: "What happens when someone clicks unsubscribe in one of your automatic follow-up emails.",
    category: "pipeline",
    plan: "pro",
    keywords: ["unsubscribe", "opt out", "stop emails", "gdpr", "marketing emails"],
    body: [
      {
        type: "p",
        text: "Every automatic follow-up email ends with a short line saying why they're getting it, and a link to unsubscribe. It keeps you on the right side of the rules and stops you chasing someone who's told you they're not interested.",
      },
      { type: "h", text: "What they see" },
      {
        type: "p",
        text: "The link opens a page asking \"Stop these emails?\" with an **Unsubscribe** button. They have to click the button, so email systems that check links can't unsubscribe anyone by accident. Many email apps also show their own unsubscribe button at the top of the email, which does the same thing.",
      },
      { type: "h", text: "What changes for you" },
      {
        type: "list",
        items: [
          "No more automatic emails go to that lead, and any automations running for them stop.",
          "Their History gets a note: \"Unsubscribed from automated emails\".",
          "On their page, the email address is marked \"unsubscribed from automatic emails\", and the Automatic emails card says so.",
        ],
      },
      { type: "h", text: "What still goes to them" },
      {
        type: "list",
        items: [
          "Emails you write yourself from the lead's **Email** tab.",
          "Confirmations, changes and reminders about a survey visit they've arranged.",
        ],
      },
      {
        type: "tip",
        text: "If someone unsubscribes but still wants the work, carry on by phone or with a personal email. A quick call often does more than any automatic email.",
      },
    ],
    related: ["automations", "leads", "privacy-and-security"],
  },
  {
    slug: "pipeline-insights",
    title: "Pipeline insights",
    summary: "See where your work comes from, your win rate, why jobs are lost and what's in the pipeline now.",
    category: "pipeline",
    plan: "pro",
    who: "Admins, the office and estimators",
    keywords: ["reports", "win rate", "conversion", "lead sources", "lost reasons", "pipeline value", "marketing"],
    body: [
      {
        type: "p",
        text: "The Insights view shows what's working. Is Checkatrade worth the money? Do referrals win more often than Google? Are you losing jobs on price? It answers those from your own leads.",
      },
      { type: "h", text: "Opening it" },
      { type: "p", text: "Go to [Pipeline](/app/pipeline) and click **Insights** next to Board and List. It covers leads from the last 12 months." },
      { type: "h", text: "The headline numbers" },
      {
        type: "list",
        items: [
          "**Leads (12 months)**: how many enquiries came in.",
          "**Win rate**: of the leads that were decided (won or lost), how many you won.",
          "**Won**: the value of the leads you won.",
          "**Enquiry to win**: on average, how many days from first enquiry to winning the job.",
        ],
      },
      { type: "h", text: "Where your work comes from" },
      {
        type: "p",
        text: "A table of each source (Website form, Referral, Past client, Google, Checkatrade and so on) with its number of leads, how many you won, the win rate and the value won. It's only as good as the source you choose when adding a lead, so pick it every time.",
      },
      { type: "h", text: "Why leads are lost" },
      {
        type: "p",
        text: "A bar for each lost reason, most common first. If \"Price too high\" keeps topping the list, it may be time to look at your [markups](/help/markups-margins-and-vat). If it's \"Stopped replying\", faster [follow-ups](/help/follow-ups) may help.",
      },
      { type: "h", text: "Open now" },
      {
        type: "p",
        text: "How many leads are at each open stage right now, with their value, and the total **Pipeline value**.",
      },
      {
        type: "tip",
        text: "Values come from each lead's **Rough value**. Set it when you add the lead, or once you've quoted, so the totals mean something.",
      },
    ],
    related: ["pipeline", "leads", "job-costing-reports"],
  },
  {
    slug: "website-estimator",
    title: "Put a cost estimator on your website",
    summary: "Homeowners get a guide price for their project on your website, then ask you for a proper quote.",
    category: "pipeline",
    who: "Admins",
    keywords: ["calculator", "price calculator", "cost calculator", "estimate", "website", "embed", "widget", "leads"],
    body: [
      {
        type: "p",
        text: "The website estimator is a cost calculator for your own website. A homeowner picks their project (an extension, loft conversion, kitchen and so on), its size and finish, and sees your guide price straight away. If they like the sound of it, they leave their details and ask you for a proper quote, with their estimate included.",
      },
      { type: "h", text: "Setting it up" },
      {
        type: "steps",
        items: [
          "Go to [Settings](/app/settings) and click **Website estimator**.",
          "Tick the projects you do and choose your area.",
          "Set **Your prices vs typical** if you're dearer or cheaper than most firms near you, or open **Use your own prices** and type in your usual prices for a standard finish.",
          "Tick **We're VAT registered** if you charge VAT, so homeowners see prices with VAT.",
          "Click **Save**, and check the **Preview** looks right.",
          "Click **Turn on the estimator**, then copy the embed code into your website, or share the link.",
        ],
      },
      {
        type: "tip",
        text: "The embed code grows to fit the estimator, so there's no scrollbar inside your page. Paste all three lines together. Your website needs to use https, as almost all do.",
      },
      { type: "h", text: "When someone asks for a quote" },
      {
        type: "list",
        items: [
          "Admins and the office get an email with their name, contact details, project and the estimate they saw. Reply to it to answer them.",
          "On the Pro plan, they also land in your [pipeline](/help/pipeline) as a new lead, with the estimate in its notes.",
          "The estimate is worked out again on our side from your settings, so nobody can send you a made-up price.",
        ],
      },
      {
        type: "note",
        text: "Estimates are guide prices to help homeowners plan, not quotes. The estimator says so, and tells them you'll confirm the real price after seeing the job.",
      },
    ],
    related: ["web-enquiry-form", "pipeline", "leads"],
  },
];
