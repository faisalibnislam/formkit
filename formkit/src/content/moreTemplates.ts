import { builtinTemplate } from "../../convex/model/builtinTemplates";
import type { FormTemplate, TemplateQuestion } from "./templates";

/**
 * Site copy for the rest of Formkit's templates. The questions, pages and
 * time come from the app's own definition of each (convex/model), so the page
 * always shows the form "Use this template" actually builds.
 */

/** Each field type, as the site names it and the glyph it shows. */
const TYPES: Record<string, [string, string]> = {
  "short-text": ["Short text", "type"],
  "long-text": ["Long text", "message-square"],
  email: ["Email", "at-sign"],
  name: ["Name", "user"],
  phone: ["Phone", "message-square"],
  url: ["Link", "link"],
  number: ["Number", "type"],
  date: ["Date", "calendar"],
  dropdown: ["Dropdown", "list-checks"],
  "single-choice": ["Multiple choice", "circle-dot"],
  "multi-choice": ["Checkboxes", "list-checks"],
  "yes-no": ["Yes / no", "circle-dot"],
  file: ["File upload", "paperclip"],
  scale: ["Scale", "sliders-horizontal"],
  rating: ["Rating", "star"],
  company: ["Company", "building-2"],
  address: ["Address", "globe"],
};

type Copy = Omit<FormTemplate, "slug" | "name" | "icon" | "time" | "pages" | "questions" | "blurb"> & { blurb?: string };

function fromApp(slug: string, copy: Copy): FormTemplate {
  const b = builtinTemplate(slug);
  if (!b) throw new Error(`No app template for ${slug}`);
  const fields = b.blocks.filter((k) => k.kind === "field");
  const breaks = b.blocks.filter((k) => k.kind === "pagebreak").length;
  const pages = b.blocks[0]?.kind === "pagebreak" ? breaks : breaks + 1;
  const questions: TemplateQuestion[] = fields.map((k) => {
    const [type, icon] = TYPES[k.kind === "field" ? k.type : ""] ?? ["Question", "circle-help"];
    return { title: k.kind === "field" ? k.title : "", type, icon };
  });
  return {
    slug,
    // Sentence case, as the site writes names, keeping acronyms.
    name: b.name
      .split(" ")
      .map((w, i) => (i === 0 || /^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase()))
      .join(" "),
    icon: b.icon,
    time: `${Math.max(1, Math.round(fields.length * 0.4))} min`,
    pages: String(pages),
    questions,
    blurb: copy.blurb ?? b.blurb,
    ...copy,
  };
}

export const MORE_TEMPLATES: FormTemplate[] = [
  fromApp("contact-form", {
    category: "Business",
    logic: false,
    meta: "A free contact form template: name, email, topic and message, with notifications to your inbox and spam protection built in.",
    lead: "Five short questions: who, what it is about, the message and a news opt-in. Answers land in your inbox and your email, and an invisible check keeps bots out.",
    who: ["Anyone with a website. Embed it on your contact page, or share the link from your email signature and social profiles."],
    faqs: [
      { q: "Can messages go to different people?", a: "Yes. Routing rules send each message to the right inbox by the topic someone picks." },
      { q: "Will I get spam?", a: "Formkit adds an invisible check and limits on floods to every form, on every plan." },
    ],
    features: ["branding"],
  }),
  fromApp("branding-questionnaire", {
    category: "Agency",
    logic: false,
    meta: "A free branding questionnaire template: the business, its audience, personality, competitors and references, before a brand project starts.",
    lead: "The questions a brand designer asks in the first meeting, answered before it. Clients can upload references and pick the words that fit.",
    who: ["Brand designers and studios who want the discovery conversation to start from answers, not a blank page."],
    faqs: [
      { q: "Can clients upload moodboards?", a: "Yes, files up to 20 MB on Free and 150 MB on Pro." },
      { q: "Can I put my own logo on it?", a: "Yes. Add your logo and colours on any plan, and your own domain on Pro." },
    ],
    features: ["branding", "ai-replies"],
  }),
  fromApp("job-application", {
    category: "HR",
    logic: false,
    meta: "A free job application form template: eligibility, role, experience, portfolio and resume upload, across three short pages.",
    lead: "Three pages, about seven minutes, and no cover letter. Resumes upload straight into each response.",
    who: ["Small teams hiring without an applicant tracking system. Share one link per role, or one form with a role dropdown."],
    faqs: [
      { q: "Can I score applicants?", a: "On Pro, calculations can score answers, and AI insights can rate how well each fits what you are looking for." },
      { q: "Can colleagues review applications?", a: "Yes. Invite them to your company as members, or as guests to just this form." },
    ],
    features: ["ai-replies", "insights"],
  }),
  fromApp("rsvp", {
    category: "Events",
    logic: false,
    meta: "A free RSVP form template: attending or not, how many are coming, dietary needs and a message.",
    lead: "Can you make it, how many are coming, dietary needs and a message. Add one rule, on any plan, so people who cannot come skip straight to the end.",
    who: ["Weddings, parties, dinners and team events. Anyone who needs a head count and a list of dietary needs."],
    faqs: [
      { q: "Can I close it at a date?", a: "Yes. Closing rules stop answers at a date or after a number of responses." },
      { q: "Can people change their answer?", a: "They can send it again; you see both and the latest is marked." },
    ],
    features: ["logic"],
  }),
  fromApp("project-discovery", {
    category: "Agency",
    logic: false,
    meta: "A free project discovery form template: goals, audience, scope, constraints and success measures, before you write a proposal.",
    lead: "The discovery call as a form: what they want, for whom, by when and how success will be measured.",
    who: ["Consultants, developers and agencies who write proposals and want the facts first."],
    faqs: [
      { q: "Can AI draft my reply?", a: "On Pro, AI replies can write each prospect a first response from your instructions and your own prices." },
      { q: "Can I send the answers to my CRM?", a: "On Pro, through webhooks, Zapier or Make, the moment a response arrives." },
    ],
    features: ["ai-replies", "integrations"],
  }),
  fromApp("support-request", {
    category: "Business",
    logic: false,
    meta: "A free support request form template: who, what, how urgent and a screenshot, routed to the right person.",
    lead: "A tidy support form: topic, urgency, what happened, the page and a screenshot. Add routing so urgent issues go straight to the right person.",
    who: ["Small teams without a help desk, or anyone who wants requests in one place instead of scattered email."],
    faqs: [
      { q: "Can urgent requests go to someone else?", a: "Yes. Notification routing sends each response to a person by what was picked." },
      { q: "Can people get an instant answer?", a: "On Pro, AI replies can answer common questions from facts you give it, straight away." },
    ],
    features: ["ai-replies", "integrations"],
  }),
  fromApp("order-form", {
    category: "Business",
    logic: false,
    meta: "A free order form template: products, quantities, delivery details and a date. Take payment through your own Stripe on Pro.",
    lead: "Product, quantity, specification, artwork and delivery, in two short pages. On Pro, add a calculation for the total and take the payment through your own Stripe.",
    who: ["Small shops, makers and caterers taking orders without a full online store."],
    faqs: [
      { q: "Can it work out the total?", a: "On Pro, calculations add up prices and quantities, and the payment can charge that total." },
      { q: "Does Formkit take a cut of payments?", a: "No. Payments go straight to your Stripe account." },
    ],
    features: ["payments", "logic"],
  }),
  fromApp("customer-satisfaction-survey", {
    category: "Feedback",
    logic: false,
    meta: "A free customer satisfaction (CSAT) survey template: overall satisfaction, what went well, what to fix and permission to follow up.",
    lead: "Five questions that measure satisfaction and tell you why. Short enough that people finish it.",
    who: ["Businesses of any size that want a steady read on how customers feel, after a purchase, a project or a support conversation."],
    faqs: [
      { q: "Can I see the average score?", a: "Yes. Analytics show the spread and average for every scale question." },
      { q: "Can AI tell me what people are unhappy about?", a: "On Pro, AI insights read every answer for sentiment and topics, and write a report." },
    ],
    features: ["insights", "ai-replies"],
  }),
  fromApp("nps-survey", {
    category: "Feedback",
    logic: false,
    meta: "A free NPS survey template: the 0 to 10 recommend question, the reason behind the score, and how long they have been a customer.",
    lead: "Net Promoter Score in two questions and a follow-up. The reason matters more than the number, so it asks for both.",
    who: ["Product, success and marketing teams tracking loyalty over time."],
    faqs: [
      { q: "Does it work out the NPS?", a: "Scores appear in analytics; on Pro, a calculation can label each person a promoter, passive or detractor." },
      { q: "Can detractors get a personal reply?", a: "On Pro, AI replies can answer low scores with an apology and an offer to talk." },
    ],
    features: ["logic", "ai-replies", "insights"],
  }),
  fromApp("event-feedback", {
    category: "Events",
    logic: false,
    meta: "A free event feedback form template: overall rating, the best session, the venue and what to change next time.",
    lead: "Six questions sent the morning after, while the event is fresh. People who want to hear about the next one can leave an email.",
    who: ["Conference, meetup and workshop organisers who want to make the next one better."],
    faqs: [
      { q: "Can I share it with a QR code?", a: "Yes. Every form has a QR code for slides and printed signs." },
      { q: "Can I compare events?", a: "Duplicate the form for each event and compare the analytics side by side." },
    ],
    features: ["insights"],
  }),
  fromApp("employee-feedback", {
    category: "HR",
    logic: false,
    meta: "A free employee feedback survey template: happiness, workload, support, growth and what to change, as a regular pulse.",
    lead: "Seven questions for a monthly or quarterly pulse. Short enough to answer honestly, specific enough to act on.",
    who: ["HR teams and team leads who want an honest read on morale without a big annual survey."],
    faqs: [
      { q: "Can it be anonymous?", a: "Yes. Leave out the name and email questions and responses carry no identity." },
      { q: "Can I spot themes quickly?", a: "On Pro, AI insights group what people wrote into topics and sentiment." },
    ],
    features: ["insights"],
  }),
  fromApp("exit-interview", {
    category: "HR",
    logic: false,
    meta: "A free exit interview form template: why someone is leaving, what went well, what would have kept them, and whether they would return.",
    lead: "Eight questions, asked kindly. People are often more honest in a form than in a meeting on their last day.",
    who: ["HR teams and founders who want to learn why people leave, and keep the next person longer."],
    faqs: [
      { q: "Who can see the answers?", a: "Only the people you give access to. Keep it to HR by inviting only them to the form." },
      { q: "Can I track reasons over time?", a: "Analytics count every answer to the main-reason question across all responses." },
    ],
    features: ["insights"],
  }),
  fromApp("employee-onboarding", {
    category: "HR",
    logic: false,
    meta: "A free new hire onboarding form template: personal details, equipment, working pattern and an emergency contact before day one.",
    lead: "Everything you need from a new starter before their first day, in three short pages.",
    who: ["Office managers and HR teams getting laptops, access and welcome packs ready in time."],
    faqs: [
      { q: "Is the data kept safe?", a: "Responses are stored securely, and on Business you can set retention rules to erase them after a period." },
      { q: "Can IT get the equipment answers?", a: "Yes. Route notifications to IT, or send them to Slack on Pro." },
    ],
    features: ["integrations"],
  }),
  fromApp("time-off-request", {
    category: "HR",
    logic: false,
    meta: "A free time off request form template: type of leave, dates and cover, sent straight to the right manager.",
    lead: "A simple leave request: type, dates and who covers. Managers hear straight away.",
    who: ["Small teams that track leave in a spreadsheet and want requests in one place."],
    faqs: [
      { q: "Can requests go to each person's manager?", a: "Routing rules send each request to a manager by the team someone picks." },
      { q: "Can it fill a spreadsheet?", a: "On Pro, Google Sheets stays up to date with every request." },
    ],
    features: ["integrations"],
  }),
  fromApp("volunteer-signup", {
    category: "Events",
    logic: false,
    meta: "A free volunteer sign-up form template: availability, roles and anything organisers should know.",
    lead: "Seven questions that tell you who can help, when, and doing what.",
    who: ["Charities, clubs, schools and event organisers building a volunteer rota."],
    faqs: [
      { q: "Can I cap how many sign up for a role?", a: "On Pro, limited places close an option once it is full." },
      { q: "Is it free for a charity?", a: "Yes. The free plan has unlimited forms, responses and members." },
    ],
    features: ["logic"],
  }),
  fromApp("workshop-registration", {
    category: "Events",
    logic: false,
    meta: "A free workshop registration form template: date, experience level and places, with payment through your own Stripe on Pro.",
    lead: "Book places on a workshop and, on Pro, take the payment in the same step through your own Stripe.",
    who: ["Trainers, studios, teachers and coaches running paid sessions."],
    faqs: [
      { q: "Can it charge per place?", a: "On Pro, a calculation multiplies places by the price and the payment charges that total." },
      { q: "Can dates close when full?", a: "On Pro, limited places close a date once it is booked out." },
    ],
    features: ["payments", "logic"],
  }),
  fromApp("webinar-registration", {
    category: "Marketing",
    logic: false,
    meta: "A free webinar registration form template: name, work email, company and role, plus the question each person wants answered.",
    lead: "Short enough to fill in on a phone, with one question that tells you what to cover.",
    who: ["Marketing teams running webinars, live demos and online events."],
    faqs: [
      { q: "Can registrations go to my email tool?", a: "On Pro, through Zapier, Make or a webhook." },
      { q: "Can I send the joining link automatically?", a: "Yes. The confirmation email can include the link and any details." },
    ],
    features: ["integrations"],
  }),
  fromApp("newsletter-signup", {
    category: "Marketing",
    logic: false,
    meta: "A free newsletter sign-up form template: email, first name and topics, ready to embed on your site.",
    lead: "Three questions. Embed it on your site or share the link, and send subscribers to your email tool on Pro.",
    who: ["Writers, shops and brands growing a mailing list."],
    faqs: [
      { q: "Can I embed it?", a: "Yes, on any plan, inline or as a popup, or share the link." },
      { q: "Does it connect to my email tool?", a: "On Pro, through Zapier, Make or a webhook." },
    ],
    features: ["integrations", "branding"],
  }),
  fromApp("waitlist", {
    category: "Marketing",
    logic: false,
    meta: "A free product waitlist form template: email, company, urgency and the problem they want solved.",
    lead: "Early-access sign-ups that also tell you who is keenest and why.",
    who: ["Founders and product teams launching something new."],
    faqs: [
      { q: "Can I rank who to let in first?", a: "On Pro, AI insights score each sign-up by how well it fits what you are looking for." },
      { q: "Can I put it on my own domain?", a: "Yes, on Pro: forms.yourproduct.com." },
    ],
    features: ["insights", "branding"],
  }),
  fromApp("testimonial-request", {
    category: "Marketing",
    logic: false,
    meta: "A free testimonial request form template: a quote, a photo and clear permission to use it.",
    lead: "Collect testimonials with the permission built in, so you never have to ask twice.",
    who: ["Freelancers, agencies, coaches and shops who want social proof on their site."],
    faqs: [
      { q: "Can people upload a photo?", a: "Yes. Uploads are on every plan, up to 20 MB each on Free." },
      { q: "Can I thank them automatically?", a: "On Pro, AI replies can write each person a personal thank-you." },
    ],
    features: ["ai-replies"],
  }),
  fromApp("quote-request", {
    category: "Sales",
    logic: false,
    meta: "A free quote request form template: what someone needs, their budget and deadline, with enough detail to price it first time.",
    lead: "Seven questions that get you everything needed to send a price, not book a discovery call.",
    who: ["Builders, designers, developers and any service business that quotes."],
    faqs: [
      { q: "Can the form work out the price?", a: "On Pro, calculations can turn answers into an estimate, and show it on the thank-you screen." },
      { q: "Can AI send a first reply?", a: "On Pro, AI replies can answer each request from your price list straight away." },
    ],
    features: ["logic", "ai-replies"],
  }),
  fromApp("booking-request", {
    category: "Business",
    logic: false,
    meta: "A free appointment booking form template: service, preferred date and time, and anything you should know beforehand.",
    lead: "Requests for an appointment, with the details you need to confirm it by email.",
    who: ["Salons, clinics, coaches and consultants who confirm bookings by hand."],
    faqs: [
      { q: "Can people pay a deposit?", a: "On Pro, take a payment through your own Stripe when they book." },
      { q: "Can the confirmation be personal?", a: "On Pro, AI replies can write each person a confirmation in your voice." },
    ],
    features: ["payments", "ai-replies"],
  }),
  fromApp("bug-report", {
    category: "Business",
    logic: false,
    meta: "A free bug report form template: what broke, steps to reproduce, severity, device and a screenshot.",
    lead: "The questions an engineer needs to fix a bug on the first try.",
    who: ["Software teams collecting bug reports from customers or testers."],
    faqs: [
      { q: "Can reports go to our issue tracker?", a: "On Pro, send each report through a webhook, Zapier or Make." },
      { q: "Can urgent bugs alert us?", a: "Routing sends blockers to a person, and Slack on Pro posts each one to a channel." },
    ],
    features: ["integrations"],
  }),
  fromApp("partnership-inquiry", {
    category: "Sales",
    logic: false,
    meta: "A free partnership inquiry form template: who they are, the kind of partnership and what they propose.",
    lead: "Six questions that tell you whether a partnership is worth a call.",
    who: ["Founders and partnership teams fielding reseller, integration and co-marketing requests."],
    faqs: [
      { q: "Can AI sort the good ones?", a: "On Pro, AI logic can decide which proposals fit and route them to you, and AI insights score each one." },
      { q: "Can I reply straight away?", a: "On Pro, AI replies can acknowledge each proposal personally." },
    ],
    features: ["logic", "insights"],
  }),
  fromApp("creative-brief", {
    category: "Agency",
    logic: false,
    meta: "A free creative brief template: objective, audience, message, tone, deliverables, deadline and budget.",
    lead: "A creative brief the client fills in, so the team starts from an agreed goal.",
    who: ["Agencies and in-house creative teams taking briefs from clients or colleagues."],
    faqs: [
      { q: "Can clients attach guidelines?", a: "Yes, files up to 20 MB on Free and 150 MB on Pro." },
      { q: "Can I brand it as my agency?", a: "Yes. Your logo and colours on any plan; your domain and no Formkit badge on Pro." },
    ],
    features: ["branding"],
  }),
  fromApp("client-feedback", {
    category: "Agency",
    logic: false,
    meta: "A free project feedback form template: satisfaction with the result and the process, what stood out and permission to quote.",
    lead: "Send it when a project wraps. Six questions tell you how it went and hand you a testimonial.",
    who: ["Studios, freelancers and agencies closing out client work."],
    faqs: [
      { q: "Can I use their answers as testimonials?", a: "Yes. The last question asks permission, so you know which quotes you can use." },
      { q: "Can I see how clients feel overall?", a: "Analytics show the averages; on Pro, AI insights read the written answers too." },
    ],
    features: ["insights"],
  }),
  fromApp("photography-booking", {
    category: "Personal",
    logic: false,
    meta: "A free photography booking form template: shoot type, date, location, hours and the shots that matter.",
    lead: "Seven questions that tell you enough to confirm availability and send a quote.",
    who: ["Photographers and videographers taking bookings from their website or Instagram."],
    faqs: [
      { q: "Can I take a deposit?", a: "On Pro, through your own Stripe account, and Formkit takes no cut." },
      { q: "Can it match my site?", a: "Yes. Your colours, fonts and logo; your own domain on Pro." },
    ],
    features: ["payments", "branding"],
  }),
  fromApp("quiz", {
    category: "Education",
    logic: false,
    meta: "A free quiz template: multiple choice, checkboxes and written answers. On Pro, add right answers, a timer, a pass mark and results.",
    lead: "A short knowledge check. Turn on quiz mode (Pro) to mark the right answers, set a timer and a pass mark, and release results when you are ready.",
    who: ["Teachers, trainers and HR teams checking what people have learned."],
    faqs: [
      { q: "Can written answers be marked?", a: "Yes. Mark them by hand in the response; everything else is marked automatically." },
      { q: "Can people see their results?", a: "Straight away, or when you release them, with or without the right answers." },
    ],
    features: ["quizzes"],
  }),
  fromApp("course-evaluation", {
    category: "Education",
    logic: false,
    meta: "A free course evaluation form template: overall rating, teaching, pace, what helped and what to change.",
    lead: "Seven anonymous questions at the end of a course, so the next group gets a better one.",
    who: ["Teachers, lecturers and trainers asking students what worked."],
    faqs: [
      { q: "Can it be anonymous?", a: "Yes. There are no name or email questions, and responses carry no identity." },
      { q: "Can I compare courses?", a: "The course dropdown lets you filter responses and analytics by course." },
    ],
    features: ["insights"],
  }),
  fromApp("course-registration", {
    category: "Education",
    logic: false,
    meta: "A free course registration form template: student details, course level, schedule and anything the teacher should know.",
    lead: "Two short pages to register a student, with room for learning needs.",
    who: ["Schools, academies, tutors and clubs taking enrolments."],
    faqs: [
      { q: "Can it take fees?", a: "On Pro, take the course fee through your own Stripe account." },
      { q: "Can levels fill up?", a: "On Pro, limited places close a level once it is full." },
    ],
    features: ["payments", "logic"],
  }),
  fromApp("course-application", {
    category: "Education",
    logic: false,
    meta: "A free program application form template: background, experience, a statement and a CV, for courses, bootcamps and scholarships.",
    lead: "Three pages that applicants can save and come back to, with a document upload at the end.",
    who: ["Bootcamps, fellowships, scholarships and selective courses."],
    faqs: [
      { q: "Can applicants save and come back?", a: "Yes. Half-finished applications are kept and come with a link to carry on." },
      { q: "Can AI help shortlist?", a: "On Pro, AI insights score each application against what you are looking for." },
    ],
    features: ["insights"],
  }),
];
