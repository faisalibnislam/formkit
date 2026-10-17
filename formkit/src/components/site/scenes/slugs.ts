/**
 * Pages without a scene of their own borrow the one closest to their work:
 * use cases, integrations, guides and the smaller feature pages.
 */
export const CASE_SCENES: Record<string, string> = {
  agencies: "branding",
  education: "quizzes",
  sales: "ai-replies",
  events: "payments",
  hr: "logic",
  // Integrations
  notion: "integrations",
  airtable: "integrations",
  hubspot: "integrations",
  "google-sheets": "integrations",
  slack: "integrations",
  discord: "integrations",
  "microsoft-teams": "integrations",
  webhooks: "integrations",
  stripe: "payments",
  "chatgpt-claude": "ai-assistants",
  // Feature pages
  calculations: "payments",
  "multi-language": "branding",
  "partial-responses": "insights",
  "file-uploads": "builder",
  // Guides
  "accept-payments-online-form": "payments",
  "conditional-logic-forms": "logic",
  "google-sheets-form": "integrations",
};

/** The scene slug a page shows. */
export function sceneSlug(slug: string, has: (s: string) => boolean) {
  return has(slug) ? slug : (CASE_SCENES[slug] ?? "");
}
