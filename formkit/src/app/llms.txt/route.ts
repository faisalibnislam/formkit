import { FEATURE_PAGES, USE_CASES } from "@/content/features";
import { HELP_CATEGORIES } from "@/content/help";
import { RIVALS } from "@/content/compare";
import { TEMPLATES } from "@/content/templates";
import { SITE_URL } from "@/lib/site";
import { PLANS } from "../../../convex/model/plans";

/**
 * /llms.txt: a plain map of the site for AI assistants and answer engines,
 * in the llmstxt.org shape. Built from the same content as the pages, so it
 * never says something the site does not.
 */
export const dynamic = "force-static";

const { free, pro, business } = PLANS;

export function GET() {
  const link = (title: string, path: string, note?: string) => `- [${title}](${SITE_URL}${path})${note ? `: ${note}` : ""}`;
  const lines = [
    "# Formkit",
    "",
    `> Formkit is an online form builder. Build a form by describing it to the AI or with a drag-and-drop builder, add conditional and AI logic, take payments, and have AI write a personal reply to every response. Free for unlimited forms, responses and members; Pro is $${pro.price.month} a seat a month and Business $${business.price.month}.`,
    "",
    `The free plan includes every question type (voice recording included), logic, themes, a formkit.app link, embeds, partial responses, CSV export and AI for ${free.ai.builds} new forms and ${free.ai.edits} edits a month. Pro adds a custom domain, connections (webhooks, Zapier, Make, Slack, Google Sheets), payments with your own Stripe, quizzes, calculations, AI replies, AI logic and AI insights. Business adds shared templates, approvals, an audit log, data retention, API access and SSO.`,
    "",
    "## Product",
    link("Pricing", "/pricing", "plans, seats, AI allowances and credits"),
    link("Features", "/features", "every feature, each with a live demo"),
    ...FEATURE_PAGES.map((f) => link(f.name, `/features/${f.slug}`, `${f.meta} (${f.plan})`)),
    "",
    "## Use cases",
    ...USE_CASES.map((u) => link(u.name, `/use-cases/${u.slug}`, u.meta)),
    "",
    "## Templates",
    link(`All ${TEMPLATES.length} templates`, "/templates"),
    ...TEMPLATES.map((t) => link(t.name, `/templates/${t.slug}`, t.meta)),
    "",
    "## Comparisons",
    link("Compare form builders", "/compare"),
    ...RIVALS.map((r) => link(`Formkit vs ${r.name}`, `/compare/${r.slug}`)),
    "",
    "## Help",
    link("Help center", "/help"),
    ...HELP_CATEGORIES.flatMap((c) => c.articles.map((a) => link(a.title, `/help/${a.id}`, a.summary))),
    "",
    "## Optional",
    link("API docs", "/api-docs", "the Business REST API and webhook signatures"),
    link("Changelog", "/changelog"),
    link("Privacy", "/privacy"),
    link("Terms", "/terms"),
  ];
  return new Response(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
