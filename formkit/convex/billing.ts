import { ConvexError, v } from "convex/values";
import { action, httpAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { platformValue, requireStaff, requireUser, setPlatformValue, writeAudit } from "./model/identity";
import { PLANS, REPLY_PACK, planOf, planIncludes, type Interval, type PlanId } from "./model/plans";

/**
 * Billing, through Polar (polar.sh) as the merchant of record.
 *
 * Four products — Pro and Business, each monthly and yearly — live in Polar;
 * their ids are kept in the `platform` table (Admin → Billing creates them).
 * Checkout is a Polar-hosted page opened with the account's id as the
 * external customer id, so every webhook can be tied back to the account
 * without matching on email. Polar's webhooks are the only thing that changes
 * an account's plan; the app never assumes a payment went through.
 *
 * Environment (Convex): POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, and
 * POLAR_SERVER=sandbox while testing (production otherwise).
 */

const SITE = process.env.SITE_URL ?? "https://formkit.app";

type Products = Partial<Record<`${Exclude<PlanId, "free">}_${Interval}` | "replies_100", string>>;

function apiBase() {
  return process.env.POLAR_SERVER === "sandbox" ? "https://sandbox-api.polar.sh" : "https://api.polar.sh";
}

async function polar<T>(path: string, body: unknown): Promise<T> {
  const token = process.env.POLAR_ACCESS_TOKEN;
  if (!token) throw new ConvexError("Billing is not set up yet. Try again soon.");
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Polar ${path} ${res.status}: ${text.slice(0, 500)}`);
    throw new ConvexError(`Polar refused the request (${res.status}).`);
  }
  return JSON.parse(text) as T;
}

/* ------------------------------------------------------------------ */
/* Checkout and the customer portal                                    */
/* ------------------------------------------------------------------ */

export const me = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const products = (await platformValue<Products>(ctx, "polarProducts")) ?? {};
    return {
      _id: user._id,
      email: user.email ?? null,
      name: user.name ?? null,
      plan: planOf(user),
      comped: !!user.planComp,
      customer: user.polarCustomerId ?? null,
      products,
    };
  },
});

/** Opens Polar's checkout for a plan; the app sends the person to the url. */
export const checkout = action({
  args: {
    plan: v.union(v.literal("pro"), v.literal("business")),
    interval: v.union(v.literal("month"), v.literal("year")),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, { plan, interval }): Promise<{ url: string }> => {
    const me: {
      _id: Id<"users">;
      email: string | null;
      name: string | null;
      plan: PlanId;
      comped: boolean;
      customer: string | null;
      products: Products;
    } = await ctx.runQuery(internal.billing.me, {});
    const product = me.products[`${plan}_${interval}`];
    if (!product) throw new ConvexError("That plan is not on sale yet. Try again soon.");
    // Someone already paying changes plan in the portal, where Polar prorates.
    if (me.customer && me.plan !== "free" && !me.comped) {
      return await portalUrl(me._id);
    }
    const res = await polar<{ url: string }>("/v1/checkouts/", {
      products: [product],
      external_customer_id: me._id,
      ...(me.email ? { customer_email: me.email } : {}),
      ...(me.name ? { customer_name: me.name } : {}),
      success_url: `${SITE}/app/settings?tab=plan&welcome=${plan}`,
      metadata: { userId: me._id, plan, interval },
    });
    return { url: res.url };
  },
});

/**
 * Business: a one-off pack of AI replies. The credits land when Polar says
 * the order is paid, and roll over until used.
 */
export const buyReplies = action({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx): Promise<{ url: string }> => {
    const me: { _id: Id<"users">; email: string | null; name: string | null; plan: PlanId; products: Products } =
      await ctx.runQuery(internal.billing.me, {});
    if (!planIncludes(me.plan, "ai.reply")) throw new ConvexError("AI replies are part of Business.");
    const product = me.products.replies_100;
    if (!product) throw new ConvexError("Reply packs are not on sale yet. Try again soon.");
    const res = await polar<{ url: string }>("/v1/checkouts/", {
      products: [product],
      external_customer_id: me._id,
      ...(me.email ? { customer_email: me.email } : {}),
      ...(me.name ? { customer_name: me.name } : {}),
      success_url: `${SITE}/app/settings?tab=plan&replies=added`,
      metadata: { userId: me._id, pack: "replies_100" },
    });
    return { url: res.url };
  },
});

async function portalUrl(userId: Id<"users">) {
  const res = await polar<{ customer_portal_url: string }>("/v1/customer-sessions/", {
    external_customer_id: userId,
  });
  return { url: res.customer_portal_url };
}

/** Polar's own page for invoices, payment method, switching and cancelling. */
export const portal = action({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx): Promise<{ url: string }> => {
    const me: { _id: Id<"users">; customer: string | null } = await ctx.runQuery(internal.billing.me, {});
    if (!me.customer) throw new ConvexError("There is no billing on this account yet.");
    return await portalUrl(me._id);
  },
});

/* ------------------------------------------------------------------ */
/* Webhooks                                                            */
/* ------------------------------------------------------------------ */

function b64(bytes: ArrayBuffer) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s);
}

/**
 * Standard Webhooks, as Polar signs them: HMAC-SHA256 over
 * "<id>.<timestamp>.<body>", keyed with the secret's own bytes, sent as
 * space-separated "v1,<base64>" signatures. Anything older than five minutes
 * is refused, so a captured request cannot be replayed later.
 */
async function verified(req: Request, body: string) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) return false;
  const id = req.headers.get("webhook-id");
  const ts = req.headers.get("webhook-timestamp");
  const sigs = req.headers.get("webhook-signature");
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = b64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  return sigs.split(" ").some((part) => {
    const [, sig] = part.split(",");
    if (!sig || sig.length !== mac.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ mac.charCodeAt(i);
    return diff === 0;
  });
}

type PolarSubscription = {
  id: string;
  status: string;
  product_id?: string;
  product?: { id: string };
  customer_id?: string;
  customer?: { id: string; external_id?: string | null; email?: string | null };
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  ended_at?: string | null;
  metadata?: Record<string, unknown>;
};

export const polarWebhook = httpAction(async (ctx, req) => {
  const body = await req.text();
  if (!(await verified(req, body))) return new Response("Invalid signature", { status: 403 });
  let event: { type: string; data: PolarSubscription };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (event.type === "order.paid" || event.type === "order.created") {
    const o = event.data as unknown as PolarOrder;
    // A created order is only money once it is paid; older API versions
    // report paid orders as created with status "paid".
    if (event.type === "order.paid" || o.status === "paid") {
      await ctx.runMutation(internal.billing.recordOrder, {
        orderId: o.id,
        amount: o.net_amount ?? o.subtotal_amount ?? o.amount ?? Math.max(0, (o.total_amount ?? 0) - (o.tax_amount ?? 0)),
        currency: (o.currency ?? "usd").toLowerCase(),
        at: o.created_at ? Date.parse(o.created_at) : Date.now(),
        reason: o.billing_reason ?? undefined,
        productId: o.product_id ?? o.product?.id ?? "",
        customerId: o.customer_id ?? o.customer?.id ?? "",
        externalId: o.customer?.external_id ?? undefined,
        email: o.customer?.email ?? undefined,
      });
    }
  }
  if (event.type.startsWith("subscription.")) {
    const s = event.data;
    await ctx.runMutation(internal.billing.applySubscription, {
      type: event.type,
      subscriptionId: s.id,
      status: s.status,
      productId: s.product_id ?? s.product?.id ?? "",
      customerId: s.customer_id ?? s.customer?.id ?? "",
      externalId: s.customer?.external_id ?? (s.metadata?.userId as string | undefined) ?? undefined,
      email: s.customer?.email ?? undefined,
      periodEnd: s.current_period_end ? Date.parse(s.current_period_end) : undefined,
      cancelAtPeriodEnd: s.cancel_at_period_end ?? false,
      endedAt: s.ended_at ? Date.parse(s.ended_at) : undefined,
    });
  }
  return new Response(null, { status: 202 });
});

type PolarOrder = {
  id: string;
  status?: string;
  amount?: number;
  net_amount?: number;
  subtotal_amount?: number;
  total_amount?: number;
  tax_amount?: number;
  currency?: string;
  created_at?: string;
  billing_reason?: string;
  product_id?: string;
  product?: { id?: string };
  customer_id?: string;
  customer?: { id?: string; external_id?: string | null; email?: string };
};

/** A plan's monthly value in dollars: a yearly price spread over twelve months. */
function monthlyValue(plan: PlanId, interval: Interval | undefined, paying: boolean) {
  if (!paying || plan === "free") return 0;
  const p = PLANS[plan].price;
  return interval === "year" ? Math.round((p.year / 12) * 100) / 100 : p.month;
}

export const recordOrder = internalMutation({
  args: {
    orderId: v.string(),
    amount: v.number(),
    currency: v.string(),
    at: v.number(),
    reason: v.optional(v.string()),
    productId: v.string(),
    customerId: v.string(),
    externalId: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const seen = await ctx.db
      .query("polarOrders")
      .withIndex("by_order", (q) => q.eq("orderId", a.orderId))
      .first();
    if (seen) return null;
    const user = await findCustomer(ctx, a.externalId, a.customerId, a.email);
    const products = (await platformValue<Products>(ctx, "polarProducts")) ?? {};
    const match = (Object.entries(products) as [keyof Products, string][]).find(([, id]) => id === a.productId);
    if (match?.[0] === "replies_100") {
      if (user) await ctx.db.patch(user._id, { aiReplyCredits: (user.aiReplyCredits ?? 0) + REPLY_PACK.replies });
      await ctx.db.insert("polarOrders", { orderId: a.orderId, userId: user?._id, email: user?.email ?? a.email, at: a.at, amount: a.amount, currency: a.currency, reason: "reply pack" });
      return null;
    }
    const [plan, interval] = match ? (match[0].split("_") as [Exclude<PlanId, "free">, Interval]) : [undefined, undefined];
    await ctx.db.insert("polarOrders", {
      orderId: a.orderId,
      userId: user?._id,
      email: user?.email ?? a.email,
      at: a.at,
      amount: a.amount,
      currency: a.currency,
      reason: a.reason,
      plan,
      interval,
    });
    return null;
  },
});

export const applySubscription = internalMutation({
  args: {
    type: v.string(),
    subscriptionId: v.string(),
    status: v.string(),
    productId: v.string(),
    customerId: v.string(),
    externalId: v.optional(v.string()),
    email: v.optional(v.string()),
    periodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    endedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const user = await findCustomer(ctx, a.externalId, a.customerId, a.email);
    await setPlatformValue(ctx, "polarLastEvent", { type: a.type, at: Date.now(), matched: !!user });
    if (!user) {
      console.warn(`Polar ${a.type}: no account for customer ${a.customerId}`);
      return null;
    }
    // An event for a subscription this account has since replaced changes nothing.
    if (user.polarSubscriptionId && user.polarSubscriptionId !== a.subscriptionId && a.status !== "active") {
      return null;
    }
    const products = (await platformValue<Products>(ctx, "polarProducts")) ?? {};
    const match = (Object.entries(products) as [keyof Products, string][]).find(([, id]) => id === a.productId);
    const [plan, interval] = (match?.[0] ?? "pro_month").split("_") as [Exclude<PlanId, "free">, Interval];
    const revoked = a.type === "subscription.revoked" || a.status === "revoked";
    const was = planOf(user);
    await ctx.db.patch(user._id, {
      plan: revoked ? "free" : plan,
      planInterval: interval,
      planStatus: revoked ? "revoked" : a.status,
      // A cancelled or unpaid plan runs to the end of the period paid for;
      // Polar retries a failed payment within it.
      planEndsAt: revoked
        ? (a.endedAt ?? Date.now())
        : a.cancelAtPeriodEnd || a.status === "past_due" || a.status === "canceled" || a.status === "unpaid"
          ? a.periodEnd
          : undefined,
      planCancelAtPeriodEnd: a.cancelAtPeriodEnd,
      polarCustomerId: a.customerId || user.polarCustomerId,
      polarSubscriptionId: a.subscriptionId,
    });
    const after = (await ctx.db.get(user._id))!;
    const now = planOf(after);
    if (now !== was) {
      await writeAudit(ctx, null, `Plan ${was} → ${now}`, user.email ?? user._id, `Polar ${a.type}`);
    }

    // The history the admin revenue figures read. Comped plans are not revenue.
    const paidBefore = !!user.plan && user.plan !== "free" && !user.planComp && ["active", "trialing", "past_due"].includes(user.planStatus ?? "");
    const paidAfter = !revoked && ["active", "trialing", "past_due"].includes(a.status) && !user.planComp;
    const prevMrr = monthlyValue((user.plan ?? "free") as PlanId, user.planInterval, paidBefore && !user.planCancelAtPeriodEnd);
    const mrr = monthlyValue(revoked ? "free" : plan, interval, paidAfter && !a.cancelAtPeriodEnd);
    const rank = { free: 0, pro: 1, business: 2 } as const;
    const prevPlan = (user.plan ?? "free") as PlanId;
    const nextPlan: PlanId = revoked ? "free" : plan;
    const kind:
      | "started"
      | "upgraded"
      | "downgraded"
      | "switched"
      | "cancelling"
      | "resumed"
      | "past_due"
      | "ended"
      | null = revoked || (!paidAfter && paidBefore && a.status !== "past_due")
      ? "ended"
      : !paidBefore && paidAfter
        ? "started"
        : a.status === "past_due" && user.planStatus !== "past_due"
          ? "past_due"
          : a.cancelAtPeriodEnd && !user.planCancelAtPeriodEnd
            ? "cancelling"
            : !a.cancelAtPeriodEnd && user.planCancelAtPeriodEnd
              ? "resumed"
              : rank[nextPlan] > rank[prevPlan]
                ? "upgraded"
                : rank[nextPlan] < rank[prevPlan]
                  ? "downgraded"
                  : interval !== user.planInterval && paidBefore
                    ? "switched"
                    : null;
    if (kind) {
      await ctx.db.insert("billingEvents", {
        userId: user._id,
        at: Date.now(),
        kind,
        plan: nextPlan,
        interval,
        prevPlan,
        mrr,
        prevMrr,
      });
    }
    if (kind === "started") await ctx.db.patch(user._id, { planSince: Date.now() });
    return null;
  },
});

async function findCustomer(
  ctx: { db: import("./_generated/server").MutationCtx["db"] },
  externalId: string | undefined,
  customerId: string,
  email: string | undefined,
): Promise<Doc<"users"> | null> {
  if (externalId) {
    const id = ctx.db.normalizeId("users", externalId);
    const byId = id ? await ctx.db.get(id) : null;
    if (byId) return byId;
  }
  if (customerId) {
    const byCustomer = await ctx.db
      .query("users")
      .withIndex("by_polar_customer", (q) => q.eq("polarCustomerId", customerId))
      .first();
    if (byCustomer) return byCustomer;
  }
  if (email) {
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email.toLowerCase()))
      .first();
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Admin → Billing                                                     */
/* ------------------------------------------------------------------ */

export const adminStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "billing");
    const users = await ctx.db.query("users").collect();
    const paying = users.filter((u) => !u.planComp && planOf(u) !== "free");
    const monthly = (u: Doc<"users">) => {
      const p = PLANS[planOf(u)];
      return u.planInterval === "year" ? p.price.year / 12 : p.price.month;
    };
    return {
      token: !!process.env.POLAR_ACCESS_TOKEN,
      secret: !!process.env.POLAR_WEBHOOK_SECRET,
      server: process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
      webhookUrl: `${process.env.CONVEX_SITE_URL ?? ""}/polar/webhook`,
      products: (await platformValue<Products>(ctx, "polarProducts")) ?? {},
      lastEvent: await platformValue<{ type: string; at: number; matched: boolean }>(ctx, "polarLastEvent"),
      counts: {
        pro: users.filter((u) => planOf(u) === "pro").length,
        business: users.filter((u) => planOf(u) === "business").length,
        comped: users.filter((u) => u.planComp).length,
        paying: paying.length,
      },
      mrr: Math.round(paying.reduce((n, u) => n + monthly(u), 0) * 100) / 100,
    };
  },
});

/** Checks the caller is billing staff, and says which products already exist. */
export const staffCheck = internalQuery({
  args: {},
  handler: async (ctx): Promise<Products> => {
    await requireStaff(ctx, "billing");
    return (await platformValue<Products>(ctx, "polarProducts")) ?? {};
  },
});

/**
 * Creates whichever products Polar doesn't have yet — the four plans and the
 * pack of AI replies — at the listed prices, and remembers their ids. Ones
 * already made are left alone: a new copy of a plan would change its id, and
 * people already paying for the old one would no longer be recognised.
 */
export const createProducts = action({
  args: {},
  returns: v.object({ made: v.array(v.string()), kept: v.array(v.string()) }),
  handler: async (ctx): Promise<{ made: string[]; kept: string[] }> => {
    const have: Products = await ctx.runQuery(internal.billing.staffCheck, {});
    const next: Products = { ...have };
    const made: string[] = [];
    for (const plan of ["pro", "business"] as const) {
      for (const interval of ["month", "year"] as const) {
        const key = `${plan}_${interval}` as const;
        if (have[key]) continue;
        const res = await polar<{ id: string }>("/v1/products/", {
          name: `Formkit ${PLANS[plan].name} (${interval === "month" ? "monthly" : "yearly"})`,
          description: PLANS[plan].tagline,
          recurring_interval: interval,
          prices: [{ amount_type: "fixed", price_amount: PLANS[plan].price[interval] * 100, price_currency: "usd" }],
        });
        next[key] = res.id;
        made.push(key);
      }
    }
    if (!have.replies_100) {
      const pack = await polar<{ id: string }>("/v1/products/", {
        name: `Formkit AI replies — ${REPLY_PACK.replies}`,
        description: `${REPLY_PACK.replies} more AI replies for Business forms. They roll over until used.`,
        prices: [{ amount_type: "fixed", price_amount: REPLY_PACK.price * 100, price_currency: "usd" }],
      });
      next.replies_100 = pack.id;
      made.push("replies_100");
    }
    // Saved after each run, so a failure part-way keeps what was made.
    if (made.length) await ctx.runMutation(internal.billing.storeProducts, { products: next });
    return { made, kept: Object.keys(have).filter((k) => have[k as keyof Products]) };
  },
});

export const storeProducts = internalMutation({
  args: { products: v.any() },
  returns: v.null(),
  handler: async (ctx, { products }) => {
    await setPlatformValue(ctx, "polarProducts", products);
    return null;
  },
});

/** Product ids pasted by hand, for products made in Polar's dashboard. */
export const saveProducts = mutation({
  args: {
    pro_month: v.string(),
    pro_year: v.string(),
    business_month: v.string(),
    business_year: v.string(),
    replies_100: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, ids) => {
    const staff = await requireStaff(ctx, "billing");
    const clean = Object.fromEntries(Object.entries(ids).map(([k, val]) => [k, val.trim()]).filter(([, val]) => val));
    await setPlatformValue(ctx, "polarProducts", clean);
    await writeAudit(ctx, staff, "Updated Polar products");
    return null;
  },
});

/** A plan given by hand — a friend, a partner, a support gesture. */
export const compPlan = mutation({
  args: { userId: v.id("users"), plan: v.union(v.literal("pro"), v.literal("business"), v.null()) },
  returns: v.null(),
  handler: async (ctx, { userId, plan }) => {
    const staff = await requireStaff(ctx, "billing");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("That account no longer exists.");
    await ctx.db.patch(userId, { planComp: plan ?? undefined });
    await writeAudit(
      ctx,
      staff,
      plan ? `Gave ${PLANS[plan].name} free of charge` : "Ended a free plan",
      user.email ?? user._id,
    );
    return null;
  },
});
