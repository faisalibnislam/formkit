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
    date: "2026-10-17",
    title: "Sign in with Google, and a Google Sheet that keeps itself up to date",
    tag: "New",
    body: "Anyone can now sign in with their Google account, and Google Sheets can take each response as it arrives.",
    points: [
      "Continue with Google on the sign-in page, for every plan.",
      "Pro: connect Google and Formkit makes a spreadsheet in your Drive with a row for each response. It can only open the files it makes.",
      "Spam checks by Cloudflare Turnstile, usually unseen, with a tick box when it can’t run.",
      "The badge on free forms now reads “Powered by Formkit”.",
      "Business: require Google Workspace sign-in for everyone at your domain.",
      "The privacy policy and data processing agreement now cover push notifications, connected services and passkeys.",
    ],
    links: [
      { label: "Google Sheets", href: "/help/google-sheets" },
      { label: "Privacy policy", href: "/privacy" },
    ],
  },
  {
    date: "2026-10-17",
    title: "Notion, Airtable and HubSpot, and push notifications",
    tag: "New",
    body: "Send each response straight into the tools you already use, and get new responses on your phone.",
    points: [
      "Pro: each response becomes a row in a Notion database or an Airtable table made for the form, or a HubSpot contact with a note of the answers.",
      "Edited responses update what they made, instead of making another.",
      "Push notifications for new responses, mentions and approvals, on every plan.",
    ],
    links: [
      { label: "Notion, Airtable and HubSpot", href: "/help/notion-airtable-hubspot" },
      { label: "Push notifications", href: "/help/push-notifications" },
    ],
  },
  {
    date: "2026-10-15",
    title: "Payments that arrive paid, Formkit in the chat, and forms AI agents can fill in",
    tag: "New",
    body: "Forms that take payment now keep the answers once they are paid for. Your AI assistant can show your forms and responses right in the chat, and people's own AI agents can answer the forms you open to them.",
    points: [
      "Pro: people pay as they send the form. Pay what you want above a minimum, quantities, promotion codes and Stripe Tax.",
      "Ask Claude or ChatGPT for your responses and see them as a table in the chat; a form shows as a preview.",
      "Let AI agents fill in a form, form by form: checked like anyone's answers, limited, and labelled.",
      "Logic can jump back to an earlier page, to any page break, or straight to an ending.",
      "Undo and redo the last 40 changes to questions, options, pages and logic.",
      "Sign in with a passkey: Face ID, a fingerprint or your device's PIN.",
      "Export responses as JSON, or as PDFs, in a zip or as one document, in any language.",
      "Bring your Google Forms, Typeform, Tally or Jotform form over from its compare page.",
      "Answers from Formkit support now come by email, with a link to reply.",
    ],
    links: [
      { label: "AI assistants and agents", href: "/features/ai-assistants" },
      { label: "Payments", href: "/features/payments" },
    ],
  },
  {
    date: "2026-10-14",
    title: "Forms in twelve languages, a form check, and your team in the inbox",
    tag: "New",
    body: "Forms can now speak the language of the people answering, a check before publishing catches what costs answers, and the inbox works for a team.",
    points: [
      "Write a form in any of twelve languages; on Pro, offer it in more, translated by AI, with people getting their own.",
      "A form check in the publish dialog, with an AI read of your wording.",
      "Give responses to teammates, comment under them with @mentions, and save the filters you use.",
      "Pro: search responses by meaning, and ask one question across several forms.",
      "Matrix and ranking questions, and signatures drawn with a finger, mouse or pen.",
      "Open a form on a date and time; on Pro, remind people who stopped partway.",
      "Webhooks pick their events and can be sent again; Discord and Microsoft Teams join Slack.",
      "Every respondent can keep a receipt of what they sent, to print or save as a PDF.",
      "Keyboard shortcuts in the builder: press ? for the list.",
    ],
    links: [
      { label: "Forms in other languages", href: "/help/languages" },
      { label: "Read your responses", href: "/help/read-responses" },
    ],
  },
  {
    date: "2026-10-14",
    title: "Formkit in your AI assistant, imports, and AI that reads every answer",
    tag: "New",
    body: "Ask Claude, ChatGPT or Cursor to build a form, publish it, or tell you what people said. Bring a form over from another tool in a minute. And on Pro, AI now reads every response, asks one follow-up question when an answer is vague, and writes out voice recordings.",
    points: [
      "Connect an AI assistant to Formkit on any plan. It does only what you allow, never deletes anything, and its new forms stay drafts until you publish.",
      "The API is on every plan now, and can build, edit and publish forms as well as read and tag responses.",
      "Import from Google Forms, Typeform, Tally or Jotform by pasting the form's link.",
      "Each question's answers summed up on the Analytics page: choices counted, ratings averaged, NPS worked out.",
      "Pro: AI reads every response for sentiment, topics and urgency, without writing replies.",
      "Pro: an AI follow-up question after a vague written answer, which people can always skip.",
      "Pro: voice recordings written out, so you can search them, export them and skim them.",
      "Pro: the weekly report says what people said, form by form.",
      "Text, picture and video blocks between questions, NPS and labelled scales, \"Other\" answers, and answer rules (lengths, ranges, patterns).",
      "Save and finish later: people can email themselves a link back to their answers.",
    ],
    links: [
      { label: "The API and AI assistants", href: "/api-docs" },
      { label: "AI insights", href: "/features/insights" },
    ],
  },
  {
    date: "2026-10-01",
    title: "Voice recordings",
    tag: "New",
    body: "A new Voice recording question lets people answer out loud. They press a button and talk, then listen back and record again if they want to before sending.",
    points: [
      "Choose the longest recording: 15 or 30 seconds, or 1, 2, 3 or 5 minutes.",
      "A timer counts down, and the recording stops by itself at the limit.",
      "If a browser cannot record, people can upload an audio file instead.",
      "Recordings play right in the response. Exports, webhooks, Google Sheets and the API link to each one.",
    ],
    links: [
      { label: "How voice recordings work", href: "/help/voice-recording" },
      { label: "The form builder", href: "/features/builder" },
    ],
  },
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
      "Pro: webhooks, Slack, Google Sheets and payments with your own Stripe.",
      "Business: shared templates, approvals, an audit log, retention rules and sign-in with your company’s Google Workspace.",
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
