import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Free, Pro and Business: what each includes, and the one place that decides
 * whether a company has a feature.
 *
 * Plans belong to companies (model/spaces.ts): every account has its own
 * personal company and can make as many more as it likes, each with its own
 * plan, paid per seat. Free is the whole form builder. Pro is for looking and
 * working like your own brand, with AI on responses. Business adds team
 * controls. A form's features follow its company's plan, whoever is editing.
 * Nothing is ever deleted on a downgrade: features stop, and come back.
 */

export type PlanId = "free" | "pro" | "business";
export type Interval = "month" | "year";

export const PLAN_ORDER: PlanId[] = ["free", "pro", "business"];

type Plan = {
  name: string;
  tagline: string;
  /** Per seat, in dollars. */
  price: Record<Interval, number>;
  /**
   * The monthly AI allowance. On a paid plan each seat adds this much to the
   * company's shared pool; a Free company has it once, however many members.
   */
  ai: { builds: number; edits: number; responses: number; reports: number };
  /** Largest single file a respondent can upload. */
  uploadMb: number;
  /** How far back version history reaches; null is all of it. */
  historyDays: number | null;
  /** Guests invited to one form, besides the company's members; null is no limit. */
  collaborators: number | null;
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    name: "Free",
    tagline: "Everything you need to run a form.",
    price: { month: 0, year: 0 },
    ai: { builds: 3, edits: 10, responses: 0, reports: 0 },
    uploadMb: 20,
    historyDays: 30,
    collaborators: 3,
  },
  pro: {
    name: "Pro",
    tagline: "Your brand, your tools, and AI on your responses.",
    price: { month: 6, year: 60 },
    ai: { builds: 50, edits: 25, responses: 20, reports: 3 },
    uploadMb: 150,
    historyDays: 365,
    collaborators: null,
  },
  business: {
    name: "Business",
    tagline: "For teams and agencies.",
    price: { month: 19, year: 190 },
    ai: { builds: 200, edits: 50, responses: 50, reports: 10 },
    uploadMb: 250,
    historyDays: null,
    collaborators: null,
  },
};

export type AiKind = keyof Plan["ai"];

/**
 * What each AI action costs in credits once the monthly allowance is used up.
 * A credit sells for 4.4 cents after fees and may cost at most 3.08 cents of
 * Gemini, a 30% margin; each figure is the action's worst case, rounded up.
 */
export const CREDIT_COST: Record<AiKind, number> = { builds: 2, edits: 1, responses: 1, reports: 3 };

/** Credit packs: price in dollars, credits, and the Polar product key. */
export const CREDIT_PACKS = [
  { key: "credits_100", price: 5, credits: 100 },
  { key: "credits_420", price: 20, credits: 420 },
  { key: "credits_1050", price: 50, credits: 1050 },
] as const;
export type CreditPackKey = (typeof CREDIT_PACKS)[number]["key"];

/** Bought credits last this long. */
export const CREDIT_LIFE_MS = 365 * 24 * 60 * 60 * 1000;

/** Every paid feature, the plan that first includes it, and how it is described. */
export const FEATURES = {
  // Pro - presentation
  "brand.badge": { plan: "pro", label: "Remove “Made with Formkit”", group: "Your brand" },
  domains: { plan: "pro", label: "Custom domain", group: "Your brand" },
  "email.domain": { plan: "pro", label: "Send emails from your own domain", group: "Your brand" },
  "design.fonts": { plan: "pro", label: "Custom fonts", group: "Your brand" },
  "design.css": { plan: "pro", label: "Custom CSS", group: "Your brand" },
  // Pro - responses
  "analytics.full": { plan: "pro", label: "Where people come from, and their devices", group: "Responses" },
  "exports.xlsx": { plan: "pro", label: "Excel export", group: "Responses" },
  "exports.copy": { plan: "pro", label: "Email a copy of every response", group: "Responses" },
  "ai.brief": { plan: "pro", label: "Ask Formkit from a brief, document or form", group: "Responses" },
  // Pro - smarter forms
  "logic.calc": { plan: "pro", label: "Calculations and scoring", group: "Smarter forms" },
  "logic.hidden": { plan: "pro", label: "Hidden fields and pre-filled answers", group: "Smarter forms" },
  "logic.piping": { plan: "pro", label: "Earlier answers in later questions", group: "Smarter forms" },
  "forms.redirect": { plan: "pro", label: "Send people to your page after", group: "Smarter forms" },
  "logic.advanced": { plan: "pro", label: "Several endings, hidden options and limited places", group: "Smarter forms" },
  // Pro - people
  collaborators: { plan: "pro", label: "Unlimited guests on every form", group: "Teams" },
  // Pro - connections
  "connect.webhooks": { plan: "pro", label: "Webhooks, Zapier and Make", group: "Connections" },
  "connect.slack": { plan: "pro", label: "Slack", group: "Connections" },
  "connect.sheets": { plan: "pro", label: "Google Sheets", group: "Connections" },
  payments: { plan: "pro", label: "Payments with your own Stripe", group: "Connections" },
  // Pro - AI on responses
  "ai.reply": { plan: "pro", label: "AI-written replies to every submission", group: "AI" },
  "ai.insights": { plan: "pro", label: "AI insights on your submissions", group: "AI" },
  "logic.ai": { plan: "pro", label: "AI decides: logic that reads answers, and facts pulled from them", group: "AI" },
  // Pro - quizzes
  quiz: { plan: "pro", label: "Quizzes and exams: marking, a timer and results", group: "Smarter forms" },
  // Business
  "templates.shared": { plan: "business", label: "Templates shared with the team", group: "Teams" },
  approvals: { plan: "business", label: "Approval before publishing", group: "Teams" },
  audit: { plan: "business", label: "Audit log", group: "Control" },
  retention: { plan: "business", label: "Data retention rules", group: "Control" },
  api: { plan: "business", label: "API access", group: "Control" },
  sso: { plan: "business", label: "Sign-in with your company’s Google or Microsoft", group: "Control" },
  "support.priority": { plan: "business", label: "Priority support", group: "Control" },
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

/** A company: its owner, and "me" for their personal company or a company id. */
export type SpaceRef = { ownerId: Id<"users">; brand: "me" | Id<"companies"> };

const RANK: Record<PlanId, number> = { free: 0, pro: 1, business: 2 };

/**
 * A company's plan. Personal companies keep theirs on the account; others on
 * the company row. A company that has never had its own plan is covered by
 * its owner's account-wide subscription if that began before per-company
 * billing (grandfathered, until the owner next buys per company).
 */
export async function planOfSpace(ctx: QueryCtx | MutationCtx, space: SpaceRef): Promise<PlanId> {
  const owner = await ctx.db.get(space.ownerId);
  if (!owner || owner.deactivatedAt) return "free";
  if (space.brand === "me") return planOf(owner);
  const company = await ctx.db.get(space.brand);
  if (!company || company.ownerId !== space.ownerId) return "free";
  if (company.plan || company.planComp) return planOf(company);
  return owner.spaceBilling ? "free" : planOf(owner);
}

/** The best plan among the companies someone owns: for account-wide things (API keys, SSO, audit). */
export async function accountPlan(ctx: QueryCtx | MutationCtx, user: Doc<"users">): Promise<PlanId> {
  let best = await planOfSpace(ctx, { ownerId: user._id, brand: "me" });
  const companies = await ctx.db
    .query("companies")
    .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
    .collect();
  for (const c of companies) {
    const p = await planOfSpace(ctx, { ownerId: user._id, brand: c._id });
    if (RANK[p] > RANK[best]) best = p;
  }
  return best;
}

/**
 * What a check is about: a form or a company (its company's plan), or a
 * person (the best plan among companies they own).
 */
export type PlanSubject = Doc<"users"> | Id<"users"> | SpaceRef | null | undefined;

export async function planOfSubject(ctx: QueryCtx | MutationCtx, who: PlanSubject): Promise<PlanId> {
  if (!who) return "free";
  if (typeof who === "string") {
    const user = await ctx.db.get(who);
    return user ? accountPlan(ctx, user) : "free";
  }
  if ("brand" in who) return planOfSpace(ctx, { ownerId: who.ownerId, brand: who.brand });
  return accountPlan(ctx, who);
}

export async function planOfId(ctx: QueryCtx | MutationCtx, who: PlanSubject) {
  return planOfSubject(ctx, who);
}

export function limitsOf(plan: PlanId) {
  return PLANS[plan];
}

export async function hasFeature(ctx: QueryCtx | MutationCtx, who: PlanSubject, feature: Feature) {
  return planIncludes(await planOfSubject(ctx, who), feature);
}

/**
 * Refuses when the plan does not include the feature. The error carries the
 * feature, so the app can open the upgrade sheet on it.
 */
export async function requireFeature(ctx: QueryCtx | MutationCtx, who: PlanSubject, feature: Feature) {
  if (await hasFeature(ctx, who, feature)) return;
  const needs = FEATURES[feature].plan;
  throw new ConvexError({
    code: "plan",
    feature,
    plan: needs,
    message: `${FEATURES[feature].label} is part of ${PLANS[needs].name}.`,
  });
}

type BillingHolder = Pick<
  Doc<"users">,
  "planInterval" | "planStatus" | "planEndsAt" | "planCancelAtPeriodEnd" | "planComp"
> | null;

/** Everything the app needs to draw a company's plan-aware screens, in one object. */
export function planSummary(id: PlanId, holder: BillingHolder, seats: number, billed: boolean) {
  const paidSeats = id === "free" ? 1 : Math.max(1, seats);
  const pool = Object.fromEntries(
    (Object.keys(PLANS[id].ai) as AiKind[]).map((k) => [k, PLANS[id].ai[k] * paidSeats]),
  ) as Record<AiKind, number>;
  return {
    id,
    name: PLANS[id].name,
    interval: (holder?.planInterval ?? null) as Interval | null,
    status: holder?.planStatus ?? null,
    endsAt: holder?.planEndsAt ?? null,
    cancelAtPeriodEnd: holder?.planCancelAtPeriodEnd ?? false,
    comped: !!holder?.planComp,
    billed,
    seats,
    features: Object.fromEntries(
      (Object.keys(FEATURES) as Feature[]).map((f) => [f, planIncludes(id, f)]),
    ) as Record<Feature, boolean>,
    limits: {
      /** The company's monthly AI pool: per seat on a paid plan. */
      ai: pool,
      uploadMb: PLANS[id].uploadMb,
      historyDays: PLANS[id].historyDays,
      collaborators: PLANS[id].collaborators,
    },
  };
}

export type PlanSummary = ReturnType<typeof planSummary>;
