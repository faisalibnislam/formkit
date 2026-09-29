import { ConvexError, v } from "convex/values";
import { action, httpAction, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { platformValue, requireStaff, requireUser, setPlatformValue, writeAudit } from "./model/identity";
import { giveComp, endComp } from "./model/grants";
import { CREDIT_PACKS, PLANS, compOf, planOf, type CreditPackKey, type Interval, type PlanId } from "./model/plans";
import { addCredits } from "./model/aiMeter";
import { canManage, currentSpace, personalSpace, resolveSpace, roleIn, seatsOf, spaceKey, spacePlanId } from "./model/spaces";

/**
 * Billing, through Polar (polar.sh) as the merchant of record.
 *
 * Plans belong to companies and are paid per seat: Pro and Business, each
 * monthly and yearly, as seat-based products, plus three packs of AI credits.
 * Their ids are kept in the `platform` table (Admin → Billing creates them).
 * The older fixed-price products stay listed so subscriptions bought on them
 * keep being recognised.
 * Checkout is a Polar-hosted page opened with the account's id as the
 * external customer id, so every webhook can be tied back to the account
 * without matching on email. Polar's webhooks are the only thing that changes
 * an account's plan; the app never assumes a payment went through.
 *
 * Environment (Convex): POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, and
 * POLAR_SERVER=sandbox while testing (production otherwise).
 */

const SITE = process.env.SITE_URL ?? "https://formkit.app";

type PlanKey = `${Exclude<PlanId, "free">}_${Interval}`;
type Products = Partial<Record<PlanKey | `${PlanKey}_seat` | "replies_100" | CreditPackKey, string>>;

/** The plan and interval a product id stands for, seat-based or older. */
function planOfProduct(products: Products, productId: string) {
  const key = (Object.entries(products) as [string, string][]).find(([, id]) => id === productId)?.[0];
  if (!key || key === "replies_100" || key.startsWith("credits_")) return null;
  const [plan, interval] = key.split("_") as [Exclude<PlanId, "free">, Interval];
  return { plan, interval, seated: key.endsWith("_seat") };
}

function apiBase() {
  return process.env.POLAR_SERVER === "sandbox" ? "https://sandbox-api.polar.sh" : "https://api.polar.sh";
}

async function polar<T>(path: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const token = process.env.POLAR_ACCESS_TOKEN;
  if (!token) throw new ConvexError("Billing is not set up yet. Try again soon.");
  const res = await fetch(`${apiBase()}${path}`, {
    method,
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
    const space = await currentSpace(ctx, user);
    const company = space.brand === "me" ? null : await ctx.db.get(space.brand);
    // The company's own subscription; a personal one counts once it is per seat.
    const subscription =
      space.brand === "me"
        ? user.spaceBilling || space.ownerId !== user._id
          ? ((await ctx.db.get(space.ownerId))?.polarSubscriptionId ?? null)
          : null
        : (company?.polarSubscriptionId ?? null);
    return {
      _id: user._id,
      email: user.email ?? null,
      name: user.name ?? null,
      space: spaceKey(space),
      company: company?.name ?? null,
      manage: canManage(await roleIn(ctx, space, user._id)),
      plan: await spacePlanId(ctx, space),
      comped: space.brand === "me" ? !!compOf(user) : !!compOf(company),
      subscription,
      seats: await seatsOf(ctx, space),
      customer: user.polarCustomerId ?? null,
      products,
    };
  },
});

type Me = {
  _id: Id<"users">;
  email: string | null;
  name: string | null;
  space: string;
  company: string | null;
  manage: boolean;
  plan: PlanId;
  comped: boolean;
  subscription: string | null;
  seats: number;
  customer: string | null;
  products: Products;
};

/**
 * Opens Polar's checkout for the company being worked in, for as many seats
 * as it has members. A company already paying changes plan in the portal.
 */
export const checkout = action({
  args: {
    plan: v.union(v.literal("pro"), v.literal("business")),
    interval: v.union(v.literal("month"), v.literal("year")),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, { plan, interval }): Promise<{ url: string }> => {
    const me: Me = await ctx.runQuery(internal.billing.me, {});
    if (!me.manage) throw new ConvexError("Only the company’s owner and admins can change its plan.");
    const product = me.products[`${plan}_${interval}_seat`];
    if (!product) throw new ConvexError("That plan is not on sale yet. Try again soon.");
    if (me.subscription && me.plan !== "free" && !me.comped && me.customer) return await portalUrl(me._id);
    const res = await polar<{ url: string }>("/v1/checkouts/", {
      products: [product],
      seats: Math.max(1, me.seats),
      external_customer_id: me._id,
      ...(me.email ? { customer_email: me.email } : {}),
      ...(me.name ? { customer_name: me.name } : {}),
      success_url: `${SITE}/app/settings?tab=plan&welcome=${plan}`,
      metadata: { userId: me._id, space: me.space, plan, interval },
    });
    return { url: res.url };
  },
});

/**
 * A pack of AI credits for the company being worked in. The credits land
 * when Polar says the order is paid, and last a year.
 */
export const buyCredits = action({
  args: { pack: v.union(v.literal("credits_100"), v.literal("credits_420"), v.literal("credits_1050")) },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, { pack }): Promise<{ url: string }> => {
    const me: Me = await ctx.runQuery(internal.billing.me, {});
    const product = me.products[pack];
    if (!product) throw new ConvexError("AI credits are not on sale yet. Try again soon.");
    const res = await polar<{ url: string }>("/v1/checkouts/", {
      products: [product],
      external_customer_id: me._id,
      ...(me.email ? { customer_email: me.email } : {}),
      ...(me.name ? { customer_name: me.name } : {}),
      success_url: `${SITE}/app/settings?tab=plan&credits=added`,
      metadata: { userId: me._id, space: me.space, pack },
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

/** What a company's subscription needs to follow its member count. */
export const seatJob = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const space = await resolveSpace(ctx, key);
    if (!space) return null;
    const holder = space.brand === "me" ? await ctx.db.get(space.ownerId) : await ctx.db.get(space.brand);
    if (!holder?.polarSubscriptionId || compOf(holder)) return null;
    // Only per-seat subscriptions follow members; an older fixed-price one does not.
    if (space.brand === "me" && !(holder as Doc<"users">).spaceBilling) return null;
    return { subscriptionId: holder.polarSubscriptionId, seats: await seatsOf(ctx, space), billed: holder.planSeats ?? null };
  },
});

/** Sets the subscription's seats to the company's members; Polar prorates the difference. */
export const syncSeats = internalAction({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, { key }) => {
    const job: { subscriptionId: string; seats: number; billed: number | null } | null = await ctx.runQuery(
      internal.billing.seatJob,
      { key },
    );
    if (!job || job.seats === job.billed) return null;
    try {
      await polar(`/v1/subscriptions/${job.subscriptionId}`, { seats: Math.max(1, job.seats) }, "PATCH");
    } catch (e) {
      console.error(`Seats not updated for ${key}`, e);
    }
    return null;
  },
});

/** Polar's own page for invoices, payment method, switching and cancelling. */
export const portal = action({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx): Promise<{ url: string }> => {
    const me: Me = await ctx.runQuery(internal.billing.me, {});
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
  seats?: number | null;
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
        space: typeof o.metadata?.space === "string" ? o.metadata.space : undefined,
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
      seats: s.seats ?? undefined,
      space: typeof s.metadata?.space === "string" ? s.metadata.space : undefined,
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
  metadata?: Record<string, unknown>;
};

/** A plan's monthly value in dollars: per seat, a yearly price spread over twelve months. */
function monthlyValue(plan: PlanId, interval: Interval | undefined, paying: boolean, seats = 1) {
  if (!paying || plan === "free") return 0;
  const p = PLANS[plan].price;
  const each = interval === "year" ? p.year / 12 : p.month;
  return Math.round(each * Math.max(1, seats) * 100) / 100;
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
    space: v.optional(v.string()),
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
    // A pack of AI credits (or an older pack of 100 AI replies, now 100
    // credits) goes to the company it was bought for.
    const pack = match?.[0] === "replies_100" ? { credits: 100 } : CREDIT_PACKS.find((p) => p.key === match?.[0]);
    if (pack) {
      const space = (await resolveSpace(ctx, a.space)) ?? (user ? personalSpace(user._id) : null);
      if (space) await addCredits(ctx, space, pack.credits);
      await ctx.db.insert("polarOrders", {
        orderId: a.orderId,
        userId: user?._id,
        email: user?.email ?? a.email,
        at: a.at,
        amount: a.amount,
        currency: a.currency,
        reason: "credits",
      });
      return null;
    }
    const known = planOfProduct(products, a.productId);
    const [plan, interval] = known ? [known.plan, known.interval] : [undefined, undefined];
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
    seats: v.optional(v.number()),
    space: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    // The payer: the account whose Polar customer holds the subscription.
    const user = await findCustomer(ctx, a.externalId, a.customerId, a.email);
    await setPlatformValue(ctx, "polarLastEvent", { type: a.type, at: Date.now(), matched: !!user });
    if (!user) {
      console.warn(`Polar ${a.type}: no account for customer ${a.customerId}`);
      return null;
    }
    const products = (await platformValue<Products>(ctx, "polarProducts")) ?? {};
    const known = planOfProduct(products, a.productId);
    const plan = known?.plan ?? "pro";
    const interval = known?.interval ?? "month";

    // The company it pays for: named at checkout, else the one already on this
    // subscription, else the payer's own (subscriptions from before companies).
    let space = await resolveSpace(ctx, a.space);
    if (!space) {
      const co = await ctx.db
        .query("companies")
        .withIndex("by_subscription", (q) => q.eq("polarSubscriptionId", a.subscriptionId))
        .first();
      if (co) space = { ownerId: co.ownerId, brand: co._id };
    }
    if (!space) space = personalSpace(user._id);
    const holder: Doc<"users"> | Doc<"companies"> | null =
      space.brand === "me" ? await ctx.db.get(space.ownerId) : await ctx.db.get(space.brand);
    if (!holder) return null;

    // An event for a subscription this company has since replaced changes nothing.
    if (holder.polarSubscriptionId && holder.polarSubscriptionId !== a.subscriptionId && a.status !== "active") {
      return null;
    }
    const revoked = a.type === "subscription.revoked" || a.status === "revoked";
    const was = planOf(holder);
    const seats = a.seats ?? holder.planSeats ?? 1;
    const patch = {
      plan: revoked ? ("free" as const) : plan,
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
      polarSubscriptionId: a.subscriptionId,
      planSeats: seats,
    };
    if (space.brand === "me") {
      await ctx.db.patch(space.ownerId, {
        ...patch,
        polarCustomerId: a.customerId || user.polarCustomerId,
        // Paying per seat ends the grandfathering of an older account-wide plan.
        ...(known?.seated ? { spaceBilling: true } : {}),
      });
    } else {
      await ctx.db.patch(space.brand, { ...patch, billedTo: user._id });
      if (a.customerId && !user.polarCustomerId) await ctx.db.patch(user._id, { polarCustomerId: a.customerId });
    }
    const after = (space.brand === "me" ? await ctx.db.get(space.ownerId) : await ctx.db.get(space.brand))!;
    const now = planOf(after);
    const label = space.brand === "me" ? (user.email ?? user._id) : `${(holder as Doc<"companies">).name} (${user.email ?? user._id})`;
    if (now !== was) await writeAudit(ctx, null, `Plan ${was} → ${now}`, label, `Polar ${a.type}`);
    // Members may have joined while checkout was open: the seats catch up.
    if (!revoked && a.status === "active") {
      await ctx.scheduler.runAfter(0, internal.billing.syncSeats, { key: spaceKey(space) });
    }

    // The history the admin revenue figures read. Comped plans are not revenue.
    const paidBefore =
      !!holder.plan && holder.plan !== "free" && !compOf(holder) && ["active", "trialing", "past_due"].includes(holder.planStatus ?? "");
    const paidAfter = !revoked && ["active", "trialing", "past_due"].includes(a.status) && !compOf(holder);
    const prevMrr = monthlyValue(
      (holder.plan ?? "free") as PlanId,
      holder.planInterval,
      paidBefore && !holder.planCancelAtPeriodEnd,
      holder.planSeats ?? 1,
    );
    const mrr = monthlyValue(revoked ? "free" : plan, interval, paidAfter && !a.cancelAtPeriodEnd, seats);
    const rank = { free: 0, pro: 1, business: 2 } as const;
    const prevPlan = (holder.plan ?? "free") as PlanId;
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
        : a.status === "past_due" && holder.planStatus !== "past_due"
          ? "past_due"
          : a.cancelAtPeriodEnd && !holder.planCancelAtPeriodEnd
            ? "cancelling"
            : !a.cancelAtPeriodEnd && holder.planCancelAtPeriodEnd
              ? "resumed"
              : rank[nextPlan] > rank[prevPlan]
                ? "upgraded"
                : rank[nextPlan] < rank[prevPlan]
                  ? "downgraded"
                  : interval !== holder.planInterval && paidBefore
                    ? "switched"
                    : mrr !== prevMrr && paidBefore && paidAfter
                      ? rank[nextPlan] === rank[prevPlan] && mrr > prevMrr
                        ? "upgraded"
                        : "downgraded"
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
    if (kind === "started") {
      if (space.brand === "me") await ctx.db.patch(space.ownerId, { planSince: Date.now() });
      else await ctx.db.patch(space.brand, { planSince: Date.now() });
    }
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
    const companies = (await ctx.db.query("companies").collect()).filter((c) => c.plan || compOf(c));
    // Every paid plan: personal ones on accounts, and companies' own.
    const holders: (Doc<"users"> | Doc<"companies">)[] = [...users, ...companies];
    const paying = holders.filter((u) => !compOf(u) && planOf(u) !== "free");
    const monthly = (u: Doc<"users"> | Doc<"companies">) => {
      const p = PLANS[planOf(u)];
      return (u.planInterval === "year" ? p.price.year / 12 : p.price.month) * Math.max(1, u.planSeats ?? 1);
    };
    return {
      token: !!process.env.POLAR_ACCESS_TOKEN,
      secret: !!process.env.POLAR_WEBHOOK_SECRET,
      server: process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
      webhookUrl: `${process.env.CONVEX_SITE_URL ?? ""}/polar/webhook`,
      products: (await platformValue<Products>(ctx, "polarProducts")) ?? {},
      lastEvent: await platformValue<{ type: string; at: number; matched: boolean }>(ctx, "polarLastEvent"),
      counts: {
        pro: holders.filter((u) => planOf(u) === "pro").length,
        business: holders.filter((u) => planOf(u) === "business").length,
        comped: holders.filter((u) => compOf(u)).length,
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
 * Creates whichever products Polar doesn't have yet - the four per-seat plans
 * and the three packs of AI credits - at the listed prices, and remembers their
 * ids. Ones already made are left alone: a new copy would change its id, and
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
        const key = `${plan}_${interval}_seat` as const;
        if (have[key]) continue;
        const res = await polar<{ id: string }>("/v1/products/", {
          name: `Formkit ${PLANS[plan].name} (${interval === "month" ? "monthly" : "yearly"}, per seat)`,
          description: PLANS[plan].tagline,
          recurring_interval: interval,
          prices: [
            {
              amount_type: "seat_based",
              price_currency: "usd",
              seat_tiers: {
                seat_tier_type: "volume",
                tiers: [{ min_seats: 1, max_seats: null, price_per_seat: PLANS[plan].price[interval] * 100 }],
              },
            },
          ],
        });
        next[key] = res.id;
        made.push(key);
      }
    }
    for (const pack of CREDIT_PACKS) {
      if (have[pack.key]) continue;
      const res = await polar<{ id: string }>("/v1/products/", {
        name: `Formkit AI credits: ${pack.credits.toLocaleString("en-US")}`,
        description: `${pack.credits.toLocaleString("en-US")} AI credits for one company, used once its monthly AI allowance runs out. They last a year.`,
        prices: [{ amount_type: "fixed", price_amount: pack.price * 100, price_currency: "usd" }],
      });
      next[pack.key] = res.id;
      made.push(pack.key);
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
    pro_month_seat: v.optional(v.string()),
    pro_year_seat: v.optional(v.string()),
    business_month_seat: v.optional(v.string()),
    business_year_seat: v.optional(v.string()),
    credits_100: v.optional(v.string()),
    credits_420: v.optional(v.string()),
    credits_1050: v.optional(v.string()),
    // The older fixed-price products, kept so their subscribers are recognised.
    pro_month: v.optional(v.string()),
    pro_year: v.optional(v.string()),
    business_month: v.optional(v.string()),
    business_year: v.optional(v.string()),
    replies_100: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, ids) => {
    const staff = await requireStaff(ctx, "billing");
    const clean = Object.fromEntries(
      Object.entries(ids)
        .map(([k, val]) => [k, (val ?? "").trim()])
        .filter(([, val]) => val),
    );
    await setPlatformValue(ctx, "polarProducts", clean);
    await writeAudit(ctx, staff, "Updated Polar products");
    return null;
  },
});

/**
 * A plan given by hand to someone's personal company - a friend, a partner, a
 * support gesture. Admin → Companies does the same for any company, with an
 * end date and a note; both go through model/grants.ts.
 */
export const compPlan = mutation({
  args: { userId: v.id("users"), plan: v.union(v.literal("pro"), v.literal("business"), v.null()) },
  returns: v.null(),
  handler: async (ctx, { userId, plan }) => {
    const staff = await requireStaff(ctx, "billing");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("That account no longer exists.");
    const space = personalSpace(userId);
    if (plan) await giveComp(ctx, staff, space, { plan, endsAt: null });
    else await endComp(ctx, staff, space);
    return null;
  },
});
