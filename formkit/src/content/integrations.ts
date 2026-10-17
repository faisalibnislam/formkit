import type { Story } from "./features";

/**
 * The integration pages (/integrations/<slug>): one for each app a form's
 * responses can go to, in the same shape as the feature pages. Every claim
 * here matches the app (convex/connections.ts, convex/integrations.ts, a
 * form's Settings → Connections and Settings → Payments), the help centre and
 * the pricing page; keep them in step.
 */

export const INTEGRATION_PAGES: Story[] = [
  {
    slug: "notion",
    name: "Notion",
    title: "Every response, a row in a Notion database.",
    seo: "Notion form builder: responses to a database",
    meta: "Send Formkit form responses to Notion: each one becomes a row in a database Formkit makes in the page you pick, and edits update it. On Pro.",
    kicker: "Notion integration",
    lead: "Sign in to Notion once and pick a page. Formkit makes a database in it with a column for each question, and every response becomes a row. If someone changes what they sent, the row changes with it.",
    icon: "database",
    plan: "Pro",
    sections: [
      {
        title: "A database made for the form",
        body: "Formkit makes a new database in the page you pick, called after the form. It has a Name, the time it was submitted, the email address, and a column for each question. Uploaded files and voice recordings arrive as links.",
        points: ["Name, Submitted and Email columns", "A column for each question", "Files as links you can open"],
      },
      {
        title: "Only the pages you share",
        body: "When you connect, Notion asks which pages Formkit may use, and only those are offered. Formkit gets the access it asks for and nothing more.",
      },
      {
        title: "Changed responses update their row",
        body: "When someone edits a response they already sent, the row it made is updated rather than copied. Remove the connection whenever you like, and what was already sent stays in Notion.",
      },
      {
        title: "See every delivery",
        body: "Each connection lists its recent deliveries and what Notion answered. A delivery that fails is tried again after a minute, then after ten.",
      },
    ],
    steps: [
      "Open a form's Settings → Connections and choose Notion",
      "Sign in to Notion and share the page the database should go in",
      "Pick that page and select Make it",
      "Send a real response and find it as a new row",
    ],
    templates: ["client-onboarding", "project-discovery", "creative-brief"],
    help: ["notion-airtable-hubspot", "read-responses"],
    related: ["airtable", "google-sheets", "hubspot"],
    faqs: [
      { q: "Does it use a database I already have?", a: "Formkit makes a new database for the form, inside the page you pick, with the columns already set up." },
      { q: "What happens if I add a question later?", a: "The columns come from the form's questions when you connect. Connect again after a big change to get a database with the new questions." },
      { q: "Does it send partial responses?", a: "No. Only responses people sent arrive in Notion. Partial ones stay in Formkit's inbox." },
      { q: "Which plan do I need?", a: "Pro or Business. Notion, Airtable and HubSpot are part of Pro." },
    ],
    updated: "2026-10-17",
  },
  {
    slug: "airtable",
    name: "Airtable",
    title: "Responses as records, in a table of their own.",
    seo: "Airtable form builder: responses as records",
    meta: "Connect Formkit forms to Airtable: pick a base, and each response becomes a record in a table made for the form, with edits kept in step. On Pro.",
    kicker: "Airtable integration",
    lead: "Sign in to Airtable and pick a base. Formkit makes a table in it with a field for each question, and each response becomes a record as it arrives.",
    icon: "table",
    plan: "Pro",
    sections: [
      {
        title: "A table built from your questions",
        body: "The table is called after the form and has Name, Submitted and Email fields, then one for each question. Formkit asks Airtable only for what it needs to make that table and add records to it.",
      },
      {
        title: "Records that stay current",
        body: "If someone changes a response they sent, the record it made is updated instead of a second one being added. Files and voice recordings arrive as links.",
      },
      {
        title: "Mind Airtable's free plan",
        body: "Airtable's free plan allows 1,000 API calls a month per workspace, which is about one per response. Past that, Airtable pauses deliveries until the month resets.",
      },
    ],
    steps: [
      "Open a form's Settings → Connections and choose Airtable",
      "Sign in to Airtable and allow Formkit",
      "Pick the base to make the table in, then select Make it",
      "Send a response and open the new table",
    ],
    templates: ["job-application", "volunteer-signup", "product-research"],
    help: ["notion-airtable-hubspot", "export-responses"],
    related: ["notion", "google-sheets", "webhooks"],
    faqs: [
      { q: "Can Formkit write into a table I already have?", a: "It makes a new table for the form in the base you pick, with a field for each question." },
      { q: "What if I disconnect?", a: "New responses stop going to Airtable. Everything already sent stays in your base." },
      { q: "How many connections can one form have?", a: "Up to ten, of any kind, so a form can go to Airtable and Slack at once." },
    ],
    updated: "2026-10-17",
  },
  {
    slug: "hubspot",
    name: "HubSpot",
    title: "Every lead in HubSpot, with their answers on the record.",
    seo: "HubSpot form integration: contacts and notes",
    meta: "Formkit's HubSpot integration turns each response with an email into a contact, or updates theirs, and adds a note with every answer. On Pro.",
    kicker: "HubSpot integration",
    lead: "Connect HubSpot and each response with an email address creates that contact, or updates the one with the same email. Every answer lands on the contact as a note, so sales sees what the person said.",
    icon: "user-check",
    plan: "Pro",
    sections: [
      {
        title: "Matched by email",
        body: "The email address decides the contact. A new address makes a new contact; one HubSpot already has is updated, with the first and last name from the form's name field.",
      },
      {
        title: "The answers, as a note",
        body: "Each response adds a note to the contact with every question and answer. If the person edits their response, the same note is updated rather than a second one added.",
      },
      {
        title: "Ask for an email",
        body: "A response with no email address has nothing to match a contact to, so it is not sent. Make the email question required on forms that feed HubSpot.",
      },
      {
        title: "Narrow access",
        body: "Formkit asks HubSpot only for access to contacts. Remove the connection from the form at any time; contacts and notes already made stay in HubSpot.",
      },
    ],
    steps: [
      "Open a form's Settings → Connections and choose HubSpot",
      "Sign in to HubSpot and allow Formkit",
      "Select Connect",
      "Send a response with an email address and find the contact",
    ],
    templates: ["lead-qualification", "quote-request", "partnership-inquiry"],
    help: ["notion-airtable-hubspot", "required-fields", "logic-ai"],
    related: ["webhooks", "slack", "notion"],
    faqs: [
      { q: "Does it create duplicate contacts?", a: "No. A response whose email HubSpot already has updates that contact and adds a note to it." },
      { q: "What if someone leaves the email blank?", a: "That response is not sent to HubSpot, because there is nothing to match it to. It is still in Formkit." },
      { q: "Can I score leads before they reach HubSpot?", a: "On Pro, AI logic can read a written answer and decide where someone goes, and on forms with AI replies, AI insights give each response a lead score." },
    ],
    updated: "2026-10-17",
  },
  {
    slug: "google-sheets",
    name: "Google Sheets",
    title: "A Google Sheet that fills itself in.",
    seo: "Send form responses to Google Sheets",
    meta: "Send Formkit form responses to Google Sheets: a spreadsheet Formkit makes and keeps up to date, or a private link your own sheet reads. On Pro.",
    kicker: "Google Sheets integration",
    lead: "Two ways in. Sign in with Google and Formkit makes a spreadsheet in your Drive, adding a row for each response. Or keep your own sheet and have it read your responses from a private link, with nothing to sign in to.",
    icon: "sheet",
    plan: "Pro",
    sections: [
      {
        title: "A spreadsheet Formkit keeps",
        body: "Choose Google Sheets and sign in. Formkit makes a spreadsheet called after the form, with a Responses tab: Submitted, Name, Email, then a column for each question. Each new response is a new row, and a changed response updates its own row.",
        points: ["Only the files Formkit makes, never the rest of your Drive", "A row the moment a response arrives", "Edits update the same row"],
      },
      {
        title: "Or a private link",
        body: "Choose Google Sheets, by link, and Formkit gives you a formula to type into any cell. Google refreshes it about once an hour. For every few minutes, paste the Apps Script Formkit gives you and add a time-driven trigger.",
      },
      {
        title: "What the link carries",
        body: "The latest 3,000 complete responses, with a column for each question, each calculation's result and the payment. Uploaded files and voice recordings arrive as links. Exports have everything, however many there are.",
      },
      {
        title: "Keep the link private",
        body: "Anyone with the link can read the responses. If it gets out, make a new link and the old one stops working at once.",
      },
    ],
    steps: [
      "Open a form's Settings → Connections",
      "Choose Google Sheets and sign in, or choose Google Sheets, by link",
      "Make the spreadsheet, or paste the =IMPORTDATA formula into a cell",
      "Send a response and watch it arrive",
    ],
    templates: ["event-registration", "customer-feedback", "rsvp"],
    help: ["google-sheets", "export-responses", "calculations"],
    related: ["airtable", "notion", "webhooks"],
    faqs: [
      { q: "Can Formkit see the rest of my Google Drive?", a: "No. When you sign in, Formkit asks only for the files it makes itself. The link way needs no Google sign-in at all." },
      { q: "How quickly do responses appear?", a: "In a spreadsheet Formkit made, as each response arrives. With the formula, about once an hour; with the Apps Script, every few minutes." },
      { q: "Are partial responses included?", a: "No. Only responses people sent reach the sheet. Partial ones stay in Formkit, where you can filter for them." },
      { q: "Is there a free way?", a: "Export to CSV on any plan and open the file in Google Sheets. The live connections are part of Pro." },
    ],
    updated: "2026-10-17",
  },
  {
    slug: "slack",
    name: "Slack",
    title: "New responses, posted in the channel that needs them.",
    seo: "Slack form notifications for new responses",
    meta: "Post Formkit form responses to Slack: a short message in the channel you choose for each response, and a line of its own for each payment. On Pro.",
    kicker: "Slack integration",
    lead: "Add Slack's Incoming Webhooks app to a channel, paste its address into Formkit, and each new response posts its first few answers there. Payments post a line of their own.",
    icon: "hash",
    plan: "Pro",
    sections: [
      {
        title: "A message people can act on",
        body: "Each message names the form and shows the first few answers. An uploaded file or a voice recording is a link, so it opens straight from Slack.",
      },
      {
        title: "Pick what it hears",
        body: "New and paid responses are posted by default. Turn on Changed as well and Slack hears when someone edits a response they sent.",
        points: ["New responses", "Payments: who paid, how much, for which form", "Changed responses, if you want them"],
      },
      {
        title: "A channel per form, or several",
        body: "Each form has its own connections, up to ten, so sales enquiries can go to one channel and support to another.",
      },
      {
        title: "Try it first",
        body: "Send a test and an example response appears in the channel. If a delivery fails, Formkit tries again after a minute, then after ten, and shows what Slack answered.",
      },
    ],
    steps: [
      "In Slack, add the Incoming Webhooks app to the channel",
      "Copy the address it gives you, starting https://hooks.slack.com/services/",
      "In a form's Settings → Connections, choose Slack and paste it",
      "Send a test to check it arrives",
    ],
    templates: ["support-request", "lead-qualification", "bug-report"],
    help: ["slack", "notify-self", "notify-routing"],
    related: ["discord", "microsoft-teams", "webhooks"],
    faqs: [
      { q: "Does it need a Slack bot?", a: "No. It uses Slack's own Incoming Webhooks app, added to the channel you choose." },
      { q: "Can I get emails instead?", a: "Yes, on every plan. Each form can email you for every response, and routing rules send different answers to different people." },
      { q: "Can different answers go to different channels?", a: "Each Slack connection posts every response it is sent. To send different answers to different people, use email routing rules." },
    ],
    updated: "2026-10-17",
  },
  {
    slug: "discord",
    name: "Discord",
    title: "Form responses, straight into a Discord channel.",
    seo: "Discord form notifications for any channel",
    meta: "Post Formkit form responses to a Discord channel with a channel webhook: a short message for each response and each payment, with no pings. On Pro.",
    kicker: "Discord integration",
    lead: "Make a webhook in the channel's settings, paste its address into Formkit, and each new response posts a short message there. Good for community sign-ups, bug reports and waitlists.",
    icon: "message-square",
    plan: "Pro",
    sections: [
      {
        title: "Made with a channel webhook",
        body: "No bot to invite. In the channel's settings, Integrations → Webhooks → New Webhook gives you an address. Formkit checks it is a Discord webhook before it saves it.",
      },
      {
        title: "No surprise pings",
        body: "Messages show the form's name and the first few answers, with files and recordings as links. Formkit turns mentions off, so an answer that says @everyone pings nobody.",
      },
      {
        title: "New, changed and paid",
        body: "New responses and payments post by default. Turn on Changed to hear when someone edits what they sent. Send a test before real answers arrive.",
      },
    ],
    steps: [
      "In Discord, open the channel's settings, then Integrations → Webhooks → New Webhook",
      "Copy the webhook's address",
      "In a form's Settings → Connections, choose Discord and paste it",
      "Send a test",
    ],
    templates: ["bug-report", "waitlist", "event-feedback"],
    help: ["webhooks", "notify-self"],
    related: ["slack", "microsoft-teams", "webhooks"],
    faqs: [
      { q: "Which plan includes Discord?", a: "Pro and Business, along with Slack and Microsoft Teams." },
      { q: "Can a response ping the whole server?", a: "No. Formkit sends every message with mentions turned off." },
      { q: "What if the webhook is deleted in Discord?", a: "Deliveries start failing, and the connection shows it. Make a new webhook and add it again." },
    ],
    updated: "2026-10-17",
  },
  {
    slug: "microsoft-teams",
    name: "Microsoft Teams",
    title: "A card in Teams for every response.",
    seo: "Microsoft Teams form notifications",
    meta: "Post Formkit form responses to a Microsoft Teams channel through a Workflows webhook: a card for each response and each payment. On Pro.",
    kicker: "Microsoft Teams integration",
    lead: "In the channel, set up the Teams workflow that posts when a webhook request arrives, paste its address into Formkit, and each new response appears as a card.",
    icon: "users",
    plan: "Pro",
    sections: [
      {
        title: "Through Teams Workflows",
        body: "Open Workflows in the channel and pick “Post to a channel when a webhook request is received”. It gives you an address; Formkit checks it is a Teams workflow address before saving it.",
      },
      {
        title: "A card, not a wall of text",
        body: "Each response is an Adaptive Card with the form's name in bold and the first few answers below. Payments get a card of their own saying who paid and how much.",
      },
      {
        title: "For the team's own forms",
        body: "Time off requests, IT and facilities requests, and feedback all land where the people who handle them already are. Add up to ten connections to one form.",
      },
    ],
    steps: [
      "In the Teams channel, open Workflows",
      "Pick “Post to a channel when a webhook request is received” and copy its address",
      "In a form's Settings → Connections, choose Microsoft Teams and paste it",
      "Send a test",
    ],
    templates: ["time-off-request", "employee-feedback", "support-request"],
    help: ["webhooks", "notify-routing"],
    related: ["slack", "discord", "webhooks"],
    faqs: [
      { q: "Do I need an Incoming Webhook connector?", a: "No. Use the Workflows template “Post to a channel when a webhook request is received” and paste the address it gives you." },
      { q: "Can people sign in to Formkit with Microsoft?", a: "No. Teams is for posting responses to a channel. You sign in to Formkit with an email and password, Google or a passkey." },
      { q: "Which plan includes Teams?", a: "Pro and Business, with Slack and Discord." },
    ],
    updated: "2026-10-17",
  },
  {
    slug: "webhooks",
    name: "Webhooks",
    title: "Every response as signed JSON, to any address you like.",
    seo: "Form webhooks: signed JSON for every response",
    meta: "Formkit form webhooks POST every response as JSON, signed with HMAC-SHA256, retried if your end is down, with a log you can replay. On Pro.",
    kicker: "Webhooks",
    lead: "Paste an address and every new response is sent there as JSON the moment it arrives. It works with your own code and with any service that accepts a webhook, including Zapier's Catch Hook and Make's Custom webhook.",
    icon: "webhook",
    plan: "Pro",
    sections: [
      {
        title: "What arrives",
        body: "A POST with the form, the respondent, every answer with its question and key, the calculations and any payment. File uploads and voice recordings carry a fileUrl to download them from.",
      },
      {
        title: "Pick the events",
        body: "The Formkit-Event header says which it is, and each connection chooses which it is sent.",
        points: ["response.created: a new response", "response.updated: the person changed one they sent", "response.paid: a payment went through", "response.deleted: you deleted one; only its id is sent", "response.test: a test you sent"],
      },
      {
        title: "Signed, so you can trust it",
        body: "Each webhook has a secret, shown once. Every delivery carries Formkit-Signature: t=…,v1=…, an HMAC-SHA256 of the timestamp and the body. New secret makes another, and the old one stops matching at once.",
      },
      {
        title: "Retries and a log",
        body: "If your end is down, Formkit tries again after a minute, then after ten. Recent deliveries are listed with what your end answered, and Send again resends one.",
      },
    ],
    steps: [
      "Open a form's Settings → Connections and choose Webhook",
      "Paste the address that should receive each response",
      "Copy the secret, which is shown once",
      "Send a test, then pick which events it is sent",
    ],
    templates: ["bug-report", "webinar-registration", "order-form"],
    help: ["webhooks", "api", "export-responses"],
    related: ["slack", "google-sheets", "chatgpt-claude"],
    faqs: [
      { q: "Does it work with Zapier and Make?", a: "Yes. Paste the address from Zapier's Catch Hook trigger or Make's Custom webhook module, and responses arrive there as they come in." },
      { q: "What addresses can I use?", a: "Any public https:// address. Local and private network addresses are refused." },
      { q: "How do I check the signature?", a: "Work out the HMAC-SHA256 of the timestamp and the body with your secret and compare it with v1. The API page has code for it." },
      { q: "Are partial responses sent?", a: "No. A webhook hears about responses people sent, and the changes, payments and deletions you choose." },
    ],
    updated: "2026-10-17",
  },
  {
    slug: "stripe",
    name: "Stripe",
    title: "Take payment through your own Stripe, as the form is sent.",
    seo: "Stripe payment form builder",
    meta: "Build a Stripe payment form with Formkit: fixed, calculated or pay what you want, with quantities, promotion codes and Stripe Tax. No Formkit fee. On Pro.",
    kicker: "Stripe integration",
    lead: "Connect your own Stripe account with a restricted key and people pay as they send the form. Their answers arrive once the payment has gone through, and the money goes straight to you. Formkit takes nothing.",
    icon: "credit-card",
    plan: "Pro",
    sections: [
      {
        title: "A key that can do one thing",
        body: "Make a restricted key in Stripe with Write access to Checkout Sessions, and to Webhook Endpoints so payments are confirmed the moment they go through. Formkit refuses your secret key, so it can never do more than open a checkout.",
      },
      {
        title: "Fixed, calculated, or what they choose",
        body: "Charge a set amount, the result of one of the form's calculations, or let people pay what they want above a minimum you set.",
        points: ["How many: one, a number they answered, or picked on Stripe's page", "Promotion codes you made in Stripe", "Stripe Tax, added on top or already in the price"],
      },
      {
        title: "Paid for first, then sent",
        body: "The last button says Pay and send. Stripe's checkout opens, and the answers become a response only once Stripe confirms the payment. If someone leaves without paying, nothing is sent, and the answers are forgotten after two days.",
      },
      {
        title: "In your responses",
        body: "Each response shows what was paid, with how many, any discount and any tax, and exports gain a Payment column. Refunds are made in Stripe, as usual.",
      },
    ],
    steps: [
      "In Stripe, open Developers → API keys → Create restricted key",
      "Give it Write access to Checkout Sessions and Webhook Endpoints",
      "Paste it in a form's Settings → Payments",
      "Set the amount, then Start taking payments",
    ],
    templates: ["order-form", "workshop-registration", "event-registration"],
    help: ["payments", "calculations", "export-responses"],
    related: ["webhooks", "google-sheets", "slack"],
    faqs: [
      { q: "Does Formkit charge a fee on payments?", a: "No. Stripe's own fees apply; Formkit adds nothing." },
      { q: "Can I test it without real money?", a: "Yes. Paste a test key (rk_test_…) and the form takes test payments." },
      { q: "What if I don't want to allow webhooks?", a: "Add one by hand in Stripe and paste its signing secret. Without one, payments are confirmed as people come back and checked every 20 minutes." },
      { q: "Can AI agents fill in a form that takes payment?", a: "No. A form with a payment can't be filled in by an agent, so the agent hands the person the link instead." },
    ],
    updated: "2026-10-17",
  },
  {
    slug: "chatgpt-claude",
    name: "ChatGPT and Claude",
    title: "Formkit in ChatGPT and Claude.",
    seo: "Build forms in ChatGPT and Claude with MCP",
    meta: "Add Formkit to ChatGPT or Claude with MCP: build forms from a description, publish when you say, and see responses in the chat. On every plan.",
    kicker: "ChatGPT and Claude",
    lead: "Add Formkit as a connector and your assistant can build forms from a description, change drafts, publish when you say, and read, search and tag responses. You choose what it may do, and nothing can be deleted that way.",
    icon: "bot",
    plan: "Every plan",
    sections: [
      {
        title: "One address to add",
        body: "In Claude or ChatGPT, add a custom connector with the address https://formkit.app/api/mcp, sign in to Formkit and choose what it may do. Claude Code and Cursor can use an API key instead; Settings → Developers has the lines to copy.",
      },
      {
        title: "What it can do",
        body: "List and read forms, make new ones from a description, change drafts, publish, close and reopen them, and read, search, mark and tag responses. On Pro, per-question summaries and AI insight reports too.",
        points: ["Edits stay in the draft until it is published", "Nothing can be deleted through it", "Disconnect it from Settings → Developers at any time"],
      },
      {
        title: "See it in the chat",
        body: "In assistants that show apps, reading a form shows a preview of its questions, and listing responses shows a table you can search, filter and sort, with a link to open each one in Formkit.",
      },
      {
        title: "Forms their assistants can fill in",
        body: "Switch on Settings → Security → Let AI agents fill it in, and someone's own assistant can read the questions and send the answers for them. It's off until you switch it on, form by form, and each form takes at most 60 agent responses an hour.",
      },
    ],
    steps: [
      "In Claude or ChatGPT, add a custom connector for https://formkit.app/api/mcp",
      "Sign in to Formkit and choose what it may do",
      "Ask it to build a form, or to show you this week's responses",
      "Publish when you are happy, from the chat or from Formkit",
    ],
    templates: ["contact-form", "quote-request", "booking-request"],
    help: ["api", "agent-forms"],
    related: ["webhooks", "notion"],
    faqs: [
      { q: "Is it on the free plan?", a: "Yes. The connector, the in-chat views and forms agents can fill in are on every plan. Summaries and AI insights through it are on Pro." },
      { q: "Can it delete my forms or responses?", a: "No. Nothing can be deleted through the connector or the API, and changes stay in the draft until the form is published." },
      { q: "Which assistants work?", a: "Any that connect to MCP servers: Claude, ChatGPT and Cursor among them. Claude Code and other tools can use an API key." },
      { q: "Is there a rate limit?", a: "60 requests a minute on Free, 600 on Pro and Business." },
    ],
    updated: "2026-10-17",
  },
];

export const integrationBySlug = (slug: string) => INTEGRATION_PAGES.find((p) => p.slug === slug) ?? null;
