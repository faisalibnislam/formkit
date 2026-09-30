/**
 * The landing page's content.
 *
 * One continuous story on Client onboarding / Maya Okafor / Northstar website
 * redesign - 8 of 11 questions, 72.5%, 2 minutes ago - reused across every
 * section, so the page reads as one form travelling through the product.
 *
 * The four brand marks (Northstar, Merrow, Velto, Fieldnote) are invented and
 * appear only as selectable answers inside a form question. They are never
 * presented as customer proof.
 */

/** Glyphs for the field types the phone hero lists. */
export const FIELD_ICONS: Record<string, string> = {
  "Short text": "type",
  "Long text": "message-square",
  Number: "sliders-horizontal",
  Email: "at-sign",
  Phone: "user",
  Website: "globe",
  Name: "user",
  "Multiple choice": "list-checks",
  Dropdown: "compass",
  Rating: "star",
};

/** The small form pieces that float around the hero headline and lean with the pointer. */
export const FLOATIES = [
  { kind: "check", depth: 26, pos: { left: "6%", top: "24%" } },
  { kind: "toggle", depth: 40, pos: { right: "9%", top: "20%" } },
  { kind: "radio", depth: 18, pos: { left: "11%", bottom: "24%" } },
  { kind: "stars", depth: 34, pos: { right: "12%", bottom: "27%" } },
  { kind: "field", depth: 14, pos: { left: "3%", top: "52%" } },
  { kind: "upload", depth: 30, pos: { right: "4%", top: "56%" } },
] as const;

export const LANDING_FAQS = [
  {
    q: "Is Formkit free?",
    a: "Yes. Unlimited forms, responses and members, free for as long as you like, with AI for 3 new forms and 10 edits a month. Pro is $6 a seat a month and Business $19, paid for each company on its own.",
  },
  {
    q: "What can the AI do?",
    a: "Build a form from a sentence (or, on Pro, a brief or a document); edit questions, logic and themes when you ask; decide where someone goes next from what they wrote; write a personal reply to every response; and report on what your responses say.",
  },
  {
    q: "What happens when the AI allowance runs out?",
    a: "Each seat adds to one monthly pool the company shares. Past it, AI credits keep things going, from $5 for 100, and they last a year. Nothing stops working without you knowing.",
  },
  {
    q: "Does it do conditional logic?",
    a: "Rules read like sentences: when someone answers this way, skip ahead, or show or hide a question. Pro adds calculations, several endings and AI logic that reads what people wrote.",
  },
  {
    q: "Can I take payments?",
    a: "On Pro, through your own Stripe account: a fixed amount or the total your form works out. The money goes straight to you and Formkit takes no cut.",
  },
  {
    q: "Can my team work on forms together?",
    a: "Each company has members who work on every form, as Admin, Editor or Viewer. Members are free on Free; on paid plans each is a seat. Guests invited to one form are always free.",
  },
  {
    q: "What about people who do not finish?",
    a: "Half-finished answers are kept and marked, left out of your finish rate, and each one has a link you can send back so they can carry on. That is on every plan.",
  },
  {
    q: "How do I cancel?",
    a: "Turn off auto-renew in Settings → Plan. One click, no survey, no call. The plan runs to the end of the period you paid for, and nothing is deleted.",
  },
];

/** Things people want to know before they trust a form builder with their answers. */
export const TRUST_POINTS = [
  { icon: "receipt", title: "Billing by Polar", body: "Polar is the merchant of record: they take the card, add the tax and send the receipt." },
  { icon: "credit-card", title: "Your money, your Stripe", body: "Payments go straight to your own Stripe account. Formkit never holds them and takes no cut." },
  { icon: "check", title: "Cancel in one click", body: "Turn off auto-renew and the plan runs to the end of what you paid for. No survey, no call." },
  { icon: "shield", title: "Spam kept out", body: "An invisible check and limits on floods, on every form, on every plan." },
];
