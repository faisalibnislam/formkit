/**
 * The six templates Formkit ships with.
 *
 * These are the real questions a new form is built from. The marketing copy for
 * the same six lives in `src/content/templates.ts` — that file describes them
 * to a visitor, this one defines them. The slugs match, so `/templates/<slug>`
 * and "Use this template" land on the same form.
 *
 * Convex only bundles what is under `convex/`, which is why the two are not one
 * module.
 */

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
  topic: string;
  blurb: string;
  audience: string;
  blocks: TemplateBlock[];
  welcome: { title: string; message: string; button?: string };
  thanks: { title: string; message: string };
};

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    slug: "client-onboarding",
    name: "Client onboarding",
    topic: "Work",
    blurb:
      "Everything you need from a new client before the work starts, in one form they can finish over a coffee.",
    audience: "Studios, freelancers and agencies",
    welcome: {
      title: "Let's start your project",
      message: "Eleven questions, four short pages. It takes about four minutes.",
      button: "Start",
    },
    thanks: {
      title: "Thank you — we have everything",
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
        help: "A brief, a deck, a moodboard — up to 10 MB.",
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
    name: "Website questionnaire",
    topic: "Work",
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
    name: "Customer feedback",
    topic: "Feedback",
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
    name: "Lead qualification",
    topic: "Sales",
    blurb: "Enough to know whether a new enquiry is worth a call, and nothing more.",
    audience: "Anyone taking enquiries",
    welcome: {
      title: "Tell us about the work",
      message: "Eight questions so we can come back with something useful.",
      button: "Start",
    },
    thanks: {
      title: "Thanks — we will be in touch",
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
    name: "Event registration",
    topic: "Events",
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
    name: "Product research",
    topic: "Research",
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
];

export function builtinTemplate(slug: string) {
  return BUILTIN_TEMPLATES.find((t) => t.slug === slug) ?? null;
}
