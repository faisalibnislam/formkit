import { ConvexError, v } from "convex/values";
import { internalAction, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./model/identity";
import { nameOf, notify } from "./model/inbox";
import { audit, teamsOf } from "./model/team";
import {
  canManage,
  currentSpace,
  membersOf,
  roleIn,
  seatsOf,
  spaceIdentity,
  spaceKey,
  spacePlanId,
} from "./model/spaces";
import type { SpaceRef } from "./model/plans";
import { PLANS } from "./model/plans";
import { renderTeamInvite } from "./emails/response";
import { send } from "./notifications";

/**
 * A company's members: people who work on every one of its forms. Admins
 * also run the company (members, plan, billing, settings) and approve forms.
 * Members are on every plan; on a paid plan each one is a seat, and the
 * subscription's seat count follows as people join and leave.
 */

const SITE = process.env.SITE_URL ?? "https://formkit.app";
const role = v.union(v.literal("admin"), v.literal("editor"), v.literal("viewer"));
const ROLE_WORD = { admin: "Admin", editor: "Editor", viewer: "Viewer" } as const;
const AS_ROLE = { admin: "an Admin", editor: "an Editor", viewer: "a Viewer" } as const;

const spaceOfRow = (row: Doc<"teamMembers">): SpaceRef => ({ ownerId: row.ownerId, brand: row.companyId ?? "me" });

/** After members change on a paid company, its subscription's seats follow. */
async function seatsChanged(ctx: MutationCtx, space: SpaceRef) {
  if ((await spacePlanId(ctx, space)) === "free") return;
  await ctx.scheduler.runAfter(0, internal.billing.syncSeats, { key: spaceKey(space) });
}

/** Settings → Members: everyone in the company being worked in. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const space = await currentSpace(ctx, me);
    const myRole = await roleIn(ctx, space, me._id);
    const owner = await ctx.db.get(space.ownerId);
    const rows = await membersOf(ctx, space);
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
          me: r.userId === me._id,
        };
      }),
    );
    const plan = await spacePlanId(ctx, space);
    return {
      company: (await spaceIdentity(ctx, space)).name,
      owner: { name: owner?.name ?? null, email: owner?.email ?? null, me: space.ownerId === me._id },
      members: members.sort((a, b) => a.invitedAt - b.invitedAt),
      myRole,
      canManage: canManage(myRole),
      plan,
      seats: await seatsOf(ctx, space),
      pricePerSeat: PLANS[plan].price,
      approvals: !!owner?.approvals,
      // Other companies this person is a member of, for the account page.
      elsewhere: (await teamsOf(ctx, me._id)).length,
    };
  },
});

export const invite = mutation({
  args: { emails: v.array(v.string()), role },
  returns: v.number(),
  handler: async (ctx, { emails, role }) => {
    const me = await requireUser(ctx);
    const space = await currentSpace(ctx, me);
    if (!canManage(await roleIn(ctx, space, me._id))) {
      throw new ConvexError("Only the company’s owner and admins can invite people.");
    }
    const company = (await spaceIdentity(ctx, space)).name;
    const owner = await ctx.db.get(space.ownerId);
    const existing = await membersOf(ctx, space);
    let n = 0;
    for (const raw of emails) {
      const email = raw.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      if (email === owner?.email?.toLowerCase()) continue;
      if (existing.some((r) => r.email === email)) continue;
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();
      const id = await ctx.db.insert("teamMembers", {
        ownerId: space.ownerId,
        companyId: space.brand === "me" ? undefined : space.brand,
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
          title: `${nameOf(me)} added you to ${company}`,
          body: `As ${AS_ROLE[role]}. Pick ${company} from the company menu at the top.`,
          href: `/app?space=${spaceKey(space)}`,
          action: `Open ${company}`,
          icon: "user-plus",
          actorId: me._id,
        });
      }
      await ctx.scheduler.runAfter(0, internal.team.sendInvite, { memberId: id });
      await audit(ctx, space.ownerId, me, `Invited ${email} to ${company} as ${ROLE_WORD[role]}`);
      n++;
    }
    if (n) await seatsChanged(ctx, space);
    return n;
  },
});

export const forInvite = internalQuery({
  args: { memberId: v.id("teamMembers") },
  handler: async (ctx, { memberId }) => {
    const row = await ctx.db.get(memberId);
    if (!row) return null;
    const inviter = row.invitedBy ? await ctx.db.get(row.invitedBy) : await ctx.db.get(row.ownerId);
    const space = spaceOfRow(row);
    return {
      ownerId: row.ownerId,
      to: row.email,
      role: row.role,
      inviter: inviter?.name ?? inviter?.email ?? "Someone",
      company: (await spaceIdentity(ctx, space)).name,
      key: spaceKey(space),
    };
  },
});

export const sendInvite = internalAction({
  args: { memberId: v.id("teamMembers") },
  returns: v.null(),
  handler: async (ctx, { memberId }) => {
    const job: { ownerId: Id<"users">; to: string; role: string; inviter: string; company: string; key: string } | null =
      await ctx.runQuery(internal.team.forInvite, { memberId });
    if (!job) return null;
    const subject = `${job.inviter} added you to ${job.company} on Formkit`;
    const result = await send({
      to: [job.to],
      subject,
      html: renderTeamInvite({
        inviter: job.inviter,
        company: job.company,
        role: job.role,
        link: `${SITE}/app?space=${encodeURIComponent(job.key)}`,
      }),
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

/** The row, and a refusal unless the person runs its company. */
async function managed(ctx: MutationCtx, memberId: Id<"teamMembers">) {
  const row = await ctx.db.get(memberId);
  if (!row) return null;
  const me = await requireUser(ctx);
  const space = spaceOfRow(row);
  if (!canManage(await roleIn(ctx, space, me._id))) {
    throw new ConvexError("Only the company’s owner and admins can do that.");
  }
  return { row, me, space };
}

export const setRole = mutation({
  args: { memberId: v.id("teamMembers"), role },
  returns: v.null(),
  handler: async (ctx, { memberId, role }) => {
    const m = await managed(ctx, memberId);
    if (!m) return null;
    await ctx.db.patch(memberId, { role });
    await audit(ctx, m.space.ownerId, m.me, `Made ${m.row.email} ${AS_ROLE[role]}`);
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
    const space = spaceOfRow(row);
    // Anyone may leave a company; only its owner and admins remove others.
    if (row.userId !== me._id && !canManage(await roleIn(ctx, space, me._id))) {
      throw new ConvexError("Only the company’s owner and admins can remove people.");
    }
    await ctx.db.delete(memberId);
    // Someone who left is taken back to their own company.
    if (row.userId) {
      const gone = await ctx.db.get(row.userId);
      if (gone?.space === spaceKey(space)) await ctx.db.patch(gone._id, { space: undefined });
    }
    const company = (await spaceIdentity(ctx, space)).name;
    await audit(ctx, space.ownerId, me, row.userId === me._id ? `${row.email} left ${company}` : `Removed ${row.email} from ${company}`);
    if (row.status === "active") await seatsChanged(ctx, space);
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
      const space = spaceOfRow(r);
      const company = (await spaceIdentity(ctx, space)).name;
      await notify(ctx, r.ownerId, {
        kind: "team",
        title: `${nameOf(me)} joined ${company}`,
        body: `As ${AS_ROLE[r.role]}.`,
        href: "/app/settings?tab=team",
        action: "See the members",
        icon: "user-check",
        actorId: me._id,
      });
      await audit(ctx, r.ownerId, me, `${me.email} joined ${company}`);
      await seatsChanged(ctx, space);
      n++;
    }
    return n;
  },
});
