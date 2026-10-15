import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { stripeSigned } from "../payments";
import { backend, form, person, type Backend } from "./fixtures.helpers";

const SECRET = "whsec_testsecretvalue1234567890";

type Call = { url: string; method: string; body: URLSearchParams };

/** Stripe, as far as the tests need it: answers by path, and remembers what was asked. */
function fakeStripe(answers: Record<string, (c: Call) => unknown>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const call = { url, method: init?.method ?? "GET", body: new URLSearchParams(String(init?.body ?? "")) };
      calls.push(call);
      const key = Object.keys(answers).find((k) => `${call.method} ${url}`.includes(k));
      const body = key ? answers[key]!(call) : { error: { message: "not stubbed" } };
      return new Response(JSON.stringify(body), { status: key ? 200 : 400, headers: { "Content-Type": "application/json" } });
    }),
  );
  return calls;
}

async function signed(body: string, secret = SECRET) {
  const t = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  return `t=${t},v1=${Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function shop(t: Backend, payment: Record<string, unknown>) {
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const accountId = await t.run((ctx) =>
    ctx.db.insert("paymentAccounts", { ownerId: owner.userId, key: "rk_test_abcdefghijklmnop", live: false, addedAt: Date.now(), webhookSecret: SECRET }),
  );
  const formId = await form(t, owner.userId, { slug: "tickets" });
  const email = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "email", title: "Email", required: true });
  const seats = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "number", title: "How many seats?", required: true });
  await owner.as.mutation(api.payments.setFormPayment, { formId, enabled: true, currency: "usd", label: "Workshop seat", ...payment });
  return { owner, accountId, formId, email, seats };
}

beforeEach(() => vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("connecting a key sets up the webhook when the key may", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const calls = fakeStripe({
    "GET https://api.stripe.com/v1/checkout/sessions": () => ({ data: [] }),
    "GET https://api.stripe.com/v1/account": () => ({ settings: { dashboard: { display_name: "Studio Nine" } } }),
    "POST https://api.stripe.com/v1/webhook_endpoints": () => ({ id: "we_1", secret: SECRET }),
  });
  await owner.as.action(api.payments.connect, { key: "rk_test_abcdefghijklmnop" });
  const hook = calls.find((c) => c.url.endsWith("/webhook_endpoints"))!;
  expect(hook.body.get("url")).toMatch(/^https:\/\/example\.convex\.site\/stripe\/webhook\//);
  expect(hook.body.get("enabled_events[0]")).toBe("checkout.session.completed");
  const formId = await form(t, owner.userId);
  expect((await owner.as.query(api.payments.settings, { formId })).webhook).toMatchObject({ on: true });
});

test("pay first, end to end", async () => {
  const t = backend();
  const { owner, formId, email, seats, accountId } = await shop(t, { amount: 25, promoCodes: true, tax: { inclusive: true } });
  await owner.as.mutation(api.payments.setFormPayment, {
    formId,
    enabled: true,
    currency: "usd",
    amount: 25,
    label: "Workshop seat",
    promoCodes: true,
    tax: { inclusive: true },
    quantity: { from: "question", blockId: seats, max: 5 },
  });
  const answers = [
    { blockId: email, value: "sam@example.com" },
    { blockId: seats, value: "3" },
  ];

  // Sending straight away is refused: this form is paid for first.
  await expect(t.mutation(api.publicForm.submit, { formId, partial: false, human: true, answers })).rejects.toThrow(/payment/);

  const calls = fakeStripe({ "POST https://api.stripe.com/v1/checkout/sessions": () => ({ id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" }) });
  const started = await t.action(api.payments.start, { formId, partial: false, human: true, answers });
  expect(started).toMatchObject({ url: "https://checkout.stripe.com/c/cs_1" });
  const holdId = (started as { holdId: Id<"paymentHolds"> }).holdId;
  const body = calls[0]!.body;
  expect(body.get("line_items[0][price_data][unit_amount]")).toBe("2500");
  expect(body.get("line_items[0][quantity]")).toBe("3");
  expect(body.get("allow_promotion_codes")).toBe("true");
  expect(body.get("automatic_tax[enabled]")).toBe("true");
  expect(body.get("line_items[0][price_data][tax_behavior]")).toBe("inclusive");
  expect(body.get("client_reference_id")).toBe(holdId);
  expect(body.get("customer_email")).toBe("sam@example.com");
  const none = await t.run((ctx) => ctx.db.query("responses").withIndex("by_form", (q) => q.eq("formId", formId)).collect());
  expect(none).toHaveLength(0);

  const event = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { id: "cs_1", client_reference_id: holdId, payment_status: "paid", status: "complete", amount_total: 6750, currency: "usd", total_details: { amount_tax: 1125, amount_discount: 750 } } },
  });
  const forged = await t.fetch(`/stripe/webhook/${accountId}`, { method: "POST", headers: { "stripe-signature": await signed(event, "whsec_wrongwrongwrongwrong") }, body: event });
  expect(forged.status).toBe(400);
  for (let i = 0; i < 2; i++) {
    const res = await t.fetch(`/stripe/webhook/${accountId}`, { method: "POST", headers: { "stripe-signature": await signed(event) }, body: event });
    expect(res.status).toBe(200);
  }
  const kept = await t.run((ctx) => ctx.db.query("responses").withIndex("by_form", (q) => q.eq("formId", formId)).collect());
  expect(kept).toHaveLength(1);
  expect(kept[0]!.payment).toMatchObject({ status: "paid", amount: 6750, tax: 1125, discount: 750, sessionId: "cs_1" });
  expect(kept[0]!.respondentEmail).toBe("sam@example.com");
  const hold = await t.run((ctx) => ctx.db.get(holdId));
  expect(hold).toMatchObject({ status: "paid", responseId: kept[0]!._id, args: null });
});

test("pay what you want takes at least the minimum", async () => {
  const t = backend();
  const { formId, email, seats } = await shop(t, { choose: { minimum: 5, suggested: 10 } });
  const answers = [
    { blockId: email, value: "pat@example.com" },
    { blockId: seats, value: "1" },
  ];
  await expect(t.action(api.payments.start, { formId, partial: false, human: true, answers, chosen: 2 })).rejects.toThrow(/least you can pay/);
  const calls = fakeStripe({ "POST https://api.stripe.com/v1/checkout/sessions": () => ({ id: "cs_2", url: "https://checkout.stripe.com/c/cs_2" }) });
  await t.action(api.payments.start, { formId, partial: false, human: true, answers, chosen: 12.5 });
  expect(calls[0]!.body.get("line_items[0][price_data][unit_amount]")).toBe("1250");
});

test("coming back to /pay/done asks Stripe, and the job settles or forgets the rest", async () => {
  const t = backend();
  const { formId, email, seats } = await shop(t, { amount: 10, quantity: { from: "checkout", max: 4 } });
  const answers = [
    { blockId: email, value: "lee@example.com" },
    { blockId: seats, value: "1" },
  ];
  fakeStripe({ "POST https://api.stripe.com/v1/checkout/sessions": (c) => ({ id: c.body.get("client_reference_id") ? `cs_${Math.random()}` : "x", url: "https://checkout.stripe.com/c/x" }) });
  const a = (await t.action(api.payments.start, { formId, partial: false, human: true, answers })) as { holdId: Id<"paymentHolds"> };
  const b = (await t.action(api.payments.start, { formId, partial: false, human: true, answers: [{ blockId: email, value: "kim@example.com" }, { blockId: seats, value: "1" }] })) as { holdId: Id<"paymentHolds"> };
  const sessionOf = async (id: Id<"paymentHolds">) => (await t.run((ctx) => ctx.db.get(id)))!.sessionId!;
  const [sa, sb] = [await sessionOf(a.holdId), await sessionOf(b.holdId)];

  fakeStripe({
    [`GET https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sa)}`]: () => ({ id: sa, client_reference_id: a.holdId, payment_status: "paid", status: "complete", amount_total: 3000, currency: "usd", line_items: { data: [{ quantity: 3 }] } }),
    [`GET https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sb)}`]: () => ({ id: sb, client_reference_id: b.holdId, payment_status: "unpaid", status: "expired" }),
  });
  const back = await t.action(api.payments.confirm, { holdId: a.holdId, sessionId: sa });
  expect(back).toMatchObject({ status: "paid", amount: 30, currency: "usd" });
  await t.action(internal.payments.recheckHolds, {});
  expect((await t.run((ctx) => ctx.db.get(b.holdId)))?.status).toBe("expired");
  const kept = await t.run((ctx) => ctx.db.query("responses").withIndex("by_form", (q) => q.eq("formId", formId)).collect());
  expect(kept.map((r) => r.payment?.quantity)).toEqual([3]);
});

test("a webhook signature must be fresh and match", async () => {
  const body = "{}";
  const header = await signed(body);
  expect(await stripeSigned(header, body, SECRET)).toBe(true);
  expect(await stripeSigned(header, "{ }", SECRET)).toBe(false);
  expect(await stripeSigned(header, body, SECRET, Date.now() + 10 * 60_000)).toBe(false);
});
