import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./model/identity";
import {
  completionRate,
  formFor,
  formIdentity,
  shouldAutoClose,
  themeLogos,
  storedBlock,
  uniqueSlug,
  purgeFormData,
} from "./model/forms";
import { builtinTemplate } from "./model/builtinTemplates";
import { closedReason, nameOf, tellFormTeam } from "./model/inbox";
import { formUrl } from "./model/handles";
import { hashPassword, newSalt, publicSecurity, securityOf } from "./model/security";

const DELETED_WINDOW_DAYS = 60;

/** Version numbers only ever go up, whatever restoring has inserted. */
async function nextVersion(ctx: MutationCtx, formId: Id<"forms">) {
  const rows = await ctx.db
    .query("versions")
    .withIndex("by_form", (q) => q.eq("formId", formId))
    .collect();
  return rows.reduce((n, r) => Math.max(n, r.number), 0) + 1;
}

async function decorate(ctx: Parameters<typeof formUrl>[0], form: Doc<"forms">) {
  const blocks = await ctx.db
    .query("blocks")
    .withIndex("by_form_order", (q) => q.eq("formId", form._id))
    .collect();
  const questions = blocks.filter((b) => b.kind === "field").length;
  const pages = blocks.filter((b) => b.kind === "pagebreak").length + 1;

  return {
    _id: form._id,
    title: form.title,
    slug: form.slug,
    description: form.description ?? null,
    status: form.status,
    brand: form.brand,
    url: await formUrl(ctx, form),
    questions,
    pages,
    responses: form.responsesCount,
    completed: form.completedCount,
    completionRate: completionRate(form),
    liveVersion: form.liveVersion ?? null,
    closesAt: form.closing?.closeAt ?? null,
    closesAfter: form.closing?.closeAfter ?? null,
    deletedAt: form.deletedAt ?? null,
    /** Days left before the bin empties, for the red chip on a deleted row. */
    daysLeft: form.deletedAt
      ? Math.max(
          0,
          DELETED_WINDOW_DAYS -
            Math.floor((Date.now() - form.deletedAt) / (24 * 60 * 60 * 1000)),
        )
      : null,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
  };
}

function countsOf(all: Doc<"forms">[], shared: number) {
  return {
    all: all.filter((f) => !f.deletedAt).length,
    draft: all.filter((f) => !f.deletedAt && f.status === "draft").length,
    published: all.filter((f) => !f.deletedAt && f.status === "published").length,
    closed: all.filter((f) => !f.deletedAt && f.status === "closed").length,
    archived: all.filter((f) => !f.deletedAt && f.status === "archived").length,
    deleted: all.filter((f) => !!f.deletedAt).length,
    shared,
  };
}

export const list = query({
  args: {
    filter: v.optional(
      v.union(
        v.literal("all"),
        v.literal("draft"),
        v.literal("published"),
        v.literal("closed"),
        v.literal("archived"),
        v.literal("deleted"),
        v.literal("shared"),
      ),
    ),
    search: v.optional(v.string()),
  },
  handler: async (ctx, { filter = "all", search }) => {
    const user = await requireUser(ctx);
    const all = await ctx.db
      .query("forms")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    // Forms other people put this person on, live ones only.
    const shares = (
      await ctx.db
        .query("collaborators")
        .withIndex("by_email", (q) => q.eq("email", (user.email ?? "").toLowerCase()))
        .collect()
    ).filter((r) => r.status === "active" && r.userId === user._id);
    const sharedForms: { form: Doc<"forms">; role: string; owner: string }[] = [];
    for (const r of shares) {
      const f = await ctx.db.get(r.formId);
      if (!f || f.deletedAt || f.ownerId === user._id) continue;
      const owner = await ctx.db.get(f.ownerId);
      sharedForms.push({ form: f, role: r.role, owner: owner?.name ?? owner?.email ?? "Someone" });
    }

    const term = search?.trim().toLowerCase();
    if (filter === "shared") {
      const picked = sharedForms
        .filter((s) =>
          term ? `${s.form.title} ${s.form.description ?? ""} ${s.owner}`.toLowerCase().includes(term) : true,
        )
        .sort((a, b) => b.form.updatedAt - a.form.updatedAt);
      return {
        counts: countsOf(all, sharedForms.length),
        forms: await Promise.all(
          picked.map(async (s) => ({ ...(await decorate(ctx, s.form)), sharedAs: { role: s.role, owner: s.owner } })),
        ),
      };
    }
    const rows = all
      .filter((f) => (filter === "deleted" ? !!f.deletedAt : !f.deletedAt))
      .filter((f) => (filter === "all" || filter === "deleted" ? true : f.status === filter))
      .filter((f) =>
        term ? `${f.title} ${f.description ?? ""}`.toLowerCase().includes(term) : true,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);

    return {
      counts: countsOf(all, sharedForms.length),
      forms: await Promise.all(
        rows.map(async (f) => ({ ...(await decorate(ctx, f)), sharedAs: null as { role: string; owner: string } | null })),
      ),
    };
  },
});

/**
 * What the app's header needs on every page: how many forms in each state and
 * the lifetime response total. Read from the form rows alone — never their
 * questions — so editing a question does not make every page recount.
 */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const all = await ctx.db
      .query("forms")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    const shared = (
      await ctx.db
        .query("collaborators")
        .withIndex("by_email", (q) => q.eq("email", (user.email ?? "").toLowerCase()))
        .collect()
    ).filter((r) => r.status === "active" && r.userId === user._id).length;
    const live = all.filter((f) => !f.deletedAt);
    return {
      counts: countsOf(all, shared),
      responses: live.reduce((n, f) => n + f.responsesCount, 0),
    };
  },
});

/** Titles to pick from — Ask Formkit's menus — without reading any questions. */
export const picker = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return (
      await ctx.db
        .query("forms")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect()
    )
      .filter((f) => !f.deletedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((f) => ({ _id: f._id, title: f.title, status: f.status, responses: f.responsesCount }));
  },
});

export const get = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId, "read");
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_form_order", (q) => q.eq("formId", formId))
      .collect();
    const rules = await ctx.db
      .query("logicRules")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();

    return {
      ...(await decorate(ctx, form)),
      welcome: form.welcome ?? null,
      thanks: form.thanks ?? null,
      theme: form.theme ?? null,
      logos: await themeLogos(ctx, form.theme),
      identity: await formIdentity(ctx, form),
      notify: form.notify ?? null,
      security: publicSecurity(form.security),
      closing: form.closing ?? null,
      blocks: blocks.sort((a, b) => a.order - b.order),
      rules: rules.sort((a, b) => a.order - b.order),
    };
  },
});

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    templateSlug: v.optional(v.string()),
    brand: v.optional(v.union(v.literal("me"), v.id("companies"))),
  },
  returns: v.id("forms"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // A saved template is a row; the six Formkit ships with live in code, so
    // they exist on a brand-new deployment with nothing seeded.
    // Only the person's own saved templates, or a built-in one.
    const saved = args.templateSlug
      ? (
          await ctx.db
            .query("templates")
            .withIndex("by_slug", (q) => q.eq("slug", args.templateSlug!))
            .collect()
        ).find((t) => t.ownerId === user._id)
      : undefined;
    const template = args.templateSlug ? (saved ?? builtinTemplate(args.templateSlug)) : null;

    const title = args.title?.trim() || template?.name || "Untitled form";

    // A new form defaults to the one company with "use branding" on, otherwise
    // to the person — identity is person-first.
    let brand = args.brand;
    if (!brand) {
      const companies = await ctx.db
        .query("companies")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect();
      const branded = companies.find((c) => c.useBranding);
      brand = branded ? branded._id : "me";
    }

    const formId = await ctx.db.insert("forms", {
      ownerId: user._id,
      brand,
      title,
      slug: await uniqueSlug(ctx, title),
      status: "draft",
      welcome: template?.welcome ?? {
        title: "Let's start your project",
        message: "A few questions — it should take about two minutes.",
        button: "Start",
      },
      thanks: template?.thanks ?? {
        title: "Thank you",
        message: "Your answers are in. We will be in touch.",
      },
      theme: (template && "theme" in template ? template.theme : null) ?? null,
      responsesCount: 0,
      completedCount: 0,
      views: 0,
      starts: 0,
      createdAt: now,
      updatedAt: now,
    });

    const blocks = (template?.blocks as unknown[] | undefined) ?? [];
    const ids: Id<"blocks">[] = [];
    for (const [i, block] of blocks.entries()) {
      ids.push(await ctx.db.insert("blocks", { ...storedBlock(block), formId, order: i }));
    }

    // Logic travels by position, and is re-pointed at the new questions.
    const rules = ((template && "rules" in template ? template.rules : undefined) ?? []) as {
      name: string;
      enabled: boolean;
      join: "and" | "or";
      action: "show" | "hide" | "require" | "jump";
      targetIndex: number | null;
      conditions: { index: number | null; operator: string; value?: string }[];
    }[];
    for (const [i, r] of rules.entries()) {
      await ctx.db.insert("logicRules", {
        formId,
        name: r.name,
        enabled: r.enabled,
        join: r.join,
        action: r.action,
        targetId: r.targetIndex !== null ? ids[r.targetIndex] : undefined,
        conditions: r.conditions.map((c) => ({
          blockId: c.index !== null ? ids[c.index] : undefined,
          operator: c.operator,
          value: c.value,
        })),
        order: i,
      });
    }

    await ctx.db.insert("activity", {
      formId,
      userId: user._id,
      what: template ? `created the form from the ${template.name} template` : "created the form",
      at: now,
    });

    return formId;
  },
});

export const update = mutation({
  args: {
    formId: v.id("forms"),
    patch: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      brand: v.optional(v.union(v.literal("me"), v.id("companies"))),
      welcome: v.optional(v.any()),
      thanks: v.optional(v.any()),
      theme: v.optional(v.any()),
      notify: v.optional(v.any()),
      closing: v.optional(v.any()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { formId, patch }) => {
    await formFor(ctx, formId);
    await ctx.db.patch(formId, { ...patch, updatedAt: Date.now() });
    return null;
  },
});

/**
 * Merge keys into one of a form's settings objects — theme, notify, welcome,
 * thanks — on the server, so two quick changes to different keys never
 * overwrite each other the way two whole-object writes would.
 */
export const patchSettings = mutation({
  args: {
    formId: v.id("forms"),
    key: v.union(
      v.literal("theme"),
      v.literal("notify"),
      v.literal("welcome"),
      v.literal("thanks"),
      v.literal("security"),
    ),
    patch: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, { formId, key, patch }) => {
    const form = await formFor(ctx, formId);
    if (key === "security") {
      // The password goes through setPassword, which hashes it.
      const p = patch as Record<string, unknown>;
      delete p.passwordHash;
      delete p.passwordSalt;
      delete p.password;
    }
    const current = ((form as Record<string, unknown>)[key] ?? {}) as Record<string, unknown>;
    await ctx.db.patch(formId, {
      [key]: { ...current, ...(patch as Record<string, unknown>) },
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Set, change or clear the password a form asks for. Only its hash is kept. */
export const setPassword = mutation({
  args: { formId: v.id("forms"), password: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { formId, password }) => {
    const form = await formFor(ctx, formId);
    const current = securityOf(form.security);
    const clean = password?.trim();
    if (clean !== undefined && clean.length < 4) {
      throw new Error("Use at least four characters, so it is not guessed on the first try.");
    }
    const salt = newSalt();
    await ctx.db.patch(formId, {
      security: clean
        ? { ...current, password: true, passwordSalt: salt, passwordHash: await hashPassword(clean, salt) }
        : { ...current, password: false, passwordHash: undefined, passwordSalt: undefined },
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Publishing snapshots the questions. Closing is a separate thing: it stops new
 * answers but keeps the form live. Unpublishing takes it back to draft and
 * keeps every response.
 */
export const publish = mutation({
  args: { formId: v.id("forms") },
  returns: v.null(),
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId);
    const user = await requireUser(ctx);
    const now = Date.now();

    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_form_order", (q) => q.eq("formId", formId))
      .collect();

    const number = await nextVersion(ctx, formId);
    await ctx.db.insert("versions", {
      formId,
      number,
      label: number === 1 ? "First published" : "Published changes",
      blocks: blocks.sort((a, b) => a.order - b.order),
      publishedAt: now,
      publishedBy: user.name ?? user.email ?? "You",
    });

    await ctx.db.patch(formId, {
      status: "published",
      liveVersion: number,
      updatedAt: now,
    });
    await ctx.db.insert("activity", {
      formId,
      userId: user._id,
      what: number === 1 ? "published the form" : `published version ${number}`,
      at: now,
    });
    await tellFormTeam(ctx, form, {
      kind: "published",
      title: `${nameOf(user)} published ${form.title}`,
      body: number === 1 ? "It is live and taking answers." : `Version ${number} is live.`,
      href: `/app/forms/${formId}`,
      action: "Open the form",
      icon: "globe",
      actorId: user._id,
    });
    return null;
  },
});

export const unpublish = mutation({
  args: { formId: v.id("forms") },
  returns: v.null(),
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId);
    const user = await requireUser(ctx);
    await ctx.db.patch(formId, { status: "draft", updatedAt: Date.now() });
    await tellFormTeam(ctx, form, {
      kind: "unpublished",
      title: `${nameOf(user)} unpublished ${form.title}`,
      body: "It is a draft again. Its responses are kept.",
      href: `/app/forms/${formId}`,
      action: "Open the form",
      icon: "eye-off",
      actorId: user._id,
    });
    await ctx.db.insert("activity", {
      formId,
      userId: user._id,
      what: "unpublished the form — responses kept",
      at: Date.now(),
    });
    return null;
  },
});

export const setClosing = mutation({
  args: {
    formId: v.id("forms"),
    closeNow: v.optional(v.boolean()),
    reopen: v.optional(v.boolean()),
    closing: v.optional(
      v.object({
        message: v.optional(v.string()),
        /** null switches the rule off. */
        closeAt: v.optional(v.union(v.number(), v.null())),
        closeAfter: v.optional(v.union(v.number(), v.null())),
        timezone: v.optional(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { formId, closeNow, reopen, closing }) => {
    const form = await formFor(ctx, formId);
    const user = await requireUser(ctx);
    const now = Date.now();

    const merged: Record<string, unknown> = { ...(form.closing ?? {}), ...(closing ?? {}) };
    for (const k of Object.keys(merged)) if (merged[k] === null) delete merged[k];
    const next = merged as NonNullable<Doc<"forms">["closing"]>;

    if (closeNow) {
      await ctx.db.patch(formId, {
        status: "closed",
        closing: { ...next, closedBy: "you", closedAt: now },
        updatedAt: now,
      });
      await ctx.db.insert("activity", {
        formId,
        userId: user._id,
        what: "closed the form",
        at: now,
      });
      await tellFormTeam(ctx, form, {
        kind: "closed",
        title: `${nameOf(user)} closed ${form.title}`,
        body: "It has stopped taking answers. Everything collected is kept.",
        href: `/app/forms/${formId}`,
        action: "Open the form",
        icon: "lock",
        actorId: user._id,
      });
      return null;
    }

    if (reopen) {
      // A rule that has already elapsed is switched off, or the form would
      // close again the moment it reopened.
      const elapsed = next.closeAt !== undefined && next.closeAt <= now;
      const full = next.closeAfter !== undefined && form.responsesCount >= next.closeAfter;
      await ctx.db.patch(formId, {
        status: "published",
        closing: {
          ...next,
          closeAt: elapsed ? undefined : next.closeAt,
          closeAfter: full ? undefined : next.closeAfter,
          closedBy: undefined,
          closedAt: undefined,
        },
        updatedAt: now,
      });
      await ctx.db.insert("activity", {
        formId,
        userId: user._id,
        what: "reopened the form",
        at: now,
      });
      await tellFormTeam(ctx, form, {
        kind: "published",
        title: `${nameOf(user)} reopened ${form.title}`,
        body: "It is taking answers again at the same link.",
        href: `/app/forms/${formId}`,
        action: "Open the form",
        icon: "lock-open",
        actorId: user._id,
      });
      return null;
    }

    await ctx.db.patch(formId, { closing: next, updatedAt: now });
    return null;
  },
});

/** Put a form away, or bring it back as a draft. Everything in it is kept. */
export const archive = mutation({
  args: { formId: v.id("forms"), archived: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { formId, archived }) => {
    await formFor(ctx, formId);
    const user = await requireUser(ctx);
    await ctx.db.patch(formId, { status: archived ? "archived" : "draft", updatedAt: Date.now() });
    await ctx.db.insert("activity", {
      formId,
      userId: user._id,
      what: archived ? "archived the form" : "restored the form from the archive",
      icon: "archive",
      at: Date.now(),
    });
    return null;
  },
});

/** Deleting moves a form to the bin, where it sits for 60 days. */
export const softDelete = mutation({
  args: { formId: v.id("forms") },
  returns: v.null(),
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId);
    const me = await requireUser(ctx);
    if (form.ownerId !== me._id) throw new Error("Only the owner can delete or restore a form.");
    await ctx.db.patch(formId, { deletedAt: Date.now(), updatedAt: Date.now() });
    return null;
  },
});

export const restore = mutation({
  args: { formId: v.id("forms") },
  returns: v.null(),
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId);
    const me = await requireUser(ctx);
    if (form.ownerId !== me._id) throw new Error("Only the owner can delete or restore a form.");
    await ctx.db.patch(formId, { deletedAt: undefined, updatedAt: Date.now() });
    return null;
  },
});

export const purge = mutation({
  args: { formId: v.optional(v.id("forms")), all: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { formId, all }) => {
    const user = await requireUser(ctx);

    const targets = all
      ? (
          await ctx.db
            .query("forms")
            .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
            .collect()
        ).filter((f) => f.deletedAt)
      : formId
        ? [await formFor(ctx, formId)]
        : [];

    for (const form of targets) {
      // Only the owner empties the bin, and only what is already in it.
      if (form.ownerId !== user._id) throw new Error("Only the owner can delete a form forever.");
      if (!form.deletedAt) throw new Error("Move the form to Deleted first.");
    }

    for (const form of targets) await purgeFormData(ctx, form);
    return null;
  },
});

export const duplicate = mutation({
  args: { formId: v.id("forms") },
  returns: v.id("forms"),
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId, "read");
    const user = await requireUser(ctx);
    const now = Date.now();
    const title = `${form.title} copy`;

    const copyId = await ctx.db.insert("forms", {
      ownerId: user._id,
      brand: form.brand,
      title,
      slug: await uniqueSlug(ctx, title),
      description: form.description,
      status: "draft",
      welcome: form.welcome,
      thanks: form.thanks,
      theme: form.theme,
      notify: form.notify,
      responsesCount: 0,
      completedCount: 0,
      views: 0,
      starts: 0,
      createdAt: now,
      updatedAt: now,
    });

    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_form_order", (q) => q.eq("formId", formId))
      .collect();
    for (const block of blocks) {
      const { _id, _creationTime, formId: _f, ...rest } = block;
      await ctx.db.insert("blocks", { ...rest, formId: copyId });
    }
    return copyId;
  },
});

/** Version history, newest first. */
export const versions = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId, "read");
    const rows = await ctx.db
      .query("versions")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    return rows
      .sort((a, b) => b.number - a.number)
      .map((r) => ({
        _id: r._id,
        number: r.number,
        label: r.label,
        publishedAt: r.publishedAt,
        publishedBy: r.publishedBy ?? null,
        questions: (r.blocks as { kind: string }[]).filter((b) => b.kind === "field").length,
        live: r.number === form.liveVersion,
      }));
  },
});

/** Restoring puts old questions back — and snapshots the current set first. */
export const restoreVersion = mutation({
  args: { versionId: v.id("versions") },
  returns: v.null(),
  handler: async (ctx, { versionId }) => {
    const version = await ctx.db.get(versionId);
    if (!version) throw new Error("That version no longer exists.");
    const form = await formFor(ctx, version.formId);
    const now = Date.now();

    const current = await ctx.db
      .query("blocks")
      .withIndex("by_form_order", (q) => q.eq("formId", form._id))
      .collect();

    const user = await requireUser(ctx);
    await ctx.db.insert("versions", {
      formId: form._id,
      number: await nextVersion(ctx, form._id),
      label: `Before restoring version ${version.number}`,
      blocks: current.sort((a, b) => a.order - b.order),
      publishedAt: now,
      publishedBy: user.name ?? user.email ?? "You",
    });

    for (const block of current) await ctx.db.delete(block._id);
    for (const [i, block] of (version.blocks as unknown[]).entries()) {
      await ctx.db.insert("blocks", { ...storedBlock(block), formId: form._id, order: i });
    }

    await ctx.db.patch(form._id, { updatedAt: now });
    return null;
  },
});

/** How many questions changed since the live version — drives the amber note. */
export const unpublishedChanges = query({
  args: { formId: v.id("forms") },
  returns: v.number(),
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId, "read");
    if (!form.liveVersion) return 0;

    const versions = await ctx.db
      .query("versions")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    const live = versions.find((x) => x.number === form.liveVersion);
    if (!live) return 0;

    const current = await ctx.db
      .query("blocks")
      .withIndex("by_form_order", (q) => q.eq("formId", formId))
      .collect();

    // A question counts once whether it was added, edited or removed.
    const shape = (b: {
      kind?: string;
      title?: string;
      pageName?: string;
      type?: string;
      required?: boolean;
      options?: string[];
    }) =>
      [b.kind, b.type ?? "", b.title ?? b.pageName ?? "", b.required ? 1 : 0, (b.options ?? []).join("|")].join("¦");
    const before = (live.blocks as typeof current).map(shape);
    const after = current.sort((a, b) => a.order - b.order).map(shape);
    const pool = [...before];
    let changed = 0;
    for (const s of after) {
      const i = pool.indexOf(s);
      if (i >= 0) pool.splice(i, 1);
      else changed++;
    }
    // What is left in the pool was removed or replaced; a replacement is
    // already counted above.
    return Math.max(changed, pool.length);
  },
});

/** Auto-closing runs where the owner reads their forms, not on a timer. */
export const sweepClosing = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const forms = await ctx.db
      .query("forms")
      .withIndex("by_owner_status", (q) => q.eq("ownerId", user._id).eq("status", "published"))
      .collect();

    let closed = 0;
    for (const form of forms) {
      if (!shouldAutoClose(form, now)) continue;
      await ctx.db.patch(form._id, {
        status: "closed",
        closing: { ...(form.closing ?? {}), closedBy: "automatically", closedAt: now },
        updatedAt: now,
      });
      await ctx.db.insert("activity", {
        formId: form._id,
        userId: user._id,
        what: "set a closing rule that has now closed the form",
        at: now,
      });
      await tellFormTeam(ctx, form, {
        kind: "closed",
        title: `${form.title} closed itself`,
        body: closedReason(form, now),
        href: `/app/forms/${form._id}`,
        action: "Open the form",
        icon: "lock",
      });
      closed++;
    }
    return closed;
  },
});

/** Every few minutes: closing rules whose date or count has arrived take effect. */
export const sweepAllClosing = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const forms = await ctx.db
      .query("forms")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    let closed = 0;
    for (const form of forms) {
      if (!shouldAutoClose(form, now)) continue;
      await ctx.db.patch(form._id, {
        status: "closed",
        closing: { ...(form.closing ?? {}), closedBy: "automatically", closedAt: now },
        updatedAt: now,
      });
      await ctx.db.insert("activity", {
        formId: form._id,
        userId: form.ownerId,
        what: "set a closing rule that has now closed the form",
        at: now,
      });
      await tellFormTeam(ctx, form, {
        kind: "closed",
        title: `${form.title} closed itself`,
        body: closedReason(form, now),
        href: `/app/forms/${form._id}`,
        action: "Open the form",
        icon: "lock",
      });
      closed++;
    }
    return closed;
  },
});

const BIN_DAYS = 60;

/** Daily: forms in Deleted for 60 days are erased, a few at a time. */
export const purgeExpired = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - BIN_DAYS * 24 * 60 * 60 * 1000;
    const old = await ctx.db
      .query("forms")
      .withIndex("by_deleted", (q) => q.gt("deletedAt", 0).lt("deletedAt", cutoff))
      .take(10);
    for (const form of old) await purgeFormData(ctx, form);
    return old.length;
  },
});
