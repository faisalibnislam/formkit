import { ConvexError, v } from "convex/values";
import { action, httpAction, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { formFor } from "./model/forms";
import { hasFeature, requireFeature, type Feature } from "./model/plans";
import { moneyText } from "./model/money";
import { csv } from "./model/sheet";
import { APP_KINDS } from "./model/providers";
import { forgetRefs, pushToApp } from "./integrations";

/**
 * Connections (Pro): where a form's new responses go.
 *
 * - Webhook: every complete response is POSTed as JSON to the owner's URL,
 *   signed with a secret (Formkit-Signature: t=<unix>,v1=<hex HMAC-SHA256 of
 *   "<t>.<body>">). Zapier's and Make's "catch hook" URLs are webhooks too.
 *   A failed delivery is tried again after a minute, then after ten.
 * - Slack, Discord and Microsoft Teams: a short message in a channel, each
 *   in the shape that app shows well.
 * - Each webhook can pick its events: created, updated, paid, deleted.
 * - Google Sheets: a private link the sheet pulls from - =IMPORTDATA() for
 *   CSV, or a small Apps Script for faster refreshes - so Google never needs
 *   to grant Formkit access to anything.
 *
 * Everything follows the form owner's plan; without it nothing is sent and
 * the sheet link answers with nothing.
 */

const SITE_API = process.env.CONVEX_SITE_URL ?? "";
const FEATURE: Record<Doc<"connections">["kind"], Feature> = {
  webhook: "connect.webhooks",
  slack: "connect.slack",
  discord: "connect.slack",
  teams: "connect.slack",
  sheets: "connect.sheets",
  gsheets: "connect.sheets",
  notion: "connect.apps",
  airtable: "connect.apps",
  hubspot: "connect.apps",
};

/** What a connection can be told about. Chat apps hear about new and paid responses by default. */
export const EVENTS = ["response.created", "response.updated", "response.paid", "response.deleted"] as const;
type Event = (typeof EVENTS)[number];
const CHAT_DEFAULT: Event[] = ["response.created", "response.paid"];
const CHAT = new Set<Doc<"connections">["kind"]>(["slack", "discord", "teams"]);

function hears(c: Doc<"connections">, event: Event) {
  return (c.events ?? (CHAT.has(c.kind) ? CHAT_DEFAULT : EVENTS)).includes(event);
}

/** Where each chat app's incoming webhooks live. */
const CHAT_HOSTS: Partial<Record<Doc<"connections">["kind"], { test: RegExp; message: string }>> = {
  slack: {
    test: /^https:\/\/hooks\.slack\.com\/services\//,
    message: "That is not a Slack incoming-webhook address. It starts https://hooks.slack.com/services/.",
  },
  discord: {
    test: /^https:\/\/(ptb\.|canary\.)?(discord|discordapp)\.com\/api\/webhooks\//,
    message: "That is not a Discord webhook address. It starts https://discord.com/api/webhooks/.",
  },
  teams: {
    test: /^https:\/\/([a-z0-9-]+\.)*(webhook\.office\.com|logic\.azure\.com|api\.powerplatform\.com)(:443)?\//,
    message: "That is not a Microsoft Teams workflow address. Make one with the “Post to a channel when a webhook request is received” workflow.",
  },
};

function randomHex(bytes: number) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Only public https addresses: no local or private network targets. */
export function publicHttps(raw: string) {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal") ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) ||
    h === "[::1]" ||
    h.startsWith("[fc") ||
    h.startsWith("[fd")
  ) {
    return null;
  }
  return u.toString();
}

/* ------------------------------------------------------------------ */
/* Managing a form's connections                                       */
/* ------------------------------------------------------------------ */

export const forForm = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    await formFor(ctx, formId, "read");
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    return await Promise.all(
      rows.map(async (c) => ({
        _id: c._id,
        kind: c.kind,
        label: c.label ?? null,
        url: c.kind === "sheets" || APP_KINDS.has(c.kind) ? null : (c.url ?? null),
        place: c.target ? { name: c.target.name, url: c.target.url ?? null } : null,
        events: c.kind === "sheets" ? [] : (c.events ?? (CHAT.has(c.kind) ? CHAT_DEFAULT : [...EVENTS])),
        feed: c.kind === "sheets" && c.token ? `${SITE_API}/sheets/${c.token}` : null,
        enabled: c.enabled,
        last: c.last ?? null,
        recent: (
          await ctx.db
            .query("deliveries")
            .withIndex("by_connection", (q) => q.eq("connectionId", c._id))
            .order("desc")
            .take(8)
        ).map((d) => ({
          id: d._id,
          at: d.at,
          ok: d.ok,
          status: d.status,
          attempt: d.attempt,
          detail: d.detail ?? null,
          event: d.event ?? null,
          canReplay: !!d.responseId && d.event !== "response.deleted",
        })),
      })),
    );
  },
});

export const add = mutation({
  args: {
    formId: v.id("forms"),
    kind: v.union(v.literal("webhook"), v.literal("slack"), v.literal("sheets"), v.literal("discord"), v.literal("teams")),
    url: v.optional(v.string()),
    label: v.optional(v.string()),
  },
  returns: v.object({ id: v.id("connections"), secret: v.union(v.string(), v.null()) }),
  handler: async (ctx, { formId, kind, url, label }) => {
    const form = await formFor(ctx, formId);
    await requireFeature(ctx, form, FEATURE[kind]);
    const existing = await ctx.db
      .query("connections")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    if (existing.length >= 10) throw new ConvexError("Ten connections is the most one form can have.");

    let clean: string | undefined;
    if (kind !== "sheets") {
      clean = publicHttps(url ?? "") ?? undefined;
      if (!clean) throw new ConvexError("Use a public https:// address.");
      const chat = CHAT_HOSTS[kind];
      if (chat && !chat.test.test(clean)) throw new ConvexError(chat.message);
    } else if (existing.some((c) => c.kind === "sheets")) {
      throw new ConvexError("This form already has a Google Sheets link.");
    }
    const secret = kind === "webhook" ? `fks_${randomHex(24)}` : null;
    const id = await ctx.db.insert("connections", {
      formId,
      ownerId: form.ownerId,
      kind,
      label: label?.trim() || undefined,
      url: clean,
      secret: secret ?? undefined,
      token: kind === "sheets" ? randomHex(20) : undefined,
      enabled: true,
      createdAt: Date.now(),
    });
    return { id, secret };
  },
});

export const setEnabled = mutation({
  args: { connectionId: v.id("connections"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { connectionId, enabled }) => {
    const c = await ctx.db.get(connectionId);
    if (!c) return null;
    await formFor(ctx, c.formId);
    await ctx.db.patch(connectionId, { enabled });
    return null;
  },
});

export const remove = mutation({
  args: { connectionId: v.id("connections") },
  returns: v.null(),
  handler: async (ctx, { connectionId }) => {
    const c = await ctx.db.get(connectionId);
    if (!c) return null;
    await formFor(ctx, c.formId);
    const log = await ctx.db
      .query("deliveries")
      .withIndex("by_connection", (q) => q.eq("connectionId", connectionId))
      .collect();
    for (const d of log) await ctx.db.delete(d._id);
    await forgetRefs(ctx, connectionId);
    await ctx.db.delete(connectionId);
    return null;
  },
});

/** Which events a connection is sent. */
export const setEvents = mutation({
  args: { connectionId: v.id("connections"), events: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { connectionId, events }) => {
    const c = await ctx.db.get(connectionId);
    if (!c || c.kind === "sheets") return null;
    await formFor(ctx, c.formId);
    const picked = EVENTS.filter((e) => events.includes(e));
    if (!picked.length) throw new ConvexError("Leave at least one event on, or turn the connection off.");
    await ctx.db.patch(connectionId, { events: picked });
    return null;
  },
});

/** A new signing secret for a webhook, shown once; the old one stops matching at once. */
export const rotateSecret = mutation({
  args: { connectionId: v.id("connections") },
  returns: v.string(),
  handler: async (ctx, { connectionId }) => {
    const c = await ctx.db.get(connectionId);
    if (!c || c.kind !== "webhook") throw new ConvexError("Only a webhook has a secret.");
    await formFor(ctx, c.formId);
    const secret = `fks_${randomHex(24)}`;
    await ctx.db.patch(connectionId, { secret });
    return secret;
  },
});

/** Sends a past delivery's response again, as it is now. */
export const replay = mutation({
  args: { deliveryId: v.id("deliveries") },
  returns: v.null(),
  handler: async (ctx, { deliveryId }) => {
    const d = await ctx.db.get(deliveryId);
    if (!d || !d.responseId) throw new ConvexError("That delivery cannot be sent again.");
    const c = await ctx.db.get(d.connectionId);
    if (!c) throw new ConvexError("That connection no longer exists.");
    await formFor(ctx, c.formId);
    if (!(await ctx.db.get(d.responseId))) throw new ConvexError("That response has been deleted.");
    const event =
      d.event === "response.updated" || d.event === "response.paid" || d.event === "response.created" ? d.event : undefined;
    await ctx.scheduler.runAfter(0, internal.connections.deliver, { connectionId: c._id, responseId: d.responseId, event, attempt: 1, replay: true });
    return null;
  },
});

/**
 * Called as a response is deleted: webhooks that asked for it hear which
 * one, with nothing else about it.
 */
export async function tellDeleted(ctx: MutationCtx, r: Doc<"responses">) {
  if (r.preview || r.partial) return;
  const form = await ctx.db.get(r.formId);
  if (!form || !(await hasFeature(ctx, form, "connect.webhooks"))) return;
  const hooks = (
    await ctx.db
      .query("connections")
      .withIndex("by_form", (q) => q.eq("formId", r.formId))
      .collect()
  ).filter((c) => c.enabled && c.kind === "webhook" && hears(c, "response.deleted"));
  for (const c of hooks) {
    await ctx.scheduler.runAfter(0, internal.connections.deliverDeleted, {
      connectionId: c._id,
      formId: form._id,
      formTitle: form.title,
      responseId: r._id,
      attempt: 1,
    });
  }
}

/** A new private link for a sheet; the old one stops answering at once. */
export const rotateToken = mutation({
  args: { connectionId: v.id("connections") },
  returns: v.null(),
  handler: async (ctx, { connectionId }) => {
    const c = await ctx.db.get(connectionId);
    if (!c || c.kind !== "sheets") return null;
    await formFor(ctx, c.formId);
    await ctx.db.patch(connectionId, { token: randomHex(20) });
    return null;
  },
});

/** Sends an example response, so the other end can be set up. */
export const test = action({
  args: { connectionId: v.id("connections") },
  returns: v.object({ ok: v.boolean(), status: v.number(), detail: v.optional(v.string()) }),
  handler: async (ctx, { connectionId }): Promise<{ ok: boolean; status: number; detail?: string }> => {
    const c: Doc<"connections"> | null = await ctx.runQuery(internal.connections.ownConnection, { connectionId });
    if (!c) throw new ConvexError("That connection no longer exists.");
    if (APP_KINDS.has(c.kind)) throw new ConvexError("Send a real response to try it: it shows up there as it arrives.");
    const payload: Payload | null = await ctx.runQuery(internal.connections.samplePayload, { formId: c.formId });
    if (!payload) throw new ConvexError("That form no longer exists.");
    return await sendOne(ctx, c, payload, undefined, 1, true);
  },
});

export const ownConnection = internalQuery({
  args: { connectionId: v.id("connections") },
  handler: async (ctx, { connectionId }) => {
    const c = await ctx.db.get(connectionId);
    if (!c) return null;
    await formFor(ctx, c.formId);
    return c;
  },
});

/* ------------------------------------------------------------------ */
/* Delivering                                                          */
/* ------------------------------------------------------------------ */

type Payload = {
  event: "response.created" | "response.updated" | "response.paid" | "response.test" | "response.deleted";
  form: { id: string; title: string };
  response: {
    id: string;
    submittedAt: string;
    respondent: { name: string | null; email: string | null };
    /** A file upload or voice recording also carries a link to the file. */
    answers: { key: string | null; question: string; type: string | null; value: string; fileUrl?: string | null }[];
    calculations: Record<string, number>;
    payment: { status: string; amount: number; currency: string } | null;
  };
};

async function blocksOf(ctx: QueryCtx, formId: Id<"forms">) {
  return (
    await ctx.db
      .query("blocks")
      .withIndex("by_form_order", (q) => q.eq("formId", formId))
      .collect()
  )
    .filter((b) => b.kind === "field")
    .sort((a, b) => a.order - b.order);
}

function answerText(a: { value?: string; values?: string[]; fileName?: string; transcript?: string }) {
  return a.values?.length ? a.values.join(", ") : (a.transcript ?? a.fileName ?? a.value ?? "");
}

/** Where to download each uploaded file and voice recording on these responses. */
async function fileLinks(ctx: QueryCtx, rows: Doc<"responses">[]) {
  const links = new Map<string, string>();
  for (const r of rows)
    for (const a of r.answers)
      if (a.fileId && !links.has(a.fileId)) {
        const url = await ctx.storage.getUrl(a.fileId);
        if (url) links.set(a.fileId, url);
      }
  return links;
}

const EVENT = v.optional(v.union(v.literal("response.created"), v.literal("response.updated"), v.literal("response.paid")));

export const payloadFor = internalQuery({
  args: { responseId: v.id("responses"), event: EVENT },
  handler: async (ctx, { responseId, event }) => {
    const r = await ctx.db.get(responseId);
    if (!r || r.partial || r.preview) return null;
    const form = await ctx.db.get(r.formId);
    if (!form) return null;
    const blocks = await blocksOf(ctx, form._id);
    const byId = new Map(blocks.map((b) => [b._id as string, b]));
    const connections = (
      await ctx.db
        .query("connections")
        .withIndex("by_form", (q) => q.eq("formId", form._id))
        .collect()
    ).filter((c) => c.enabled && c.kind !== "sheets" && hears(c, event ?? "response.created"));
    const allowed = [];
    for (const c of connections) if (await hasFeature(ctx, form, FEATURE[c.kind])) allowed.push(c._id);
    const links = await fileLinks(ctx, [r]);
    const payload: Payload = {
      event: event ?? "response.created",
      form: { id: form._id, title: form.title },
      response: {
        id: r._id,
        submittedAt: new Date(r.submittedAt).toISOString(),
        respondent: { name: r.respondentName ?? null, email: r.respondentEmail ?? null },
        answers: r.answers.map((a) => ({
          key: byId.get(a.blockId)?.key ?? null,
          question: a.question,
          type: byId.get(a.blockId)?.type ?? null,
          value: answerText(a),
          ...(a.fileId ? { fileUrl: links.get(a.fileId) ?? null } : {}),
        })),
        calculations: r.calc ?? {},
        payment: r.payment ? { status: r.payment.status, amount: r.payment.amount, currency: r.payment.currency } : null,
      },
    };
    return { payload, connections: allowed };
  },
});

export const samplePayload = internalQuery({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }): Promise<Payload | null> => {
    const form = await ctx.db.get(formId);
    if (!form) return null;
    const blocks = (await blocksOf(ctx, formId)).filter((b) => b.type !== "hidden");
    return {
      event: "response.test",
      form: { id: form._id, title: form.title },
      response: {
        id: "test",
        submittedAt: new Date().toISOString(),
        respondent: { name: "Sam Taylor", email: "sam@example.com" },
        answers: blocks.map((b) => ({
          key: b.key ?? null,
          question: b.title ?? "Question",
          type: b.type ?? null,
          value: b.options?.[0] ?? (b.type === "email" ? "sam@example.com" : "An example answer"),
        })),
        calculations: Object.fromEntries((form.calc ?? []).map((c) => [c.name, 0])),
        payment: null,
      },
    };
  },
});

/** Scheduled when a response is complete. */
export const fanout = internalAction({
  args: { responseId: v.id("responses"), event: EVENT },
  returns: v.null(),
  handler: async (ctx, { responseId, event }): Promise<null> => {
    const job: { payload: Payload; connections: Id<"connections">[] } | null = await ctx.runQuery(
      internal.connections.payloadFor,
      { responseId, event },
    );
    if (!job) return null;
    for (const id of job.connections) {
      await ctx.scheduler.runAfter(0, internal.connections.deliver, { connectionId: id, responseId, event, attempt: 1 });
    }
    return null;
  },
});

export const connection = internalQuery({
  args: { connectionId: v.id("connections") },
  handler: async (ctx, { connectionId }) => ctx.db.get(connectionId),
});

export const deliver = internalAction({
  args: {
    connectionId: v.id("connections"),
    responseId: v.id("responses"),
    event: EVENT,
    attempt: v.number(),
    replay: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { connectionId, responseId, event, attempt, replay }): Promise<null> => {
    const c: Doc<"connections"> | null = await ctx.runQuery(internal.connections.connection, { connectionId });
    if (!c || !c.enabled) return null;
    const job: { payload: Payload } | null = await ctx.runQuery(internal.connections.payloadFor, { responseId, event });
    if (!job) return null;
    const result = APP_KINDS.has(c.kind)
      ? await logged(ctx, c, job.payload, responseId, attempt, await pushToApp(ctx, c, job.payload, responseId), replay)
      : await sendOne(ctx, c, job.payload, responseId, attempt, false, replay);
    if (replay) return null;
    if (!result.ok && attempt < 3) {
      await ctx.scheduler.runAfter(attempt === 1 ? 60_000 : 600_000, internal.connections.deliver, {
        connectionId,
        responseId,
        event,
        attempt: attempt + 1,
      });
    }
    return null;
  },
});

export const deliverDeleted = internalAction({
  args: { connectionId: v.id("connections"), formId: v.id("forms"), formTitle: v.string(), responseId: v.id("responses"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    const c: Doc<"connections"> | null = await ctx.runQuery(internal.connections.connection, { connectionId: a.connectionId });
    if (!c || !c.enabled) return null;
    const payload: Payload = {
      event: "response.deleted",
      form: { id: a.formId, title: a.formTitle },
      response: { id: a.responseId, submittedAt: "", respondent: { name: null, email: null }, answers: [], calculations: {}, payment: null },
    };
    const result = await sendOne(ctx, c, payload, a.responseId, a.attempt, false);
    if (!result.ok && a.attempt < 3) {
      await ctx.scheduler.runAfter(a.attempt === 1 ? 60_000 : 600_000, internal.connections.deliverDeleted, { ...a, attempt: a.attempt + 1 });
    }
    return null;
  },
});

async function sign(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function slackText(p: Payload) {
  const lines = p.response.answers
    .filter((a) => a.value)
    .slice(0, 8)
    // A file or voice recording links to itself, so it opens straight from Slack.
    .map((a) => `*${a.question}*\n${a.fileUrl ? `<${a.fileUrl}|${a.type === "voice" ? "Play the recording" : a.value}>` : a.value.slice(0, 300)}`);
  if (p.event === "response.paid" && p.response.payment) {
    const pay = p.response.payment;
    const who = p.response.respondent.name ?? p.response.respondent.email ?? "Someone";
    const money = moneyText(pay.amount, pay.currency);
    return `${who} paid ${money} for *${p.form.title}*`;
  }
  const head =
    p.event === "response.test"
      ? `Test from Formkit: ${p.form.title}`
      : p.event === "response.updated"
        ? `Answers changed on *${p.form.title}*`
        : p.event === "response.deleted"
          ? `A response to *${p.form.title}* was deleted`
        : `New response to *${p.form.title}*`;
  return [head, ...lines].join("\n\n");
}

/** The message for Discord: markdown, links as [text](url), at most 2,000 characters, no pings. */
function discordBody(p: Payload) {
  const text = slackText(p)
    .replace(/<([^|>]+)\|([^>]+)>/g, "[$2]($1)")
    .replace(/\*([^*\n]+)\*/g, "**$1**");
  return { content: text.slice(0, 1990), allowed_mentions: { parse: [] } };
}

/** The message for a Teams workflow: an Adaptive Card. */
function teamsBody(p: Payload) {
  const plain = (s: string) => s.replace(/<([^|>]+)\|([^>]+)>/g, "[$2]($1)");
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: slackText(p)
            .split("\n\n")
            .map((l, i) => ({
              type: "TextBlock",
              text: plain(l).slice(0, 1000),
              wrap: true,
              ...(i === 0 ? { weight: "Bolder", size: "Medium" } : {}),
            })),
        },
      },
    ],
  };
}

function bodyFor(c: Doc<"connections">, payload: Payload) {
  if (c.kind === "slack") return JSON.stringify({ text: slackText(payload) });
  if (c.kind === "discord") return JSON.stringify(discordBody(payload));
  if (c.kind === "teams") return JSON.stringify(teamsBody(payload));
  return JSON.stringify(payload);
}

/** An app delivery's outcome, into the same log as every other. */
async function logged(
  ctx: { runMutation: import("./_generated/server").ActionCtx["runMutation"] },
  c: Doc<"connections">,
  payload: Payload,
  responseId: Id<"responses">,
  attempt: number,
  result: { ok: boolean; status: number; detail?: string },
  replay = false,
) {
  await ctx.runMutation(internal.connections.recordDelivery, {
    connectionId: c._id,
    responseId,
    event: payload.event,
    attempt,
    ok: result.ok,
    status: result.status,
    detail: replay ? `Sent again${result.detail ? `: ${result.detail}` : ""}` : result.detail,
  });
  return result;
}

async function sendOne(
  ctx: { runMutation: import("./_generated/server").ActionCtx["runMutation"] },
  c: Doc<"connections">,
  payload: Payload,
  responseId: Id<"responses"> | undefined,
  attempt: number,
  test: boolean,
  replay = false,
) {
  const body = bodyFor(c, payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Formkit-Webhooks/1",
  };
  if (c.kind === "webhook" && c.secret) {
    const t = Math.floor(Date.now() / 1000);
    headers["Formkit-Event"] = payload.event;
    headers["Formkit-Signature"] = `t=${t},v1=${await sign(c.secret, `${t}.${body}`)}`;
  }
  let ok = false;
  let status = 0;
  let detail: string | undefined;
  try {
    const res = await fetch(c.url!, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    status = res.status;
    ok = res.status >= 200 && res.status < 300;
    if (!ok) detail = (await res.text().catch(() => "")).slice(0, 200) || res.statusText;
  } catch (e) {
    detail = e instanceof Error ? e.message.slice(0, 200) : "No answer";
  }
  await ctx.runMutation(internal.connections.recordDelivery, {
    connectionId: c._id,
    responseId,
    event: test ? undefined : payload.event,
    attempt,
    ok,
    status,
    detail: test ? `Test${detail ? `: ${detail}` : ""}` : replay ? `Sent again${detail ? `: ${detail}` : ""}` : detail,
  });
  return { ok, status, detail };
}

export const recordDelivery = internalMutation({
  args: {
    connectionId: v.id("connections"),
    responseId: v.optional(v.id("responses")),
    event: v.optional(v.string()),
    attempt: v.number(),
    ok: v.boolean(),
    status: v.number(),
    detail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (!(await ctx.db.get(a.connectionId))) return null;
    const at = Date.now();
    await ctx.db.insert("deliveries", { ...a, at });
    await ctx.db.patch(a.connectionId, { last: { at, ok: a.ok, status: a.status, detail: a.detail } });
    // Keep the log short: the newest fifty.
    const old = await ctx.db
      .query("deliveries")
      .withIndex("by_connection", (q) => q.eq("connectionId", a.connectionId))
      .order("desc")
      .take(60);
    for (const d of old.slice(50)) await ctx.db.delete(d._id);
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Google Sheets: the private link                                     */
/* ------------------------------------------------------------------ */

/** The most rows the Google Sheets feed carries. */
const SHEET_ROWS = 3000;

export const sheetRows = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const c = await ctx.db
      .query("connections")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!c || !c.enabled || c.kind !== "sheets") return null;
    const form = await ctx.db.get(c.formId);
    if (!form || form.deletedAt || !(await hasFeature(ctx, form, "connect.sheets"))) return null;
    const blocks = await blocksOf(ctx, form._id);
    // The latest 3,000 complete responses, oldest of them first: as much as
    // one read can carry with long answers. Exports have everything.
    const latest: Doc<"responses">[] = [];
    for await (const r of ctx.db
      .query("responses")
      .withIndex("by_form_preview_submitted", (q) => q.eq("formId", form._id).eq("preview", undefined))
      .order("desc")) {
      if (r.partial) continue;
      latest.push(r);
      if (latest.length === SHEET_ROWS) break;
    }
    const responses = latest.reverse();
    const calcNames = (form.calc ?? []).map((x) => x.name);
    const links = await fileLinks(ctx, responses);
    const columns = ["Submitted", "Name", "Email", ...blocks.map((b) => b.title ?? "Question"), ...calcNames, "Payment"];
    const rows = responses.map((r) => {
      const byBlock = new Map(r.answers.map((a) => [a.blockId as string, a]));
      return [
        new Date(r.submittedAt).toISOString().replace("T", " ").slice(0, 16),
        r.respondentName ?? "",
        r.respondentEmail ?? "",
        ...blocks.map((b) => {
          const a = byBlock.get(b._id);
          if (a?.fileId) return links.get(a.fileId) ?? answerText(a);
          return a ? answerText(a) : "";
        }),
        ...calcNames.map((n) => (r.calc && n in r.calc ? String(r.calc[n]) : "")),
        r.payment ? `${r.payment.status} ${moneyText(r.payment.amount, r.payment.currency)}` : "",
      ];
    });
    return { title: form.title, columns, rows };
  },
});

/** GET /sheets/<token> (CSV) or /sheets/<token>.json. */
export const sheetFeed = httpAction(async (ctx, req) => {
  const url = new URL(req.url);
  const last = url.pathname.split("/").pop() ?? "";
  const json = last.endsWith(".json");
  const token = last.replace(/\.(json|csv)$/, "");
  if (!/^[0-9a-f]{40}$/.test(token)) return new Response("Not found", { status: 404 });
  const data: { title: string; columns: string[]; rows: string[][] } | null = await ctx.runQuery(
    internal.connections.sheetRows,
    { token },
  );
  if (!data) return new Response("Not found", { status: 404 });
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  if (json) {
    return new Response(JSON.stringify({ columns: data.columns, rows: data.rows }), {
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
    });
  }
  return new Response(csv({ columns: data.columns, rows: data.rows }), {
    headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
  });
});
