import { ConvexError, v } from "convex/values";
import { action, httpAction, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { formFor } from "./model/forms";
import { requireUser } from "./model/identity";
import { CURRENCIES, fromMinor, toMinor } from "./model/money";
import { hasFeature, requireFeature } from "./model/plans";
import { isSealed, seal, unseal } from "./model/sealed";
import { servedForm } from "./model/served";
import { submitArgs, type SubmitArgs } from "./model/submitArgs";
import { admit, calcFor, store, vet } from "./publicForm";

/**
 * Payments (Pro): a form takes money through the form owner's own Stripe
 * account, and keeps the answers once they are paid for.
 *
 * The owner pastes a restricted key that can create Checkout Sessions (and,
 * if they allow it, the webhook that confirms payments). The key never comes
 * back to the browser.
 *
 * Pay first: the finished form is checked like any other (publicForm.vet),
 * then held (`paymentHolds`) while the person pays on Stripe Checkout - a
 * fixed price, a calculation's result or what they choose to pay above a
 * minimum; one, a number they answered, or as many as they pick; with
 * promotion codes and Stripe Tax when the owner turns them on. Stripe's
 * webhook - or the person coming back to /pay/done, or a job every twenty
 * minutes - confirms it with Stripe, and only then does the hold become a
 * response (`settle`). Unpaid holds are forgotten after two days.
 *
 * Responses from before pay-first (paid after sending) still settle the old
 * way, below.
 *
 * The money goes straight to the owner. Formkit takes nothing and never sees
 * card details.
 */

const SITE = process.env.SITE_URL ?? "https://formkit.app";
const STRIPE = "https://api.stripe.com/v1";

/** `key` is the stored key, sealed or (from before sealing) plain; it is opened only here. */
async function stripe(key: string, path: string, init?: { method?: string; form?: Record<string, string> }) {
  const res = await fetch(`${STRIPE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${await unseal(key)}`,
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
      /** Number questions a quantity can come from. */
      numberQuestions: (
        await ctx.db
          .query("blocks")
          .withIndex("by_form_order", (q) => q.eq("formId", formId))
          .collect()
      )
        .filter((b) => b.kind === "field" && b.type === "number")
        .map((b) => ({ id: b._id, title: b.title ?? "Untitled question" })),
      /** Whether Stripe tells Formkit about payments straight away, and where it should if set up by hand. */
      webhook: account ? { on: !!account.webhookSecret, url: webhookUrl(account._id) } : null,
    };
  },
});

/** Where Stripe sends an account's payment events (convex/http.ts). */
const webhookUrl = (accountId: Id<"paymentAccounts">) =>
  `${(process.env.CONVEX_SITE_URL ?? "").replace(/\/$/, "")}/stripe/webhook/${accountId}`;

const EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
];

/** Checks a pasted key against Stripe, then keeps it. */
export const connect = action({
  args: { key: v.string() },
  returns: v.object({ live: v.boolean(), name: v.union(v.string(), v.null()) }),
  handler: async (ctx, { key }): Promise<{ live: boolean; name: string | null }> => {
    const clean = key.trim();
    if (/^sk_(live|test)_/.test(clean)) {
      throw new ConvexError(
        "That is your secret key, which can do anything in your Stripe account. Make a restricted key with Write access to Checkout Sessions, and paste that instead.",
      );
    }
    if (!/^rk_(live|test)_[A-Za-z0-9]{10,}$/.test(clean)) {
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
    const accountId: Id<"paymentAccounts"> = await ctx.runMutation(internal.payments.saveAccount, {
      key: await seal(clean),
      live,
      name: name ?? undefined,
    });
    // Instant confirmation, when the key may set up the webhook itself. If
    // not, payments are confirmed as people come back, and every 20 minutes.
    if (process.env.CONVEX_SITE_URL) {
      const form: Record<string, string> = { url: webhookUrl(accountId), description: "Formkit: confirms form payments" };
      EVENTS.forEach((e, i) => (form[`enabled_events[${i}]`] = e));
      const hook = await stripe(clean, "/webhook_endpoints", { method: "POST", form }).catch(() => null);
      if (hook?.ok && typeof hook.data.secret === "string") {
        await ctx.runMutation(internal.payments.saveWebhook, {
          accountId,
          secret: await seal(hook.data.secret),
          webhookId: String(hook.data.id),
        });
      }
    }
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
  returns: v.id("paymentAccounts"),
  handler: async (ctx, a) => {
    const user = await requireUser(ctx);
    await requireFeature(ctx, user._id, "payments");
    const existing = await accountOf(ctx, user._id);
    // A new key is a new start: any webhook set up for the old one is not trusted for it.
    if (existing) {
      await ctx.db.patch(existing._id, { ...a, addedAt: Date.now(), webhookSecret: undefined, webhookId: undefined });
      return existing._id;
    }
    return await ctx.db.insert("paymentAccounts", { ownerId: user._id, ...a, addedAt: Date.now() });
  },
});

export const saveWebhook = internalMutation({
  args: { accountId: v.id("paymentAccounts"), secret: v.string(), webhookId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { accountId, secret, webhookId }) => {
    await ctx.db.patch(accountId, { webhookSecret: secret, webhookId });
    return null;
  },
});

/** A webhook added by hand in Stripe: its signing secret, pasted here. */
export const setWebhookSecret = action({
  args: { secret: v.string() },
  returns: v.null(),
  handler: async (ctx, { secret }) => {
    const clean = secret.trim();
    if (!/^whsec_[A-Za-z0-9]{16,}$/.test(clean)) throw new ConvexError("A signing secret starts whsec_. Copy it from the webhook's page in Stripe.");
    const accountId: Id<"paymentAccounts"> | null = await ctx.runQuery(internal.payments.myAccountId, {});
    if (!accountId) throw new ConvexError("Connect a Stripe account first.");
    await ctx.runMutation(internal.payments.saveWebhook, { accountId, secret: await seal(clean) });
    return null;
  },
});

export const myAccountId = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return (await accountOf(ctx, user._id))?._id ?? null;
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
    /** Pay what you want: at least `minimum`, `suggested` filled in (major units). */
    choose: v.optional(v.object({ minimum: v.number(), suggested: v.optional(v.number()) })),
    label: v.optional(v.string()),
    quantity: v.optional(
      v.object({
        from: v.union(v.literal("one"), v.literal("question"), v.literal("checkout")),
        blockId: v.optional(v.id("blocks")),
        max: v.optional(v.number()),
      }),
    ),
    promoCodes: v.optional(v.boolean()),
    tax: v.optional(v.union(v.object({ inclusive: v.boolean() }), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, { formId, enabled, currency, amount, fromCalc, choose, label, quantity, promoCodes, tax }) => {
    const form = await formFor(ctx, formId);
    const cur = currency.toLowerCase();
    if (!CURRENCIES.includes(cur)) throw new ConvexError("Pick one of the listed currencies.");
    if (enabled) {
      await requireFeature(ctx, form, "payments");
      if (!(await accountOf(ctx, form.ownerId))) throw new ConvexError("Connect a Stripe account first.");
      if (choose) {
        if (!(choose.minimum >= 0)) throw new ConvexError("The least someone can pay can't be below nothing.");
        if (choose.suggested !== undefined && choose.suggested < choose.minimum) throw new ConvexError("The suggested amount is below the least someone can pay.");
      } else if (fromCalc) {
        if (!(form.calc ?? []).some((c) => c.name === fromCalc)) throw new ConvexError("That calculation is not on this form.");
      } else if (!amount || amount <= 0) {
        throw new ConvexError("Enter the amount to charge.");
      }
      if (quantity?.from === "question") {
        const b = quantity.blockId ? await ctx.db.get(quantity.blockId) : null;
        if (!b || b.formId !== formId || b.type !== "number") throw new ConvexError("Pick a number question for how many.");
      }
    }
    const max = Math.max(1, Math.min(99, Math.round(quantity?.max ?? 10)));
    await ctx.db.patch(formId, {
      payment: {
        enabled,
        currency: cur,
        amount: fromCalc || choose ? undefined : amount ? toMinor(amount, cur) : undefined,
        fromCalc: !choose && fromCalc ? fromCalc : undefined,
        choose: choose
          ? { minimum: toMinor(choose.minimum, cur), suggested: choose.suggested !== undefined ? toMinor(choose.suggested, cur) : undefined }
          : undefined,
        label: label?.trim().slice(0, 120) || undefined,
        quantity: quantity && quantity.from !== "one" ? { from: quantity.from, blockId: quantity.from === "question" ? quantity.blockId : undefined, max } : undefined,
        promoCodes: promoCodes || undefined,
        tax: tax ?? undefined,
      },
      updatedAt: Date.now(),
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
  if (!(await hasFeature(ctx, form, "payments"))) return null;
  if (!(await accountOf(ctx, form.ownerId))) return null;
  const amount = p.fromCalc ? toMinor(calc?.[p.fromCalc] ?? 0, p.currency) : (p.amount ?? 0);
  if (!(amount > 0)) return null;
  return { status: "pending", amount, currency: p.currency };
}

/** Whether a runner should send people to pay after submitting. */
export async function takesPayment(ctx: QueryCtx, form: Doc<"forms">) {
  const p = form.payment;
  if (!p?.enabled) return null;
  if (!(await hasFeature(ctx, form, "payments"))) return null;
  if (!(await accountOf(ctx, form.ownerId))) return null;
  return {
    label: p.label ?? null,
    currency: p.currency,
    amount: p.amount !== undefined ? fromMinor(p.amount, p.currency) : null,
    fromCalc: p.fromCalc ?? null,
    /** Pay what you want: the form asks how much, at least `minimum`. */
    choose: p.choose
      ? { minimum: fromMinor(p.choose.minimum, p.currency), suggested: p.choose.suggested !== undefined ? fromMinor(p.choose.suggested, p.currency) : null }
      : null,
    /** Picked on Stripe's page, up to this many. */
    quantityAtCheckout: p.quantity?.from === "checkout" ? (p.quantity.max ?? 10) : null,
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
    if (!account || !(await hasFeature(ctx, form, "payments"))) return null;
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
          : "The payment page did not open. Your answers are saved and the form's owner has been told.",
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
  args: { responseId: v.optional(v.id("responses")), holdId: v.optional(v.id("paymentHolds")), sessionId: v.optional(v.string()) },
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
    { responseId, holdId, sessionId },
  ): Promise<{
    status: "paid" | "pending" | "failed" | "none";
    amount: number;
    currency: string;
    formTitle: string;
    formUrl: string | null;
  } | null> => {
    if (holdId) {
      const h: {
        status: "open" | "paid" | "expired";
        sessionId: string | null;
        key: string | null;
        amount: number;
        currency: string;
        formTitle: string;
        formUrl: string | null;
      } | null = await ctx.runQuery(internal.payments.forHold, { holdId });
      if (!h) return null;
      let status: "paid" | "pending" | "failed" = h.status === "paid" ? "paid" : h.status === "expired" ? "failed" : "pending";
      let amount = h.amount;
      // Asked of Stripe, never taken from the address.
      if (status === "pending" && h.key && h.sessionId) {
        const s = await readSession(h.key, h.sessionId, holdId).catch(() => null);
        if (s?.paid) {
          await ctx.runMutation(internal.payments.settle, { holdId, ...pick(s) });
          status = "paid";
          amount = s.amount;
        }
      }
      return { status, amount: fromMinor(amount, h.currency), currency: h.currency, formTitle: h.formTitle, formUrl: h.formUrl };
    }
    if (!responseId) return null;
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

/**
 * One-off, after SECRETS_KEY is set: seals every Stripe key still stored as
 * plain text. `npx convex run payments:sealStoredKeys` (add --prod).
 */
export const plainKeys = internalQuery({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("paymentAccounts").collect()).filter((a) => !isSealed(a.key)).map((a) => ({ id: a._id, key: a.key })),
});

export const storeSealed = internalMutation({
  args: { id: v.id("paymentAccounts"), key: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, key }) => {
    await ctx.db.patch(id, { key });
    return null;
  },
});

export const sealStoredKeys = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    if (!process.env.SECRETS_KEY) throw new Error("Set SECRETS_KEY on the deployment first.");
    const rows: { id: Id<"paymentAccounts">; key: string }[] = await ctx.runQuery(internal.payments.plainKeys, {});
    for (const r of rows) await ctx.runMutation(internal.payments.storeSealed, { id: r.id, key: await seal(r.key) });
    return rows.length;
  },
});

/* ------------------------------------------------------------------ */
/* Pay first                                                           */
/* ------------------------------------------------------------------ */

/** How long unpaid answers are kept before they are forgotten. */
const HOLD_MS = 48 * 3600_000;
/** The most one checkout can take, in minor units: a typo's ceiling, not a price list. */
const MAX_MINOR = 100_000_000;

type HoldJob = {
  holdId: Id<"paymentHolds">;
  key: string;
  unitAmount: number;
  currency: string;
  quantity: number;
  adjustable: number | null;
  title: string;
  email: string | null;
  promo: boolean;
  tax: { inclusive: boolean } | null;
};

/**
 * Checks a finished form exactly as sending it would, works out what it
 * costs, and holds it while the person pays. A total of nothing needs no
 * checkout: the response is kept there and then.
 */
export const hold = internalMutation({
  args: { ...submitArgs, chosen: v.optional(v.number()) },
  handler: async (ctx, { chosen, ...args }): Promise<{ free: { responseId: Id<"responses">; resumeToken: string } } | { job: HoldJob }> => {
    if (args.partial) throw new ConvexError("Only a finished form is paid for.");
    const checked = await vet(ctx, args);
    if ("early" in checked) throw new ConvexError("These answers were already sent.");
    const { form, existing } = checked;
    if (existing && !existing.partial) throw new ConvexError("These answers were already sent.");
    await admit(ctx, form, args, existing);

    const p = form.payment;
    const account = await accountOf(ctx, form.ownerId);
    if (!p?.enabled || !account || !(await hasFeature(ctx, form, "payments"))) {
      return { free: await store(ctx, form, args, existing, false) };
    }
    let unit: number;
    if (p.choose) {
      if (chosen === undefined || !Number.isFinite(chosen)) throw new ConvexError("Enter how much you'd like to pay.");
      unit = toMinor(chosen, p.currency);
      if (unit < p.choose.minimum) throw new ConvexError(`The least you can pay is ${fromMinor(p.choose.minimum, p.currency)} ${p.currency.toUpperCase()}.`);
    } else if (p.fromCalc) {
      unit = toMinor((await calcFor(ctx, form, args.answers))?.[p.fromCalc] ?? 0, p.currency);
    } else {
      unit = p.amount ?? 0;
    }
    let quantity = 1;
    if (p.quantity?.from === "question" && p.quantity.blockId) {
      const said = Number(args.answers.find((a) => a.blockId === p.quantity!.blockId)?.value ?? "1");
      quantity = Math.round(said);
      if (!(quantity >= 1)) throw new ConvexError("How many has to be at least one.");
      if (quantity > (p.quantity.max ?? 10)) throw new ConvexError(`At most ${p.quantity.max ?? 10} at a time.`);
    }
    if (unit * quantity > MAX_MINOR) throw new ConvexError("That's more than one payment can take.");
    // Nothing to pay - a calculation that came to zero, or a minimum of zero chosen.
    if (!(unit > 0)) return { free: await store(ctx, form, args, existing, false) };

    // What is kept while they pay: the answers, not how they proved they were a person.
    const { password: _pw, pass: _pass, human: _human, trap: _trap, ...keep } = args;
    void _pw;
    void _pass;
    void _human;
    void _trap;
    const holdId = await ctx.db.insert("paymentHolds", {
      formId: form._id,
      ownerId: form.ownerId,
      args: keep,
      unitAmount: unit,
      currency: p.currency,
      quantity,
      adjustable: p.quantity?.from === "checkout" ? (p.quantity.max ?? 10) : undefined,
      status: "open",
      createdAt: Date.now(),
    });
    const served = await servedForm(ctx, form);
    const emailIds = new Set(served.blocks.filter((b) => b.type === "email").map((b) => b._id as string));
    const email = args.answers.find((a) => emailIds.has(a.blockId) && a.value?.trim())?.value?.trim().toLowerCase() ?? null;
    return {
      job: {
        holdId,
        key: account.key,
        unitAmount: unit,
        currency: p.currency,
        quantity,
        adjustable: p.quantity?.from === "checkout" ? (p.quantity.max ?? 10) : null,
        title: (p.label || form.title).slice(0, 200),
        email,
        promo: !!p.promoCodes,
        tax: p.tax ?? null,
      },
    };
  },
});

/** A Stripe Checkout for a hold. */
async function openCheckout(job: HoldJob) {
  const form: Record<string, string> = {
    mode: "payment",
    "line_items[0][price_data][currency]": job.currency,
    "line_items[0][price_data][unit_amount]": String(job.unitAmount),
    "line_items[0][price_data][product_data][name]": job.title,
    "line_items[0][quantity]": String(job.quantity),
    success_url: `${SITE}/pay/done?h=${job.holdId}&s={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE}/pay/done?h=${job.holdId}&cancelled=1`,
    client_reference_id: job.holdId,
    "metadata[formkit_hold]": job.holdId,
  };
  if (job.adjustable) {
    form["line_items[0][adjustable_quantity][enabled]"] = "true";
    form["line_items[0][adjustable_quantity][minimum]"] = "1";
    form["line_items[0][adjustable_quantity][maximum]"] = String(job.adjustable);
  }
  if (job.promo) form.allow_promotion_codes = "true";
  if (job.tax) {
    form["automatic_tax[enabled]"] = "true";
    form["line_items[0][price_data][tax_behavior]"] = job.tax.inclusive ? "inclusive" : "exclusive";
    form.billing_address_collection = "required";
  }
  if (job.email) form.customer_email = job.email;
  const res = await stripe(job.key, "/checkout/sessions", { method: "POST", form });
  if (!res.ok || typeof res.data.url !== "string") {
    throw new ConvexError(
      res.data.error?.message
        ? `Stripe said: ${res.data.error.message}`
        : "The payment page did not open. Nothing was charged; try again in a moment.",
    );
  }
  return { url: res.data.url, sessionId: String(res.data.id) };
}

/**
 * "Pay and send": the form's answers, checked and held, and the address of
 * the payment page. Or, when nothing is owed, the response, already kept.
 */
export const start = action({
  args: { ...submitArgs, chosen: v.optional(v.number()) },
  returns: v.union(
    v.object({ url: v.string(), holdId: v.id("paymentHolds") }),
    v.object({ responseId: v.id("responses"), resumeToken: v.string() }),
  ),
  handler: async (ctx, args): Promise<{ url: string; holdId: Id<"paymentHolds"> } | { responseId: Id<"responses">; resumeToken: string }> => {
    const held: { free: { responseId: Id<"responses">; resumeToken: string } } | { job: HoldJob } = await ctx.runMutation(
      internal.payments.hold,
      args,
    );
    if ("free" in held) return { responseId: held.free.responseId, resumeToken: held.free.resumeToken };
    const { url, sessionId } = await openCheckout(held.job);
    await ctx.runMutation(internal.payments.holdSession, { holdId: held.job.holdId, sessionId });
    return { url, holdId: held.job.holdId };
  },
});

export const holdSession = internalMutation({
  args: { holdId: v.id("paymentHolds"), sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, { holdId, sessionId }) => {
    const h = await ctx.db.get(holdId);
    if (h?.status === "open") await ctx.db.patch(holdId, { sessionId });
    return null;
  },
});

export const forHold = internalQuery({
  args: { holdId: v.id("paymentHolds") },
  handler: async (ctx, { holdId }) => {
    const h = await ctx.db.get(holdId);
    if (!h) return null;
    const form = await ctx.db.get(h.formId);
    const account = form ? await accountOf(ctx, form.ownerId) : null;
    const owner = form ? await ctx.db.get(form.ownerId) : null;
    const p = form?.payment;
    const email = ((h.args?.answers ?? []) as { value?: string }[]).find((a) => /@/.test(a.value ?? ""))?.value ?? null;
    return {
      status: h.status,
      sessionId: h.sessionId ?? null,
      responseId: h.responseId ?? null,
      expired: Date.now() - h.createdAt > HOLD_MS,
      key: account?.key ?? null,
      amount: h.unitAmount * h.quantity,
      currency: h.currency,
      formTitle: form?.title ?? "the form",
      formUrl: form && owner?.handle ? `/${owner.handle}/${form.slug}` : null,
      job:
        account && form
          ? {
              holdId,
              key: account.key,
              unitAmount: h.unitAmount,
              currency: h.currency,
              quantity: h.quantity,
              adjustable: h.adjustable ?? null,
              title: (p?.label || form.title).slice(0, 200),
              email,
              promo: !!p?.promoCodes,
              tax: p?.tax ?? null,
            }
          : null,
    };
  },
});

/** Back on /pay/done without having paid: the same answers, a new payment page. */
export const retry = action({
  args: { holdId: v.id("paymentHolds") },
  returns: v.union(v.object({ url: v.string() }), v.null()),
  handler: async (ctx, { holdId }): Promise<{ url: string } | null> => {
    const h: { status: string; expired: boolean; job: HoldJob | null } | null = await ctx.runQuery(internal.payments.forHold, { holdId });
    if (!h || h.status !== "open" || h.expired || !h.job) return null;
    const { url, sessionId } = await openCheckout(h.job);
    await ctx.runMutation(internal.payments.holdSession, { holdId, sessionId });
    return { url };
  },
});

type Paid = { sessionId: string; amount: number; currency: string; quantity?: number; tax?: number; discount?: number };

/** The payment went through: the held answers become a response, once. */
export const settle = internalMutation({
  args: {
    holdId: v.id("paymentHolds"),
    ownerId: v.optional(v.id("users")),
    sessionId: v.string(),
    amount: v.number(),
    currency: v.string(),
    quantity: v.optional(v.number()),
    tax: v.optional(v.number()),
    discount: v.optional(v.number()),
  },
  returns: v.union(v.id("responses"), v.null()),
  handler: async (ctx, { holdId, ownerId, ...paid }) => {
    const h = await ctx.db.get(holdId);
    if (!h || (ownerId && h.ownerId !== ownerId)) return null;
    if (h.status === "paid") return h.responseId ?? null;
    if (h.sessionId && h.sessionId !== paid.sessionId) return null;
    const form = await ctx.db.get(h.formId);
    if (!form) return null;
    const args = h.args as SubmitArgs;
    const existing = args.resumeToken
      ? await ctx.db
          .query("responses")
          .withIndex("by_resume", (q) => q.eq("resumeToken", args.resumeToken!))
          .first()
      : null;
    const { responseId } = await store(
      ctx,
      form,
      {
        ...args,
        partial: false,
        paid: { status: "paid", ...paid, quantity: paid.quantity ?? h.quantity, at: Date.now() },
      },
      existing && existing.formId === form._id && existing.partial ? existing : null,
      false,
    );
    // Paid for and kept: the answers live on in the response, not here.
    await ctx.db.patch(holdId, { status: "paid", responseId, args: null });
    await ctx.scheduler.runAfter(0, internal.connections.fanout, { responseId, event: "response.paid" });
    return responseId;
  },
});

export const lapse = internalMutation({
  args: { holdId: v.id("paymentHolds") },
  returns: v.null(),
  handler: async (ctx, { holdId }) => {
    const h = await ctx.db.get(holdId);
    if (h?.status === "open") await ctx.db.patch(holdId, { status: "expired", args: null });
    return null;
  },
});

/** A Checkout Session as Stripe has it: paid or not, and for how much. */
async function readSession(key: string, sessionId: string, ref: string): Promise<(Paid & { paid: boolean; expired: boolean }) | null> {
  const res = await stripe(key, `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items`);
  if (!res.ok) return null;
  return sessionFacts(res.data, ref);
}

function sessionFacts(d: Record<string, unknown>, ref: string): (Paid & { paid: boolean; expired: boolean }) | null {
  const s = d as {
    id: string;
    client_reference_id?: string;
    payment_status?: string;
    status?: string;
    amount_total?: number;
    currency?: string;
    total_details?: { amount_tax?: number; amount_discount?: number };
    line_items?: { data?: { quantity?: number }[] };
  };
  if (s.client_reference_id !== ref) return null;
  return {
    paid: s.payment_status === "paid" || s.payment_status === "no_payment_required",
    expired: s.status === "expired",
    sessionId: s.id,
    amount: s.amount_total ?? 0,
    currency: s.currency ?? "",
    quantity: s.line_items?.data?.[0]?.quantity,
    tax: s.total_details?.amount_tax || undefined,
    discount: s.total_details?.amount_discount || undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Stripe's webhook                                                    */
/* ------------------------------------------------------------------ */

export const webhookSecretOf = internalQuery({
  args: { accountId: v.string() },
  handler: async (ctx, { accountId }) => {
    const id = ctx.db.normalizeId("paymentAccounts", accountId);
    const account = id ? await ctx.db.get(id) : null;
    return account?.webhookSecret ? { secret: account.webhookSecret, ownerId: account.ownerId } : null;
  },
});

/** Stripe's signature: HMAC-SHA256 of "timestamp.body", within five minutes. */
export async function stripeSigned(header: string, body: string, secret: string, now = Date.now()) {
  const pairs = header.split(",").map((p) => p.trim().split("=") as [string, string | undefined]);
  const t = Number(pairs.find(([k]) => k === "t")?.[1]);
  const sigs = pairs.filter(([k, s]) => k === "v1" && s).map(([, s]) => s!);
  if (!t || !sigs.length || Math.abs(now / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

/** POST /stripe/webhook/{account}: an owner's Stripe telling Formkit a payment went through. */
export const webhook = httpAction(async (ctx, request) => {
  const accountId = new URL(request.url).pathname.split("/").filter(Boolean).pop() ?? "";
  const body = await request.text();
  const found: { secret: string; ownerId: Id<"users"> } | null = await ctx.runQuery(internal.payments.webhookSecretOf, { accountId });
  if (!found) return new Response("Unknown account", { status: 404 });
  if (!(await stripeSigned(request.headers.get("stripe-signature") ?? "", body, await unseal(found.secret)))) {
    return new Response("Bad signature", { status: 400 });
  }
  const event = JSON.parse(body) as { type?: string; data?: { object?: Record<string, unknown> } };
  const session = event.data?.object ?? {};
  const holdRef = String(session.client_reference_id ?? "");
  const holdId = await ctx.runQuery(internal.payments.holdIdOf, { ref: holdRef });
  if (holdId) {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const facts = sessionFacts(session, holdRef);
      if (facts?.paid) {
        // The event leaves out the line items; how many comes from the hold unless it could change.
        await ctx.runMutation(internal.payments.settle, {
          holdId,
          ownerId: found.ownerId,
          sessionId: facts.sessionId,
          amount: facts.amount,
          currency: facts.currency,
          quantity: facts.quantity,
          tax: facts.tax,
          discount: facts.discount,
        });
      }
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      await ctx.runMutation(internal.payments.lapse, { holdId });
    }
  } else if (typeof (session.metadata as Record<string, string> | undefined)?.formkit_response === "string") {
    // A response from before pay-first, paid after it was sent.
    const responseId = await ctx.runQuery(internal.payments.responseIdOf, { ref: String(session.client_reference_id ?? "") });
    if (responseId && session.payment_status === "paid") {
      await ctx.runMutation(internal.payments.markPaid, { responseId, sessionId: String(session.id) });
    }
  }
  return new Response(null, { status: 200 });
});

export const holdIdOf = internalQuery({
  args: { ref: v.string() },
  handler: async (ctx, { ref }) => ctx.db.normalizeId("paymentHolds", ref),
});

export const responseIdOf = internalQuery({
  args: { ref: v.string() },
  handler: async (ctx, { ref }) => ctx.db.normalizeId("responses", ref),
});

/** Every 20 minutes, beside the old recheck: holds nobody heard back about, and forgetting unpaid ones. */
export const openHolds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const open = await ctx.db
      .query("paymentHolds")
      .withIndex("by_status_created", (q) => q.eq("status", "open").gt("createdAt", now - HOLD_MS))
      .take(200);
    const out = [];
    for (const h of open) {
      if (!h.sessionId) continue;
      const form = await ctx.db.get(h.formId);
      const account = form ? await accountOf(ctx, form.ownerId) : null;
      if (account) out.push({ holdId: h._id, sessionId: h.sessionId, key: account.key });
    }
    return out;
  },
});

export const forgetHolds = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const before = Date.now() - HOLD_MS;
    let n = 0;
    for (const status of ["open", "expired", "paid"] as const) {
      for (const h of await ctx.db
        .query("paymentHolds")
        .withIndex("by_status_created", (q) => q.eq("status", status).lt("createdAt", before))
        .take(200)) {
        await ctx.db.delete(h._id);
        n++;
      }
    }
    return n;
  },
});

export const recheckHolds = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const rows: { holdId: Id<"paymentHolds">; sessionId: string; key: string }[] = await ctx.runQuery(internal.payments.openHolds, {});
    for (const row of rows) {
      const s = await readSession(row.key, row.sessionId, row.holdId).catch(() => null);
      if (s?.paid) await ctx.runMutation(internal.payments.settle, { holdId: row.holdId, ...pick(s) });
      else if (s?.expired) await ctx.runMutation(internal.payments.lapse, { holdId: row.holdId });
    }
    await ctx.runMutation(internal.payments.forgetHolds, {});
    return null;
  },
});

const pick = (s: Paid) => ({ sessionId: s.sessionId, amount: s.amount, currency: s.currency, quantity: s.quantity, tax: s.tax, discount: s.discount });
