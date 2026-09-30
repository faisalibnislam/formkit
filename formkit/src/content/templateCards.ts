import type { BrowserTemplate } from "@/components/templates/TemplateBrowser";
import { templatePreview } from "@/content/templatePreview";
import type { FormTemplate } from "@/content/templates";

/** What a template card needs, including a miniature of the form's first questions. */
export function templateCard(t: FormTemplate): BrowserTemplate {
  const p = templatePreview(t.slug);
  return {
    slug: t.slug,
    name: t.name,
    blurb: t.blurb,
    category: t.category ?? "Business",
    icon: t.icon,
    count: t.questions.length,
    time: t.time,
    logic: t.logic,
    accent: p?.accent ?? "var(--blue-200)",
    welcome: p?.welcome.title ?? t.name,
    first: (p?.questions ?? []).slice(0, 3).map((q) => ({ title: q.title, type: q.type, options: q.options })),
    words: t.questions.map((q) => q.title).join(" "),
  };
}
