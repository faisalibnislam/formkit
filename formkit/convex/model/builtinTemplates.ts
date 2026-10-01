/**
 * The templates Formkit ships with: the first thirteen here, the rest in
 * moreTemplates.ts.
 *
 * These are the real questions a new form is built from. The marketing copy for
 * the same six lives in `src/content/templates.ts` - that file describes them
 * to a visitor, this one defines them. The slugs match, so `/templates/<slug>`
 * and "Use this template" land on the same form. The marketing site shows six
 * of them; the app's library has all thirteen.
 *
 * Convex only bundles what is under `convex/`, which is why the two are not one
 * module.
 */

import { MORE_ORDER, MORE_TEMPLATES } from "./moreTemplates";

type Field = {
  kind: "field";
  type: string;
  title: string;
  help?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  accept?: string[];
  maxSeconds?: number;
};
type PageBreak = { kind: "pagebreak"; pageName: string };
export type TemplateBlock = Field | PageBreak;

const page = (pageName: string): PageBreak => ({ kind: "pagebreak", pageName });

const f = (type: string, title: string, extra: Partial<Field> = {}): Field => ({
  kind: "field",
  type,
  title,
  ...extra,
});

export type BuiltinTemplate = {
  slug: string;
  name: string;
  /** Business, Agency, Marketing, HR, Events or Personal. */
  topic: string;
  /** A lucide icon name, and the tint behind it, for the library's tiles. */
  icon: string;
  accent: string;
  blurb: string;
  audience: string;
  blocks: TemplateBlock[];
  welcome: { title: string; message: string; button?: string };
  thanks: { title: string; message: string };
};

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    slug: "client-onboarding",
    name: "Client Onboarding",
    topic: "Agency",
    icon: "briefcase",
    accent: "var(--blue-300)",
    blurb:
      "Everything you need from a new client before the work starts, in one form they can finish over a coffee.",
    audience: "Studios, freelancers and agencies",
    welcome: {
      title: "Let's start your project",
      message: "Eleven questions, four short pages. It takes about four minutes.",
      button: "Start",
    },
    thanks: {
      title: "Thank you, we have everything",
      message: "We will come back to you with a proposal within two working days.",
    },
    blocks: [
      f("short-text", "Who is the main contact for this project?", { required: true }),
      f("email", "Where should we send the proposal?", { required: true }),
      f("yes-no", "Have we worked together before?"),
      page("The project"),
      f("short-text", "What are we building, in one line?", { required: true }),
      f("single-choice", "Which brand is this brief for?", {
        options: ["A new brand", "An existing brand", "A sub-brand", "Not sure yet"],
      }),
      f("multi-choice", "Which parts of the brand are already fixed?", {
        options: ["Name", "Logo", "Colours", "Typography", "Tone of voice", "None of it"],
      }),
      page("Practicalities"),
      f("file", "Anything we should read first?", {
        help: "A brief, a deck, a moodboard. Up to 10 MB.",
      }),
      f("scale", "Where does the budget sit?", { scaleMin: 1, scaleMax: 5 }),
      f("date", "When does this need to be live?"),
      page("Sign-off"),
      f("short-text", "Who signs off on the final work?"),
      f("long-text", "Anything else we should know?"),
    ],
  },
  {
    slug: "website-questionnaire",
    name: "Website Questionnaire",
    topic: "Agency",
    icon: "layout-template",
    accent: "var(--blue-200)",
    blurb: "The fourteen questions that decide what a website build actually costs.",
    audience: "Anyone scoping a site",
    welcome: {
      title: "About your website",
      message: "Fourteen questions about scope, content and launch.",
      button: "Start",
    },
    thanks: {
      title: "Got it",
      message: "We will read this through and come back with a scope and a number.",
    },
    blocks: [
      f("short-text", "Who is the main contact for this site?", { required: true }),
      f("short-text", "What is the site for, in one sentence?", { required: true }),
      f("multi-choice", "Which pages are in scope?", {
        options: ["Home", "About", "Services", "Work", "Blog", "Contact", "Shop"],
      }),
      f("file", "Do you have a sitemap already?"),
      page("Content"),
      f("single-choice", "Who writes the copy?", {
        options: ["We do", "You do", "A writer we bring in", "Not decided"],
      }),
      f("single-choice", "Where do the images come from?", {
        options: ["A photoshoot", "Stock", "Our own library", "Not decided"],
      }),
      page("Technical"),
      f("short-text", "Which platform are you on today?"),
      f("yes-no", "Is the domain already registered?"),
      f("yes-no", "Do you need a content management system?"),
      f("multi-choice", "Which browsers and devices matter most?", {
        options: ["Desktop", "Phone", "Tablet", "Older browsers"],
      }),
      page("Launch"),
      f("long-text", "What must launch first?"),
      f("short-text", "Who maintains the site after launch?"),
      f("date", "What is the launch date you are working to?"),
      f("long-text", "Which sites do you admire, and why?"),
    ],
  },
  {
    slug: "customer-feedback",
    name: "Customer Feedback",
    topic: "Business",
    icon: "message-square",
    accent: "var(--mint-200)",
    blurb: "Six questions people will actually finish, asked right after the work lands.",
    audience: "Anyone who just delivered something",
    welcome: {
      title: "How did we do?",
      message: "Six questions. Under two minutes, and it genuinely helps.",
      button: "Start",
    },
    thanks: { title: "Thank you", message: "We read every one of these." },
    blocks: [
      f("rating", "How did the work land?", { scaleMax: 5 }),
      f("long-text", "What worked best?"),
      f("long-text", "What would you change?"),
      f("scale", "How clear was the process?", { scaleMin: 1, scaleMax: 5 }),
      f("yes-no", "Would you work with us again?"),
      f("long-text", "Anything else we should hear?"),
    ],
  },
  {
    slug: "lead-qualification",
    name: "Lead Generation",
    topic: "Marketing",
    icon: "magnet",
    accent: "var(--blue-200)",
    blurb: "Enough to know whether a new enquiry is worth a call, and nothing more.",
    audience: "Anyone taking enquiries",
    welcome: {
      title: "Tell us about the work",
      message: "Eight questions so we can come back with something useful.",
      button: "Start",
    },
    thanks: {
      title: "Thanks, we will be in touch",
      message: "Someone will reply within one working day.",
    },
    blocks: [
      f("short-text", "What is your name?", { required: true }),
      f("email", "What is the best email to reach you on?", { required: true }),
      f("long-text", "What are you trying to solve?", { required: true }),
      f("single-choice", "What kind of work is this?", {
        options: ["A new project", "Ongoing work", "A one-off fix", "Advice"],
      }),
      f("single-choice", "What is the timeline?", {
        options: ["This month", "This quarter", "This year", "No fixed date"],
      }),
      f("scale", "Where does the budget sit?", { scaleMin: 1, scaleMax: 5 }),
      f("short-text", "Who else is involved in the decision?"),
      f("dropdown", "How did you find us?", {
        options: ["A recommendation", "Search", "Social", "An event", "Somewhere else"],
      }),
    ],
  },
  {
    slug: "event-registration",
    name: "Event Registration",
    topic: "Events",
    icon: "calendar",
    accent: "var(--yellow-200)",
    blurb: "Names, tickets, access needs and dietary requirements, asked once.",
    audience: "Anyone running an event",
    welcome: {
      title: "Save your place",
      message: "Nine quick questions and your ticket is on its way.",
      button: "Register",
    },
    thanks: {
      title: "You're registered",
      message: "Your ticket is on its way to the address you gave us.",
    },
    blocks: [
      f("short-text", "What is your name?", { required: true }),
      f("email", "Which email should we send the ticket to?", { required: true }),
      f("multi-choice", "Which sessions are you joining?", {
        options: ["Morning keynote", "Workshops", "Lunch", "Afternoon panel", "Drinks"],
      }),
      f("single-choice", "Are you attending in person or online?", {
        options: ["In person", "Online"],
      }),
      page("Before you arrive"),
      f("short-text", "Any dietary requirements?"),
      f("yes-no", "Do you need accessible seating?"),
      f("short-text", "Who are you bringing?"),
      f("short-text", "What is your organisation?"),
      f("long-text", "Anything we should know before you arrive?"),
    ],
  },
  {
    slug: "product-research",
    name: "Product Survey",
    topic: "Marketing",
    icon: "chart-pie",
    accent: "var(--mint-200)",
    blurb: "Ten open questions that get people talking about the problem, not your product.",
    audience: "Product and research teams",
    welcome: {
      title: "Tell us how you work",
      message: "Ten questions about the problem, not about us. Around six minutes.",
      button: "Start",
    },
    thanks: {
      title: "Thank you",
      message: "This goes straight to the people building the thing.",
    },
    blocks: [
      f("long-text", "What are you trying to get done?", { required: true }),
      f("long-text", "How do you do it today?"),
      f("long-text", "What breaks most often?"),
      f("single-choice", "How often does this come up?", {
        options: ["Every day", "Every week", "Every month", "A few times a year"],
      }),
      page("What you have tried"),
      f("long-text", "What have you already tried?"),
      f("long-text", "What made you stop using it?"),
      f("scale", "How much time does this cost you a week?", { scaleMin: 1, scaleMax: 5 }),
      f("long-text", "What would make this worth paying for?"),
      page("About you"),
      f("dropdown", "What is your role?", {
        options: ["Founder", "Product", "Design", "Engineering", "Research", "Something else"],
      }),
      f("email", "Can we follow up?", { help: "Only if you want us to." }),
    ],
  },
  {
    slug: "contact-form",
    name: "Contact Form",
    topic: "Business",
    icon: "mail",
    accent: "var(--blue-300)",
    blurb: "Name, email, subject and message. The one every site needs.",
    audience: "Any website",
    welcome: {
      title: "Get in touch",
      message: "Tell us what you need and we will come back to you within one working day.",
      button: "Start",
    },
    thanks: { title: "Message sent", message: "Thank you. We reply to everything within one working day." },
    blocks: [
      f("name", "Your name", { required: true }),
      f("email", "Email address", { help: "We reply to this address", required: true }),
      f("dropdown", "What is this about?", {
        required: true,
        options: ["New project", "Existing project", "Billing", "Press", "Something else"],
      }),
      f("long-text", "How can we help?", { help: "A couple of sentences is plenty", required: true }),
      f("yes-no", "Happy to receive occasional studio news?"),
    ],
  },
  {
    slug: "branding-questionnaire",
    name: "Branding Questionnaire",
    topic: "Agency",
    icon: "palette",
    accent: "var(--mint-200)",
    blurb: "Positioning, audience and taste, without the jargon.",
    audience: "Brand studios",
    welcome: {
      title: "Brand discovery",
      message: "The more honest you are here, the better the work gets.",
      button: "Start",
    },
    thanks: {
      title: "Thank you",
      message: "We will read every word and come back with a direction to react to.",
    },
    blocks: [
      page("The business"),
      f("company", "Company name", { required: true }),
      f("email", "Email address", { required: true }),
      f("long-text", "What do you do, in one sentence?", { required: true }),
      f("long-text", "Who is it for?", { help: "Be as specific as you can", required: true }),
      page("Where you are now"),
      f("single-choice", "Is this a new brand or a refresh?", {
        required: true,
        options: ["Brand new", "Refresh of an existing brand", "Full rebrand"],
      }),
      f("long-text", "What is not working today?"),
      f("long-text", "Who else does this well?", { help: "Inside or outside your industry" }),
      page("Taste and scope"),
      f("multi-choice", "Which words should the brand feel like?", {
        options: ["Warm", "Precise", "Playful", "Quiet", "Bold", "Classic", "Technical"],
      }),
      f("long-text", "Anything you actively dislike?"),
      f("multi-choice", "What do you need delivered?", {
        required: true,
        options: ["Logo suite", "Colour and type system", "Brand guidelines", "Packaging", "Social templates", "Website"],
      }),
      f("dropdown", "Budget range", {
        required: true,
        options: ["Under $3,000", "$3,000–$10,000", "$10,000–$25,000", "Over $25,000"],
      }),
      f("file", "Existing brand assets", { help: "Logos, type, guidelines, whatever you have" }),
    ],
  },
  {
    slug: "job-application",
    name: "Job Application",
    topic: "HR",
    icon: "user-round",
    accent: "var(--neutral-150)",
    blurb: "Eligibility, role, availability, portfolio and resume upload.",
    audience: "Anyone hiring",
    welcome: {
      title: "Apply to join us",
      message: "Three pages, about seven minutes. No cover letter needed.",
      button: "Start",
    },
    thanks: {
      title: "Application received",
      message: "We review every application ourselves and reply within ten working days.",
    },
    blocks: [
      page("About you"),
      f("name", "Full name", { required: true }),
      f("email", "Email address", { required: true }),
      f("phone", "Phone number"),
      f("short-text", "Where are you based?", { help: "City and country", required: true }),
      f("single-choice", "Are you authorised to work there?", {
        required: true,
        options: ["Yes", "I would need sponsorship"],
      }),
      page("The role"),
      f("dropdown", "Which role are you applying for?", {
        required: true,
        options: ["Product designer", "Design engineer", "Brand designer", "Design lead", "Internship"],
      }),
      f("dropdown", "Years of relevant experience", {
        required: true,
        options: ["Less than 1", "1–3", "3–5", "5–8", "8+"],
      }),
      f("single-choice", "Preferred working pattern", { options: ["Full time", "Part time", "Contract"] }),
      f("dropdown", "Earliest start date", {
        required: true,
        options: ["Immediately", "Within two weeks", "Within a month", "Within three months"],
      }),
      f("short-text", "Salary expectation", { help: "A range is fine" }),
      page("Your work"),
      f("url", "Portfolio or website", { required: true }),
      f("url", "LinkedIn profile"),
      f("file", "Resume", { help: "PDF, up to 10 MB", required: true, accept: [".pdf", ".doc", ".docx"] }),
      f("long-text", "Why this role, and why us?", {
        help: "A short paragraph beats a cover letter",
        required: true,
      }),
      f("long-text", "Tell us about one project you are proud of"),
      f("single-choice", "How did you hear about this role?", {
        options: ["Our website", "LinkedIn", "A referral", "A job board", "Somewhere else"],
      }),
    ],
  },
  {
    slug: "rsvp",
    name: "RSVP",
    topic: "Personal",
    icon: "party-popper",
    accent: "var(--yellow-200)",
    blurb: "Coming or not, headcount, and a line for a message.",
    audience: "Parties, weddings and gatherings",
    welcome: {
      title: "Are you coming?",
      message: "Let us know by the end of the month so we can plan numbers.",
      button: "Reply",
    },
    thanks: {
      title: "Thank you",
      message: "Your reply is in. We will send the final details closer to the day.",
    },
    blocks: [
      f("name", "Your name", { required: true }),
      f("yes-no", "Can you make it?", { required: true }),
      f("number", "How many of you are coming?"),
      f("dropdown", "Dietary requirements", {
        options: ["None", "Vegetarian", "Vegan", "Gluten free", "Other"],
      }),
      f("long-text", "Leave a message"),
    ],
  },
  {
    slug: "project-discovery",
    name: "Project Discovery",
    topic: "Agency",
    icon: "compass",
    accent: "var(--blue-300)",
    blurb: "A longer intake for complex or multi-phase work.",
    audience: "Agencies and consultancies",
    welcome: {
      title: "Project discovery",
      message: "Thirteen questions. Skip anything you are not sure about yet.",
      button: "Start",
    },
    thanks: {
      title: "Thank you",
      message: "We will review this and suggest a discovery call with the right people.",
    },
    blocks: [
      page("About you"),
      f("name", "Your name", { required: true }),
      f("email", "Email address", { required: true }),
      f("company", "Company", { required: true }),
      f("short-text", "Your role"),
      page("The work"),
      f("dropdown", "Project type", {
        required: true,
        options: ["Website", "Brand", "Product", "Campaign", "Something else"],
      }),
      f("long-text", "What are you trying to achieve?", { required: true }),
      f("long-text", "What has been tried already?"),
      f("long-text", "How will you know it worked?", { help: "The measure you actually care about" }),
      f("multi-choice", "Who needs to sign this off?", {
        options: ["Founder", "Marketing", "Product", "Finance", "Board"],
      }),
      page("Shape and scale"),
      f("dropdown", "Budget range", {
        required: true,
        options: ["Under $10,000", "$10,000–$30,000", "$30,000–$80,000", "Over $80,000"],
      }),
      f("date", "Ideal start date"),
      f("date", "Hard deadline, if there is one"),
      f("file", "Anything useful to read first"),
    ],
  },
  {
    slug: "support-request",
    name: "Support Request",
    topic: "Business",
    icon: "life-buoy",
    accent: "var(--neutral-150)",
    blurb: "Triage by topic and urgency, with a screenshot upload.",
    audience: "Anyone running support",
    welcome: {
      title: "Tell us what is wrong",
      message: "The more detail here, the faster we can fix it.",
      button: "Start",
    },
    thanks: {
      title: "Request logged",
      message: "You will get a confirmation email with your ticket number.",
    },
    blocks: [
      f("name", "Your name", { required: true }),
      f("email", "Email address", { required: true }),
      f("dropdown", "What do you need help with?", {
        required: true,
        options: ["Something is broken", "Billing", "My account", "A feature question", "Something else"],
      }),
      f("dropdown", "How urgent is it?", {
        required: true,
        options: ["Blocking my work", "Painful but not blocking", "A minor annoyance", "Just a question"],
      }),
      f("long-text", "What happened?", {
        help: "What you expected, and what happened instead",
        required: true,
      }),
      f("url", "Which page or form?", { help: "Paste the link if you have it" }),
      f("file", "Screenshot or recording", {
        help: "PNG, JPG or MP4, up to 10 MB",
        accept: [".png", ".jpg", ".jpeg", ".mp4"],
      }),
    ],
  },
  {
    slug: "order-form",
    name: "Order Form",
    topic: "Business",
    icon: "shopping-bag",
    accent: "var(--yellow-200)",
    blurb: "Product, quantity, specification, artwork and delivery.",
    audience: "Print shops and makers",
    welcome: {
      title: "Place an order",
      message: "Two pages: what you need, then where it is going.",
      button: "Start",
    },
    thanks: {
      title: "Order received",
      message: "We will confirm pricing and a delivery date by email today.",
    },
    blocks: [
      page("What you need"),
      f("dropdown", "Product", {
        required: true,
        options: [
          "Print run: business cards",
          "Print run: posters",
          "Print run: booklets",
          "Custom job",
        ],
      }),
      f("number", "Quantity", { required: true }),
      f("dropdown", "Paper stock", {
        required: true,
        options: ["Uncoated 300gsm", "Coated 350gsm", "Recycled 300gsm", "Not sure, advise me"],
      }),
      f("long-text", "Specification and notes", { help: "Sizes, finishes, anything unusual" }),
      f("file", "Artwork", { help: "PDF preferred, up to 10 MB", accept: [".pdf", ".ai", ".png"] }),
      page("Delivery and contact"),
      f("name", "Contact name", { required: true }),
      f("email", "Email address", { required: true }),
      f("phone", "Phone number", { required: true }),
      f("address", "Delivery address", { required: true }),
      f("date", "Needed by", { required: true }),
    ],
  },
];

BUILTIN_TEMPLATES.push(...MORE_TEMPLATES);

/** The order the library shows them in. */
const ORDER = [
  "contact-form",
  "client-onboarding",
  "website-questionnaire",
  "branding-questionnaire",
  "customer-feedback",
  "job-application",
  "event-registration",
  "rsvp",
  "lead-qualification",
  "product-research",
  "project-discovery",
  "support-request",
  "order-form",
  ...MORE_ORDER,
];
BUILTIN_TEMPLATES.sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug));

export function builtinTemplate(slug: string) {
  return BUILTIN_TEMPLATES.find((t) => t.slug === slug) ?? null;
}
