import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./model/identity";
import { hasFeature } from "./model/plans";
import { allow } from "./model/rateLimit";
import { send } from "./notifications";
import { renderSupportAnswer, renderSupportReceived } from "./emails/support";

/**
 * Asking Formkit for help: from inside the app, or from /contact without an
 * account. Business accounts' tickets are marked priority, go to the top of
 * the support queue, and are promised a reply within one business day.
 *
 * Every ticket has a private link (/support/{token}). Staff answers are
 * emailed in full with that link, where the person reads the conversation
 * and replies - signed in or not. Signed in, they can also reply on /contact.
 */

const SITE = (process.env.SITE_URL ?? "https://formkit.app").replace(/\/$/, "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HOUR = 3600_000;

const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, "0")).join("");
export const ticketLink = (token: string) => `${SITE}/support/${token}`;

function clean(subject: string, body: string) {
  const s = subject.trim().slice(0, 140);
  const b = body.trim().slice(0, 5000);
  if (!s || !b) throw new ConvexError("Add a subject and say what is happening.");
  return { s, b };
}

const shown = (t: Doc<"tickets">) => ({
  _id: t._id,
  subject: t.subject,
  state: t.state,
  openedAt: t.openedAt,
  messages: t.messages,
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const rows = await ctx.db
      .query("tickets")
      .withIndex("by_user_opened", (q) => q.eq("userId", me._id))
      .order("desc")
      .take(10);
    return {
      priority: await hasFeature(ctx, me, "support.priority"),
      tickets: rows.map(shown),
    };
  },
});

export const open = mutation({
  args: { subject: v.string(), body: v.string() },
  returns: v.id("tickets"),
  handler: async (ctx, { subject, body }) => {
    const me = await requireUser(ctx);
    const { s, b } = clean(subject, body);
    const recent = await ctx.db
      .query("tickets")
      .withIndex("by_user_opened", (q) => q.eq("userId", me._id).gt("openedAt", Date.now() - HOUR))
      .take(5);
    if (recent.length >= 5) throw new ConvexError("That is a lot of tickets in an hour. We will get to the ones you sent.");
    return await ctx.db.insert("tickets", {
      userId: me._id,
      fromName: me.name ?? me.email ?? "Customer",
      fromEmail: me.email ?? "",
      subject: s,
      state: "open",
      messages: [{ who: me.name ?? me.email ?? "Customer", body: b, at: Date.now() }],
      openedAt: Date.now(),
      priority: (await hasFeature(ctx, me, "support.priority")) || undefined,
      token: newToken(),
    });
  },
});

/** /contact without an account: name, address and message. The private link is emailed to them. */
export const openAsGuest = mutation({
  args: { name: v.string(), email: v.string(), subject: v.string(), body: v.string(), trap: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { name, email, subject, body, trap }) => {
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address) || address.length > 254) throw new ConvexError("That does not look like an email address.");
    const { s, b } = clean(subject, body);
    // Only a script fills in the hidden field: it is told it worked, and nothing is kept.
    if (trap) return null;
    if (!(await allow(ctx, `ticket:${address}`, { max: 3, windowMs: HOUR }))) {
      throw new ConvexError("We have your messages from this address. We will answer them before long.");
    }
    if (!(await allow(ctx, "ticket:guests", { max: 120, windowMs: HOUR }))) {
      throw new ConvexError("A lot of messages are arriving just now. Try again in a little while, or email support@formkit.app.");
    }
    const who = name.trim().slice(0, 80) || address;
    const ticketId = await ctx.db.insert("tickets", {
      fromName: who,
      fromEmail: address,
      subject: s,
      state: "open",
      messages: [{ who, body: b, at: Date.now() }],
      openedAt: Date.now(),
      token: newToken(),
    });
    await ctx.scheduler.runAfter(0, internal.support.emailReceived, { ticketId });
    return null;
  },
});

async function addReply(ctx: MutationCtx, t: Doc<"tickets">, who: string, body: string) {
  const b = body.trim().slice(0, 5000);
  if (!b) return;
  if (t.messages.length >= 100) throw new ConvexError("This conversation is very long. Start a new message on formkit.app/contact.");
  await ctx.db.patch(t._id, { messages: [...t.messages, { who, body: b, at: Date.now() }], state: "open" });
}

export const reply = mutation({
  args: { ticketId: v.id("tickets"), body: v.string() },
  returns: v.null(),
  handler: async (ctx, { ticketId, body }) => {
    const me = await requireUser(ctx);
    const t = await ctx.db.get(ticketId);
    if (!t || t.userId !== me._id) throw new ConvexError("That ticket is not yours.");
    await addReply(ctx, t, me.name ?? me.email ?? "Customer", body);
    return null;
  },
});

async function byToken(ctx: { db: QueryCtx["db"] }, token: string) {
  if (!/^[0-9a-f]{40}$/.test(token)) return null;
  return await ctx.db
    .query("tickets")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

/** The conversation behind a private link. */
export const thread = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const t = await byToken(ctx, token);
    return t ? shown(t) : null;
  },
});

export const replyByToken = mutation({
  args: { token: v.string(), body: v.string() },
  returns: v.null(),
  handler: async (ctx, { token, body }) => {
    const t = await byToken(ctx, token);
    if (!t) throw new ConvexError("That conversation is not here any more.");
    if (!(await allow(ctx, `ticket-reply:${t._id}`, { max: 20, windowMs: HOUR }))) {
      throw new ConvexError("That is a lot of replies in an hour. We will read the ones you sent.");
    }
    await addReply(ctx, t, t.fromName, body);
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Email                                                               */

export const forEmail = internalQuery({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, { ticketId }) => {
    const t = await ctx.db.get(ticketId);
    if (!t?.token) return null;
    const user = t.userId ? await ctx.db.get(t.userId) : null;
    const to = user?.email ?? t.fromEmail;
    if (!to) return null;
    const last = t.messages[t.messages.length - 1];
    return { to, subject: t.subject, token: t.token, last: last ?? null };
  },
});

/** A staff answer, emailed in full with the link back (admin.replyToTicket). */
export const emailAnswer = internalAction({
  args: { ticketId: v.id("tickets") },
  returns: v.null(),
  handler: async (ctx, { ticketId }) => {
    const m: { to: string; subject: string; token: string; last: { who: string; body: string } | null } | null = await ctx.runQuery(
      internal.support.forEmail,
      { ticketId },
    );
    if (!m?.last) return null;
    const link = ticketLink(m.token);
    await send({
      to: [m.to],
      subject: `Re: ${m.subject}`,
      replyTo: "support@formkit.app",
      html: renderSupportAnswer({ subject: m.subject, who: m.last.who, body: m.last.body, link }),
      text: `${m.last.who} from Formkit support:\n\n${m.last.body}\n\nReply or read the conversation: ${link}\nAnyone with this link can read and reply, so keep it to yourself.`,
    });
    return null;
  },
});

export const emailReceived = internalAction({
  args: { ticketId: v.id("tickets") },
  returns: v.null(),
  handler: async (ctx, { ticketId }) => {
    const m: { to: string; subject: string; token: string } | null = await ctx.runQuery(internal.support.forEmail, { ticketId });
    if (!m) return null;
    const link = ticketLink(m.token);
    await send({
      to: [m.to],
      subject: `We have your message: ${m.subject}`,
      html: renderSupportReceived({ subject: m.subject, link }),
      text: `We have your message, “${m.subject}”. A person reads every one, and the answer comes to this address.\n\nThe conversation: ${link}\nAnyone with this link can read and reply, so keep it to yourself.`,
    });
    return null;
  },
});

/** Tickets from before private links get one when they are first answered. */
export async function ensureToken(ctx: MutationCtx, ticketId: Id<"tickets">) {
  const t = await ctx.db.get(ticketId);
  if (t && !t.token) await ctx.db.patch(ticketId, { token: newToken() });
}
