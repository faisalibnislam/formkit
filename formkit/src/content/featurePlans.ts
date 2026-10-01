import { FEATURES, PLANS } from "../../convex/model/plans";

/**
 * Which plan includes what, for each feature page. The paid rows are the
 * app's own feature labels (convex/model/plans.ts), and the AI numbers are
 * the plans' own allowances, so the page can never disagree with checkout.
 * Only the free rows are written here; keep them true to the app.
 */

type FeatureKey = keyof typeof FEATURES;

export type PlanLadder = {
  free: string[];
  pro: string[];
  business: string[];
};

const { free, pro, business } = PLANS;
const label = (k: FeatureKey) => FEATURES[k].label;
const seat = "a seat each month";

const LADDERS: Record<string, { free: string[]; pro: (FeatureKey | string)[]; business: (FeatureKey | string)[] }> = {
  "ai-form-builder": {
    free: [`${free.ai.builds} AI-built forms and ${free.ai.edits} AI edits a month`, "Build from a sentence", "Change anything by asking"],
    pro: [`${pro.ai.builds} builds and ${pro.ai.edits} edits, ${seat}`, "ai.brief"],
    business: [`${business.ai.builds} builds and ${business.ai.edits} edits, ${seat}`, "templates.shared"],
  },
  logic: {
    free: ["Skip, show and hide", "Groups of conditions", "The logic map and tester", "Describe a rule in words"],
    pro: ["logic.calc", "logic.advanced", "logic.hidden", "logic.piping", "logic.ai", `${pro.ai.responses} responses AI works on, ${seat}`],
    business: [`${business.ai.responses} responses AI works on, ${seat}`],
  },
  quizzes: {
    free: [],
    pro: ["quiz", "logic.calc"],
    business: [],
  },
  "ai-replies": {
    free: [],
    pro: ["ai.reply", `${pro.ai.responses} responses AI works on, ${seat}`],
    business: [`${business.ai.responses} responses AI works on, ${seat}`],
  },
  insights: {
    free: ["Views, starts and completions", "Drop-off by question", "Partial responses kept"],
    pro: ["ai.insights", "analytics.full", `${pro.ai.reports} insight reports, ${seat}`],
    business: [`${business.ai.reports} insight reports, ${seat}`],
  },
  payments: {
    free: [],
    pro: ["payments", "logic.calc", "forms.redirect"],
    business: [],
  },
  integrations: {
    free: ["CSV export"],
    pro: ["connect.webhooks", "connect.slack", "connect.sheets", "exports.xlsx", "exports.copy"],
    business: ["api"],
  },
  builder: {
    free: ["Every question type, voice recording included", "Pages and page breaks", "Drag, duplicate and undo", `${free.uploadMb} MB uploads`, `${free.collaborators} guests on each form`],
    pro: [`${pro.uploadMb} MB uploads`, "collaborators"],
    business: [`${business.uploadMb} MB uploads`, "templates.shared", "approvals"],
  },
  versions: {
    free: [`${free.historyDays} days of version history`, "Restore any version", "CSV export"],
    pro: ["A year of version history", "exports.xlsx", "exports.copy"],
    business: ["All of your version history", "api"],
  },
  "custom-domains": {
    free: [],
    pro: ["domains", "email.domain", "brand.badge"],
    business: [],
  },
  branding: {
    free: ["Ten ready-made themes", "Your colours and logo", "formkit.app/your-name, or a link per company", "Embed on any site"],
    pro: ["domains", "brand.badge", "design.fonts", "design.css", "email.domain"],
    business: ["templates.shared"],
  },
};

const text = (x: FeatureKey | string) => (x in FEATURES ? label(x as FeatureKey) : x);

export function planLadder(slug: string): PlanLadder | null {
  const l = LADDERS[slug];
  if (!l) return null;
  return { free: l.free, pro: l.pro.map(text), business: l.business.map(text) };
}

export const LADDER_PRICES = {
  free: { name: free.name, price: "$0" },
  pro: { name: pro.name, price: `$${pro.price.month}` },
  business: { name: business.name, price: `$${business.price.month}` },
};
