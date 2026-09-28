import type { LegalSection } from "./legal";

/** formkit.app/api-docs - the Business REST API and webhook signatures. */
export const API_DOCS: LegalSection[] = [
  {
    id: "overview",
    title: "Overview",
    paras: [
      "The Formkit API reads your forms and their responses, so you can pull them into your own systems. It is part of the Business plan, read-only, and answers in JSON.",
      "Everything lives under https://formkit.app/api/v1. Times are ISO 8601 in UTC, with a millisecond timestamp alongside where you page by it.",
    ],
  },
  {
    id: "keys",
    title: "Authentication",
    paras: [
      "Make a key in Settings → Controls → API keys. It is shown once, so keep it somewhere safe, and revoke it there if it leaks. Send it on every request:",
    ],
    code: ['curl https://formkit.app/api/v1/forms \\\n  -H "Authorization: Bearer fk_live_…"'],
  },
  {
    id: "forms",
    title: "List forms",
    paras: ["GET /api/v1/forms returns every form on the account, most recently changed first, with its public link when it is live."],
    code: [
      `{
  "data": [
    {
      "id": "k17a…",
      "title": "Client onboarding",
      "status": "published",
      "url": "https://formkit.app/studio-nine/onboarding",
      "responses": 248,
      "createdAt": "2026-08-02T09:14:00.000Z",
      "updatedAt": "2026-09-20T16:40:12.000Z"
    }
  ]
}`,
    ],
  },
  {
    id: "form",
    title: "Get a form",
    paras: ["GET /api/v1/forms/{id} returns the form with its questions, each with the key you gave it, and the names of its calculations."],
  },
  {
    id: "responses",
    title: "List responses",
    paras: [
      "GET /api/v1/forms/{id}/responses returns responses, oldest first. Add ?limit= (1–100, default 50) and page with ?after= set to the next value from the previous page. To poll for new ones, keep the last submittedAtMs you saw and pass it as after.",
    ],
    code: [
      `curl "https://formkit.app/api/v1/forms/k17a…/responses?limit=2" \\
  -H "Authorization: Bearer fk_live_…"

{
  "data": [
    {
      "id": "j57c…",
      "formId": "k17a…",
      "submittedAt": "2026-09-20T16:40:12.000Z",
      "submittedAtMs": 1789922412000,
      "complete": true,
      "respondent": { "name": "Sam Taylor", "email": "sam@example.com", "phone": null, "company": null },
      "answers": [
        { "questionId": "m9x…", "key": "budget", "question": "What is your budget?", "value": "5000" },
        { "questionId": "m9y…", "key": "services", "question": "What do you need?", "value": ["Brand", "Web"] }
      ],
      "calculations": { "total": 42 },
      "payment": { "status": "paid", "amount": 2500, "currency": "usd" },
      "source": "Direct",
      "tags": []
    }
  ],
  "hasMore": true,
  "next": 1789922412000
}`,
    ],
  },
  {
    id: "response",
    title: "Get a response",
    paras: ["GET /api/v1/responses/{id} returns one response, in the same shape as above. Payment amounts are in the currency's smallest unit (cents)."],
  },
  {
    id: "errors",
    title: "Errors",
    bullets: [
      "401: no key, or a key that is wrong or revoked.",
      "403: the account is not on Business.",
      "404: no such endpoint, or nothing with that id on this account.",
    ],
    code: ['{ "error": { "status": 404, "message": "Not found." } }'],
  },
  {
    id: "webhooks",
    title: "Webhook signatures",
    paras: [
      "Webhooks (Pro and Business, in a form's Settings → Connections) POST each new response as JSON. The Formkit-Event header says what happened (response.created, response.paid or response.test) and Formkit-Signature proves it came from Formkit:",
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
];

export const API_FOOT =
  "The API is read-only for now. If you need to write through it, or a field is missing, tell us from Settings → Plan → Contact support.";
