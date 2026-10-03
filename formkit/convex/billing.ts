import { ConvexError, v } from "convex/values";
import { action, httpAction, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { platformValue, requireStaff, requireUser, setPlatformValue, writeAudit } from "./model/identity";
import { giveComp, endComp } from "./model/grants";
import { CREDIT_PACKS, PLANS, compOf, planOf, type CreditPackKey, type Interval, type PlanId } from "./model/plans";
import { addCredits } from "./model/aiMeter";
import { readReport, type BillingReport } from "./adminReports";
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
 * without matching on email. Polar's webhooks change plans as they happen;
 * `syncCustomer` asks Polar directly as well (after checkout, before a new
 * one, and on request), so a webhook that never arrived cannot leave a
 * paying company on Free. The app never assumes a payment went through.
 *
 * Environment (Convex): POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, and
 * POLAR_SERVER=sandbox while testing (production otherwise).
 */

const SITE = process.env.SITE_URL ?? "https://formkit.app";

type PlanKey = `${Exclude<PlanId, "free">}_${Interval}`;
/**
 * `${PlanKey}_seat_<n>` are copies of a seat product. Polar refuses a second
 * live subscription to the same product for one customer, even with multiple
 * subscriptions allowed, so a person paying for several companies on the same
 * plan has each on its own copy (see `productFor`).
 */
type Products = Partial<
  Record<PlanKey | `${PlanKey}_seat` | `${PlanKey}_seat_${number}` | "replies_100" | CreditPackKey, string>
>;

/** The plan and interval a product id stands for, seat-based or older. */
function planOfProduct(products: Products, productId: string) {
  const key = (Object.entries(products) as [string, string][]).find(([, id]) => id === productId)?.[0];
  if (!key || key === "replies_100" || key.startsWith("credits_")) return null;
  const [plan, interval] = key.split("_") as [Exclude<PlanId, "free">, Interval];
  return { plan, interval, seated: key.includes("_seat") };
}

/** What Polar is sent to make a seat product: the same for every copy. */
function seatProductBody(plan: Exclude<PlanId, "free">, interval: Interval) {
  return {
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
  };
}

/**
 * The seat product to put a subscription on: the plan's product, or the first
 * copy of it this customer has no other live subscription to. A copy is made
 * in Polar the first time one is needed.
 */
async function productFor(
  ctx: { runMutation: import("./_generated/server").ActionCtx["runMutation"] },
  products: Products,
  plan: Exclude<PlanId, "free">,
  interval: Interval,
  taken: Set<string>,
): Promise<{ id: string; key: string }> {
  const base = `${plan}_${interval}_seat` as const;
  if (!products[base]) throw new ConvexError("That plan is not on sale yet. Try again soon.");
  for (let n = 1; n <= 50; n++) {
    const key = (n === 1 ? base : `${base}_${n}`) as keyof Products;
    const id = products[key];
    if (id && !taken.has(id)) return { id, key };
    if (!id) {
      const made = await polar<{ id: string }>("/v1/products/", seatProductBody(plan, interval));
      await ctx.runMutation(internal.billing.addProduct, { key, id: made.id });
      return { id: made.id, key: `${key} (new)` };
    }
  }
  throw new ConvexError("Too many companies on this plan for one account. Write to us and we will sort it out.");
}

export const addProduct = internalMutation({
  args: { key: v.string(), id: v.string() },
  returns: v.null(),
  handler: async (ctx, { key, id }) => {
    const have = (await platformValue<Products>(ctx, "polarProducts")) ?? {};
    await setPlatformValue(ctx, "polarProducts", { ...have, [key]: id });
    return null;
  },
});

function apiBase() {
  return process.env.POLAR_SERVER === "sandbox" ? "https://sandbox-api.polar.sh" : "https://api.polar.sh";
}

async function polar<T>(path: string, body?: unknown, method: "GET" | "POST" | "PATCH" = "POST"): Promise<T> {
  const token = process.env.POLAR_ACCESS_TOKEN;
  if (!token) throw new ConvexError("Billing is not set up yet. Try again soon.");
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Polar ${method} ${path} ${res.status}: ${text.slice(0, 500)}`);
    if (res.status === 404) throw new ConvexError({ code: "not_found", message: "Polar has no record of that." });
    let detail = "";
    try {
      const j = JSON.parse(text) as { detail?: unknown };
      detail = typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? String((j.detail[0] as { msg?: string })?.msg ?? "") : "";
    } catch {
      /* not JSON */
    }
    throw new ConvexError(detail ? `Polar: ${detail}` : `Polar refused the request (${res.status}).`);
  }
  return JSON.parse(text) as T;
}

const notFound = (e: unknown) =>
  e instanceof ConvexError && typeof e.data === "object" && (e.data as { code?: string })?.code === "not_found";

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
    // The subscription this company's plan comes from, and who pays for it.
    const holder = space.brand === "me" ? await ctx.db.get(space.ownerId) : company;
    const subscription = holder?.polarSubscriptionId ?? null;
    const live =
      !!subscription &&
      !!holder?.plan &&
      holder.plan !== "free" &&
      ["active", "trialing", "past_due"].includes(holder.planStatus ?? "") &&
      planOf(holder) !== "free";
    const payerId = space.brand === "me" ? space.ownerId : (company?.billedTo ?? space.ownerId);
    const payer = payerId === user._id ? user : await ctx.db.get(payerId);
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
      live,
      current: live && holder?.plan && holder.plan !== "free" ? { plan: holder.plan, interval: holder.planInterval ?? "month" } : null,
      cancelling: live && !!holder?.planCancelAtPeriodEnd,
      payer: { _id: payerId, name: payer?.name ?? payer?.email ?? null, me: payerId === user._id },
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
  live: boolean;
  current: { plan: Exclude<PlanId, "free">; interval: Interval } | null;
  cancelling: boolean;
  payer: { _id: Id<"users">; name: string | null; me: boolean };
  seats: number;
  customer: string | null;
  products: Products;
};

/**
 * Moves the company being worked in to a plan. A company already paying
 * changes plan (or monthly and yearly) on its subscription, in place: Polar
 * works out the difference. Otherwise Polar's checkout opens, for as many
 * seats as it has members. Polar is asked first, so a payment whose webhook
 * never arrived is found rather than paid twice.
 */
export const checkout = action({
  args: {
    plan: v.union(v.literal("pro"), v.literal("business")),
    interval: v.union(v.literal("month"), v.literal("year")),
  },
  returns: v.object({ url: v.optional(v.string()), changed: v.optional(v.string()) }),
  handler: async (ctx, { plan, interval }): Promise<{ url?: string; changed?: string }> => {
    let me: Me = await ctx.runQuery(internal.billing.me, {});
    if (!me.manage) throw new ConvexError("Only the company’s owner and admins can change its plan.");
    if (me.comped) throw new ConvexError("This company has a plan from Formkit. Ask support to change it.");
    if (!me.products[`${plan}_${interval}_seat`]) throw new ConvexError("That plan is not on sale yet. Try again soon.");

    // What the payer already has running in Polar, brought up to date first.
    const wasLive = me.live;
    const running = await syncWith(ctx, me.live ? me.payer._id : me._id, wasLive ? "before changing plan" : "before checkout").catch(
      async (e: unknown) => {
        await ctx.runMutation(internal.billing.logEvent, {
          type: "sync failed",
          ok: false,
          note: `Could not ask Polar what is running: ${e instanceof ConvexError ? String(typeof e.data === "string" ? e.data : (e.data as { message?: string })?.message) : String(e)}. Does POLAR_ACCESS_TOKEN allow reading customers and subscriptions?`,
        });
        return [] as PolarSubscription[];
      },
    );
    me = await ctx.runQuery(internal.billing.me, {});
    // A subscription Formkit had missed: it is on the plan it paid for now.
    if (!wasLive && me.live && me.current) return { changed: `found:${me.current.plan}` };
    const taken = new Set((running ?? []).filter((x) => x.id !== me.subscription).map((x) => x.product_id ?? x.product?.id ?? ""));

    if (me.live && me.subscription) {
      if (!me.payer.me) {
        throw new ConvexError(`${me.payer.name ?? "Someone else"} pays for this company. Ask them to change its plan.`);
      }
      if (me.current?.plan === plan && me.current.interval === interval && !me.cancelling) return { changed: plan };
      if (me.cancelling) {
        await applyPolar(ctx, "resumed", await polar<PolarSubscription>(`/v1/subscriptions/${me.subscription}`, { cancel_at_period_end: false }, "PATCH"));
      }
      if (me.current?.plan !== plan || me.current.interval !== interval) {
        const product = await productFor(ctx, me.products, plan, interval, taken);
        const updated = await polar<PolarSubscription>(
          `/v1/subscriptions/${me.subscription}`,
          { product_id: product.id, proration_behavior: "prorate" },
          "PATCH",
        );
        await applyPolar(ctx, "changed plan", updated, me.space);
      }
      return { changed: plan };
    }

    const product = await productFor(ctx, me.products, plan, interval, taken);
    const names = Object.fromEntries(Object.entries(me.products).map(([k, id]) => [id, k]));
    await ctx.runMutation(internal.billing.logEvent, {
      type: "checkout",
      ok: true,
      note: `Checkout for ${me.company ?? "a personal company"} (${me.email ?? me._id}) on ${product.key}. Polar has ${
        running?.length ?? 0
      } running for this person${running?.length ? `: ${running.map((x) => names[x.product_id ?? x.product?.id ?? ""] ?? x.product_id).join(", ")}` : ""}. If Polar still says "already have an active subscription", its one-subscription-per-customer setting is on.`,
    });
    const res = await polar<{ url: string }>("/v1/checkouts/", {
      products: [product.id],
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

/** Cancels at the end of the period paid for; nothing is charged again. */
export const cancel = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const me: Me = await ctx.runQuery(internal.billing.me, {});
    if (!me.manage) throw new ConvexError("Only the company’s owner and admins can change its plan.");
    if (!me.live || !me.subscription) throw new ConvexError("This company has no paid plan to cancel.");
    if (!me.payer.me) throw new ConvexError(`${me.payer.name ?? "Someone else"} pays for this company. Ask them to cancel it.`);
    await applyPolar(ctx, "cancelled", await polar<PolarSubscription>(`/v1/subscriptions/${me.subscription}`, { cancel_at_period_end: true }, "PATCH"), me.space);
    return null;
  },
});

/** Takes back a cancellation before the period ends. */
export const resume = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const me: Me = await ctx.runQuery(internal.billing.me, {});
    if (!me.manage) throw new ConvexError("Only the company’s owner and admins can change its plan.");
    if (!me.live || !me.subscription || !me.cancelling) throw new ConvexError("There is no cancellation to take back.");
    if (!me.payer.me) throw new ConvexError(`${me.payer.name ?? "Someone else"} pays for this company.`);
    await applyPolar(ctx, "resumed", await polar<PolarSubscription>(`/v1/subscriptions/${me.subscription}`, { cancel_at_period_end: false }, "PATCH"), me.space);
    return null;
  },
});

/**
 * Asks Polar what this person pays for and brings every company up to date:
 * after checkout, and from "Check with Polar" when a plan looks wrong.
 */
export const refresh = action({
  args: {},
  returns: v.object({ plan: v.string(), found: v.number() }),
  handler: async (ctx): Promise<{ plan: string; found: number }> => {
    const me: Me = await ctx.runQuery(internal.billing.me, {});
    const ids = [...new Set([me._id, me.payer._id])];
    let found = 0;
    for (const userId of ids) {
      const r = await ctx.runAction(internal.billing.syncCustomer, { userId, why: "checked from the app" });
      found += r.subscriptions;
    }
    const after: Me = await ctx.runQuery(internal.billing.me, {});
    return { plan: after.plan, found };
  },
});

/** Admin: the same check, for any company's payer. */
export const adminSync = action({
  args: { key: v.string() },
  returns: v.object({ found: v.number() }),
  handler: async (ctx, { key }): Promise<{ found: number }> => {
    const payer: Id<"users"> | null = await ctx.runQuery(internal.billing.payerOf, { key });
    if (!payer) throw new ConvexError("That company no longer exists.");
    const r = await ctx.runAction(internal.billing.syncCustomer, { userId: payer, why: "checked from the admin console" });
    return { found: r.subscriptions };
  },
});

export const payerOf = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireStaff(ctx, "billing");
    const space = await resolveSpace(ctx, key);
    if (!space) return null;
    if (space.brand === "me") return space.ownerId;
    return (await ctx.db.get(space.brand))?.billedTo ?? space.ownerId;
  },
});

/** Every subscription Polar has for this person, applied oldest first. */
export const syncCustomer = internalAction({
  args: { userId: v.id("users"), why: v.string() },
  returns: v.object({ customer: v.boolean(), subscriptions: v.number() }),
  handler: async (ctx, { userId, why }): Promise<{ customer: boolean; subscriptions: number }> => {
    const running = await syncWith(ctx, userId, why);
    return { customer: running !== null, subscriptions: running?.length ?? 0 };
  },
});

/**
 * Asks Polar for this person's subscriptions and applies each one. Returns
 * the ones still running, or null when Polar has no customer for them.
 */
async function syncWith(
  ctx: { runMutation: import("./_generated/server").ActionCtx["runMutation"] },
  userId: Id<"users">,
  why: string,
): Promise<PolarSubscription[] | null> {
  let customer: { id: string } | null = null;
  try {
    customer = await polar<{ id: string }>(`/v1/customers/external/${encodeURIComponent(userId)}`, undefined, "GET");
  } catch (e) {
    if (!notFound(e)) throw e;
  }
  if (!customer) return null;
  await ctx.runMutation(internal.billing.noteCustomer, { userId, customerId: customer.id });
  const list = await polar<{ items: PolarSubscription[] }>(
    `/v1/subscriptions/?customer_id=${encodeURIComponent(customer.id)}&limit=100`,
    undefined,
    "GET",
  );
  const live = new Set(["active", "trialing", "past_due"]);
  const subs = list.items
    .filter((x) => x.status !== "incomplete" && x.status !== "incomplete_expired")
    // Ended ones first, so the one still running has the last word.
    .sort((a, b) => Number(live.has(a.status)) - Number(live.has(b.status)));
  for (const sub of subs) await applyPolar(ctx, why, sub);
  return subs.filter((x) => live.has(x.status));
}

export const noteCustomer = internalMutation({
  args: { userId: v.id("users"), customerId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, customerId }) => {
    const u = await ctx.db.get(userId);
    if (u && u.polarCustomerId !== customerId) await ctx.db.patch(userId, { polarCustomerId: customerId });
    return null;
  },
});

/** A subscription as Polar returns it, applied the way its webhook would be. */
async function applyPolar(
  ctx: { runMutation: import("./_generated/server").ActionCtx["runMutation"] },
  why: string,
  s: PolarSubscription,
  space?: string,
) {
  await ctx.runMutation(internal.billing.applySubscription, { ...subArgs("subscription.updated", s), via: why, ...(space && !subArgs("", s).space ? { space } : {}) });
}

function subArgs(type: string, s: PolarSubscription) {
  return {
    type,
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
  };
}

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

/**
 * Polar's customer portal for this person. Seat-based plans make them a
 * "team" customer in Polar, whose portal opens as one of its members: the
 * owner member, or else a billing manager. The portal has a way back here.
 */
async function portalUrl(userId: Id<"users">) {
  const body = { external_customer_id: userId, return_url: `${SITE}/app/settings?tab=plan` };
  const open = (extra: Record<string, string> = {}) =>
    polar<{ customer_portal_url: string }>("/v1/customer-sessions/", { ...body, ...extra }).then((r) => ({ url: r.customer_portal_url }));
  try {
    return await open();
  } catch (e) {
    const said = e instanceof ConvexError && typeof e.data === "string" ? e.data : "";
    if (!said.includes("member_id")) throw e;
  }
  const members = await polar<{ items: { id: string; role: string }[] }>(
    `/v1/customers/external/${encodeURIComponent(userId)}/members?limit=100`,
    undefined,
    "GET",
  );
  const member =
    members.items.find((m) => m.role === "owner") ?? members.items.find((m) => m.role === "billing_manager");
  if (!member) throw new ConvexError("Polar has no billing contact on your account yet. Write to us and we will sort it out.");
  return await open({ member_id: member.id });
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
    if (!me.payer.me && me.live) {
      throw new ConvexError(`${me.payer.name ?? "Someone else"} pays for this company, so its invoices are in their billing.`);
    }
    try {
      return await portalUrl(me._id);
    } catch (e) {
      if (notFound(e)) throw new ConvexError("There are no payments on your account yet.");
      throw e;
    }
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
 *
 * The secret is trimmed (a pasted one often ends in a space or newline), and
 * a "whsec_" or plain base64 secret is also tried decoded, the other way
 * Standard Webhooks secrets are written. Each candidate comes from the secret
 * itself, so none of this lets an unsigned request through. Returns why a
 * delivery was refused, or null when it is genuine.
 */
async function verified(req: Request, body: string): Promise<string | null> {
  const raw = process.env.POLAR_WEBHOOK_SECRET;
  if (!raw) return "POLAR_WEBHOOK_SECRET is not set in Convex.";
  const secret = raw.trim();
  const id = req.headers.get("webhook-id");
  const ts = req.headers.get("webhook-timestamp");
  const sigs = req.headers.get("webhook-signature");
  if (!id || !ts || !sigs) return "The delivery had no Standard Webhooks signature headers. Is the endpoint's format set to Raw in Polar?";
  const age = Math.round(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || Math.abs(age) > 300) return `The delivery was signed ${Math.abs(age)} seconds away from now; over five minutes is refused.`;

  const keys: Uint8Array[] = [new TextEncoder().encode(secret)];
  const encoded = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) && encoded.length % 4 === 0) {
    try {
      keys.push(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
    } catch {
      /* not base64 after all */
    }
  }
  const signed = new TextEncoder().encode(`${id}.${ts}.${body}`);
  const given = sigs.split(" ").map((part) => part.split(",")[1] ?? "");
  for (const k of keys) {
    const key = await crypto.subtle.importKey("raw", k as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = b64(await crypto.subtle.sign("HMAC", key, signed));
    const match = given.some((sig) => {
      if (sig.length !== mac.length) return false;
      let diff = 0;
      for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ mac.charCodeAt(i);
      return diff === 0;
    });
    if (match) return null;
  }
  // Enough to compare with Polar's without showing the secret: its prefix and length.
  const prefix = /^[a-z]+(_[a-z]+)*_/.exec(secret)?.[0] ?? "";
  return `The signature did not match. Formkit's POLAR_WEBHOOK_SECRET is ${prefix ? `"${prefix}…", ` : ""}${secret.length} characters${
    raw !== secret ? " (after trimming spaces)" : ""
  }: copy the secret again from this endpoint in Polar → Settings → Webhooks.`;
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
  const refused = await verified(req, body);
  if (refused) {
    await ctx.runMutation(internal.billing.logEvent, { type: "rejected", ok: false, note: refused });
    return new Response("Invalid signature", { status: 403 });
  }
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
    await ctx.runMutation(internal.billing.applySubscription, { ...subArgs(event.type, event.data), via: "webhook" });
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
    /** Where it came from: "webhook", or why Formkit asked Polar. */
    via: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const via = a.via ?? "webhook";
    const log = (ok: boolean, note: string, extra: { space?: string; plan?: string } = {}) =>
      logPolar(ctx, { type: via === "webhook" ? a.type : `sync: ${via}`, ok, note, subscriptionId: a.subscriptionId, ...extra });
    // The payer: the account whose Polar customer holds the subscription.
    const user = await findCustomer(ctx, a.externalId, a.customerId, a.email);
    if (via === "webhook") await setPlatformValue(ctx, "polarLastEvent", { type: a.type, at: Date.now(), matched: !!user });
    if (!user) {
      console.warn(`Polar ${a.type}: no account for customer ${a.customerId}`);
      await log(false, `No Formkit account for Polar customer ${a.customerId || "(none)"}${a.email ? ` (${a.email})` : ""}.`);
      return null;
    }
    const products = (await platformValue<Products>(ctx, "polarProducts")) ?? {};
    const known = planOfProduct(products, a.productId);
    const plan = known?.plan ?? "pro";
    const interval = known?.interval ?? "month";
    if (!known) await log(false, `Product ${a.productId} is not one of Formkit's saved products; treated as Pro monthly.`);

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
    if (!holder) {
      await log(false, `The company ${a.space ?? ""} it was bought for no longer exists.`);
      return null;
    }

    // An event for a subscription this company has since replaced changes nothing.
    if (holder.polarSubscriptionId && holder.polarSubscriptionId !== a.subscriptionId && a.status !== "active") {
      await log(true, `Skipped: an older subscription (${a.status}); the company has moved on to another.`, { space: spaceKey(space) });
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
      planPeriodEnd: revoked ? undefined : a.periodEnd,
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
    await log(true, `${label}: ${PLANS[now].name} (${a.status}${a.cancelAtPeriodEnd ? ", cancelling" : ""}, ${seats} ${seats === 1 ? "seat" : "seats"}).`, {
      space: spaceKey(space),
      plan: now,
    });
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

/** Keeps the last 200 things Polar told Formkit, for Admin → Billing. */
async function logPolar(
  ctx: import("./_generated/server").MutationCtx,
  e: { type: string; ok: boolean; note: string; subscriptionId?: string; space?: string; plan?: string },
) {
  await ctx.db.insert("polarEvents", { at: Date.now(), ...e });
  const old = await ctx.db.query("polarEvents").withIndex("by_at").order("desc").take(260);
  for (const row of old.slice(200)) await ctx.db.delete(row._id);
}

export const logEvent = internalMutation({
  args: { type: v.string(), ok: v.boolean(), note: v.string() },
  returns: v.null(),
  handler: async (ctx, e) => {
    await logPolar(ctx, e);
    return null;
  },
});

/**
 * Admin: the Polar organization Formkit's token belongs to, and whether it
 * lets one customer hold several subscriptions (each company is its own).
 */
export const polarOrg = action({
  args: {},
  returns: v.array(v.object({ name: v.string(), slug: v.string(), multiple: v.union(v.boolean(), v.null()) })),
  handler: async (ctx): Promise<{ name: string; slug: string; multiple: boolean | null }[]> => {
    await ctx.runQuery(internal.billing.staffCheck, {});
    const res = await polar<{
      items: { name: string; slug: string; subscription_settings?: { allow_multiple_subscriptions?: boolean } }[];
    }>("/v1/organizations/?limit=10", undefined, "GET");
    return res.items.map((o) => ({
      name: o.name,
      slug: o.slug,
      multiple: o.subscription_settings?.allow_multiple_subscriptions ?? null,
    }));
  },
});

export const recentEvents = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "billing");
    return await ctx.db.query("polarEvents").withIndex("by_at").order("desc").take(30);
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
    // Plan counts need every account: they come from the hourly count (adminReports.ts).
    const report = await readReport<BillingReport>(ctx, "billing");
    return {
      token: !!process.env.POLAR_ACCESS_TOKEN,
      secret: !!process.env.POLAR_WEBHOOK_SECRET,
      server: process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
      webhookUrl: `${process.env.CONVEX_SITE_URL ?? ""}/polar/webhook`,
      products: (await platformValue<Products>(ctx, "polarProducts")) ?? {},
      lastEvent: await platformValue<{ type: string; at: number; matched: boolean }>(ctx, "polarLastEvent"),
      counts: report
        ? { pro: report.data.pro, business: report.data.business, comped: report.data.comped, paying: report.data.paying }
        : null,
      mrr: report?.data.mrr ?? null,
      asOf: report?.at ?? null,
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
        const res = await polar<{ id: string }>("/v1/products/", seatProductBody(plan, interval));
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
    // Copies made for people with several companies on one plan are kept.
    const have = (await platformValue<Products>(ctx, "polarProducts")) ?? {};
    const copies = Object.fromEntries(Object.entries(have).filter(([k]) => /_seat_\d+$/.test(k)));
    await setPlatformValue(ctx, "polarProducts", { ...copies, ...clean });
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
