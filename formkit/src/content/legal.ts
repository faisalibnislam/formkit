/**
 * The privacy policy and terms of service, as authored in the design.
 *
 * Both are plain-English and accurate to how the product actually behaves, but
 * the retention windows, jurisdictions and the liability paragraph have not
 * been through a lawyer. Have them reviewed before launch.
 */

export type LegalSection = {
  id: string;
  title: string;
  paras?: string[];
  bullets?: string[];
};

export const LEGAL_UPDATED = "21 September 2026";

export const PRIVACY: LegalSection[] = [
  {
    id: "what-this-covers",
    title: "What this covers",
    paras: [
      "Formkit is a form builder. You write questions, share a link, and the answers come back to you. This policy explains what we do with two different sets of data: the information about you as a Formkit user, and the answers your respondents send through your forms.",
      "The two are treated differently, and the difference matters. Your account is ours to look after. The answers in your forms are yours — we hold them on your behalf and do not use them for anything of our own.",
    ],
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    paras: ["Three things, and nothing else:"],
    bullets: [
      "Your account. A name, an email address, a hashed password, and a company name if you choose to add one. A company is optional and most people never add one.",
      "Your forms and their answers. Questions, themes, settings, every response, and any file somebody uploads — up to 10 MB per file.",
      "Technical records. Sign-in times, the pages you opened in the app, the browser and rough location (city level) a request came from, and errors. We keep these to work out what broke and to spot someone attacking the service.",
    ],
  },
  {
    id: "what-we-do-with-it",
    title: "What we do with it",
    paras: [
      "We use your account data to sign you in, send the notifications you asked for, and answer you when you contact support. We use the technical records to keep the service up and to investigate abuse.",
      "We do not sell anything to anyone. We do not run advertising, we do not build profiles of your respondents, and we do not train anything on your responses.",
    ],
  },
  {
    id: "answers-belong-to-you",
    title: "The answers belong to you",
    paras: [
      "When somebody fills in your form, you decide what was asked and what happens next; we store it and show it back to you. In data-protection language you are the controller and we are the processor.",
      "That means two practical things. If a respondent asks us to delete their answer, we will point them to you — it is your record to delete. And if you ask for something sensitive, it is on you to have a reason and to say so on the form.",
    ],
  },
  {
    id: "who-else-sees-it",
    title: "Who else touches it",
    paras: [
      "A small number of companies handle data for us because they run the machines: our hosting provider, our email delivery provider and our error-tracking tool. They are bound to use it only to provide that service.",
      "Formkit staff can reach your account for support — to answer a ticket, look into a report, or investigate abuse. When they do, it is logged, and a support view is read-only: staff can see what you see and change nothing.",
    ],
  },
  {
    id: "how-long",
    title: "How long we keep it",
    bullets: [
      "Responses stay until you delete them. Deleting a form moves it to Deleted, where it sits for 60 days before it goes for good.",
      "Close your account and everything — forms, responses, uploads — is removed within 30 days. Backups age out within 90.",
      "Technical records are kept for 12 months, then deleted.",
    ],
  },
  {
    id: "your-choices",
    title: "What you can do about it",
    paras: ["At any time, without asking us:"],
    bullets: [
      "Export every response as CSV or Excel.",
      "Delete a response, a form, or your whole account, from Settings.",
      "Turn off any email we send you, including the weekly report.",
      "Correct anything about you that is wrong, in Settings → Account.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies",
    paras: [
      "Formkit sets one cookie, to keep you signed in. There is no advertising cookie, no third-party tracker and no consent banner to dismiss, because there is nothing to consent to.",
    ],
  },
  {
    id: "where-data-lives",
    title: "Where the data lives",
    paras: [
      "On servers in the United States and the European Union. If you are somewhere else, your data crosses a border to reach us, under the standard contractual clauses our providers sign.",
    ],
  },
  {
    id: "children",
    title: "Children",
    paras: [
      "Formkit is not for people under 16. If you run a form aimed at children, that is your responsibility and you need the right consent to do it.",
    ],
  },
  {
    id: "changes-and-contact",
    title: "Changes, and how to reach us",
    paras: [
      "If we change anything that affects you, we will tell you in the app and by email before it takes effect — not quietly, and not after the fact.",
      "Questions, requests and complaints go to privacy@formkit.app. We answer within five working days.",
    ],
  },
];

export const PRIVACY_FOOT =
  "If you want a copy of everything we hold about you, ask at privacy@formkit.app and we will send it as a single file.";

export const TERMS: LegalSection[] = [
  {
    id: "the-agreement",
    title: "The short version",
    paras: [
      "Use Formkit to build and share forms. Do not use it to hurt people. It is free, we will do our best to keep it running, and we do not promise perfection.",
      "The rest of this page is the same thing said carefully. Using Formkit means you accept it.",
    ],
  },
  {
    id: "your-account",
    title: "Your account",
    paras: [
      "An account belongs to one person. Keep your password to yourself; anything done from your account is treated as done by you. If you invite collaborators to a form, you are responsible for what they do with it.",
      "You need to be 16 or older to have an account.",
    ],
  },
  {
    id: "what-you-may-not-do",
    title: "What you may not do",
    paras: ["A short list, and we enforce it:"],
    bullets: [
      "Collect card numbers, bank details or passwords. Formkit has no payment field and is not built to hold them.",
      "Send unsolicited email, or use a form as the landing page for a spam campaign.",
      "Impersonate somebody else, or run a form designed to trick people into handing over credentials.",
      "Upload malware, or use a form to distribute it.",
      "Collect data about people where you have no lawful reason to, or where you have hidden what you are doing with it.",
      "Hammer the service with scripts, or work around a rate limit.",
    ],
  },
  {
    id: "your-content",
    title: "Your forms stay yours",
    paras: [
      "You own your questions, your design and every response. You give us permission to store and display them, which is the only way a form tool can work. That permission ends when you delete the content or close your account.",
      "We will not use your forms in our marketing without asking you first.",
    ],
  },
  {
    id: "respondents",
    title: "The people who answer",
    paras: [
      "You decide what to ask, so you carry the duties that go with it: telling respondents who you are, why you are asking, and what happens to their answers; and having a lawful reason to hold what they send.",
      "Formkit gives you the tools — a description, a closing message, a confirmation email, an export and a delete button. Using them well is your part.",
    ],
  },
  {
    id: "availability",
    title: "What we promise about uptime",
    paras: [
      "We aim to keep Formkit up and to warn you before planned maintenance. We do not offer a service-level agreement, because the service is free. Forms stay live during most maintenance; when the dashboard is read-only we say so in advance.",
    ],
  },
  {
    id: "moderation",
    title: "Reported and locked forms",
    paras: [
      "Anyone can report a form. A Formkit admin reads the report and either dismisses it or locks the form, which stops it collecting while we look into it. We tell you when that happens and why.",
      "We can suspend an account that is breaking the rules in this page, and delete one that is doing it deliberately or repeatedly. Suspension stops your forms collecting; it does not delete what you have already collected.",
    ],
  },
  {
    id: "free",
    title: "Free, and what happens if that changes",
    paras: [
      "Formkit is free. There are no plans, no seats and no card on file. If we ever introduce a paid tier, everything you have built stays yours and stays accessible, and you will hear about the change with enough notice to export and leave if you want to.",
    ],
  },
  {
    id: "liability",
    title: "Where our responsibility ends",
    paras: [
      "Formkit is provided as it is. We do not warrant that it will be uninterrupted or free of faults, and we are not liable for lost profits, lost data or business you did not win because a form was down. Where the law lets us cap liability, it is capped at nothing, because you have paid us nothing — and nothing in this page limits liability we cannot lawfully limit, including for death, personal injury or fraud.",
    ],
  },
  {
    id: "ending-it",
    title: "Ending it",
    paras: [
      "You can close your account whenever you like, from Settings. We can end this agreement if you break the rules above, or if we shut the service down — in which case we will give you at least 60 days to export everything.",
    ],
  },
  {
    id: "changes",
    title: "Changes to these terms",
    paras: [
      "We will post any change here and tell you in the app before it takes effect. Carrying on using Formkit after that means you accept the new version.",
      "Questions go to hello@formkit.app.",
    ],
  },
];

export const TERMS_FOOT =
  "This is written to be read, not to be impressive. If a term here conflicts with a right you have under your local law, your local law wins.";
