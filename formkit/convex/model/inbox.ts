import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Putting something in a person's bell.
 *
 * Every kind belongs to a group the person can switch off under Settings →
 * Notifications → In the app. Replies and mentions also schedule an email,
 * sent only if the row is still unread ten minutes later.
 */

export type InboxKind =
  | "invited"
  | "role"
  | "removed"
  | "joined"
  | "comment"
  | "reply"
  | "mention"
  | "resolved"
  | "response"
  | "closed"
  | "published"
  | "unpublished"
  | "locked"
  | "security"
  | "ai"
  | "support"
  | "approval"
  | "approved"
  | "declined"
  | "team";

type Group = "sharing" | "comments" | "responses" | "sharedResponses" | "forms" | "security" | null;

const GROUP: Record<InboxKind, Group> = {
  invited: "sharing",
  role: "sharing",
  removed: "sharing",
  joined: "sharing",
  comment: "comments",
  reply: "comments",
  mention: "comments",
  resolved: "comments",
  response: "responses",
  closed: "forms",
  published: "forms",
  unpublished: "forms",
  // A lock by Formkit is not something anyone should miss.
  locked: null,
  security: "security",
  ai: null,
  support: null,
  approval: null,
  approved: "forms",
  declined: null,
  team: "sharing",
};

const EMAIL_AFTER_MS = 10 * 60 * 1000;

export function wants(user: Doc<"users">, group: Group) {
  if (!group) return true;
  const p = user.inAppPrefs ?? {};
  if (group === "sharedResponses") return p.sharedResponses === true;
  return p[group] !== false;
}

export async function notify(
  ctx: MutationCtx,
  userId: Id<"users">,
  item: {
    kind: InboxKind;
    title: string;
    body?: string;
    href?: string;
    action?: string;
    icon?: string;
    formId?: Id<"forms">;
    commentId?: Id<"comments">;
    actorId?: Id<"users">;
  },
  group: Group = GROUP[item.kind],
) {
  // Nobody is told about what they did themselves.
  if (item.actorId && item.actorId === userId) return null;
  const user = await ctx.db.get(userId);
  if (!user || user.deactivatedAt || !wants(user, group)) return null;
  const id = await ctx.db.insert("inbox", { ...item, userId, at: Date.now() });
  if ((item.kind === "reply" || item.kind === "mention") && user.emailPrefs?.comments !== false && user.email) {
    await ctx.scheduler.runAfter(EMAIL_AFTER_MS, internal.inbox.emailIfUnread, { inboxId: id });
  }
  return id;
}

/**
 * A complete response: the owner hears about it, and so does anyone the form
 * is shared with who can read responses and asked to. Unread rows for the same
 * form are counted up rather than repeated.
 */
export async function notifyResponse(ctx: MutationCtx, form: Doc<"forms">, response: Doc<"responses">) {
  const who = response.respondentName ?? response.respondentEmail ?? "Someone";
  const people = await ctx.db
    .query("collaborators")
    .withIndex("by_form", (q) => q.eq("formId", form._id))
    .collect();
  const targets: { userId: Id<"users">; group: Group }[] = [{ userId: form.ownerId, group: "responses" }];
  for (const p of people) {
    if (p.status === "active" && p.userId && p.role !== "commenter") {
      targets.push({ userId: p.userId, group: "sharedResponses" });
    }
  }
  for (const t of targets) {
    const user = await ctx.db.get(t.userId);
    if (!user || user.deactivatedAt || !wants(user, t.group)) continue;
    const open = (
      await ctx.db
        .query("inbox")
        .withIndex("by_user_form_kind", (q) => q.eq("userId", t.userId).eq("formId", form._id).eq("kind", "response"))
        .collect()
    ).find((r) => r.readAt === undefined);
    if (open) {
      const count = (open.count ?? 1) + 1;
      await ctx.db.patch(open._id, {
        title: `${count} new responses to ${form.title}`,
        body: `The latest from ${who}.`,
        href: `/app/forms/${form._id}?tab=responses`,
        action: "View responses",
        count,
        responseId: response._id,
        at: Date.now(),
      });
    } else {
      await ctx.db.insert("inbox", {
        userId: t.userId,
        kind: "response",
        title: `New response to ${form.title}`,
        body: `${who} sent their answers.`,
        href: `/app/forms/${form._id}?tab=responses&open=${response._id}`,
        action: "View response",
        icon: "inbox",
        formId: form._id,
        responseId: response._id,
        count: 1,
        at: Date.now(),
      });
    }
  }
}

/** Everyone on a form - owner and active collaborators - except one person. */
export async function peopleOn(ctx: MutationCtx, form: Doc<"forms">, except?: Id<"users">) {
  const rows = await ctx.db
    .query("collaborators")
    .withIndex("by_form", (q) => q.eq("formId", form._id))
    .collect();
  const ids = new Set<Id<"users">>([form.ownerId]);
  for (const r of rows) if (r.status === "active" && r.userId) ids.add(r.userId);
  if (except) ids.delete(except);
  return { ids: [...ids], rows };
}

export function nameOf(user: Doc<"users"> | null) {
  return user?.name?.trim() || user?.email || "Someone";
}

/**
 * Something happened to a form as a whole - it went live, came down, or
 * closed. The owner and its Editors hear about it, except whoever did it.
 */
export async function tellFormTeam(
  ctx: MutationCtx,
  form: Doc<"forms">,
  item: Omit<Parameters<typeof notify>[2], "formId">,
) {
  const rows = await ctx.db
    .query("collaborators")
    .withIndex("by_form", (q) => q.eq("formId", form._id))
    .collect();
  const to = new Set<Id<"users">>([form.ownerId]);
  for (const r of rows) if (r.status === "active" && r.userId && r.role === "editor") to.add(r.userId);
  for (const userId of to) await notify(ctx, userId, { ...item, formId: form._id });
}

/** Why a form closed itself, in the words the notice uses. */
export function closedReason(form: Doc<"forms">, now: number) {
  const c = form.closing;
  if (c?.closeAfter !== undefined && form.responsesCount >= c.closeAfter) {
    return `It reached its limit of ${c.closeAfter.toLocaleString("en-US")} responses.`;
  }
  if (c?.closeAt !== undefined && c.closeAt <= now) return "Its closing time arrived.";
  return "Its closing rule took effect.";
}
