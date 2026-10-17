import type { Story } from "./features";

/**
 * More feature pages (/features/<slug>): calculations, languages, partial
 * responses and file uploads, in the same shape as FEATURE_PAGES. Every claim
 * here matches the app, the help centre and the pricing page; keep them in
 * step.
 */

export const MORE_FEATURE_PAGES: Story[] = [
  {
    slug: "calculations",
    name: "Calculations and scoring",
    title: "Answers that add up to a price, a score or a total.",
    seo: "Form calculator: add calculations to forms",
    meta: "Add calculations to Formkit forms: give options points, write a formula, show the total on the thank-you screen or charge it with Stripe. On Pro.",
    kicker: "Calculations",
    lead: "Give each option points, or use number, rating and scale answers as they are. Write a small formula and Formkit works out a price, a score or a total for every response, then shows it, saves it, or charges it.",
    icon: "calculator",
    plan: "Pro",
    sections: [
      {
        title: "Numbers from any answer",
        body: "A choice question's options can each carry points, and a multiple-choice answer adds up the points of everything picked. Number, rating and scale questions count as their own value. A question nobody answered counts as 0.",
      },
      {
        title: "Formulas you can read",
        body: "In the Logic tab, under Calculations, give each one a name and a formula over question keys, like quality + value * 2. Each calculation can use the ones above it.",
        points: ["+ − × ÷ and brackets", "min, max, round and abs", "Earlier calculations by name"],
      },
      {
        title: "Use the result",
        body: "Quote it on the thank-you screen with {{total}}, use it in a logic condition to send people to the right ending, or charge it with payments. A quote that adds up the options someone picked becomes the amount Stripe asks for.",
      },
      {
        title: "Kept with every response",
        body: "Results are worked out when the form is sent and saved with the response. They show in the inbox, come out as columns in exports, and travel in webhooks and the Google Sheets link.",
      },
    ],
    steps: [
      "Give the questions you need short keys, and options points",
      "Open the Logic tab and add a calculation under Calculations",
      "Write the formula, like quality + value * 2",
      "Quote it with {{total}}, or pick it as the amount in Settings → Payments",
    ],
    templates: ["quote-request", "order-form", "quiz"],
    help: ["calculations", "payments", "logic-groups", "piping-redirects"],
    related: ["logic", "payments", "quizzes"],
    faqs: [
      { q: "Can the total set the payment amount?", a: "Yes. In Settings → Payments, choose the result of a calculation as the amount, and people pay what their answers came to." },
      { q: "Can logic use a calculation?", a: "Yes. A condition can read a calculation's result, so a high score can finish on one ending and a low score on another." },
      { q: "Can people see the total?", a: "Quote it on the thank-you screen with {{total}}, using the calculation's name." },
      { q: "Is it on the free plan?", a: "No. Calculations and scoring are part of Pro." },
    ],
    updated: "2026-10-17",
  },
  {
    slug: "multi-language",
    name: "Forms in other languages",
    title: "One form, in the language each person reads.",
    seo: "Multilingual forms in many languages",
    meta: "Make multilingual forms in Formkit: write in any of 12 languages on every plan, and on Pro offer more, translated by AI and checked by you.",
    kicker: "Languages",
    lead: "Every form is written in a language, and its buttons, messages and errors follow it, on every plan. On Pro, offer the same form in more languages: the AI translates your questions, and each person gets the one their browser asks for.",
    icon: "languages",
    plan: "Every plan · more languages on Pro",
    sections: [
      {
        title: "Twelve languages",
        body: "English, Spanish, French, German, Portuguese, Italian, Dutch, Arabic, Hindi, Bengali, Japanese and Chinese. Arabic reads right to left.",
      },
      {
        title: "Translated by AI, checked by you (Pro)",
        body: "Add a language and Formkit translates your questions, options and screens with one AI edit. Edit shows the translation beside your own words, so you can change anything. A language not translated yet shows your own words.",
      },
      {
        title: "Each person gets their own",
        body: "People get their browser's language when the form has it, and can switch with the menu at the top. A link ending ?lang=es opens the Spanish version, which suits a campaign in one country.",
      },
      {
        title: "Results in one language",
        body: "Whatever language someone answers in, a choice is saved as your own option, so results, logic, exports and connections stay in one language. Written answers stay in the words people typed, and PDF exports get answers in any language right.",
      },
    ],
    steps: [
      "Open Settings → General → Languages",
      "Set Written in to the form's own language",
      "On Pro, add a language and select Translate with AI",
      "Read it over with Edit, then publish",
    ],
    templates: ["contact-form", "customer-satisfaction-survey", "event-registration"],
    help: ["languages", "export-responses", "ai-credits"],
    related: ["builder", "ai-form-builder", "branding"],
    faqs: [
      { q: "Which languages can a form be in?", a: "Twelve: English, Spanish, French, German, Portuguese, Italian, Dutch, Arabic, Hindi, Bengali, Japanese and Chinese." },
      { q: "Is it free?", a: "Setting the form's own language is on every plan. Offering it in more than one language is part of Pro." },
      { q: "What does translating cost?", a: "Translating a form into a language uses one AI edit from your monthly allowance. You can also write the translation yourself." },
      { q: "How do I link to one language?", a: "Add ?lang= and the language code to the form's link, like ?lang=es for Spanish." },
    ],
    updated: "2026-10-17",
  },
  {
    slug: "partial-responses",
    name: "Partial responses and drop-off",
    title: "See who stopped, where, and bring them back.",
    seo: "Partial form submissions and drop-off",
    meta: "Formkit keeps partial form submissions and shows drop-off by question on every plan, with resume links and, on Pro, a reminder email.",
    kicker: "Partial responses",
    lead: "When someone answers a question and leaves without sending, Formkit keeps what they wrote. You see how far they got, which question people leave on, and you can send them a link back to finish.",
    icon: "chart-line",
    plan: "Every plan · reminders on Pro",
    sections: [
      {
        title: "Nothing they typed is lost",
        body: "A partial response is badged as partial, with the number of questions answered. Partials are left out of the Completed count and the completion rate, so your headline numbers stay honest. Switch between All, Complete and Partial to see them.",
      },
      {
        title: "Where people stop",
        body: "The form's Analytics tab shows question drop-off: the share of people who leave on each question. A cluster of partials that all stop at the same question usually means that question is the problem.",
      },
      {
        title: "A way back",
        body: "Each partial has a resume link in its drawer. Send it and the person picks up where they stopped, with their answers still there. People can also choose Save and finish later and email the link to themselves.",
      },
      {
        title: "One reminder (Pro)",
        body: "Turn on Remind people who stop partway and anyone who gave an email address and did not finish gets one email with their link back, after the wait you pick: from 3 hours to 3 days. Never more than one.",
      },
    ],
    steps: [
      "Publish the form and share it",
      "In Responses, switch the filter to Partial",
      "Open a partial and send its resume link",
      "Check Analytics for the question people leave on",
    ],
    templates: ["job-application", "course-application", "client-onboarding"],
    help: ["partials", "read-responses", "export-responses"],
    related: ["builder", "insights", "versions"],
    faqs: [
      { q: "Are partial responses on the free plan?", a: "Yes. Partials, resume links and drop-off by question are on every plan. The reminder email is part of Pro." },
      { q: "Do partials go to my connections?", a: "No. Webhooks, Slack, Google Sheets and the other connections only get responses people sent." },
      { q: "Will people get lots of reminder emails?", a: "No. One email, after the wait you set, and only to people who gave an address. Say on your form that you may remind people." },
      { q: "Can I get drop-off by email?", a: "Yes. Turn on the weekly report in Settings → Notifications for completion rate and drop-off every Monday." },
    ],
    updated: "2026-10-17",
  },
  {
    slug: "file-uploads",
    name: "File uploads",
    title: "Collect documents, photos and recordings with the answers.",
    seo: "File upload form builder",
    meta: "Add file uploads to Formkit forms on every plan: up to 20 MB a file on Free, 150 MB on Pro and 250 MB on Business, with signatures and voice answers too.",
    kicker: "File uploads",
    lead: "Add a File upload question and people drag a file onto it or browse for one. It is attached to their response, ready to open in the inbox, and every export and connection carries a link to it.",
    icon: "paperclip",
    plan: "Every plan",
    sections: [
      {
        title: "Sizes by plan",
        body: "Each file can be up to 20 MB on Free, 150 MB on Pro and 250 MB on Business. The form's company plan decides, and the limit is shown under the drop zone so nobody waits on a file that will be refused.",
      },
      {
        title: "Only the types you want",
        body: "Leave the accepted list blank to take anything, or list extensions such as .pdf .png .docx and the picker filters to those. Mark the question required and the form will not send without a file.",
      },
      {
        title: "Signatures and voice answers",
        body: "The Upload group also has a signature, drawn with a finger, mouse or pen beside a typed full name, and a voice recording people make in the browser, from 15 seconds to 5 minutes. On Pro, voice answers are written out, searchable and in exports.",
      },
      {
        title: "Where files go",
        body: "Open a response in the inbox to download its files. In CSV and Excel exports, each file is a link in its question's column, and webhooks, Slack, Google Sheets, Notion and Airtable get links too.",
      },
    ],
    steps: [
      "Drag File upload from the Upload group onto the canvas",
      "List the accepted file types, or leave it blank for any",
      "Mark it required if you need a file every time",
      "Publish, then open a response to download what came in",
    ],
    templates: ["job-application", "creative-brief", "bug-report"],
    help: ["file-uploads", "voice-recording", "field-types", "data"],
    related: ["builder", "versions", "integrations"],
    faqs: [
      { q: "How big can an uploaded file be?", a: "20 MB on Free, 150 MB on Pro and 250 MB on Business, for each file." },
      { q: "Can I limit uploads to PDFs?", a: "Yes. List .pdf as the accepted type and the picker only offers PDFs." },
      { q: "Are files in my exports?", a: "As links, one in each file question's column. Open a response to download the file itself." },
      { q: "Can uploads be deleted automatically?", a: "On Business, data retention rules erase responses and the files uploaded with them once they reach an age you choose." },
    ],
    updated: "2026-10-17",
  },
];
