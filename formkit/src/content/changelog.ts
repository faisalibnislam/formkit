/**
 * /changelog: what shipped, newest first. Plain words, what changed for the
 * person using Formkit, and a link to the page or help article that explains
 * it. Plans named here are the plans today, not at release.
 */

export type ChangelogEntry = {
  date: string;
  title: string;
  body: string;
  points?: string[];
  tag?: "New" | "Improved" | "Plans";
  links?: { label: string; href: string }[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-09-30",
    title: "37 templates, feature pages and more comparisons",
    tag: "New",
    body: "The template library grew from 13 to 37, grouped by what they are for: feedback, HR, events, education, sales and more. Every feature now has its own page, and there are pages for the teams that use Formkit most.",
    links: [
      { label: "Templates", href: "/templates" },
      { label: "Features", href: "/features" },
      { label: "Compare", href: "/compare" },
    ],
  },
  {
    date: "2026-09-29",
    title: "Plan controls with no tricks",
    tag: "Improved",
    body: "Settings, then Plan, shows when your plan renews and for how much, or the day it ends.",
    points: [
      "An Auto-renew switch turns renewal off and back on in one click.",
      "Switch between Pro and Business in place. You only pay the difference.",
      "Cancel is one clear button, and it tells you the day the plan ends.",
      "Invoices and payment details open in Polar's billing portal.",
    ],
    links: [{ label: "Pricing", href: "/pricing" }],
  },
  {
    date: "2026-09-29",
    title: "Companies as workspaces",
    tag: "Plans",
    body: "Each company now has its own forms, members, plan and AI allowance. Switch between them beside the logo. Paid plans are priced per seat, a Free company can have as many members as it likes, and AI credit packs top up the shared allowance.",
    points: [
      "Pro is $6 a seat a month and Business is $19.",
      "Every company can have a full logo and a square one.",
      "Custom domains belong to the company they were added in.",
    ],
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "AI allowance and credits", href: "/help/ai-credits" },
    ],
  },
  {
    date: "2026-09-29",
    title: "Custom domains, step by step",
    tag: "Improved",
    body: "Connecting a domain now shows where your DNS is managed, the exact record to add with copy buttons, steps for your provider, and what public DNS shows right now. Common mistakes, like a clashing record or Cloudflare's proxy, are called out.",
    links: [{ label: "Branding and domains", href: "/features/branding" }],
  },
  {
    date: "2026-09-28",
    title: "Quizzes and exams",
    tag: "New",
    body: "Give questions right answers and marks. Responses are marked as they arrive, and written answers wait for you to mark them by hand.",
    points: [
      "A timer that submits the quiz at zero.",
      "Shuffle questions and options, and allow one attempt per person.",
      "Show results straight away, or hold them and release them later.",
      "The average, pass rate and results for each question.",
    ],
    links: [{ label: "Quizzes", href: "/features/quizzes" }],
  },
  {
    date: "2026-09-28",
    title: "AI replies and AI insights",
    tag: "New",
    body: "Write instructions once, and each complete response gets a reply of its own, on the thank-you screen, by email, or both. Forms with AI replies on also get insights: sentiment, urgency, topics, what people want and which responses deserve a personal answer.",
    links: [
      { label: "AI replies", href: "/features/ai-replies" },
      { label: "AI insights", href: "/features/insights" },
    ],
  },
  {
    date: "2026-09-28",
    title: "Logic, rebuilt",
    tag: "Improved",
    body: "Rules can hold groups of conditions, read calculation results, and compare with any-of, between, dates, email domains and patterns. The Logic tab gained a map of the whole flow that checks for common mistakes, and a tester that runs the same rules the live form runs.",
    points: [
      "On Pro: several endings, hidden options and limited places per option.",
      "On Pro: AI logic, which asks a yes-or-no question about an answer or pulls a fact into a hidden field.",
      "On every plan: describe a rule in plain words and review what Formkit writes.",
    ],
    links: [{ label: "Logic", href: "/features/logic" }],
  },
  {
    date: "2026-09-28",
    title: "Free, Pro and Business",
    tag: "Plans",
    body: "Formkit now has paid plans. Free stays the whole form builder, with unlimited forms and responses. Pro adds your own brand, your tools and AI on your responses. Business adds team controls.",
    points: [
      "Pro: custom domains, sending from your own domain, fonts and CSS.",
      "Pro: hidden fields, earlier answers in later questions, calculations and redirects.",
      "Pro: webhooks, Slack, Google Sheets, Zapier, Make and payments with your own Stripe.",
      "Business: shared templates, approvals, an audit log, retention rules, the API and single sign-on.",
    ],
    links: [{ label: "Pricing", href: "/pricing" }],
  },
  {
    date: "2026-09-28",
    title: "Emails that look like your brand",
    tag: "Improved",
    body: "Every email was redesigned. The confirmation a respondent receives carries your logo and brand colour, not ours.",
  },
  {
    date: "2026-09-27",
    title: "Ask Formkit",
    tag: "New",
    body: "Describe a form and Formkit writes it. On Pro it can also work from a pasted brief or an uploaded document. It can add questions, write logic rules, pick a theme and rewrite the wording in a new tone, and nothing changes until you accept it.",
    links: [{ label: "AI form builder", href: "/features/ai-form-builder" }],
  },
  {
    date: "2026-09-23",
    title: "Notifications and @mentions",
    tag: "New",
    body: "The bell is now a real inbox: new responses, comments and replies, @mentions, forms shared with you, and security alerts. Replies and mentions you have not read after ten minutes arrive by email.",
  },
  {
    date: "2026-09-23",
    title: "Working together on a form",
    tag: "New",
    body: "Share a form as Editor, Commenter or Viewer, leave comments on questions, see who else is in the form, and preview it exactly as respondents will.",
  },
  {
    date: "2026-09-22",
    title: "Formkit opens",
    tag: "New",
    body: "The first public version: the form builder, themes, logic, publishing under your own link, responses, analytics and templates.",
    links: [{ label: "Getting started", href: "/help/create-first-form" }],
  },
];
