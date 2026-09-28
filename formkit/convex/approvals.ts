import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./model/identity";
import { formFor } from "./model/forms";
import { nameOf, notify } from "./model/inbox";
import { requireFeature } from "./model/plans";
import { accountManagers, audit, managesAccount, needsApproval } from "./model/team";
import { publishNow } from "./forms";

/**
 * Business: approvals before publishing. With them on, an editor's Publish
 * becomes "Ask for approval"; the owner and the team's admins hear about it
 * and approve — which publishes — or send it back with a note.
 */

export const setEnabled = mutation({
  args: { enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { enabled }) => {
    const me = await requireUser(ctx);
    if (enabled) await requireFeature(ctx, me._id, "approvals");
    await ctx.db.patch(me._id, { approvals: enabled });
    await audit(ctx, me._id, me, enabled ? "Turned on approvals before publishing" : "Turned off approvals");
    return null;
  },
});

export const request = mutation({
  args: { formId: v.id("forms"), note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { formId, note }) => {
    const form = await formFor(ctx, formId);
    const me = await requireUser(ctx);
    if (!(await needsApproval(ctx, form, me._id))) throw new ConvexError("This form can be published without approval.");
    const clean = note?.trim().slice(0, 500) || undefined;
    await ctx.db.patch(formId, { approval: { state: "pending", by: me._id, at: Date.now(), note: clean } });
    for (const userId of await accountManagers(ctx, form.ownerId)) {
      if (userId === me._id) continue;
      await notify(ctx, userId, {
        kind: "approval",
        title: `${nameOf(me)} asked to publish ${form.title}`,
        body: clean ? `“${clean}”` : "Look it over, then approve it to put it live.",
        href: `/app/forms/${formId}`,
        action: "Review the form",
        icon: "badge-check",
        formId,
        actorId: me._id,
      });
    }
    await audit(ctx, form.ownerId, me, "Asked for approval", form.title);
    return null;
  },
});

export const withdraw = mutation({
  args: { formId: v.id("forms") },
  returns: v.null(),
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId);
    await ctx.db.patch(formId, { approval: undefined });
    void form;
    return null;
  },
});

export const approve = mutation({
  args: { formId: v.id("forms") },
  returns: v.null(),
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId);
    const me = await requireUser(ctx);
    if (!(await managesAccount(ctx, form.ownerId, me._id))) throw new ConvexError("Only the owner or a team admin can approve.");
    const asked = form.approval?.by;
    await publishNow(ctx, form, me);
    await audit(ctx, form.ownerId, me, "Approved and published", form.title);
    if (asked && asked !== me._id) {
      await notify(ctx, asked, {
        kind: "approved",
        title: `${nameOf(me)} approved ${form.title}`,
        body: "It is live and taking answers.",
        href: `/app/forms/${formId}`,
        action: "Open the form",
        icon: "badge-check",
        formId,
        actorId: me._id,
      });
    }
    return null;
  },
});

export const decline = mutation({
  args: { formId: v.id("forms"), note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { formId, note }) => {
    const form = await formFor(ctx, formId);
    const me = await requireUser(ctx);
    if (!(await managesAccount(ctx, form.ownerId, me._id))) throw new ConvexError("Only the owner or a team admin can decline.");
    if (!form.approval) return null;
    const clean = note?.trim().slice(0, 500) || undefined;
    await ctx.db.patch(formId, { approval: { state: "declined", by: form.approval.by, at: Date.now(), note: clean } });
    await audit(ctx, form.ownerId, me, "Sent a form back", form.title);
    if (form.approval.by !== me._id) {
      await notify(ctx, form.approval.by, {
        kind: "declined",
        title: `${nameOf(me)} sent ${form.title} back`,
        body: clean ? `“${clean}”` : "It needs changes before it goes live.",
        href: `/app/forms/${formId}`,
        action: "Open the form",
        icon: "message-square",
        formId,
        actorId: me._id,
      });
    }
    return null;
  },
});

/** Forms waiting on this person's approval, across the accounts they run. */
export const waiting = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const owners = [me._id];
    const rows = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    for (const r of rows) if (r.status === "active" && r.role === "admin") owners.push(r.ownerId);
    const out = [];
    for (const ownerId of owners) {
      if (!(await managesAccount(ctx, ownerId, me._id))) continue;
      const forms = await ctx.db
        .query("forms")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect();
      for (const f of forms) {
        if (f.approval?.state !== "pending" || f.deletedAt) continue;
        const by = await ctx.db.get(f.approval.by);
        out.push({ formId: f._id, title: f.title, by: by?.name ?? by?.email ?? "Someone", at: f.approval.at, note: f.approval.note ?? null });
      }
    }
    return out.sort((a, b) => b.at - a.at);
  },
});
