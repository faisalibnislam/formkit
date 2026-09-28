import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Free, Pro and Business: what each includes, and the one place that decides
 * whether an account has a feature.
 *
 * Free is the whole product for one person — every question type, logic,
 * publishing, embedding, notifications, CSV, unlimited responses. Pro is for
 * looking like your own brand and wiring Formkit into your tools. Business is
 * for teams and agencies.
 *
 * A form's features follow its owner's plan: a collaborator on a Pro owner's
 * form sees Pro features there, whatever their own plan. Nothing is ever
 * deleted on a downgrade — features simply stop, and come back on upgrade.
 */

export type PlanId = "free" | "pro" | "business";
export type Interval = "month" | "year";

export const PLAN_ORDER: PlanId[] = ["free", "pro", "business"];

export const PLANS: Record<
  PlanId,
  {
    name: string;
    tagline: string;
    price: Record<Interval, number>;
    aiCredits: number;
    /** Largest single file a respondent can upload. */
    uploadMb: number;
    /** How far back version history reaches; null is all of it. */
    historyDays: number | null;
    /** People on one form besides the owner; null is no limit. */
    collaborators: number | null;
    /** Companies (brands) on the account; null is no limit. */
    companies: number | null;
    /** AI-written replies to submitters each month (more can be bought). */
    aiReplies: number;
    /** Live AI logic checks each month: "AI decides" and facts read from answers. */
    aiChecks: number;
  }
> = {
  free: {
    name: "Free",
    tagline: "Everything you need to run a form.",
    price: { month: 0, year: 0 },
    aiCredits: 5,
    uploadMb: 20,
    historyDays: 30,
    collaborators: 3,
    companies: 1,
    aiReplies: 0,
    aiChecks: 0,
  },
  pro: {
    name: "Pro",
    tagline: "Your brand, your domain, your tools.",
    price: { month: 3, year: 35 },
    aiCredits: 50,
    uploadMb: 150,
    historyDays: 365,
    collaborators: null,
    companies: 5,
    aiReplies: 0,
    aiChecks: 0,
  },
  business: {
    name: "Business",
    tagline: "For teams and agencies.",
    price: { month: 10, year: 99 },
    aiCredits: 200,
    uploadMb: 250,
    historyDays: null,
    collaborators: null,
    companies: null,
    aiReplies: 30,
    aiChecks: 1000,
  },
};

/** A pack of extra AI replies: its price in dollars and how many it holds. */
export const REPLY_PACK = { price: 5, replies: 100 } as const;

/** Every paid feature, the plan that first includes it, and how it is described. */
export const FEATURES = {
  // Pro — presentation
  "brand.badge": { plan: "pro", label: "Remove “Made with Formkit”", group: "Your brand" },
  domains: { plan: "pro", label: "Custom domain", group: "Your brand" },
  "email.domain": { plan: "pro", label: "Send emails from your own domain", group: "Your brand" },
  "design.fonts": { plan: "pro", label: "Custom fonts", group: "Your brand" },
  "design.css": { plan: "pro", label: "Custom CSS", group: "Your brand" },
  // Pro — responses
  "analytics.full": { plan: "pro", label: "Where people come from, and their devices", group: "Responses" },
  "exports.xlsx": { plan: "pro", label: "Excel export", group: "Responses" },
  "exports.copy": { plan: "pro", label: "Email a copy of every response", group: "Responses" },
  "ai.brief": { plan: "pro", label: "Ask Formkit from a brief, document or form", group: "Responses" },
  // Pro — smarter forms
  "logic.calc": { plan: "pro", label: "Calculations and scoring", group: "Smarter forms" },
  "logic.hidden": { plan: "pro", label: "Hidden fields and pre-filled answers", group: "Smarter forms" },
  "logic.piping": { plan: "pro", label: "Earlier answers in later questions", group: "Smarter forms" },
  "forms.redirect": { plan: "pro", label: "Send people to your page after", group: "Smarter forms" },
  "logic.advanced": { plan: "pro", label: "Several endings, hidden options and limited places", group: "Smarter forms" },
  // Pro — connections
  // Pro — people and brands
  collaborators: { plan: "pro", label: "Unlimited collaborators on every form", group: "Teams" },
  brands: { plan: "pro", label: "Up to 5 companies and brands", group: "Teams" },
  "connect.webhooks": { plan: "pro", label: "Webhooks, Zapier and Make", group: "Connections" },
  "connect.slack": { plan: "pro", label: "Slack", group: "Connections" },
  "connect.sheets": { plan: "pro", label: "Google Sheets", group: "Connections" },
  payments: { plan: "pro", label: "Payments with your own Stripe", group: "Connections" },
  // Business
  team: { plan: "business", label: "A team with unlimited seats", group: "Teams" },
  "brands.unlimited": { plan: "business", label: "Unlimited companies and brands", group: "Teams" },
  "templates.shared": { plan: "business", label: "Templates shared with the team", group: "Teams" },
  approvals: { plan: "business", label: "Approval before publishing", group: "Teams" },
  audit: { plan: "business", label: "Audit log", group: "Control" },
  retention: { plan: "business", label: "Data retention rules", group: "Control" },
  api: { plan: "business", label: "API access", group: "Control" },
  sso: { plan: "business", label: "Sign-in with your company’s Google or Microsoft", group: "Control" },
  "support.priority": { plan: "business", label: "Priority support", group: "Control" },
  // Business — AI
  "ai.reply": { plan: "business", label: "AI-written replies to every submission", group: "AI" },
  "ai.insights": { plan: "business", label: "AI insights on your submissions", group: "AI" },
  "logic.ai": { plan: "business", label: "AI decides: logic that reads answers, and facts pulled from them", group: "AI" },
  // Business — quizzes
  quiz: { plan: "business", label: "Quizzes and exams: marking, a timer and results", group: "Smarter forms" },
} as const satisfies Record<string, { plan: Exclude<PlanId, "free">; label: string; group: string }>;

export type Feature = keyof typeof FEATURES;

export function isFeature(key: string): key is Feature {
  return key in FEATURES;
}

/** Whether a plan includes a feature: a higher plan includes everything below it. */
export function planIncludes(plan: PlanId, feature: Feature) {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(FEATURES[feature].plan);
}

/**
 * The plan an account is on right now.
 *
 * Staff can comp a plan by hand (`planComp`), which wins. Otherwise the paid
 * plan holds while the subscription is active, and after a cancellation until
 * the end of the period already paid for.
 */
export function planOf(user: Pick<Doc<"users">, "plan" | "planStatus" | "planEndsAt" | "planComp"> | null): PlanId {
  if (!user) return "free";
  if (user.planComp) return user.planComp;
  const plan = user.plan ?? "free";
  if (plan === "free") return "free";
  const now = Date.now();
  if (user.planStatus === "active" || user.planStatus === "trialing") {
    return user.planEndsAt && user.planEndsAt < now ? "free" : plan;
  }
  // Cancelled or past due: kept to the end of what was paid for.
  if (user.planEndsAt && user.planEndsAt > now) return plan;
  return "free";
}

export async function planOfId(ctx: QueryCtx | MutationCtx, userId: Id<"users"> | null | undefined) {
  if (!userId) return "free" as PlanId;
  return planOf(await ctx.db.get(userId));
}

export function limitsOf(plan: PlanId) {
  return PLANS[plan];
}

export async function hasFeature(
  ctx: QueryCtx | MutationCtx,
  who: Doc<"users"> | Id<"users"> | null | undefined,
  feature: Feature,
) {
  const user = typeof who === "string" ? await ctx.db.get(who) : who;
  return planIncludes(planOf(user ?? null), feature);
}

/**
 * Refuses when the account's plan does not include the feature. The error
 * carries the feature, so the app can open the upgrade sheet on it.
 */
export async function requireFeature(
  ctx: QueryCtx | MutationCtx,
  who: Doc<"users"> | Id<"users">,
  feature: Feature,
) {
  if (await hasFeature(ctx, who, feature)) return;
  const needs = FEATURES[feature].plan;
  throw new ConvexError({
    code: "plan",
    feature,
    plan: needs,
    message: `${FEATURES[feature].label} is part of ${PLANS[needs].name}.`,
  });
}

/** Everything the app needs to draw plan-aware screens, in one object. */
export function planSummary(user: Doc<"users">) {
  const id = planOf(user);
  return {
    id,
    name: PLANS[id].name,
    interval: (user.planInterval ?? null) as Interval | null,
    status: user.planStatus ?? null,
    endsAt: user.planEndsAt ?? null,
    cancelAtPeriodEnd: user.planCancelAtPeriodEnd ?? false,
    comped: !!user.planComp,
    billed: !!user.polarCustomerId,
    features: Object.fromEntries(
      (Object.keys(FEATURES) as Feature[]).map((f) => [f, planIncludes(id, f)]),
    ) as Record<Feature, boolean>,
    limits: {
      aiCredits: PLANS[id].aiCredits,
      uploadMb: PLANS[id].uploadMb,
      historyDays: PLANS[id].historyDays,
      collaborators: PLANS[id].collaborators,
      companies: PLANS[id].companies,
      aiReplies: PLANS[id].aiReplies,
      aiChecks: PLANS[id].aiChecks,
    },
  };
}

export type PlanSummary = ReturnType<typeof planSummary>;
