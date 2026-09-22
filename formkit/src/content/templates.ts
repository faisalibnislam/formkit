/**
 * The six built-in form templates.
 *
 * Each gets its own indexable route (`/templates/<slug>`) rather than the hash
 * routing the prototype used — the handoff calls that the highest-value SEO
 * task in the build.
 */

export type TemplateQuestion = {
  /** The question as the respondent reads it. */
  title: string;
  /** Its answer type, in the app's own words. */
  type: string;
  /** A Lucide glyph name. */
  icon: string;
};

export type FormTemplate = {
  slug: string;
  name: string;
  icon: string;
  time: string;
  pages: string;
  logic: boolean;
  blurb: string;
  /** The meta description for this template's own page. */
  meta: string;
  lead: string;
  questions: TemplateQuestion[];
  who: string[];
  faqs: { q: string; a: string }[];
};

const q = (title: string, type: string, icon: string): TemplateQuestion => ({
  title,
  type,
  icon,
});

export const TEMPLATES: FormTemplate[] = [
  {
    slug: "client-onboarding",
    name: "Client onboarding",
    icon: "briefcase",
    time: "4 min",
    pages: "4",
    logic: true,
    blurb:
      "Everything you need from a new client before the work starts, in one form they can finish over a coffee.",
    meta: "A free client onboarding form template: contact, project scope, brand assets, budget and sign-off, with logic that skips returning clients past what you already know.",
    lead: "Eleven questions, split across four pages so nobody faces a wall of inputs. A conditional rule sends returning clients straight to scope, which drops their form to eight questions.",
    questions: [
      q("Who is the main contact for this project?", "Name", "user"),
      q("Where should we send the proposal?", "Email", "at-sign"),
      q("Have we worked together before?", "Yes / no", "circle-dot"),
      q("What are we building, in one line?", "Short text", "type"),
      q("Which brand is this brief for?", "Multiple choice", "list-checks"),
      q("Which parts of the brand are already fixed?", "Multiple choice", "palette"),
      q("Anything we should read first?", "File upload", "paperclip"),
      q("Where does the budget sit?", "Scale", "sliders-horizontal"),
      q("When does this need to be live?", "Date", "calendar"),
      q("Who signs off on the final work?", "Short text", "badge-check"),
      q("Anything else we should know?", "Long text", "message-square"),
    ],
    who: [
      "Studios, freelancers and consultants who currently gather this over email and end up chasing three of the answers a week later. The form replaces the back-and-forth with one link you send when a project is agreed.",
      "It also doubles as a record. Six months in, when somebody asks what was agreed about sign-off, the answer is in the response rather than in a thread.",
    ],
    faqs: [
      {
        q: "Can I use this for retainer clients too?",
        a: 'Yes. The "have we worked together before" rule exists for exactly that — returning clients skip the three brand questions and answer eight instead of eleven.',
      },
      {
        q: "What file types can clients upload?",
        a: "Anything you allow. The question can list accepted extensions, and each file can be up to 10 MB.",
      },
      {
        q: "Can the response go to a specific person?",
        a: "Yes. A routing rule can send the email to a different address depending on how a question was answered — by project type, for instance.",
      },
    ],
  },
  {
    slug: "website-questionnaire",
    name: "Website questionnaire",
    icon: "monitor",
    time: "6 min",
    pages: "4",
    logic: true,
    blurb:
      "The scoping questions that decide whether a website project runs smoothly or drifts for a month.",
    meta: "A free website questionnaire template: pages in scope, who writes the copy, launch priorities, current platform and who maintains the site after launch.",
    lead: "Fourteen questions covering scope, content, technical position and ownership after launch. The longest template here, and the one that saves the most time later.",
    questions: [
      q("Who is the main contact for this site?", "Name", "user"),
      q("What is the site for, in one sentence?", "Short text", "type"),
      q("Which pages are in scope?", "Multiple choice", "list-checks"),
      q("Do you have a sitemap already?", "File upload", "paperclip"),
      q("Who writes the copy?", "Multiple choice", "pen-line"),
      q("Where do the images come from?", "Multiple choice", "image"),
      q("Which platform are you on today?", "Short text", "code"),
      q("Is the domain already registered?", "Yes / no", "globe"),
      q("What must launch first?", "Long text", "rocket"),
      q("Which browsers and devices matter most?", "Multiple choice", "monitor"),
      q("Do you need a content management system?", "Yes / no", "layout-template"),
      q("Who maintains the site after launch?", "Short text", "settings"),
      q("What is the launch date you are working to?", "Date", "calendar"),
      q("Which sites do you admire, and why?", "Long text", "star"),
    ],
    who: [
      "Web designers and agencies taking on a build where the client has not yet decided who writes the copy or who owns the site afterwards. Those two questions cause more delay than any technical decision.",
      "If you quote from this form, the quote holds — because the scope is written down before you price it.",
    ],
    faqs: [
      {
        q: "Is fourteen questions too many?",
        a: "It is split across four pages with a progress indicator, so it reads as four short steps. Partial answers are kept, so somebody can start it and come back.",
      },
      {
        q: "Can I ask for the current site analytics?",
        a: "Add a file upload question. Up to 10 MB per file, and you can restrict it to the formats you want.",
      },
      {
        q: "Does it work for a redesign as well as a new build?",
        a: '"Which platform are you on today" and "is the domain already registered" cover the redesign case; delete them for a greenfield project.',
      },
    ],
  },
  {
    slug: "customer-feedback",
    name: "Customer feedback",
    icon: "message-square",
    time: "2 min",
    pages: "1",
    logic: false,
    blurb:
      "Six questions people will actually finish, ending with the one that tells you whether to change anything.",
    meta: "A free customer feedback form template: six short questions on how the work landed, what to change, and whether they would recommend you.",
    lead: "Short on purpose. Feedback forms fail because they are long, so this one asks six questions on a single page and can be finished in about two minutes.",
    questions: [
      q("How did the work land?", "Rating", "star"),
      q("What worked best?", "Long text", "circle-check"),
      q("What would you change?", "Long text", "pen-line"),
      q("How clear was the process?", "Scale", "sliders-horizontal"),
      q("Would you work with us again?", "Yes / no", "circle-dot"),
      q("Anything else we should hear?", "Long text", "message-square"),
    ],
    who: [
      "Anybody finishing a piece of client work who wants an honest read while it is still fresh. Send it the day you deliver, not a month later.",
      "The rating and the scale give you something to track across projects; the three open questions give you the reason behind the number.",
    ],
    faqs: [
      {
        q: "Should feedback be anonymous?",
        a: "You decide. Remove the email question and nothing identifies the respondent, though you lose the ability to follow up.",
      },
      {
        q: "Can I see how many people dropped out?",
        a: "Yes. Analytics shows views, starts, completions and the question people stop on.",
      },
      {
        q: "Can I send a copy of their answers back to them?",
        a: "Turn on the respondent confirmation and optionally attach their answers.",
      },
    ],
  },
  {
    slug: "lead-qualification",
    name: "Lead qualification",
    icon: "magnet",
    time: "3 min",
    pages: "2",
    logic: true,
    blurb:
      "Enough to know whether an enquiry is worth a call, without making a good lead fill in a form they resent.",
    meta: "A free lead qualification form template: the problem, the timeline, the budget range, who else is involved and how they found you — with routing to the right person.",
    lead: "Eight questions across two pages. Routing rules send each enquiry to the right inbox based on what they picked, so nothing sits unclaimed.",
    questions: [
      q("What is your name?", "Name", "user"),
      q("What is the best email to reach you on?", "Email", "at-sign"),
      q("What are you trying to solve?", "Long text", "circle-help"),
      q("What kind of work is this?", "Multiple choice", "list-checks"),
      q("What is the timeline?", "Multiple choice", "calendar-clock"),
      q("Where does the budget sit?", "Scale", "sliders-horizontal"),
      q("Who else is involved in the decision?", "Short text", "users"),
      q("How did you find us?", "Dropdown", "compass"),
    ],
    who: [
      'Anyone whose contact page currently says "get in touch" and produces enquiries with no detail in them. Eight questions is the point where you learn enough to prepare for a call without losing people.',
      "The budget question is a scale rather than a text field on purpose — a range is easier to answer honestly than a number.",
    ],
    faqs: [
      {
        q: "Will asking about budget put people off?",
        a: "A range framed as a scale is far easier to answer than an open field. If you would rather not ask, delete the question — the rest of the form stands on its own.",
      },
      {
        q: "Can different enquiry types go to different people?",
        a: 'Yes. Routing rules read the answer to "what kind of work is this" and send the alert to the matching address. The first matching rule wins.',
      },
      {
        q: "Can I embed this on my site?",
        a: "Yes, inline, as a popup or full screen. The embed snippet is in the Share modal.",
      },
    ],
  },
  {
    slug: "event-registration",
    name: "Event registration",
    icon: "calendar",
    time: "3 min",
    pages: "2",
    logic: true,
    blurb:
      "Sessions, dietary needs, accessibility and guests — the four things you will otherwise chase by email.",
    meta: "A free event registration form template: attendee details, session choices, dietary requirements, accessibility needs and guests, with a confirmation email.",
    lead: "Nine questions over two pages, ending with a confirmation email that gives the attendee something to keep. Close the form when you are full — the link keeps working and shows your closing message.",
    questions: [
      q("What is your name?", "Name", "user"),
      q("Which email should we send the ticket to?", "Email", "at-sign"),
      q("Which sessions are you joining?", "Multiple choice", "list-checks"),
      q("Are you attending in person or online?", "Multiple choice", "monitor"),
      q("Any dietary requirements?", "Short text", "circle-alert"),
      q("Do you need accessible seating?", "Yes / no", "circle-dot"),
      q("Who are you bringing?", "Short text", "users"),
      q("What is your organisation?", "Short text", "building-2"),
      q("Anything we should know before you arrive?", "Long text", "message-square"),
    ],
    who: [
      "Workshops, meet-ups, launches and anything with a headcount. The accessibility and dietary questions are here because they are the two most often forgotten and the two most expensive to fix late.",
      "Pair it with a QR code on printed material — every published form has one.",
    ],
    faqs: [
      {
        q: "Can I stop registrations when we are full?",
        a: "Close the form. The link stays live and shows your closing message instead of the questions, so nobody gets a dead page.",
      },
      {
        q: "Do attendees get a confirmation?",
        a: "Turn on the respondent confirmation and write what it says. You can attach a copy of their answers.",
      },
      {
        q: "Can I export the attendee list?",
        a: "Yes, to CSV or Excel, matching whatever filter you have applied.",
      },
    ],
  },
  {
    slug: "product-research",
    name: "Product research",
    icon: "scan-search",
    time: "4 min",
    pages: "3",
    logic: false,
    blurb:
      "Ten questions that get at what someone actually does today, rather than what they say they would like.",
    meta: "A free product research form template: the problem, the current workaround, what breaks, what they would pay for, and permission to follow up.",
    lead: "Written to avoid the usual trap of asking people to predict their own behaviour. Most questions are about what already happens, not what might.",
    questions: [
      q("What are you trying to get done?", "Long text", "circle-help"),
      q("How do you do it today?", "Long text", "settings-2"),
      q("What breaks most often?", "Long text", "triangle-alert"),
      q("How often does this come up?", "Multiple choice", "calendar-clock"),
      q("What have you already tried?", "Long text", "history"),
      q("What made you stop using it?", "Long text", "circle-alert"),
      q("How much time does this cost you a week?", "Scale", "timer"),
      q("What would make this worth paying for?", "Long text", "receipt"),
      q("What is your role?", "Dropdown", "briefcase"),
      q("Can we follow up?", "Email", "at-sign"),
    ],
    who: [
      "Founders and product teams doing discovery who want notes they can act on rather than a list of feature requests. The questions ask about the present, which people can answer accurately.",
      "Ten questions across three pages, with the follow-up permission last so a refusal does not cost you the rest of the answers.",
    ],
    faqs: [
      {
        q: "Why so many open questions?",
        a: "Because the value is in the wording people choose. Multiple choice would give you cleaner data about a question you have already decided the answer to.",
      },
      {
        q: "Can I summarise the responses?",
        a: "If AI is enabled on your account, the assistant can summarise a batch of responses. It is free — only creating a new form spends a credit.",
      },
      {
        q: "What if somebody abandons it halfway?",
        a: "Partial answers are kept and badged separately, and each has a resume link you can send back.",
      },
    ],
  },
];

export function templateBySlug(slug: string) {
  return TEMPLATES.find((t) => t.slug === slug) ?? null;
}
