import { ConvexError, v } from "convex/values";
import { internalAction, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./model/identity";
import { nameOf, notify } from "./model/inbox";
import { hasFeature, requireFeature } from "./model/plans";
import { audit, managesAccount, teamsOf } from "./model/team";
import { renderTeamInvite } from "./emails/response";
import { send } from "./notifications";

/**
 * Business teams: unlimited people who work on every one of the account's
 * forms. Admins also run the team, approve forms and see the audit log.
 */

const SITE = process.env.SITE_URL ?? "https://formkit.app";
const role = v.union(v.literal("admin"), v.literal("editor"), v.literal("viewer"));
const ROLE_WORD = { admin: "Admin", editor: "Editor", viewer: "Viewer" } as const;
const AS_ROLE = { admin: "an Admin", editor: "an Editor", viewer: "a Viewer" } as const;

/** The account this person manages the team of: their own, or one they are admin on. */
async function accountFor(ctx: Parameters<typeof requireUser>[0], ownerId: Id<"users"> | undefined) {
  const me = await requireUser(ctx);
  const target = ownerId ?? me._id;
  if (!(await managesAccount(ctx, target, me._id))) throw new ConvexError("Only the owner or a team admin can do that.");
  return { me, ownerId: target };
}

/** Settings → Team. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const rows = await ctx.db
      .query("teamMembers")
      .withIndex("by_owner", (q) => q.eq("ownerId", me._id))
      .collect();
    const members = await Promise.all(
      rows.map(async (r) => {
        const u = r.userId ? await ctx.db.get(r.userId) : null;
        return {
          _id: r._id,
          email: r.email,
          name: u?.name ?? null,
          role: r.role,
          status: r.status,
          invitedAt: r.invitedAt,
        };
      }),
    );
    const teams = (await teamsOf(ctx, me._id)).map(({ row, owner }) => ({
      _id: row._id,
      ownerId: owner._id,
      owner: owner.name ?? owner.email ?? "Someone",
      email: owner.email ?? null,
      role: row.role,
    }));
    return {
      members: members.sort((a, b) => a.invitedAt - b.invitedAt),
      teams,
      approvals: !!me.approvals,
      enabled: await hasFeature(ctx, me, "team"),
    };
  },
});

export const invite = mutation({
  args: { emails: v.array(v.string()), role },
  returns: v.number(),
  handler: async (ctx, { emails, role }) => {
    const me = await requireUser(ctx);
    await requireFeature(ctx, me._id, "team");
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_owner", (q) => q.eq("ownerId", me._id))
      .collect();
    let n = 0;
    for (const raw of emails) {
      const email = raw.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      if (email === me.email?.toLowerCase()) continue;
      if (existing.some((r) => r.email === email)) continue;
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();
      const id = await ctx.db.insert("teamMembers", {
        ownerId: me._id,
        email,
        userId: user?._id,
        role,
        status: user ? "active" : "pending",
        invitedBy: me._id,
        invitedAt: Date.now(),
      });
      if (user) {
        await notify(ctx, user._id, {
          kind: "team",
          title: `${nameOf(me)} added you to their team`,
          body: `As ${AS_ROLE[role]}. Their forms are under Shared.`,
          href: "/app/forms?filter=shared",
          action: "See the forms",
          icon: "user-plus",
          actorId: me._id,
        });
      }
      await ctx.scheduler.runAfter(0, internal.team.sendInvite, { memberId: id });
      await audit(ctx, me._id, me, `Invited ${email} as ${ROLE_WORD[role]}`);
      n++;
    }
    return n;
  },
});

export const forInvite = internalQuery({
  args: { memberId: v.id("teamMembers") },
  handler: async (ctx, { memberId }) => {
    const row = await ctx.db.get(memberId);
    if (!row) return null;
    const owner = await ctx.db.get(row.ownerId);
    return { ownerId: row.ownerId, to: row.email, role: row.role, inviter: owner?.name ?? owner?.email ?? "Someone" };
  },
});

export const sendInvite = internalAction({
  args: { memberId: v.id("teamMembers") },
  returns: v.null(),
  handler: async (ctx, { memberId }) => {
    const job: { ownerId: Id<"users">; to: string; role: string; inviter: string } | null = await ctx.runQuery(
      internal.team.forInvite,
      { memberId },
    );
    if (!job) return null;
    const subject = `${job.inviter} added you to their team on Formkit`;
    const result = await send({
      to: [job.to],
      subject,
      html: renderTeamInvite({ inviter: job.inviter, role: job.role, link: `${SITE}/app/forms?filter=shared` }),
    });
    await ctx.runMutation(internal.notifications.record, {
      userId: job.ownerId,
      kind: "invitation",
      to: job.to,
      subject,
      state: result.state,
      detail: result.detail,
    });
    return null;
  },
});

export const setRole = mutation({
  args: { memberId: v.id("teamMembers"), role },
  returns: v.null(),
  handler: async (ctx, { memberId, role }) => {
    const row = await ctx.db.get(memberId);
    if (!row) return null;
    const { me } = await accountFor(ctx, row.ownerId);
    await ctx.db.patch(memberId, { role });
    await audit(ctx, row.ownerId, me, `Made ${row.email} ${AS_ROLE[role]}`);
    return null;
  },
});

export const remove = mutation({
  args: { memberId: v.id("teamMembers") },
  returns: v.null(),
  handler: async (ctx, { memberId }) => {
    const row = await ctx.db.get(memberId);
    if (!row) return null;
    const me = await requireUser(ctx);
    // Anyone may leave a team; only its managers remove others.
    if (row.userId !== me._id) await accountFor(ctx, row.ownerId);
    await ctx.db.delete(memberId);
    await audit(ctx, row.ownerId, me, row.userId === me._id ? `${row.email} left the team` : `Removed ${row.email} from the team`);
    return null;
  },
});

/** On sign-in: invitations sent to this address before the account existed. */
export const acceptPending = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    if (!me.email) return 0;
    const rows = await ctx.db
      .query("teamMembers")
      .withIndex("by_email", (q) => q.eq("email", me.email!.toLowerCase()))
      .collect();
    let n = 0;
    for (const r of rows) {
      if (r.status !== "pending" && r.userId) continue;
      await ctx.db.patch(r._id, { status: "active", userId: me._id });
      await notify(ctx, r.ownerId, {
        kind: "team",
        title: `${nameOf(me)} joined your team`,
        body: `As ${AS_ROLE[r.role]}.`,
        href: "/app/settings?tab=team",
        action: "See the team",
        icon: "user-check",
        actorId: me._id,
      });
      await audit(ctx, r.ownerId, me, `${me.email} joined the team`);
      n++;
    }
    return n;
  },
});
