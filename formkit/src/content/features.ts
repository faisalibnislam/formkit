/**
 * The feature pages (/features/<slug>) and use-case pages (/use-cases/<slug>).
 * One shape for both: a hero, a few sections, steps, related templates and
 * help, questions, and the plan it needs. Every claim here matches the app
 * and the pricing page; keep them in step.
 */

export type Story = {
  slug: string;
  /** The short name, for cards, the footer and breadcrumbs. */
  name: string;
  /** The page's own headline. */
  title: string;
  /** Meta description, about 150 characters. */
  meta: string;
  kicker: string;
  lead: string;
  icon: string;
  /** Which plan it needs: "Every plan", "Pro"… */
  plan: string;
  sections: { title: string; body: string; points?: string[] }[];
  steps?: string[];
  templates: string[];
  help: string[];
  /** Other feature pages to point to. */
  related: string[];
  faqs: { q: string; a: string }[];
  updated: string;
};

export const FEATURE_PAGES: Story[] = [
  {
    slug: "ai-form-builder",
    name: "AI form builder",
    title: "Describe a form. Formkit builds it.",
    meta: "Formkit's AI form builder turns a sentence into a working form with questions, pages and logic. Free for 3 forms a month; Pro builds from briefs and documents.",
    kicker: "AI form builder",
    lead: "Write what you need in plain words, or on Pro paste a brief, a document or an old form. Ask Formkit drafts the questions, splits them into pages and writes the logic, in your wording. Then keep changing it by asking.",
    icon: "sparkles",
    plan: "Every plan",
    sections: [
      {
        title: "From a sentence, a brief or a document",
        body: "Start from “an intake form for a branding studio, with budget and timeline”. On Pro and Business, paste the brief a client sent you, upload a document or pick one of your existing forms, and Ask Formkit builds from that.",
      },
      {
        title: "Edit by asking",
        body: "Once there is a draft, ask for changes the way you would ask a colleague: “make the budget question a range”, “add a thank-you page”, “only ask about print if they need it”. Each change lands on the canvas where you can see it and undo it.",
        points: ["Reword questions and options", "Add or reorder pages", "Write logic rules from a sentence", "Suggest a theme from a brand description"],
      },
      {
        title: "It drafts, you decide",
        body: "Everything the AI makes is an ordinary draft. Nothing is published until you publish it, and every question can be edited by hand like any other.",
      },
    ],
    steps: ["Open Ask Formkit from the top bar", "Describe the form (or, on Pro, paste a brief)", "Review the draft on the canvas", "Ask for changes, then publish"],
    templates: ["client-onboarding", "quote-request", "creative-brief"],
    help: ["ai-what", "ai-credits", "ai-access"],
    related: ["logic", "ai-replies"],
    faqs: [
      { q: "How many forms can the AI build?", a: "3 a month on Free. On Pro each seat adds 50 a month and on Business 200, shared across the company. Past that, AI credits keep it going, from $5 for 100." },
      { q: "Does talking to it cost anything?", a: "No. Asking it questions about Formkit never counts. Building a form counts as a build, and changing one counts as an edit." },
      { q: "Which AI does it use?", a: "Google's Gemini models, through Google's API." },
    ],
    updated: "2026-09-30",
  },
  {
    slug: "logic",
    name: "Conditional and AI logic",
    title: "Logic that reads like a sentence, and AI that reads the answer.",
    meta: "Conditional logic in plain words: skip, show and hide questions on every plan. On Pro, calculations, several endings and AI logic that reads what people wrote.",
    kicker: "Logic",
    lead: "Every person should only see what applies to them. Formkit's rules read like sentences, a map shows every path, and on Pro the AI can read a written answer and decide where someone goes next.",
    icon: "git-branch",
    plan: "Every plan · AI logic on Pro",
    sections: [
      {
        title: "Rules in plain words",
        body: "When someone answers a question a certain way, skip ahead, show a follow-up, or hide what does not apply. Group conditions with and/or, and the first rule that matches wins.",
        points: ["Skip to a page or the end", "Show or hide questions", "Groups of conditions", "Test a path before you publish"],
      },
      {
        title: "See every path",
        body: "The logic map draws the whole form as a flow, with every branch, so you can spot a dead end before a respondent does. The tester walks a made-up person through it.",
      },
      {
        title: "AI decides (Pro)",
        body: "Describe the decision in words, “is this a good fit for us?”, and the AI reads the person's answer and picks the path. It can also pull facts out of a written answer, like a budget or a company size, and use them in later rules and calculations.",
      },
      {
        title: "Calculations, endings and more (Pro)",
        body: "Add answers up into a price or a score, send people to one of several endings, hide options that are full, and quote earlier answers in later questions.",
      },
    ],
    templates: ["lead-qualification", "client-onboarding", "quote-request"],
    help: ["logic-basics", "logic-skip", "logic-show-hide", "logic-map", "logic-ai", "calculations"],
    related: ["quizzes", "ai-form-builder"],
    faqs: [
      { q: "Is logic on the free plan?", a: "Yes. Skip, show and hide rules, groups and the logic map are on every plan. Calculations, several endings, hidden fields, piping and AI logic are on Pro." },
      { q: "How is AI logic counted?", a: "Each response that goes through AI logic counts once towards your company's monthly responses, however many checks it needs." },
    ],
    updated: "2026-09-30",
  },
  {
    slug: "quizzes",
    name: "Quizzes and exams",
    title: "Quizzes with right answers, a timer and results.",
    meta: "Make a quiz or exam in Formkit: right answers, marks, a timer, shuffling, a pass mark, marking by hand and results released when you are ready. On Pro.",
    kicker: "Quizzes and exams",
    lead: "Turn any form into a quiz. Mark the right answers, set what each question is worth, add a timer and a pass mark, and decide whether people see their results straight away or when you release them.",
    icon: "graduation-cap",
    plan: "Pro",
    sections: [
      {
        title: "Right answers and marks",
        body: "Pick the right option, every right option on a multiple-choice question, or accepted answers for a short text. Written answers and uploads are marked by hand.",
      },
      {
        title: "Fair attempts",
        body: "A countdown kept by Formkit, not the person's browser. Questions and options shuffled into each person's own order. One attempt per device and email address.",
        points: ["Timer that submits at zero", "Shuffled questions and options", "One attempt each", "A pass mark"],
      },
      {
        title: "Results when you are ready",
        body: "Show the mark on the thank-you screen, with or without the right answers, or hold results until everything is marked and release them at a time you set. People can get their results by email.",
      },
    ],
    templates: ["quiz", "course-evaluation", "course-registration"],
    help: ["quizzes", "quiz-results"],
    related: ["logic", "insights"],
    faqs: [
      { q: "Can I mark long answers?", a: "Yes. Open a response and type a mark for anything waiting; the totals update." },
      { q: "Can I see which questions people got wrong?", a: "The quiz summary shows the average, pass rate, spread of scores and how many got each question right." },
    ],
    updated: "2026-09-30",
  },
  {
    slug: "ai-replies",
    name: "AI replies",
    title: "A personal reply to every response.",
    meta: "Formkit's AI writes each person a reply from your instructions and your own facts, on the thank-you screen or by email. Included with Pro.",
    kicker: "AI replies",
    lead: "Brief the AI like a colleague: who the reply is from, what to look at, what to offer. It writes each person who answers a reply of their own, on the thank-you screen, by email or both.",
    icon: "mail",
    plan: "Pro",
    sections: [
      {
        title: "Your instructions, your facts",
        body: "Add the background it may use: services, prices, links, answers to common questions. It only uses what you give it and never invents offers.",
      },
      {
        title: "Where it goes",
        body: "On the thank-you screen as soon as it is written, by email from your own address in place of the usual confirmation, or both. Plain text or your branded template.",
      },
      {
        title: "You stay in charge",
        body: "Try it on your latest response before turning it on. Every reply is kept with the response, and you can edit it, send it again or write it again.",
      },
    ],
    steps: ["Open a form's Settings → AI reply", "Write your instructions and background", "Try it on a real response", "Turn it on"],
    templates: ["lead-qualification", "project-discovery", "support-request"],
    help: ["ai-replies", "ai-replies-allowance"],
    related: ["insights", "logic"],
    faqs: [
      { q: "How many replies do I get?", a: "Each Pro seat adds 20 responses AI works on a month, and each Business seat 50, shared across the company. Credits cover more, 1 credit a response." },
      { q: "What if a reply fails?", a: "It does not count, and the person gets your usual confirmation instead." },
    ],
    updated: "2026-09-30",
  },
  {
    slug: "insights",
    name: "AI insights",
    title: "Know what your responses are telling you.",
    meta: "AI insights read every response for sentiment, intent, topics, a lead score and urgency, and write a report of what stands out. Included with Pro.",
    kicker: "AI insights",
    lead: "Stop reading every answer to find the three that matter. The AI reads each response for how the person feels, what they want and how promising they are, then writes a report across all of them.",
    icon: "scan-search",
    plan: "Pro",
    sections: [
      {
        title: "On every response",
        body: "Sentiment, what the person wants, the topics they touch, a lead score out of 100 by your goal, and how urgent it is.",
        points: ["Sentiment", "Intent and topics", "Lead score", "Urgency"],
      },
      {
        title: "A report on request",
        body: "Select Write a report and the AI reads across your latest responses: themes, opportunities, things to watch and what to do next.",
      },
      {
        title: "In your exports",
        body: "Sentiment, lead score, urgency, the AI summary and the reply all come out as columns in CSV and Excel.",
      },
    ],
    templates: ["customer-satisfaction-survey", "nps-survey", "lead-qualification"],
    help: ["ai-insights"],
    related: ["ai-replies", "integrations"],
    faqs: [
      { q: "How many reports can I run?", a: "3 a month per Pro seat and 10 per Business seat, shared across the company. Credits cover more, 3 credits a report." },
      { q: "Does it work on any form?", a: "Insights appear on forms with AI replies turned on: each response is read as its reply is written." },
    ],
    updated: "2026-09-30",
  },
  {
    slug: "payments",
    name: "Payments",
    title: "Take payment when the form is sent.",
    meta: "Take payments with Formkit forms through your own Stripe account: a fixed amount or a calculated total. The money goes straight to you. On Pro.",
    kicker: "Payments",
    lead: "Connect your own Stripe account and charge when someone sends the form: a fixed price, or the total your form worked out. The money goes straight to you, and Formkit takes nothing.",
    icon: "credit-card",
    plan: "Pro",
    sections: [
      {
        title: "Your Stripe, your money",
        body: "Formkit never holds the payment. A restricted Stripe key lets Formkit create a checkout and nothing else, and refunds happen in Stripe as usual.",
      },
      {
        title: "Fixed or calculated",
        body: "Charge a set amount, or the result of a calculation: places times price, a quote that adds up the options someone picked.",
      },
      {
        title: "Nothing lost",
        body: "Answers are saved before checkout, so a closed tab never loses a response. Each response shows Paid, Awaiting payment or Not paid.",
      },
    ],
    templates: ["order-form", "workshop-registration", "event-registration"],
    help: ["payments", "calculations"],
    related: ["logic", "integrations"],
    faqs: [
      { q: "Does Formkit charge a fee on payments?", a: "No. Stripe's own fees apply; Formkit adds nothing." },
      { q: "Can I test it first?", a: "Yes. Use a Stripe test key and try it without real money." },
    ],
    updated: "2026-09-30",
  },
  {
    slug: "integrations",
    name: "Connections",
    title: "Send every response where it needs to go.",
    meta: "Connect Formkit to Slack, Google Sheets, Zapier, Make and signed webhooks, so every response lands in your tools the moment it arrives. On Pro.",
    kicker: "Connections",
    lead: "Post new responses to Slack, keep a Google Sheet up to date, or send them anywhere through Zapier, Make or your own webhook, the moment they arrive.",
    icon: "webhook",
    plan: "Pro",
    sections: [
      { title: "Slack", body: "A short message in the channel you choose for each response, and a line of its own for each payment." },
      { title: "Google Sheets", body: "A private link your sheet reads from. Refreshes about hourly with a formula, or every few minutes with a small script. Nothing to authorise." },
      {
        title: "Webhooks, Zapier and Make",
        body: "Every response as JSON, signed so you know it came from Formkit, retried if your end is down, with recent deliveries listed so you can see what happened.",
      },
      { title: "The API (Business)", body: "Read your forms and responses from your own code with a key, through a documented read-only API." },
    ],
    templates: ["bug-report", "webinar-registration", "lead-qualification"],
    help: ["webhooks", "slack", "google-sheets", "api"],
    related: ["payments", "insights"],
    faqs: [
      { q: "Can I test a connection?", a: "Yes. Send a test delivery before real answers arrive." },
      { q: "What if my endpoint is down?", a: "Formkit tries again after a minute, then after ten, and shows what your end answered." },
    ],
    updated: "2026-09-30",
  },
  {
    slug: "branding",
    name: "Branding and custom domains",
    title: "Forms that look like you, on your own domain.",
    meta: "Brand your Formkit forms with your colours, fonts, logo and CSS, publish at formkit.app/you, and on Pro at forms.yourcompany.com without the Formkit badge.",
    kicker: "Branding",
    lead: "Ten ready-made looks, then your own colours, type and logo, at your own formkit.app link. On Pro, put forms on your own domain, send emails from your address and remove the Formkit badge.",
    icon: "palette",
    plan: "Every plan · domain on Pro",
    sections: [
      {
        title: "On every plan",
        body: "Themes, your colours and logo, two logos side by side for client work, and a link of your own: formkit.app/your-name or a name for each company.",
      },
      {
        title: "On Pro",
        body: "forms.yourcompany.com with step-by-step DNS help for your provider, confirmation emails from your own domain, custom fonts and CSS, and no “Made with Formkit”.",
        points: ["Custom domain", "Emails from your domain", "Custom fonts and CSS", "No Formkit badge"],
      },
      {
        title: "A company per brand",
        body: "Each company has its own logos, link, domain and theme defaults, so client work never mixes.",
      },
    ],
    templates: ["contact-form", "branding-questionnaire", "newsletter-signup"],
    help: ["custom-domain", "email-domain", "pick-theme", "logos", "claim-handle"],
    related: ["integrations", "ai-form-builder"],
    faqs: [
      { q: "What happens to my domain if I downgrade?", a: "Nothing breaks: visits are sent on to the matching formkit.app link." },
      { q: "Can I embed forms on my site?", a: "Yes, on every plan: inline, as a popup, or with a link or QR code." },
    ],
    updated: "2026-09-30",
  },
];

export const USE_CASES: Story[] = [
  {
    slug: "agencies",
    name: "Agencies and freelancers",
    title: "Forms for client work, under each client's name.",
    meta: "Formkit for agencies and freelancers: onboarding, briefs and quote requests, a company per client, your own domain, AI replies and payments.",
    kicker: "For agencies and freelancers",
    lead: "Onboard clients, take briefs and quote jobs with forms that look like you, or like them. Keep each client in its own company, and let the AI send the first reply.",
    icon: "briefcase",
    plan: "Free to start",
    sections: [
      { title: "A company per client", body: "Each client gets its own workspace with its own forms, logos, link and plan, and you switch between them from the top bar." },
      { title: "Briefs that come back complete", body: "Onboarding and brief templates split into short pages, with uploads for assets. Add a rule so returning clients skip what you already know." },
      { title: "Quote faster", body: "On Pro, calculations turn answers into an estimate, AI replies send a first response from your price list, and payments take a deposit." },
    ],
    templates: ["client-onboarding", "creative-brief", "quote-request", "website-questionnaire", "client-feedback"],
    help: ["add-company", "team", "custom-domain"],
    related: ["branding", "ai-replies", "payments"],
    faqs: [
      { q: "Can clients see each other's forms?", a: "No. Each company is separate, with its own members and forms." },
      { q: "Can I put a client's logo on the form?", a: "Yes, on any plan, and two logos side by side for joint work." },
    ],
    updated: "2026-09-30",
  },
  {
    slug: "education",
    name: "Teachers and trainers",
    title: "Quizzes, registrations and feedback, marked and sorted.",
    meta: "Formkit for teachers and trainers: quizzes with a timer and marking, course registration, applications and course evaluations.",
    kicker: "For teachers and trainers",
    lead: "Run knowledge checks with a timer and a pass mark, take registrations and applications, and ask students what worked, all in one place.",
    icon: "graduation-cap",
    plan: "Free to start · quizzes on Pro",
    sections: [
      { title: "Quizzes that mark themselves", body: "Right answers, marks, shuffling, a timer and a pass mark. Mark written answers by hand, then release results when you are ready." },
      { title: "Registration and applications", body: "Enrol students, take applications with a statement and a CV, and let applicants save and come back." },
      { title: "Hear from students", body: "Anonymous course evaluations with averages per course, and on Pro, AI insights across the written answers." },
    ],
    templates: ["quiz", "course-registration", "course-application", "course-evaluation"],
    help: ["quizzes", "quiz-results", "partials"],
    related: ["quizzes", "insights"],
    faqs: [
      { q: "Is Formkit free for schools?", a: "The free plan has unlimited forms, responses and members. Quizzes with marking are on Pro." },
      { q: "Can students see their results?", a: "Straight away or when you release them, with or without the right answers." },
    ],
    updated: "2026-09-30",
  },
  {
    slug: "sales",
    name: "Sales and lead generation",
    title: "Qualify every lead, and answer it in seconds.",
    meta: "Formkit for sales: lead qualification forms with AI logic, a personal AI reply to every lead, lead scores, and routing to your CRM.",
    kicker: "For sales teams",
    lead: "Ask the questions that matter, let the AI decide which leads fit, reply to every one in your voice, and send the good ones to your CRM straight away.",
    icon: "magnet",
    plan: "Free to start · AI on Pro",
    sections: [
      { title: "Qualify as they answer", body: "Rules send small budgets one way and big ones another; on Pro, AI logic reads a written answer and decides whether someone is a fit." },
      { title: "Reply in seconds", body: "On Pro, every lead gets a personal reply from your instructions and your own facts, on the thank-you screen or by email." },
      { title: "Score and route", body: "AI insights give each lead a score and urgency, and connections post hot leads to Slack or your CRM through Zapier, Make or a webhook." },
    ],
    templates: ["lead-qualification", "quote-request", "partnership-inquiry", "waitlist"],
    help: ["logic-ai", "ai-replies", "ai-insights", "webhooks"],
    related: ["logic", "ai-replies", "insights"],
    faqs: [
      { q: "Can it book a call?", a: "Send qualified leads to your booking page with a redirect, and quote their answers in the link." },
      { q: "Does it work with my CRM?", a: "Through Zapier, Make or a signed webhook, on Pro." },
    ],
    updated: "2026-09-30",
  },
  {
    slug: "events",
    name: "Events",
    title: "Registrations, RSVPs, payments and feedback.",
    meta: "Formkit for events: registrations with payments and limited places, RSVPs, volunteer sign-ups and event feedback, with QR codes.",
    kicker: "For event organisers",
    lead: "Take registrations and payments, cap places, collect RSVPs and dietary needs, sign up volunteers and ask for feedback the morning after.",
    icon: "calendar",
    plan: "Free to start",
    sections: [
      { title: "Registration and payment", body: "On Pro, take the fee through your own Stripe, work out totals per place, and close dates or sessions once they are full." },
      { title: "RSVPs and volunteers", body: "Head counts, dietary needs and a rota of who can help, when. Close the form at a date or after a number of answers." },
      { title: "Share anywhere", body: "A link, an embed on your site, or a QR code on slides and signs." },
    ],
    templates: ["event-registration", "workshop-registration", "rsvp", "volunteer-signup", "event-feedback"],
    help: ["qr-code", "embed", "payments"],
    related: ["payments", "logic"],
    faqs: [
      { q: "Can I limit places?", a: "On Pro, limited places close an option once it is full." },
      { q: "Can people pay by card?", a: "On Pro, through your own Stripe account." },
    ],
    updated: "2026-09-30",
  },
  {
    slug: "hr",
    name: "HR and hiring",
    title: "Hiring, onboarding and feedback, without the spreadsheets.",
    meta: "Formkit for HR: job applications with uploads, new hire onboarding, time off requests, employee feedback and exit interviews.",
    kicker: "For HR teams",
    lead: "Take job applications with resumes, get new starters ready for day one, handle time off requests and hear honestly from the team.",
    icon: "users",
    plan: "Free to start",
    sections: [
      { title: "Hiring", body: "Applications with portfolio links and resume uploads, reviewed by the people you invite. On Pro, AI insights help shortlist." },
      { title: "Onboarding and requests", body: "New hire details, equipment and emergency contacts before day one; time off requests routed to the right manager." },
      { title: "Listening", body: "Pulse surveys and exit interviews, anonymous if you like, with retention rules on Business to erase old answers." },
    ],
    templates: ["job-application", "employee-onboarding", "time-off-request", "employee-feedback", "exit-interview"],
    help: ["team", "notify-routing", "data"],
    related: ["insights", "integrations"],
    faqs: [
      { q: "Can responses be deleted after a while?", a: "On Business, retention rules erase responses and their files once they reach an age you choose." },
      { q: "Who can see applications?", a: "Only members of your company and guests you invite to the form." },
    ],
    updated: "2026-09-30",
  },
];

export const featureBySlug = (slug: string) => FEATURE_PAGES.find((f) => f.slug === slug) ?? null;
export const caseBySlug = (slug: string) => USE_CASES.find((u) => u.slug === slug) ?? null;
