import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requireUser } from "./model/identity";
import {
  completionRate,
  formFor,
  formIdentity,
  shouldAutoClose,
  themeLogos,
  storedBlock,
  uniqueSlug,
} from "./model/forms";
import { builtinTemplate } from "./model/builtinTemplates";
import { formUrl } from "./model/handles";

const DELETED_WINDOW_DAYS = 60;

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

export const list = query({
  args: {
    filter: v.optional(
      v.union(
        v.literal("all"),
        v.literal("draft"),
        v.literal("published"),
        v.literal("closed"),
        v.literal("deleted"),
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

    const term = search?.trim().toLowerCase();
    const rows = all
      .filter((f) => (filter === "deleted" ? !!f.deletedAt : !f.deletedAt))
      .filter((f) => (filter === "all" || filter === "deleted" ? true : f.status === filter))
      .filter((f) => (term ? f.title.toLowerCase().includes(term) : true))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const counts = {
      all: all.filter((f) => !f.deletedAt).length,
      draft: all.filter((f) => !f.deletedAt && f.status === "draft").length,
      published: all.filter((f) => !f.deletedAt && f.status === "published").length,
      closed: all.filter((f) => !f.deletedAt && f.status === "closed").length,
      deleted: all.filter((f) => !!f.deletedAt).length,
    };

    return { counts, forms: await Promise.all(rows.map((f) => decorate(ctx, f))) };
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
    const template = args.templateSlug
      ? ((await ctx.db
          .query("templates")
          .withIndex("by_slug", (q) => q.eq("slug", args.templateSlug!))
          .first()) ?? builtinTemplate(args.templateSlug))
      : null;

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
    for (const [i, block] of blocks.entries()) {
      await ctx.db.insert("blocks", { ...storedBlock(block), formId, order: i });
    }

    await ctx.db.insert("activity", {
      formId,
      userId: user._id,
      what: template ? `Created from the ${template.name} template` : "Created the form",
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
    const current = ((form as Record<string, unknown>)[key] ?? {}) as Record<string, unknown>;
    await ctx.db.patch(formId, {
      [key]: { ...current, ...(patch as Record<string, unknown>) },
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

    const number = (form.liveVersion ?? 0) + 1;
    await ctx.db.insert("versions", {
      formId,
      number,
      label: number === 1 ? "First published" : "Published changes",
      blocks: blocks.sort((a, b) => a.order - b.order),
      publishedAt: now,
    });

    await ctx.db.patch(formId, {
      status: "published",
      liveVersion: number,
      updatedAt: now,
    });
    await ctx.db.insert("activity", {
      formId,
      userId: user._id,
      what: number === 1 ? "Published the form" : `Published version ${number}`,
      at: now,
    });
    return null;
  },
});

export const unpublish = mutation({
  args: { formId: v.id("forms") },
  returns: v.null(),
  handler: async (ctx, { formId }) => {
    await formFor(ctx, formId);
    const user = await requireUser(ctx);
    await ctx.db.patch(formId, { status: "draft", updatedAt: Date.now() });
    await ctx.db.insert("activity", {
      formId,
      userId: user._id,
      what: "Unpublished the form — responses kept",
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
        closeAt: v.optional(v.number()),
        closeAfter: v.optional(v.number()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { formId, closeNow, reopen, closing }) => {
    const form = await formFor(ctx, formId);
    const user = await requireUser(ctx);
    const now = Date.now();

    const next = { ...(form.closing ?? {}), ...(closing ?? {}) };

    if (closeNow) {
      await ctx.db.patch(formId, {
        status: "closed",
        closing: { ...next, closedBy: "you", closedAt: now },
        updatedAt: now,
      });
      await ctx.db.insert("activity", {
        formId,
        userId: user._id,
        what: "Closed the form",
        at: now,
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
        what: "Reopened the form",
        at: now,
      });
      return null;
    }

    await ctx.db.patch(formId, { closing: next, updatedAt: now });
    return null;
  },
});

/** Deleting moves a form to the bin, where it sits for 60 days. */
export const softDelete = mutation({
  args: { formId: v.id("forms") },
  returns: v.null(),
  handler: async (ctx, { formId }) => {
    await formFor(ctx, formId);
    await ctx.db.patch(formId, { deletedAt: Date.now(), updatedAt: Date.now() });
    return null;
  },
});

export const restore = mutation({
  args: { formId: v.id("forms") },
  returns: v.null(),
  handler: async (ctx, { formId }) => {
    await formFor(ctx, formId);
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
      // `blocks` is indexed by form *and* order, so it is swept on its own.
      const blocks = await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", form._id))
        .collect();
      for (const row of blocks) await ctx.db.delete(row._id);

      for (const table of ["logicRules", "responses", "versions"] as const) {
        const rows = await ctx.db
          .query(table)
          .withIndex("by_form", (q) => q.eq("formId", form._id))
          .collect();
        for (const row of rows) await ctx.db.delete(row._id);
      }
      await ctx.db.delete(form._id);
    }
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

    await ctx.db.insert("versions", {
      formId: form._id,
      number: (form.liveVersion ?? 0) + 1,
      label: `Before restoring version ${version.number}`,
      blocks: current.sort((a, b) => a.order - b.order),
      publishedAt: now,
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

    const shape = (b: { title?: string; type?: string; required?: boolean }) =>
      `${b.type ?? ""}|${b.title ?? ""}|${b.required ? "1" : "0"}`;
    const before = new Set((live.blocks as typeof current).map(shape));
    return current.filter((b) => !before.has(shape(b))).length;
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
        what: "Closed automatically",
        at: now,
      });
      closed++;
    }
    return closed;
  },
});
