import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { formFor } from "./model/forms";
import { requireUser } from "./model/identity";
import { CURRENCIES, fromMinor, toMinor } from "./model/money";
import { hasFeature, requireFeature } from "./model/plans";

/**
 * Payments (Pro): a form can take money after it is sent, through the form
 * owner's own Stripe account.
 *
 * The owner pastes a restricted key that can only create and read Checkout
 * Sessions. The key never comes back to the browser. After a complete
 * response, the runner asks for a checkout and sends the person to Stripe;
 * Stripe sends them back to /pay/done, which confirms the session with the
 * same key. A job looks again at anything still unpaid, so a closed tab does
 * not leave a paid response marked as waiting.
 *
 * The money goes straight to the owner. Formkit takes nothing and never sees
 * card details.
 */

const SITE = process.env.SITE_URL ?? "https://formkit.app";
const STRIPE = "https://api.stripe.com/v1";

async function stripe(key: string, path: string, init?: { method?: string; form?: Record<string, string> }) {
  const res = await fetch(`${STRIPE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init?.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      "Stripe-Version": "2024-06-20",
    },
    body: init?.form ? new URLSearchParams(init.form).toString() : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  return { ok: res.ok, status: res.status, data };
}

/* ------------------------------------------------------------------ */
/* The owner's Stripe account                                          */
/* ------------------------------------------------------------------ */

async function accountOf(ctx: QueryCtx, ownerId: Id<"users">) {
  return await ctx.db
    .query("paymentAccounts")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .first();
}

/** What the form's Payments section shows. The key itself never leaves. */
export const settings = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId, "read");
    const account = await accountOf(ctx, form.ownerId);
    const me = await requireUser(ctx);
    return {
      mine: form.ownerId === me._id,
      account: account
        ? { live: account.live, name: account.name ?? null, last4: account.key.slice(-4), addedAt: account.addedAt }
        : null,
      payment: form.payment ?? null,
      calcNames: (form.calc ?? []).map((c) => c.name),
      currencies: CURRENCIES,
    };
  },
});

/** Checks a pasted key against Stripe, then keeps it. */
export const connect = action({
  args: { key: v.string() },
  returns: v.object({ live: v.boolean(), name: v.union(v.string(), v.null()) }),
  handler: async (ctx, { key }): Promise<{ live: boolean; name: string | null }> => {
    const clean = key.trim();
    if (!/^(rk|sk)_(live|test)_[A-Za-z0-9]{10,}$/.test(clean)) {
      throw new ConvexError("That does not look like a Stripe key. A restricted key starts rk_live_ or rk_test_.");
    }
    await ctx.runQuery(internal.payments.mayConnect, {});
    const probe = await stripe(clean, "/checkout/sessions?limit=1");
    if (probe.status === 401) throw new ConvexError("Stripe did not accept that key.");
    if (!probe.ok) {
      throw new ConvexError(
        "That key cannot open checkouts. Give it Write access to Checkout Sessions in Stripe, then paste it again.",
      );
    }
    // A restricted key may not be allowed to read the account; the name is a nicety.
    const acct = await stripe(clean, "/account");
    const settings = acct.data?.settings as { dashboard?: { display_name?: string } } | undefined;
    const name =
      (acct.ok && (settings?.dashboard?.display_name || (acct.data.business_profile as { name?: string } | undefined)?.name)) ||
      null;
    const live = clean.includes("_live_");
    await ctx.runMutation(internal.payments.saveAccount, { key: clean, live, name: name ?? undefined });
    return { live, name };
  },
});

export const mayConnect = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await requireFeature(ctx, user._id, "payments");
    return null;
  },
});

export const saveAccount = internalMutation({
  args: { key: v.string(), live: v.boolean(), name: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const user = await requireUser(ctx);
    await requireFeature(ctx, user._id, "payments");
    const existing = await accountOf(ctx, user._id);
    if (existing) await ctx.db.patch(existing._id, { ...a, addedAt: Date.now() });
    else await ctx.db.insert("paymentAccounts", { ownerId: user._id, ...a, addedAt: Date.now() });
    return null;
  },
});

export const disconnect = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const existing = await accountOf(ctx, user._id);
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

/** Turns a form's payment on or off, and says how much it asks for. */
export const setFormPayment = mutation({
  args: {
    formId: v.id("forms"),
    enabled: v.boolean(),
    currency: v.string(),
    amount: v.optional(v.number()),
    fromCalc: v.optional(v.string()),
    label: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { formId, enabled, currency, amount, fromCalc, label }) => {
    const form = await formFor(ctx, formId);
    const cur = currency.toLowerCase();
    if (!CURRENCIES.includes(cur)) throw new ConvexError("Pick one of the listed currencies.");
    if (enabled) {
      await requireFeature(ctx, form.ownerId, "payments");
      if (!(await accountOf(ctx, form.ownerId))) throw new ConvexError("Connect a Stripe account first.");
      if (fromCalc) {
        if (!(form.calc ?? []).some((c) => c.name === fromCalc)) throw new ConvexError("That calculation is not on this form.");
      } else if (!amount || amount <= 0) {
        throw new ConvexError("Enter the amount to charge.");
      }
    }
    await ctx.db.patch(formId, {
      payment: {
        enabled,
        currency: cur,
        amount: fromCalc ? undefined : amount ? toMinor(amount, cur) : undefined,
        fromCalc: fromCalc || undefined,
        label: label?.trim().slice(0, 120) || undefined,
      },
    });
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Taking a payment                                                    */
/* ------------------------------------------------------------------ */

/**
 * What a complete response owes, worked out when it is stored. Null when the
 * form takes no payment, the plan has lapsed or the amount comes to nothing.
 */
export async function owed(
  ctx: QueryCtx,
  form: Doc<"forms">,
  calc: Record<string, number> | undefined,
): Promise<{ status: "pending"; amount: number; currency: string } | null> {
  const p = form.payment;
  if (!p?.enabled) return null;
  if (!(await hasFeature(ctx, form.ownerId, "payments"))) return null;
  if (!(await accountOf(ctx, form.ownerId))) return null;
  const amount = p.fromCalc ? toMinor(calc?.[p.fromCalc] ?? 0, p.currency) : (p.amount ?? 0);
  if (!(amount > 0)) return null;
  return { status: "pending", amount, currency: p.currency };
}

/** Whether a runner should send people to pay after submitting. */
export async function takesPayment(ctx: QueryCtx, form: Doc<"forms">) {
  const p = form.payment;
  if (!p?.enabled) return null;
  if (!(await hasFeature(ctx, form.ownerId, "payments"))) return null;
  if (!(await accountOf(ctx, form.ownerId))) return null;
  return {
    label: p.label ?? null,
    currency: p.currency,
    amount: p.amount !== undefined ? fromMinor(p.amount, p.currency) : null,
    fromCalc: p.fromCalc ?? null,
  };
}

export const forCheckout = internalQuery({
  args: { responseId: v.id("responses"), resumeToken: v.string() },
  handler: async (ctx, { responseId, resumeToken }) => {
    const r = await ctx.db.get(responseId);
    if (!r || r.resumeToken !== resumeToken || !r.payment) return null;
    const form = await ctx.db.get(r.formId);
    if (!form) return null;
    const account = await accountOf(ctx, form.ownerId);
    if (!account || !(await hasFeature(ctx, form.ownerId, "payments"))) return null;
    return {
      key: account.key,
      payment: r.payment,
      email: r.respondentEmail ?? null,
      title: form.payment?.label || form.title,
      formTitle: form.title,
    };
  },
});

/** Opens a Stripe Checkout for a response that owes a payment. */
export const checkout = action({
  args: { responseId: v.id("responses"), resumeToken: v.string() },
  returns: v.union(v.object({ url: v.string() }), v.object({ paid: v.literal(true) }), v.null()),
  handler: async (ctx, args): Promise<{ url: string } | { paid: true } | null> => {
    const job: {
      key: string;
      payment: NonNullable<Doc<"responses">["payment"]>;
      email: string | null;
      title: string;
      formTitle: string;
    } | null = await ctx.runQuery(internal.payments.forCheckout, args);
    if (!job) return null;
    if (job.payment.status === "paid") return { paid: true };
    if (job.payment.status === "none") return null;
    const form: Record<string, string> = {
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": job.payment.currency,
      "line_items[0][price_data][unit_amount]": String(job.payment.amount),
      "line_items[0][price_data][product_data][name]": job.title.slice(0, 200),
      success_url: `${SITE}/pay/done?r=${args.responseId}&s={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/pay/done?r=${args.responseId}&cancelled=1`,
      client_reference_id: args.responseId,
      "metadata[formkit_response]": args.responseId,
      "metadata[formkit_form]": job.formTitle.slice(0, 200),
    };
    if (job.email) form.customer_email = job.email;
    const res = await stripe(job.key, "/checkout/sessions", { method: "POST", form });
    if (!res.ok || typeof res.data.url !== "string") {
      throw new ConvexError(
        res.data.error?.message
          ? `Stripe said: ${res.data.error.message}`
          : "The payment page did not open. Your answers are saved — the form's owner has been told.",
      );
    }
    await ctx.runMutation(internal.payments.markSession, {
      responseId: args.responseId,
      sessionId: res.data.id as string,
    });
    return { url: res.data.url };
  },
});

export const markSession = internalMutation({
  args: { responseId: v.id("responses"), sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, { responseId, sessionId }) => {
    const r = await ctx.db.get(responseId);
    if (!r?.payment || r.payment.status === "paid") return null;
    await ctx.db.patch(responseId, { payment: { ...r.payment, sessionId, status: "pending" } });
    return null;
  },
});

export const forConfirm = internalQuery({
  args: { responseId: v.id("responses") },
  handler: async (ctx, { responseId }) => {
    const r = await ctx.db.get(responseId);
    if (!r?.payment) return null;
    const form = await ctx.db.get(r.formId);
    if (!form) return null;
    const account = await accountOf(ctx, form.ownerId);
    const owner = await ctx.db.get(form.ownerId);
    return {
      key: account?.key ?? null,
      payment: r.payment,
      formTitle: form.title,
      slug: form.slug,
      handle: owner?.handle ?? null,
    };
  },
});

async function sessionState(key: string, sessionId: string, responseId: string) {
  const res = await stripe(key, `/checkout/sessions/${encodeURIComponent(sessionId)}`);
  if (!res.ok) return null;
  const d = res.data as {
    id: string;
    payment_status?: string;
    status?: string;
    client_reference_id?: string;
    amount_total?: number;
    currency?: string;
  };
  if (d.client_reference_id !== responseId) return null;
  return {
    paid: d.payment_status === "paid" || d.payment_status === "no_payment_required",
    expired: d.status === "expired",
    amount: d.amount_total,
    currency: d.currency,
  };
}

/**
 * The page Stripe sends people back to. Confirms with Stripe itself rather
 * than trusting the address, so a made-up link cannot mark anything paid.
 */
export const confirm = action({
  args: { responseId: v.id("responses"), sessionId: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      status: v.union(v.literal("paid"), v.literal("pending"), v.literal("failed"), v.literal("none")),
      amount: v.number(),
      currency: v.string(),
      formTitle: v.string(),
      formUrl: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (
    ctx,
    { responseId, sessionId },
  ): Promise<{
    status: "paid" | "pending" | "failed" | "none";
    amount: number;
    currency: string;
    formTitle: string;
    formUrl: string | null;
  } | null> => {
    const row: {
      key: string | null;
      payment: NonNullable<Doc<"responses">["payment"]>;
      formTitle: string;
      slug: string;
      handle: string | null;
    } | null = await ctx.runQuery(internal.payments.forConfirm, { responseId });
    if (!row) return null;
    let status: "paid" | "pending" | "failed" | "none" = row.payment.status;
    const sid = sessionId && sessionId === row.payment.sessionId ? sessionId : row.payment.sessionId;
    if (status !== "paid" && row.key && sid) {
      const state = await sessionState(row.key, sid, responseId);
      if (state?.paid) {
        await ctx.runMutation(internal.payments.markPaid, { responseId, sessionId: sid });
        status = "paid";
      }
    }
    return {
      status,
      amount: fromMinor(row.payment.amount, row.payment.currency),
      currency: row.payment.currency,
      formTitle: row.formTitle,
      formUrl: row.handle ? `/${row.handle}/${row.slug}` : null,
    };
  },
});

export const markPaid = internalMutation({
  args: { responseId: v.id("responses"), sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, { responseId, sessionId }) => {
    const r = await ctx.db.get(responseId);
    if (!r?.payment || r.payment.status === "paid") return null;
    await ctx.db.patch(responseId, { payment: { ...r.payment, status: "paid", sessionId, at: Date.now() } });
    // Anything listening hears about the payment too.
    await ctx.scheduler.runAfter(0, internal.connections.fanout, { responseId, event: "response.paid" });
    return null;
  },
});

export const markFailed = internalMutation({
  args: { responseId: v.id("responses") },
  returns: v.null(),
  handler: async (ctx, { responseId }) => {
    const r = await ctx.db.get(responseId);
    if (!r?.payment || r.payment.status !== "pending") return null;
    await ctx.db.patch(responseId, { payment: { ...r.payment, status: "failed" } });
    return null;
  },
});

/** Pending payments with a checkout open, a few minutes to a day old. */
export const pendingSessions = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("responses")
      .withIndex("by_payment", (q) => q.eq("payment.status", "pending").gt("submittedAt", now - 26 * 3600_000))
      .take(200);
    const out: { responseId: Id<"responses">; sessionId: string | null; key: string | null; old: boolean }[] = [];
    for (const r of rows) {
      const form = await ctx.db.get(r.formId);
      const account = form ? await accountOf(ctx, form.ownerId) : null;
      out.push({
        responseId: r._id,
        sessionId: r.payment?.sessionId ?? null,
        key: account?.key ?? null,
        old: now - r.submittedAt > 25 * 3600_000,
      });
    }
    return out;
  },
});

/** Every 20 minutes: settle checkouts nobody came back from. */
export const recheckPending = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const rows: { responseId: Id<"responses">; sessionId: string | null; key: string | null; old: boolean }[] =
      await ctx.runQuery(internal.payments.pendingSessions, {});
    for (const row of rows) {
      if (row.key && row.sessionId) {
        const state = await sessionState(row.key, row.sessionId, row.responseId).catch(() => null);
        if (state?.paid) {
          await ctx.runMutation(internal.payments.markPaid, { responseId: row.responseId, sessionId: row.sessionId });
          continue;
        }
        if (state?.expired || row.old) await ctx.runMutation(internal.payments.markFailed, { responseId: row.responseId });
      } else if (row.old) {
        await ctx.runMutation(internal.payments.markFailed, { responseId: row.responseId });
      }
    }
    return null;
  },
});
