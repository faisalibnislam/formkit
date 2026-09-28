import { v } from "convex/values";
import { Resend as ResendAPI } from "resend";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./model/identity";
import { brandOf, formFor } from "./model/forms";
import {
  fill,
  renderConfirmation,
  renderExport,
  renderNotification,
  type Vars,
} from "./emails/response";
import { csv, xlsx } from "./model/sheet";

/**
 * What Formkit sends on a customer's behalf.
 *
 * Notification settings belong to the *form*, not the account — a support form
 * and a job application go to different people. The account's email only
 * supplies the first draft, which `notifyDefaults` fills in.
 *
 * Everything sent is written to `emailLog`, which the customer can read under
 * Settings → Email log. A send that fails is logged as failed rather than
 * disappearing.
 */

const FROM = process.env.AUTH_EMAIL_FROM ?? "Formkit <onboarding@resend.dev>";
const SITE = process.env.SITE_URL ?? "https://formkit.app";

export type NotifySettings = {
  /** Email the owner about each new response. */
  newResponse: boolean;
  /** Include this form in the daily summary and the weekly report. */
  daily: boolean;
  weekly: boolean;
  to: string;
  subject: string;
  body: string;
  routes: { when?: string; value?: string; to?: string }[];
  confirm: boolean;
  replyTo: string;
  confirmSubject: string;
  confirmBody: string;
  confirmAttach: boolean;
};

export type AccountPrefs = Doc<"users">["emailPrefs"];

/**
 * The settings a form has. Anything the form leaves blank comes from the
 * account's Settings → Notifications, and then from Formkit's own wording.
 */
export function notifyDefaults(stored: unknown, ownerEmail: string, prefs?: AccountPrefs): NotifySettings {
  const n = (stored ?? {}) as Partial<NotifySettings>;
  return {
    newResponse: n.newResponse ?? prefs?.newResponse ?? true,
    daily: n.daily ?? prefs?.daily ?? false,
    weekly: n.weekly ?? prefs?.weekly ?? true,
    to: n.to || prefs?.to || ownerEmail,
    subject: n.subject || prefs?.subject || "New response to {{form_name}}",
    body: n.body || prefs?.body || "{{name}} ({{email}}) just submitted {{form_name}}.",
    routes: n.routes ?? [],
    confirm: !!n.confirm,
    replyTo: n.replyTo ?? ownerEmail,
    confirmSubject: n.confirmSubject ?? "We have your answers — {{form_name}}",
    confirmBody:
      n.confirmBody ??
      "Thank you {{name}}. We have your answers and will come back to you shortly.",
    confirmAttach: n.confirmAttach !== false,
  };
}

/** Several addresses, comma-separated, is one field in the UI. */
function addresses(value: string) {
  return value
    .split(/[,\s]+/)
    .map((a) => a.trim())
    .filter((a) => a.includes("@"));
}

/**
 * The first rule that matches wins; a response matching nothing goes to the
 * address on the form. A rule missing a question, a value or an address is
 * incomplete and skipped rather than silently redirecting everything.
 */
function route(settings: NotifySettings, response: Doc<"responses">) {
  for (const rule of settings.routes) {
    if (!rule.when || !rule.to || rule.value === undefined || rule.value === "") continue;
    const answer = response.answers.find((a) => a.blockId === rule.when);
    if (!answer) continue;
    const given = answer.values ? answer.values.join(", ") : (answer.value ?? "");
    if (given.trim().toLowerCase() === rule.value.trim().toLowerCase()) return rule.to;
  }
  return settings.to;
}

function variables(response: Doc<"responses">, formTitle: string): Vars {
  return {
    name: response.respondentName ?? "Someone",
    email: response.respondentEmail ?? "no email given",
    form_name: formTitle,
    submitted_at: new Date(response.submittedAt).toUTCString(),
  };
}

function rowsOf(response: Doc<"responses">) {
  return response.answers.map((a) => ({
    question: a.question,
    value: a.fileName ?? (a.values ? a.values.join(", ") : (a.value ?? "")),
  }));
}

/* ------------------------------------------------------------------ */
/* Everything the send needs, read in one go so the action holds no db */
/* ------------------------------------------------------------------ */

export const forResponse = internalQuery({
  args: { responseId: v.id("responses") },
  handler: async (ctx, { responseId }) => {
    const response = await ctx.db.get(responseId);
    if (!response) return null;
    const form = await ctx.db.get(response.formId);
    if (!form) return null;
    const owner = await ctx.db.get(form.ownerId);
    if (!owner?.email) return null;

    const settings = notifyDefaults(form.notify, owner.email, owner.emailPrefs);
    const vars = variables(response, form.title);
    const rows = rowsOf(response);

    const brand = await brandOf(ctx, form);
    const brandName = brand.name;

    return {
      userId: owner._id,
      formId: form._id,
      formTitle: form.title,
      brandName,
      brand,
      partial: response.partial,
      respondentEmail: response.respondentEmail ?? null,
      notification: {
        to: settings.newResponse ? addresses(route(settings, response)) : [],
        subject: fill(settings.subject, vars),
        message: fill(settings.body, vars),
        rows,
        link: `${SITE}/app/forms/${form._id}?tab=responses&open=${response._id}`,
      },
      // Settings → Exports → Email a copy: the whole response, to one inbox.
      copy:
        owner.emailCopy?.on && addresses(owner.emailCopy.to).length
          ? {
              to: addresses(owner.emailCopy.to),
              subject: `${form.title}: ${vars.name}`,
              message: `A copy of ${vars.name}’s answers to ${form.title}, sent ${vars.submitted_at}.`,
              rows,
              link: `${SITE}/app/forms/${form._id}?tab=responses&open=${response._id}`,
            }
          : null,
      confirmation: settings.confirm
        ? {
            subject: fill(settings.confirmSubject, vars),
            message: fill(settings.confirmBody, vars),
            replyTo: settings.replyTo,
            rows: settings.confirmAttach ? rows : [],
          }
        : null,
    };
  },
});

export const record = internalMutation({
  args: {
    userId: v.id("users"),
    formId: v.optional(v.id("forms")),
    kind: v.string(),
    to: v.string(),
    subject: v.string(),
    state: v.string(),
    detail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("emailLog", { ...args, at: Date.now() });
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* The send itself                                                     */
/* ------------------------------------------------------------------ */

export async function send(
  payload: {
    to: string[];
    subject: string;
    html: string;
    replyTo?: string;
  },
): Promise<{ state: "sent" | "failed"; detail?: string }> {
  const key = process.env.AUTH_RESEND_KEY;
  if (!key) return { state: "failed", detail: "No Resend key is configured." };
  try {
    const resend = new ResendAPI(key);
    const { error } = await resend.emails.send({
      from: FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
    });
    if (error) return { state: "failed", detail: error.message };
    return { state: "sent" };
  } catch (e) {
    return { state: "failed", detail: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Scheduled by `publicForm.submit` once a response is complete. */
export const onResponse = internalAction({
  args: { responseId: v.id("responses") },
  returns: v.null(),
  handler: async (ctx, { responseId }) => {
    const job = await ctx.runQuery(internal.notifications.forResponse, { responseId });
    if (!job) return null;

    if (job.notification.to.length) {
      const result = await send({
        to: job.notification.to,
        subject: job.notification.subject,
        html: renderNotification({ ...job.notification, partial: job.partial }),
      });
      await ctx.runMutation(internal.notifications.record, {
        userId: job.userId,
        formId: job.formId,
        kind: "notification",
        to: job.notification.to.join(", "),
        subject: job.notification.subject,
        ...result,
      });
    }

    if (job.copy) {
      const result = await send({
        to: job.copy.to,
        subject: job.copy.subject,
        html: renderNotification({ ...job.copy, partial: job.partial }),
      });
      await ctx.runMutation(internal.notifications.record, {
        userId: job.userId,
        formId: job.formId,
        kind: "copy",
        to: job.copy.to.join(", "),
        subject: job.copy.subject,
        ...result,
      });
    }

    // The confirmation needs an address, which only an email question supplies.
    if (job.confirmation && job.respondentEmail) {
      const result = await send({
        to: [job.respondentEmail],
        subject: job.confirmation.subject,
        replyTo: job.confirmation.replyTo,
        html: renderConfirmation({
          subject: job.confirmation.subject,
          message: job.confirmation.message,
          rows: job.confirmation.rows,
          brandName: job.brandName,
          brand: job.brand,
        }),
      });
      await ctx.runMutation(internal.notifications.record, {
        userId: job.userId,
        formId: job.formId,
        kind: "confirmation",
        to: job.respondentEmail,
        subject: job.confirmation.subject,
        ...result,
      });
    }

    return null;
  },
});

/**
 * An action that calls back into this file has to be told its own shape, or
 * TypeScript chases `api` round in a circle and gives up with `any`.
 */
type SendResult = { state: string; to: string; detail?: string };

type TestJob = {
  userId: Id<"users">;
  to: string;
  replyTo: string | undefined;
  subject: string;
  html: string;
};

/**
 * "Send me a test" on the notification settings, so the customer sees the real
 * email rather than a description of one.
 */
export const sendTest = action({
  args: {
    formId: v.id("forms"),
    which: v.union(v.literal("notification"), v.literal("confirmation")),
  },
  returns: v.object({ state: v.string(), to: v.string(), detail: v.optional(v.string()) }),
  handler: async (ctx, { formId, which }): Promise<SendResult> => {
    const job: TestJob = await ctx.runQuery(internal.notifications.testFor, { formId, which });
    const result = await send({
      to: [job.to],
      subject: job.subject,
      html: job.html,
      replyTo: job.replyTo,
    });
    await ctx.runMutation(internal.notifications.record, {
      userId: job.userId,
      formId,
      kind: which,
      to: job.to,
      subject: job.subject,
      ...result,
    });
    return { state: result.state, to: job.to, detail: result.detail };
  },
});

export const testFor = internalQuery({
  args: {
    formId: v.id("forms"),
    which: v.union(v.literal("notification"), v.literal("confirmation")),
  },
  handler: async (ctx, { formId, which }): Promise<TestJob> => {
    const user = await requireUser(ctx);
    const form = await formFor(ctx, formId, "read");
    const settings = notifyDefaults(form.notify, user.email ?? "", user.emailPrefs);

    const blocks = (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", formId))
        .collect()
    )
      .filter((b) => b.kind === "field")
      .sort((a, b) => a.order - b.order);

    const vars: Vars = {
      name: user.name ?? "Sam Taylor",
      email: user.email ?? "sam@example.com",
      form_name: form.title,
      submitted_at: new Date().toUTCString(),
    };
    // A test shows the shape of the email, filled with example answers.
    const rows = blocks.slice(0, 6).map((b) => ({
      question: b.title ?? "Question",
      value: b.options?.[0] ?? "An example answer",
    }));

    const to = which === "notification" ? addresses(settings.to)[0] : settings.replyTo;
    const brand = await brandOf(ctx, form);
    if (!to) throw new Error("Add an address to send to before sending a test.");

    return {
      userId: user._id,
      to,
      replyTo: which === "confirmation" ? settings.replyTo : undefined,
      subject: fill(
        which === "notification" ? settings.subject : settings.confirmSubject,
        vars,
      ),
      html:
        which === "notification"
          ? renderNotification({
              subject: fill(settings.subject, vars),
              message: fill(settings.body, vars),
              rows,
              link: `${SITE}/app/forms/${formId}?tab=responses`,
            })
          : renderConfirmation({
              subject: fill(settings.confirmSubject, vars),
              message: fill(settings.confirmBody, vars),
              rows: settings.confirmAttach ? rows : [],
              brandName: brand.name,
              brand,
            }),
    };
  },
});

/**
 * Export by email. The same rows the Export button downloads, sent as a CSV
 * attachment — for exports too large to wait on, and for sending to somebody
 * who is not signed in.
 */
export const exportByEmail = action({
  args: {
    formId: v.optional(v.id("forms")),
    to: v.optional(v.string()),
    ids: v.optional(v.array(v.id("responses"))),
    includePartial: v.optional(v.boolean()),
    from: v.optional(v.number()),
    until: v.optional(v.number()),
    format: v.optional(v.union(v.literal("csv"), v.literal("xlsx"))),
    what: v.optional(v.union(v.literal("responses"), v.literal("contacts"))),
  },
  returns: v.object({ state: v.string(), to: v.string(), detail: v.optional(v.string()) }),
  handler: async (
    ctx,
    { formId, to, ids, includePartial, from, until, format: asked = "xlsx", what = "responses" },
  ): Promise<SendResult> => {
    // With Excel export switched off for this account, the file goes as CSV.
    const flags: { "exports.xlsx": boolean } = await ctx.runQuery(api.flags.mine, {});
    const format = asked === "xlsx" && !flags["exports.xlsx"] ? "csv" : asked;
    const me: { _id: Id<"users">; email: string } | null = await ctx.runQuery(
      api.users.viewer,
      {},
    );
    const address = (to ?? me?.email ?? "").trim();
    if (!address.includes("@")) throw new Error("Add an address to send the export to.");

    const data: { filename: string; title?: string; columns: string[]; rows: string[][] } =
      what === "contacts"
        ? await ctx.runQuery(api.responses.contactsForExport, { formId })
        : await ctx.runQuery(api.responses.forExport, { formId, ids, includePartial, from, to: until });
    const filename = `${data.filename}.${format}`;
    const content =
      format === "xlsx"
        ? bytesToBase64(xlsx([{ name: data.title ?? "Responses", columns: data.columns, rows: data.rows }]))
        : toBase64("\uFEFF" + csv(data));
    const subject = `Your export from Formkit — ${data.title ?? data.filename}`;

    const key = process.env.AUTH_RESEND_KEY;
    let result: { state: "sent" | "failed"; detail?: string };
    if (!key) {
      result = { state: "failed", detail: "No Resend key is configured." };
    } else {
      try {
        const resend = new ResendAPI(key);
        const { error } = await resend.emails.send({
          from: FROM,
          to: [address],
          subject,
          html: renderExport({
            formTitle: data.title ?? data.filename,
            count: data.rows.length,
            filename,
          }),
          attachments: [{ filename, content }],
        });
        result = error ? { state: "failed", detail: error.message } : { state: "sent" };
      } catch (e) {
        result = { state: "failed", detail: e instanceof Error ? e.message : "Unknown error" };
      }
    }

    if (me) {
      await ctx.runMutation(internal.notifications.record, {
        userId: me._id,
        formId,
        kind: "export",
        to: address,
        subject,
        ...result,
      });
      if (result.state === "sent") {
        await ctx.runMutation(internal.exports.recordFor, {
          userId: me._id,
          formId,
          what,
          format,
          filename,
          rows: data.rows.length,
          from,
          to: until,
          ids,
          emailedTo: address,
        });
      }
    }
    return { state: result.state, to: address, detail: result.detail };
  },
});

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function toBase64(text: string) {
  return bytesToBase64(new TextEncoder().encode(text));
}

/* ------------------------------------------------------------------ */
/* What the customer sees                                              */
/* ------------------------------------------------------------------ */

/** Settings → Email log: everything Formkit sent on their behalf, newest first. */
export const log = query({
  args: { formId: v.optional(v.id("forms")), limit: v.optional(v.number()) },
  handler: async (ctx, { formId, limit = 60 }) => {
    const user = await requireUser(ctx);
    const rows = formId
      ? await ctx.db
          .query("emailLog")
          .withIndex("by_form", (q) => q.eq("formId", formId))
          .collect()
      : await ctx.db
          .query("emailLog")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();

    const forms = new Map<string, string>();
    const out = [];
    for (const row of rows.sort((a, b) => b.at - a.at).slice(0, limit)) {
      if (row.userId !== user._id) continue;
      if (row.formId && !forms.has(row.formId)) {
        forms.set(row.formId, (await ctx.db.get(row.formId))?.title ?? "");
      }
      out.push({
        _id: row._id,
        kind: row.kind,
        to: row.to,
        subject: row.subject,
        state: row.state,
        detail: row.detail ?? null,
        at: row.at,
        form: row.formId ? (forms.get(row.formId) ?? "") : "",
      });
    }
    return out;
  },
});
