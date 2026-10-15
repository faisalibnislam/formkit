import type { LegalSection } from "./legal";

/** formkit.app/api-docs - the Business REST API and webhook signatures. */
/**
 * formkit.app/api-docs - API v2 (every plan), the MCP server for AI
 * assistants, webhook signatures, and the first, read-only API (Business).
 */
export const API_DOCS: LegalSection[] = [
  {
    id: "overview",
    title: "Overview",
    paras: [
      "The Formkit API builds forms, edits their drafts, publishes them, and reads and tags their responses. It is on every plan and answers in JSON. Summaries and AI insight reports are on Pro and Business.",
      "Everything lives under https://formkit.app/api/v2. Times are ISO 8601 in UTC. Nothing can be deleted through the API: edits change a form's draft, which goes live only when it is published, and team approvals still apply.",
    ],
  },
  {
    id: "keys",
    title: "Authentication",
    paras: [
      "Make a key in Settings → Developers and tick only what it may do. It is shown once, so keep it somewhere safe, and revoke it there if it leaks. Send it on every request:",
    ],
    code: ['curl https://formkit.app/api/v2/forms \\\n  -H "Authorization: Bearer fk_live_…"'],
    bullets: [
      "forms:read: list forms and read their questions, logic and settings.",
      "forms:write: make new forms and change drafts.",
      "forms:publish: publish, close and reopen forms.",
      "responses:read: read responses, including names and email addresses.",
      "responses:write: mark responses new, read or reviewed, and tag them.",
      "insights:read: per-question summaries and AI insight reports (Pro).",
    ],
  },
  {
    id: "limits",
    title: "Rate limits",
    paras: ["60 requests a minute on Free and 600 on Pro and Business, for each account across all its keys and connected apps. Past that, requests get a 429 until the minute is up."],
  },
  {
    id: "create",
    title: "Create a form",
    paras: [
      "POST /api/v2/forms with a spec makes a new draft and returns it with its question ids. Question types: short-text, long-text, email, phone, url, name, company, address, number, single-choice, multi-choice, dropdown, yes-no, date, time, rating, scale, file, signature, voice. A choice question needs at least two options. A page break is { \"kind\": \"page\", \"title\": \"…\" }.",
      "Rules show, hide or require a later question from an earlier answer. Name questions by their number (from 1, pages not counted) or their exact wording. Operators: is, is-not, contains, is-empty, is-not-empty, at-least, at-most, greater, less.",
    ],
    code: [
      `curl -X POST https://formkit.app/api/v2/forms \\
  -H "Authorization: Bearer fk_live_…" -H "Content-Type: application/json" \\
  -d '{
    "title": "Workshop sign-up",
    "welcome": { "title": "Join the workshop", "message": "Two minutes, four questions." },
    "items": [
      { "type": "name", "title": "Your name", "required": true },
      { "type": "email", "title": "Your email", "required": true },
      { "type": "single-choice", "title": "Which session?", "options": ["Morning", "Afternoon"] },
      { "type": "long-text", "title": "Any access needs?" }
    ],
    "rules": [{ "when": 3, "operator": "is", "value": "Afternoon", "action": "show", "target": 4 }],
    "theme": "sky"
  }'`,
    ],
  },
  {
    id: "edit",
    title: "Edit a draft",
    paras: [
      "PATCH /api/v2/forms/{id} changes the draft: title, description, welcome, thanks, theme, and ops, a list of steps run in order. Each step is add (with a question, and after: a question id, null for first, or left out for last), update (id with any of title, help, required, options), move (id and after), or remove (id; rules that use the question go with it). The live form does not change until it is published.",
      "GET /api/v2/forms/{id} returns the form with unpublishedChanges, the number of changes in the draft that are not live yet.",
    ],
    code: [
      `{
  "title": "Workshop sign-up (October)",
  "ops": [
    { "op": "add", "question": { "type": "yes-no", "title": "First time with us?" }, "after": null },
    { "op": "update", "id": "m9y…", "options": ["Morning", "Afternoon", "Evening"] }
  ]
}`,
    ],
  },
  {
    id: "publish",
    title: "Publish, close and reopen",
    paras: ["POST /api/v2/forms/{id}/publish puts the draft live and returns the form with its link. POST …/close stops it taking answers, keeping everything collected; POST …/reopen opens it again at the same link."],
  },
  {
    id: "responses",
    title: "Read responses",
    paras: [
      "GET /api/v2/forms/{id}/responses returns responses newest first. Add ?limit= (1–100, default 25), and any of status (new, read, reviewed), tag, since and until (ISO times), and complete (true or false). Follow next as ?cursor= for the page after; a filtered page can hold fewer than the limit.",
      "GET /api/v2/forms/{id}/search?q= finds responses by their answers, names and tags. GET /api/v2/responses/{id} returns one. Each has its answers (a file or voice recording has a fileUrl, and a transcript when it was written out), who sent it, its status and tags, and the AI's reading of it where there is one.",
      "PATCH /api/v2/responses/{id} with status, tags (the whole list), addTags or removeTags marks and tags it.",
    ],
  },
  {
    id: "insights",
    title: "Summaries and insights (Pro)",
    paras: [
      "GET /api/v2/forms/{id}/summary totals each question across finished responses: choices counted, ratings averaged, NPS worked out. No individual answers.",
      "GET /api/v2/forms/{id}/insights returns the latest AI insight report already written for the form, or null. New reports are written in Formkit.",
    ],
  },
  {
    id: "hooks",
    title: "Subscribe to new responses (Pro)",
    paras: [
      "POST /api/v2/hooks with formId, url (a public https address) and optionally event (response.created, response.updated, response.paid or response.deleted) sends that form's responses to the address as they happen, in the webhook format below. It answers with the subscription's id; DELETE /api/v2/hooks/{id} ends it. Tools like Zapier and Make subscribe this way. GET /api/v2/me says which account a key belongs to.",
    ],
  },
  {
    id: "mcp",
    title: "AI assistants (MCP)",
    paras: [
      "Formkit's MCP server at https://formkit.app/api/mcp lets Claude, ChatGPT, Cursor and other assistants use the API for you: build a form from a description, publish it when you say, and tell you what people said. Its tools are list_forms, get_form, create_form, update_form, publish_form, close_form, reopen_form, list_responses, get_response, search_responses, set_response_status, tag_response, form_summary and get_ai_insights. None of them can delete anything.",
      "In Claude or ChatGPT, add a custom connector with that address: you sign in to Formkit and choose what it may do, and you can disconnect it in Settings → Developers. Tools that take a key, like Claude Code, use an API key instead:",
    ],
    code: ['claude mcp add --transport http formkit https://formkit.app/api/mcp \\\n  --header "Authorization: Bearer fk_live_…"'],
  },
  {
    id: "errors",
    title: "Errors",
    bullets: [
      "400: the body is not valid JSON, or a search has no q.",
      "401: no key, or a key or token that is wrong, expired or revoked.",
      "403: the key was not given that permission, or the feature is not on the plan.",
      "404: no such endpoint, or nothing with that id on this account.",
      "409: the form is not in a state for that (closing a draft, or publishing on a team that approves first).",
      "422: the spec or change could not be used; the message says which step and why.",
      "429: too many requests this minute.",
    ],
    code: ['{ "error": { "status": 422, "message": "ops[1]: no question m9q… on this form." } }'],
  },
  {
    id: "webhooks",
    title: "Webhook signatures",
    paras: [
      "Webhooks (Pro and Business, in a form's Settings → Connections) POST each new response as JSON. The Formkit-Event header says what happened (response.created, response.updated when someone changes a response they sent, response.paid, response.deleted with only the response id, or response.test; each webhook picks which it is sent) and Formkit-Signature proves it came from Formkit:",
      "Formkit-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of \"<t>.<raw body>\" keyed with the webhook's secret>. Check it, and refuse anything older than five minutes. In Node:",
    ],
    code: [
      `import crypto from "node:crypto";

function verify(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = crypto.createHmac("sha256", secret).update(\`\${parts.t}.\${rawBody}\`).digest("hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  return fresh && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1 ?? ""));
}`,
    ],
  },
  {
    id: "v1",
    title: "The first API (v1)",
    paras: [
      "The first, read-only API at /api/v1 keeps working for keys on Business: GET /api/v1/forms, /api/v1/forms/{id}, /api/v1/forms/{id}/responses (oldest first, paged with ?after= set to next) and /api/v1/responses/{id}. New code should use v2.",
    ],
  },
];

export const API_FOOT =
  "If a field you need is missing, tell us from Settings → Plan → Contact support.";
