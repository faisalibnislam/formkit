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
  /** Blocks of code, shown after the text - the API docs use these. */
  code?: string[];
};

export const LEGAL_UPDATED = "21 September 2026";

export const PRIVACY: LegalSection[] = [
  {
    id: "what-this-covers",
    title: "What this covers",
    paras: [
      "Formkit is a form builder. You write questions, share a link, and the answers come back to you. This policy explains what we do with two different sets of data: the information about you as a Formkit user, and the answers your respondents send through your forms.",
      "The two are treated differently, and the difference matters. Your account is ours to look after. The answers in your forms are yours. We hold them on your behalf and do not use them for anything of our own.",
    ],
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    paras: ["Three things, and nothing else:"],
    bullets: [
      "Your account. A name, an email address, a hashed password, and a company name if you choose to add one. A company is optional and most people never add one.",
      "Your forms and their answers. Questions, themes, settings, every response, and any file somebody uploads (up to 20 MB per file on Free, more on paid plans).",
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
      "That means two practical things. If a respondent asks us to delete their answer, we will point them to you, because it is your record to delete. And if you ask for something sensitive, it is on you to have a reason and to say so on the form.",
    ],
  },
  {
    id: "who-else-sees-it",
    title: "Who else touches it",
    paras: [
      "A small number of companies handle data for us because they run the machines: our hosting provider, our email delivery provider and our error-tracking tool. They are bound to use it only to provide that service.",
      "Formkit staff can reach your account for support: to answer a ticket, look into a report, or investigate abuse. When they do, it is logged, and a support view is read-only: staff can see what you see and change nothing.",
    ],
  },
  {
    id: "how-long",
    title: "How long we keep it",
    bullets: [
      "Responses stay until you delete them. Deleting a form moves it to Deleted, where it sits for 60 days before it goes for good.",
      "Close your account and everything (forms, responses, uploads) is removed within 30 days. Backups age out within 90.",
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
      "If we change anything that affects you, we will tell you in the app and by email before it takes effect. Not quietly, and not after the fact.",
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
      "Use Formkit to build and share forms. Do not use it to hurt people. The Free plan costs nothing; Pro and Business are paid by subscription through Polar, and you can cancel any time. We will do our best to keep it running, and we do not promise perfection.",
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
      "Ask for card numbers, bank details or passwords in a question. A form that takes payment does it through its payment step, where Stripe handles the card, not Formkit.",
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
      "Formkit gives you the tools: a description, a closing message, a confirmation email, an export and a delete button. Using them well is your part.",
    ],
  },
  {
    id: "availability",
    title: "What we promise about uptime",
    paras: [
      "We aim to keep Formkit up and to warn you before planned maintenance. We do not offer a service-level agreement on any plan. Forms stay live during most maintenance; when the dashboard is read-only we say so in advance.",
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
    id: "plans",
    title: "Plans and payment",
    paras: [
      "Formkit has three plans. Free costs nothing and has no time limit. Pro and Business are subscriptions, monthly or yearly, at the prices on the pricing page.",
      "Paid plans are sold by Polar (polar.sh), who act as the merchant of record: they take the payment, charge any sales tax or VAT, and send the receipt, and their checkout terms apply to the purchase. A subscription renews automatically at the end of each period until you cancel it.",
      "You can cancel, or move between plans, any time from Settings → Plan. A cancelled plan stays on until the end of the period you have paid for and is not charged again. We do not refund part-used periods, except where the law requires us to.",
      "If a payment fails, Polar tries again; the plan stays on until the end of the period while it does. Moving to a lower plan never deletes anything: features that are not in the new plan stop, and everything you built or collected stays yours and exportable.",
      "We will give you at least 30 days' notice by email before changing the price of a plan you are on.",
    ],
  },
  {
    id: "liability",
    title: "Where our responsibility ends",
    paras: [
      "Formkit is provided as it is. We do not warrant that it will be uninterrupted or free of faults, and we are not liable for lost profits, lost data or business you did not win because a form was down. Where the law lets us cap liability, it is capped at what you paid us in the twelve months before the claim, which on the Free plan is nothing. Nothing in this page limits liability we cannot lawfully limit, including for death, personal injury or fraud.",
    ],
  },
  {
    id: "ending-it",
    title: "Ending it",
    paras: [
      "You can close your account whenever you like, from Settings. We can end this agreement if you break the rules above, or if we shut the service down. In that case we will give you at least 60 days to export everything.",
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

/**
 * The data processing agreement. Business accounts accept it with the plan;
 * anyone may read it. Like the rest of this file it is plain English and has
 * not been through a lawyer - have it reviewed before relying on it.
 */
export const DPA: LegalSection[] = [
  {
    id: "parties",
    title: "Who this is between",
    paras: [
      "This agreement is between you, the Formkit customer who builds forms and collects responses (the controller), and Formkit (the processor). It forms part of the terms of service and applies whenever Formkit processes personal data in the responses your forms collect.",
      "It is included with the Business plan. Customers on any plan may rely on it; if your organisation needs a countersigned copy, ask from Settings → Plan → Contact support.",
    ],
  },
  {
    id: "scope",
    title: "What we process, and why",
    bullets: [
      "Subject matter: the answers, files and contact details people give in your forms, and the account details of you and your team.",
      "Purpose: to host your forms, collect and store responses, send the emails you switch on, and give you the exports and connections you set up.",
      "Duration: for as long as you use Formkit, then as set out under deletion below.",
      "People concerned: the people who answer your forms, and your team members.",
    ],
  },
  {
    id: "instructions",
    title: "We act only on your instructions",
    paras: [
      "We process the data only to provide Formkit as you configure it. Your forms, settings, connections and exports are your instructions. We do not sell it, use it to advertise, or use your responses to train AI models. If we ever believe an instruction breaks data-protection law, we will tell you.",
    ],
  },
  {
    id: "confidentiality",
    title: "Confidentiality and staff access",
    paras: [
      "Everyone at Formkit who can reach customer data is bound to confidentiality. Staff reach an account only to answer a ticket, look into a report or investigate abuse; that access is read-only in the product and is logged.",
    ],
  },
  {
    id: "security",
    title: "Security measures",
    bullets: [
      "Data is encrypted in transit (TLS) and at rest by our hosting providers.",
      "Passwords are never stored in readable form; API keys are kept only as hashes.",
      "Access to production systems is limited to the people who run Formkit.",
      "Business accounts get an audit log of who did what, automatic deletion after a period you choose, and single sign-on for your domain.",
    ],
  },
  {
    id: "subprocessors",
    title: "Subprocessors",
    paras: ["We use these companies to run Formkit. Each is bound to protect the data at least as well as this agreement requires:"],
    bullets: [
      "Convex: database, file storage and back-end hosting.",
      "Vercel: hosting for the website and the forms.",
      "Resend: delivery of the emails Formkit sends.",
      "Polar: billing for Formkit plans (your account details only, never your responses).",
      "Google: the AI features, only when you use Ask Formkit: your prompts and the form, and responses only when you ask it to summarise them.",
    ],
  },
  {
    id: "changes-to-subprocessors",
    title: "Changes to subprocessors",
    paras: [
      "We will list any new subprocessor on this page and tell Business accounts in the app at least 30 days before it starts. If you object on reasonable data-protection grounds, you may end your plan and we will refund the unused part of it.",
    ],
  },
  {
    id: "your-own-services",
    title: "Services you connect yourself",
    paras: [
      "Webhooks, Slack, Google Sheets and Stripe payments send data where you tell them to. Those services are yours to choose, and your agreement with them, not this one, covers what they do with it.",
    ],
  },
  {
    id: "helping-you",
    title: "Helping you with requests and incidents",
    bullets: [
      "Requests from the people who answered your forms to see, correct or delete their answers can be handled by you in the app. If one comes to us, we pass it to you.",
      "If we learn of a breach affecting your data, we will tell you without undue delay, and within 72 hours, with what we know and what we are doing.",
      "We will give you the information you reasonably need for a data-protection impact assessment or to answer a regulator.",
    ],
  },
  {
    id: "transfers",
    title: "International transfers",
    paras: [
      "Data is stored in the United States and the European Union. Where data leaves the EEA, the UK or Switzerland, transfers rely on the standard contractual clauses our providers have signed.",
    ],
  },
  {
    id: "deletion",
    title: "Deletion at the end",
    paras: [
      "You can export and delete your data at any time. When you close your account, everything (forms, responses, uploads) is removed within 30 days, and backups age out within 90.",
    ],
  },
  {
    id: "audits",
    title: "Audits",
    paras: [
      "We will answer reasonable written questions about how we protect your data, once a year or after an incident. On-site audits are by agreement, at your cost.",
    ],
  },
];

export const DPA_FOOT =
  "Where this agreement and the terms of service disagree about personal data, this agreement wins. Questions go to hello@formkit.app.";
