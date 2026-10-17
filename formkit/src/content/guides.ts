import type { Story } from "./features";

/**
 * The how-to guides (/guides/<slug>): the general way to do something with a
 * form, the choices and the usual mistakes, then how it is done in Formkit.
 * Same shape as the feature pages. Every claim about Formkit matches the app,
 * the help centre and the pricing page; keep them in step.
 */

export const GUIDE_PAGES: Story[] = [
  {
    slug: "accept-payments-online-form",
    name: "Accept payments in a form",
    title: "How to accept payments in an online form",
    seo: "How to accept payments in an online form",
    meta: "How to accept payments in an online form: fixed, calculated or pay what you want, tax and discounts, testing, and the mistakes to avoid. With Stripe.",
    kicker: "Guide",
    lead: "Taking the money as the form is sent saves chasing invoices later. This guide covers the choices you have, how to set the amount, tax and discounts, and how to set it up in Formkit with your own Stripe account.",
    icon: "credit-card",
    plan: "Pro",
    sections: [
      {
        title: "Pay as they send, or invoice later",
        body: "There are two common ways to charge through a form. You can collect the answers and send an invoice afterwards, or take the payment as part of sending the form, so the answers and the money arrive together. Paying in the form suits anything with a known price: tickets, deposits, orders, fees and donations.",
      },
      {
        title: "Decide how the amount is set",
        body: "Most forms charge one of three ways. A fixed price suits a ticket or a fee. A calculated price suits orders and quotes, where the total depends on what someone picked. Pay what you want suits donations and sliding scales, usually with a minimum.",
        points: ["Fixed: the same amount for everyone", "Calculated: places times price, or options added up", "Pay what you want: above a minimum you set", "How many: one, a number they answered, or picked at checkout"],
      },
      {
        title: "Tax and discounts",
        body: "Decide whether your prices include tax or have it added on top, and say so on the form. Discount codes are easiest to manage where the payments are, so you can see who used which. In Formkit, promotion codes are the ones you made in Stripe, and Stripe Tax works out tax from the person's address.",
      },
      {
        title: "Let the payment provider hold the money",
        body: "Card details belong on the payment provider's own page, not in your form. In Formkit, people pay on Stripe's checkout and the money goes straight to your Stripe account. Formkit never holds it, adds no fee of its own, and refunds are made in Stripe as usual.",
      },
      {
        title: "How Formkit keeps paid and unpaid apart",
        body: "The last button says Pay and send. The answers wait while the person pays and become a response only once Stripe confirms the payment, so nobody turns up unpaid. If they leave without paying, nothing is sent, and the answers are forgotten after two days.",
      },
      {
        title: "Common mistakes",
        body: "Most problems with payment forms come from the setup, not the form.",
        points: [
          "Pasting your Stripe secret key. Formkit refuses it: use a restricted key that can only open checkouts",
          "Going live untested. Paste a test key (rk_test_…) first and try it without real money",
          "Turning on tax before Stripe Tax is set up in Stripe",
          "Leaving out the webhook. Without it, payments are confirmed as people come back and checked every 20 minutes",
          "Hiding the price until the last page. Say what it costs early",
        ],
      },
    ],
    steps: [
      "In Stripe, open Developers → API keys → Create restricted key",
      "Give it Write access to Checkout Sessions and Webhook Endpoints",
      "Paste it in a form's Settings → Payments, a test key first",
      "Choose the amount: fixed, a calculation's result, or pay what you want",
      "Set how many, promotion codes and tax, then Start taking payments",
    ],
    templates: ["order-form", "workshop-registration", "event-registration"],
    help: ["payments", "calculations", "export-responses"],
    related: ["payments", "conditional-logic-forms", "integrations"],
    faqs: [
      { q: "Can I take payments on Formkit's free plan?", a: "No. Payments through your own Stripe account are part of Pro. Stripe's own fees apply, and Formkit adds nothing." },
      { q: "Do I need a Stripe account?", a: "Yes. Payments go to your own Stripe account, through a restricted key you make there." },
      { q: "What if someone closes the tab while paying?", a: "If the payment went through, Stripe tells Formkit and the response arrives anyway. If it didn't, nothing is sent." },
      { q: "Can the total come from the answers?", a: "Yes. Write a calculation, like places times price, and choose its result as the amount in Settings → Payments." },
      { q: "Which currencies can I charge in?", a: "Fifteen: US, Canadian, Australian, New Zealand and Singapore dollars, euros, pounds, Swiss francs, Swedish kronor, Japanese yen, Indian rupees, Bangladeshi taka, Brazilian reais, Mexican pesos and UAE dirhams." },
    ],
    updated: "2026-10-17",
  },
  {
    slug: "conditional-logic-forms",
    name: "Conditional logic in forms",
    title: "How to add conditional logic to a form",
    seo: "How to add conditional logic to a form",
    meta: "How to add conditional logic to a form: show, hide and skip questions by answer, plan the paths, test each one, and avoid the usual mistakes.",
    kicker: "Guide",
    lead: "Conditional logic means each person only sees what applies to them. This guide explains the kinds of rules, how to plan the paths before you build, how to test them, and how it is done in Formkit, where logic is on every plan.",
    icon: "git-branch",
    plan: "Every plan · more on Pro",
    sections: [
      {
        title: "What conditional logic is",
        body: "A rule watches one answer and changes what happens next. Someone who says they are an existing client skips the questions about how they found you. Someone who picks Other is asked what they meant. One form can serve several kinds of people without any of them wading through the rest.",
      },
      {
        title: "The moves a rule can make",
        body: "Nearly all form logic comes down to a handful of actions. Pick the simplest one that does the job.",
        points: ["Show a follow-up only when it applies", "Hide a question that stops applying", "Skip ahead to a page, or jump back to an earlier one", "Finish the form there and then"],
      },
      {
        title: "Plan the paths first",
        body: "Sketch who fills the form in and what each kind of person needs to be asked. Put the sorting question early, because a rule can only read answers given before the question it changes. Give each branch its own page, and order rules from most specific to least, since the first rule that matches wins.",
      },
      {
        title: "Build it in Formkit",
        body: "Open the Logic tab and select Add rule. Every rule reads the same way: When a question Is a particular answer, Then show, hide or skip to a Target. Group conditions with and/or, and compare numbers, dates and text as well as choices. Or describe the rule in your own words at the top of the tab and the AI writes it against your questions.",
      },
      {
        title: "Test every path",
        body: "How it flows draws your pages in order with every skip, jump back and ending. Underneath, Formkit lists anything that looks wrong. Switch to Try it, pick answers, and see the pages a person would see, what is hidden and which ending they reach.",
      },
      {
        title: "Common mistakes",
        body: "Most broken forms have one of these.",
        points: [
          "A rule that reads an answer given after the question it changes",
          "A branch page with no skip of its own, so people fall into the next branch",
          "Logic nested more than two levels deep. Use a page break and a skip instead",
          "Never walking each path before publishing",
          "Deleting a question a rule points at, which removes that rule",
        ],
      },
    ],
    steps: [
      "Open the Logic tab and select Add rule",
      "Pick the question to watch in When, and the answer in Is",
      "Choose Then: show, hide or skip to, and the target",
      "Drag rules into order, since the first match wins",
      "Check How it flows, then walk each path in Try it",
    ],
    templates: ["lead-qualification", "support-request", "client-onboarding"],
    help: ["logic-basics", "logic-skip", "logic-show-hide", "logic-groups", "logic-jumps", "logic-map"],
    related: ["logic", "quizzes", "accept-payments-online-form"],
    faqs: [
      { q: "Is conditional logic free on Formkit?", a: "Yes. Show, hide, skip and jump rules, groups of conditions, the logic map and the tester are on every plan. Several endings, hidden options, limited places, calculations and AI logic are on Pro." },
      { q: "Can a rule send people back?", a: "Yes. A jump back sends people round again to change an answer. If it stays the same, they go round at most five times and then the form moves on." },
      { q: "Can I combine conditions?", a: "Yes. A rule can hold groups of conditions, each joined with AND or OR, like “(budget over £20k and a company email) or they asked for a call”." },
      { q: "Do hidden questions still have to be answered?", a: "No. A hidden question never counts towards required checks, and in responses it shows as blank." },
    ],
    updated: "2026-10-17",
  },
  {
    slug: "google-sheets-form",
    name: "Form responses to Google Sheets",
    title: "How to send form responses to Google Sheets",
    seo: "How to send form responses to Google Sheets",
    meta: "How to send form responses to Google Sheets: export a CSV, have a sheet read a private link, or let Formkit keep a spreadsheet up to date for you.",
    kicker: "Guide",
    lead: "A spreadsheet is still where most teams sort, count and share answers. There are three ways to get a form's responses into Google Sheets, from a one-off export to a sheet that fills itself in. This guide covers each, when to use it, and what goes wrong.",
    icon: "sheet",
    plan: "Pro · CSV export on every plan",
    sections: [
      {
        title: "Three ways in",
        body: "You can export the responses as a file and open it in Sheets, have a sheet pull them from a link on a schedule, or have the form write each response into a spreadsheet as it arrives. The first is a snapshot, the second refreshes on a timer, and the third is up to date all the time.",
      },
      {
        title: "Export a CSV (every plan)",
        body: "Choose Export CSV above the responses table and open the file in Google Sheets. You get one row per response and one column per question, and whatever filter you applied carries over. It is the right choice for a one-off count or a report, but it does not update.",
      },
      {
        title: "A spreadsheet Formkit keeps (Pro)",
        body: "In a form's Settings → Connections, choose Google Sheets and sign in with Google. Formkit makes a spreadsheet in your Drive with Submitted, Name, Email and a column for each question, adds a row as each response arrives, and updates that row if the person changes their answers. It can only reach the files it makes.",
      },
      {
        title: "A sheet that reads a private link (Pro)",
        body: "Choose Google Sheets, by link, and type the =IMPORTDATA formula Formkit shows into any cell. Google refreshes it about once an hour; the Apps Script Formkit gives you, on a time-driven trigger, refreshes every few minutes. The link carries the latest 3,000 complete responses, with calculations and payments, and needs no Google sign-in.",
      },
      {
        title: "Which to choose",
        body: "Export when you need a snapshot. Let Formkit keep a spreadsheet when the team works from the sheet day to day. Use the link when you want the data in a sheet of your own and would rather not sign in to Google.",
      },
      {
        title: "Common mistakes",
        body: "These cause most missing or muddled rows.",
        points: [
          "Typing into the sheet the link fills. The formula or script rewrites it, so work in another tab that refers to it",
          "Renaming questions after you connect. The spreadsheet's columns come from the questions at that moment, so settle them first",
          "Sharing the link. Anyone with it can read the responses; make a new one if it gets out",
          "Looking for partial responses. Only responses people sent reach the sheet",
        ],
      },
    ],
    steps: [
      "Open a form's Settings → Connections",
      "Choose Google Sheets and sign in with Google",
      "Select Make the spreadsheet",
      "Send a response from the live form and open the spreadsheet",
      "Or choose Google Sheets, by link, and paste the =IMPORTDATA formula into a cell",
    ],
    templates: ["event-registration", "volunteer-signup", "customer-feedback"],
    help: ["google-sheets", "export-responses", "partials"],
    related: ["integrations", "versions", "accept-payments-online-form"],
    faqs: [
      { q: "Can I send form responses to Google Sheets for free?", a: "Export a CSV on any plan and open it in Sheets. The live connections, the spreadsheet Formkit keeps and the private link, are part of Pro." },
      { q: "How often does the sheet update?", a: "A spreadsheet Formkit made updates as each response arrives. With the formula, about once an hour; with the Apps Script, every few minutes." },
      { q: "Does Formkit get access to my whole Google Drive?", a: "No. When you sign in, it asks only for the files it makes. The link way needs no Google access at all." },
      { q: "Can one form go to Sheets and Slack?", a: "Yes. A form can have up to ten connections of any kind." },
      { q: "What happens if the plan ends?", a: "Nothing more is sent and the link stops answering. What is already in your spreadsheet stays where it is." },
    ],
    updated: "2026-10-17",
  },
];

export const guideBySlug = (slug: string) => GUIDE_PAGES.find((p) => p.slug === slug) ?? null;
