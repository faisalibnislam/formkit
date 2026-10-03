/** The use-case pages borrow the scene closest to their work. */
export const CASE_SCENES: Record<string, string> = {
  agencies: "branding",
  education: "quizzes",
  sales: "ai-replies",
  events: "payments",
  hr: "logic",
};

/** The scene slug a feature or use-case page shows. */
export function sceneSlug(slug: string, has: (s: string) => boolean) {
  return has(slug) ? slug : (CASE_SCENES[slug] ?? "");
}
