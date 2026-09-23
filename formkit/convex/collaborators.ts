import { v } from "convex/values";
import { internalAction, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./model/identity";
import { formFor } from "./model/forms";
import { accessOf, colourFor, logActivity, token } from "./model/access";
import { renderInvite } from "./emails/response";
import { nameOf, notify } from "./model/inbox";
import type { Doc } from "./_generated/dataModel";
import { send } from "./notifications";

/**
 * People on a form.
 *
 * This is the second of the three separate things sharing means. Collaborators
 * owns *people* — who can edit, comment or read. The public link belongs to the
 * Share panel, and the shape of that link belongs to a claimed handle. None of
 * the three is a switch inside another.
 *
 * An Editor edits the form and reads its responses from their own account. A
 * Commenter can leave comments but change nothing. A Viewer reads.
 */

const role = v.union(v.literal("editor"), v.literal("commenter"), v.literal("viewer"));
const SITE = process.env.SITE_URL ?? "https://formkit.app";
const ONLINE_MS = 45_000;
const JOIN_DAYS = 7;

const ROLE_WORD = { editor: "Editor", commenter: "Commenter", viewer: "Viewer" } as const;
const AS_ROLE = { editor: "an Editor", commenter: "a Commenter", viewer: "a Viewer" } as const;
const ROLE_CAN = {
  editor: "You can edit its questions and read its responses.",
  commenter: "You can read it and leave comments.",
  viewer: "You can read it and its responses.",
} as const;

/** The invited person hears in the app, not only by email. */
async function tellInvited(
  ctx: Parameters<typeof notify>[0],
  userId: Doc<"users">["_id"],
  form: Doc<"forms">,
  role: keyof typeof ROLE_WORD,
  actor: Doc<"users"> | null,
  note?: string,
) {
  await notify(ctx, userId, {
    kind: "invited",
    title: `${nameOf(actor)} added you to ${form.title}`,
    body: `As ${AS_ROLE[role]}. ${ROLE_CAN[role]}${note ? ` “${note}”` : ""}`,
    href: `/app/forms/${form._id}`,
    action: "Open the form",
    icon: "user-plus",
    formId: form._id,
    actorId: actor?._id,
  });
}

/** The owner, and whoever sent the invitation, hear that someone joined. */
async function tellJoined(
  ctx: Parameters<typeof notify>[0],
  form: Doc<"forms">,
  person: Doc<"users">,
  role: keyof typeof ROLE_WORD,
  invitedBy: Doc<"users">["_id"] | undefined,
  how: string,
) {
  const to = new Set([form.ownerId, ...(invitedBy ? [invitedBy] : [])]);
  for (const userId of to) {
    await notify(ctx, userId, {
      kind: "joined",
      title: `${nameOf(person)} joined ${form.title}`,
      body: `As ${AS_ROLE[role]}, ${how}.`,
      href: `/app/forms/${form._id}?open=share`,
      action: "See who has access",
      icon: "user-check",
      formId: form._id,
      actorId: person._id,
    });
  }
}

export const list = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const { form, user, role: myRole } = await accessOf(ctx, formId);
    const owner = await ctx.db.get(form.ownerId);
    const rows = await ctx.db
      .query("collaborators")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    const here = await ctx.db
      .query("presence")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    const now = Date.now();
    const seenOf = (id?: string) => here.find((p) => p.userId === id);

    const describe = (id: string | undefined, fallback: string) => {
      const p = seenOf(id);
      if (!p) return fallback;
      if (now - p.at < ONLINE_MS) return p.blockId ? "Editing a question now" : "Here now";
      return `Last here ${ago(now - p.at)}`;
    };

    return {
      myRole,
      owner: {
        _id: form.ownerId,
        name: owner?.name ?? "The owner",
        email: owner?.email ?? "",
        image: owner?.image ?? null,
        color: colourFor(form.ownerId),
        you: form.ownerId === user._id,
        online: !!seenOf(form.ownerId) && now - seenOf(form.ownerId)!.at < ONLINE_MS,
        seen: form.ownerId === user._id ? "Here now" : describe(form.ownerId, "Owner"),
      },
      people: await Promise.all(
        rows
          .sort((a, b) => a.invitedAt - b.invitedAt)
          .map(async (r) => {
            const person = r.userId ? await ctx.db.get(r.userId) : null;
            const p = seenOf(r.userId);
            return {
              _id: r._id,
              userId: r.userId ?? null,
              email: r.email,
              name: person?.name ?? null,
              image: person?.image ?? null,
              color: colourFor(r.userId ?? r.email),
              role: r.role,
              status: r.status,
              invitedAt: r.invitedAt,
              note: r.note ?? null,
              you: r.userId === user._id,
              online: !!p && now - p.at < ONLINE_MS,
              seen: r.userId === user._id ? "Here now" : describe(r.userId, "Has not opened it yet"),
            };
          }),
      ),
    };
  },
});

function ago(ms: number) {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${Math.max(1, min)} minute${min === 1 ? "" : "s"} ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export const invite = mutation({
  args: {
    formId: v.id("forms"),
    email: v.string(),
    role,
    note: v.optional(v.string()),
  },
  returns: v.id("collaborators"),
  handler: async (ctx, { formId, email, role: theirRole, note }) => {
    const form = await formFor(ctx, formId);
    const me = await requireUser(ctx);
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      throw new Error("That does not look like an email address.");
    }

    const owner = await ctx.db.get(form.ownerId);
    if (owner?.email?.toLowerCase() === address) {
      throw new Error("That is the owner of this form.");
    }

    const already = (
      await ctx.db
        .query("collaborators")
        .withIndex("by_form", (q) => q.eq("formId", formId))
        .collect()
    ).find((r) => r.email === address);
    if (already) throw new Error(`${address} is already on this form.`);

    // If they already have a Formkit account the invitation is live at once;
    // otherwise it waits until they sign in with that address.
    const person = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", address))
      .first();

    const id = await ctx.db.insert("collaborators", {
      formId,
      email: address,
      userId: person?._id,
      role: theirRole,
      status: person ? "active" : "pending",
      invitedAt: Date.now(),
      note: note?.trim() || undefined,
      invitedBy: me._id,
    });
    await logActivity(ctx, formId, me._id, `invited ${address} as ${ROLE_WORD[theirRole]}`, "user-plus");
    if (person) await tellInvited(ctx, person._id, form, theirRole, me, note?.trim() || undefined);
    await ctx.scheduler.runAfter(0, internal.collaborators.sendInvite, { collaboratorId: id });
    return id;
  },
});

/** Send the invitation again, and start its clock over. */
export const resend = mutation({
  args: { collaboratorId: v.id("collaborators") },
  returns: v.null(),
  handler: async (ctx, { collaboratorId }) => {
    const row = await ctx.db.get(collaboratorId);
    if (!row) throw new Error("That invitation is gone.");
    await formFor(ctx, row.formId);
    await ctx.db.patch(collaboratorId, { invitedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.collaborators.sendInvite, { collaboratorId });
    return null;
  },
});

export const forInvite = internalQuery({
  args: { collaboratorId: v.id("collaborators") },
  handler: async (ctx, { collaboratorId }) => {
    const row = await ctx.db.get(collaboratorId);
    if (!row) return null;
    const form = await ctx.db.get(row.formId);
    if (!form) return null;
    const owner = await ctx.db.get(form.ownerId);
    return {
      ownerId: form.ownerId,
      formId: form._id,
      formTitle: form.title,
      inviter: owner?.name ?? owner?.email ?? "Someone",
      to: row.email,
      role: row.role,
      note: row.note,
    };
  },
});

export const sendInvite = internalAction({
  args: { collaboratorId: v.id("collaborators") },
  returns: v.null(),
  handler: async (ctx, { collaboratorId }) => {
    const job = await ctx.runQuery(internal.collaborators.forInvite, { collaboratorId });
    if (!job) return null;
    const subject = `${job.inviter} added you to ${job.formTitle}`;
    const result = await send({
      to: [job.to],
      subject,
      html: renderInvite({
        inviter: job.inviter,
        formTitle: job.formTitle,
        role: job.role,
        note: job.note,
        link: `${SITE}/app/forms/${job.formId}`,
      }),
    });
    await ctx.runMutation(internal.notifications.record, {
      userId: job.ownerId,
      formId: job.formId,
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
  args: { collaboratorId: v.id("collaborators"), role },
  returns: v.null(),
  handler: async (ctx, { collaboratorId, role: theirRole }) => {
    const row = await ctx.db.get(collaboratorId);
    if (!row) throw new Error("That person is no longer on this form.");
    await formFor(ctx, row.formId);
    const me = await requireUser(ctx);
    const form = await ctx.db.get(row.formId);
    await ctx.db.patch(collaboratorId, { role: theirRole });
    if (row.userId && row.status === "active" && row.role !== theirRole && form) {
      await notify(ctx, row.userId, {
        kind: "role",
        title: `${nameOf(me)} made you ${AS_ROLE[theirRole]} on ${form.title}`,
        body: ROLE_CAN[theirRole],
        href: `/app/forms/${form._id}`,
        action: "Open the form",
        icon: "shield",
        formId: form._id,
        actorId: me._id,
      });
    }
    await logActivity(ctx, row.formId, me._id, `made ${row.email} ${ROLE_WORD[theirRole] === "Editor" ? "an Editor" : `a ${ROLE_WORD[theirRole]}`}`, "shield");
    return null;
  },
});

/** Remove someone, or revoke an invitation nobody has taken up yet. */
export const remove = mutation({
  args: { collaboratorId: v.id("collaborators") },
  returns: v.null(),
  handler: async (ctx, { collaboratorId }) => {
    const row = await ctx.db.get(collaboratorId);
    if (!row) return null;
    await formFor(ctx, row.formId);
    const me = await requireUser(ctx);
    const form = await ctx.db.get(row.formId);
    await ctx.db.delete(collaboratorId);
    if (row.userId && row.status === "active" && form) {
      await notify(ctx, row.userId, {
        kind: "removed",
        title: `${nameOf(me)} removed you from ${form.title}`,
        body: "You no longer have access to it. Its owner can add you again.",
        icon: "user-minus",
        actorId: me._id,
      });
    }
    await logActivity(
      ctx,
      row.formId,
      me._id,
      row.status === "pending" ? `revoked the invitation to ${row.email}` : `removed ${row.email}`,
      "user-minus",
    );
    return null;
  },
});

/** A link anyone signed in can use to join, for seven days. */
export const joinLink = mutation({
  args: { formId: v.id("forms"), role },
  returns: v.object({ url: v.string(), expiresAt: v.number() }),
  handler: async (ctx, { formId, role: theirRole }) => {
    await formFor(ctx, formId);
    const me = await requireUser(ctx);
    const now = Date.now();
    const existing = (
      await ctx.db
        .query("joinLinks")
        .withIndex("by_form", (q) => q.eq("formId", formId))
        .collect()
    ).find((l) => l.role === theirRole && l.expiresAt > now + 24 * 60 * 60 * 1000);
    if (existing) return { url: `${SITE}/j/${existing.token}`, expiresAt: existing.expiresAt };
    const t = token();
    const expiresAt = now + JOIN_DAYS * 24 * 60 * 60 * 1000;
    await ctx.db.insert("joinLinks", { formId, token: t, role: theirRole, createdBy: me._id, expiresAt });
    return { url: `${SITE}/j/${t}`, expiresAt };
  },
});

export const joinPreview = query({
  args: { token: v.string() },
  handler: async (ctx, { token: t }) => {
    const link = await ctx.db
      .query("joinLinks")
      .withIndex("by_token", (q) => q.eq("token", t))
      .first();
    if (!link || link.expiresAt < Date.now()) return null;
    const form = await ctx.db.get(link.formId);
    if (!form || form.deletedAt) return null;
    const owner = await ctx.db.get(form.ownerId);
    return { title: form.title, owner: owner?.name ?? "Someone", role: link.role };
  },
});

export const join = mutation({
  args: { token: v.string() },
  returns: v.id("forms"),
  handler: async (ctx, { token: t }) => {
    const me = await requireUser(ctx);
    const link = await ctx.db
      .query("joinLinks")
      .withIndex("by_token", (q) => q.eq("token", t))
      .first();
    if (!link || link.expiresAt < Date.now()) {
      throw new Error("That invite link has expired. Ask for a new one.");
    }
    const form = await ctx.db.get(link.formId);
    if (!form || form.deletedAt) throw new Error("That form no longer exists.");
    if (form.ownerId === me._id) return form._id;

    const rows = await ctx.db
      .query("collaborators")
      .withIndex("by_form", (q) => q.eq("formId", form._id))
      .collect();
    const mine = rows.find((r) => r.userId === me._id || r.email === me.email?.toLowerCase());
    if (mine) {
      if (mine.status !== "active" || !mine.userId) {
        await ctx.db.patch(mine._id, { status: "active", userId: me._id });
      }
      return form._id;
    }
    await ctx.db.insert("collaborators", {
      formId: form._id,
      email: me.email?.toLowerCase() ?? "",
      userId: me._id,
      role: link.role,
      status: "active",
      invitedAt: Date.now(),
      invitedBy: link.createdBy,
    });
    await logActivity(ctx, form._id, me._id, `joined with an invite link as ${ROLE_WORD[link.role]}`, "log-in");
    await tellJoined(ctx, form, me, link.role, link.createdBy, "with an invite link");
    return form._id;
  },
});

/**
 * Invitations sent to an address before its owner had an account become live
 * once they sign in with it. The app calls this on the way in.
 */
export const acceptPending = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    if (!me.email) return 0;
    const rows = await ctx.db
      .query("collaborators")
      .withIndex("by_email", (q) => q.eq("email", me.email!.toLowerCase()))
      .collect();
    let n = 0;
    for (const r of rows) {
      if (r.status === "pending" || !r.userId) {
        await ctx.db.patch(r._id, { status: "active", userId: me._id });
        await logActivity(ctx, r.formId, me._id, "accepted the invitation", "check");
        const form = await ctx.db.get(r.formId);
        if (form && !form.deletedAt) {
          const inviter = r.invitedBy ? await ctx.db.get(r.invitedBy) : await ctx.db.get(form.ownerId);
          await tellInvited(ctx, me._id, form, r.role, inviter, r.note);
          await tellJoined(ctx, form, me, r.role, r.invitedBy, "from your invitation");
        }
        n++;
      }
    }
    return n;
  },
});

/** Forms other people have put this person on, for their own Sharing screen. */
export const sharedWithMe = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user.email) return [];
    const rows = await ctx.db
      .query("collaborators")
      .withIndex("by_email", (q) => q.eq("email", user.email!))
      .collect();

    return Promise.all(
      rows.map(async (r) => {
        const form = await ctx.db.get(r.formId);
        const owner = form ? await ctx.db.get(form.ownerId) : null;
        return {
          _id: r._id,
          formId: r.formId,
          title: form?.title ?? "A form",
          owner: owner?.name ?? owner?.email ?? "Someone",
          role: r.role,
          status: r.status,
        };
      }),
    );
  },
});

/** What has happened on a form, newest first. */
export const activity = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const { user } = await accessOf(ctx, formId);
    const rows = await ctx.db
      .query("activity")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    const sorted = rows.sort((a, b) => b.at - a.at).slice(0, 60);
    const people = new Map<string, { name: string; image: string | null }>();
    for (const r of sorted) {
      if (!people.has(r.userId)) {
        const p = await ctx.db.get(r.userId);
        people.set(r.userId, { name: p?.name ?? p?.email ?? "Someone", image: p?.image ?? null });
      }
    }
    return sorted.map((r) => ({
      _id: r._id,
      who: r.userId === user._id ? "You" : people.get(r.userId)!.name,
      image: people.get(r.userId)!.image,
      color: colourFor(r.userId),
      what: r.what,
      icon: r.icon ?? null,
      at: r.at,
    }));
  },
});

/* ------------------------------------------------------------------ */
/* Settings → Sharing: everyone, across every form                     */
/* ------------------------------------------------------------------ */

async function myShares(ctx: Parameters<typeof requireUser>[0], ownerId: string) {
  const forms = (
    await ctx.db
      .query("forms")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId as never))
      .collect()
  ).filter((f) => !f.deletedAt);
  const rows = [];
  for (const f of forms) {
    const people = await ctx.db
      .query("collaborators")
      .withIndex("by_form", (q) => q.eq("formId", f._id))
      .collect();
    for (const p of people) rows.push({ row: p, form: f });
  }
  return rows;
}

/** A person is their account once they have joined, their email until then. */
function personKey(row: { userId?: string; email: string }) {
  return row.userId ?? `email:${row.email.toLowerCase()}`;
}

export const people = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const shares = await myShares(ctx, me._id);
    const byKey = new Map<
      string,
      {
        key: string;
        name: string | null;
        email: string;
        color: string;
        roles: Set<string>;
        forms: { collaboratorId: string; formId: string; title: string; role: string; status: string }[];
      }
    >();
    for (const { row, form } of shares.filter((s) => s.row.status === "active")) {
      const key = personKey(row);
      let p = byKey.get(key);
      if (!p) {
        const user = row.userId ? await ctx.db.get(row.userId) : null;
        p = {
          key,
          name: user?.name ?? null,
          email: user?.email ?? row.email,
          color: colourFor(row.userId ?? row.email),
          roles: new Set(),
          forms: [],
        };
        byKey.set(key, p);
      }
      p.roles.add(row.role);
      p.forms.push({ collaboratorId: row._id, formId: form._id, title: form.title, role: row.role, status: row.status });
    }
    const pending = shares
      .filter((s) => s.row.status === "pending")
      .map(({ row, form }) => ({
        _id: row._id,
        email: row.email,
        role: row.role,
        formId: form._id,
        formTitle: form.title,
        invitedAt: row.invitedAt,
      }))
      .sort((a, b) => b.invitedAt - a.invitedAt);
    return {
      people: [...byKey.values()].map((p) => ({
        key: p.key,
        name: p.name,
        email: p.email,
        color: p.color,
        role: p.roles.size === 1 ? [...p.roles][0]! : "mixed",
        forms: p.forms,
      })),
      pending,
    };
  },
});

export const setRoleEverywhere = mutation({
  args: { key: v.string(), role },
  returns: v.number(),
  handler: async (ctx, { key, role: theirRole }) => {
    const me = await requireUser(ctx);
    let n = 0;
    for (const { row, form } of await myShares(ctx, me._id)) {
      if (personKey(row) !== key || row.role === theirRole) continue;
      await ctx.db.patch(row._id, { role: theirRole });
      await logActivity(ctx, form._id, me._id, `made ${row.email} ${ROLE_WORD[theirRole]}`, "user-cog");
      if (row.userId && row.status === "active") {
        await notify(ctx, row.userId, {
          kind: "role",
          title: `${nameOf(me)} made you ${AS_ROLE[theirRole]} on ${form.title}`,
          body: ROLE_CAN[theirRole],
          href: `/app/forms/${form._id}`,
          action: "Open the form",
          icon: "shield",
          formId: form._id,
          actorId: me._id,
        });
      }
      n++;
    }
    return n;
  },
});

export const removeEverywhere = mutation({
  args: { key: v.string() },
  returns: v.number(),
  handler: async (ctx, { key }) => {
    const me = await requireUser(ctx);
    let n = 0;
    for (const { row, form } of await myShares(ctx, me._id)) {
      if (personKey(row) !== key) continue;
      await ctx.db.delete(row._id);
      await logActivity(ctx, form._id, me._id, `removed ${row.email}`, "user-minus");
      if (row.userId && row.status === "active") {
        await notify(ctx, row.userId, {
          kind: "removed",
          title: `${nameOf(me)} removed you from ${form.title}`,
          body: "You no longer have access to it. Its owner can add you again.",
          icon: "user-minus",
          actorId: me._id,
        });
      }
      n++;
    }
    return n;
  },
});
