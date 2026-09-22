import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { shouldAutoClose } from "./model/forms";

/**
 * The published form, as a respondent sees it.
 *
 * None of this requires a signed-in user. A form is reachable at
 * `/<handle>/<slug>` once its identity has claimed a handle, and at `/f/<slug>`
 * otherwise; both resolve here.
 */

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

async function resolve(
  ctx: QueryCtx,
  slug: string,
  handle?: string,
): Promise<Doc<"forms"> | null> {
  const form = await ctx.db
    .query("forms")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (!form || form.deletedAt) return null;

  if (handle) {
    // The handle must actually belong to the identity the form publishes under,
    // or a form could be read from somebody else's link.
    const owner =
      form.brand === "me"
        ? await ctx.db.get(form.ownerId)
        : await ctx.db.get(form.brand as Id<"companies">);
    if (owner?.handle !== handle) return null;
  }
  return form;
}

export const bySlug = query({
  args: { slug: v.string(), handle: v.optional(v.string()) },
  handler: async (ctx, { slug, handle }) => {
    const form = await resolve(ctx, slug, handle);
    if (!form) return null;

    const closed = form.status === "closed" || shouldAutoClose(form, Date.now());
    if (form.status === "draft") return { state: "draft" as const };

    const identity =
      form.brand === "me"
        ? await ctx.db.get(form.ownerId)
        : await ctx.db.get(form.brand as Id<"companies">);

    const brand = {
      name: (identity as { name?: string } | null)?.name ?? "Formkit",
      logoUrl:
        identity && "logoId" in identity && identity.logoId
          ? await ctx.storage.getUrl(identity.logoId)
          : null,
      color: (identity as { brandColor?: string } | null)?.brandColor ?? null,
    };

    if (closed) {
      return {
        state: "closed" as const,
        title: form.title,
        brand,
        message:
          form.closing?.message ??
          "This form is closed. Thank you to everyone who answered.",
      };
    }

    const blocks = (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", form._id))
        .collect()
    ).sort((a, b) => a.order - b.order);

    const rules = (
      await ctx.db
        .query("logicRules")
        .withIndex("by_form", (q) => q.eq("formId", form._id))
        .collect()
    ).filter((r) => r.enabled);

    return {
      state: "open" as const,
      formId: form._id,
      title: form.title,
      brand,
      welcome: form.welcome ?? null,
      thanks: form.thanks ?? null,
      theme: form.theme ?? null,
      uploadCapMb: MAX_UPLOAD_BYTES / 1024 / 1024,
      blocks: blocks.map((b) => ({
        _id: b._id,
        kind: b.kind,
        type: b.type ?? null,
        title: b.title ?? null,
        help: b.help ?? null,
        placeholder: b.placeholder ?? null,
        required: b.required ?? false,
        options: b.options ?? null,
        accept: b.accept ?? null,
        scaleMin: b.scaleMin ?? null,
        scaleMax: b.scaleMax ?? null,
        pageName: b.pageName ?? null,
      })),
      rules: rules.map((r) => ({
        join: r.join,
        conditions: r.conditions,
        action: r.action,
        targetId: r.targetId ?? null,
      })),
    };
  },
});

/** A view, counted once per opened form. */
export const recordView = mutation({
  args: { formId: v.id("forms"), started: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { formId, started }) => {
    const form = await ctx.db.get(formId);
    if (!form) return null;
    await ctx.db.patch(formId, {
      views: (form.views ?? 0) + (started ? 0 : 1),
      starts: (form.starts ?? 0) + (started ? 1 : 0),
    });
    return null;
  },
});

/** Where a respondent's upload goes. The cap is 10 MB, stated on the field. */
export const uploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

export const resume = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query("responses")
      .withIndex("by_resume", (q) => q.eq("resumeToken", token))
      .first();
    if (!row || !row.partial) return null;

    // The resume page has only a token, so it needs the link back as well.
    const form = await ctx.db.get(row.formId);
    if (!form || form.deletedAt) return null;
    const identity =
      form.brand === "me"
        ? await ctx.db.get(form.ownerId)
        : await ctx.db.get(form.brand as Id<"companies">);

    return {
      formId: row.formId,
      responseId: row._id,
      slug: form.slug,
      handle: identity?.handle ?? null,
      answers: row.answers.map((a) => ({
        blockId: a.blockId,
        value: a.value ?? null,
        values: a.values ?? null,
        fileName: a.fileName ?? null,
      })),
    };
  },
});

/**
 * Submitting. A partial is a real record — it keeps what was answered before
 * the person left, and carries a token so they can be sent back to it.
 */
export const submit = mutation({
  args: {
    formId: v.id("forms"),
    partial: v.boolean(),
    device: v.optional(v.string()),
    source: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    resumeOf: v.optional(v.id("responses")),
    answers: v.array(
      v.object({
        blockId: v.id("blocks"),
        value: v.optional(v.string()),
        values: v.optional(v.array(v.string())),
        fileId: v.optional(v.id("_storage")),
        fileName: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({ responseId: v.id("responses"), resumeToken: v.string() }),
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId);
    if (!form || form.deletedAt) throw new Error("That form is no longer available.");
    if (form.status !== "published") throw new Error("That form is not accepting answers.");
    if (shouldAutoClose(form, Date.now())) {
      throw new Error("That form has closed.");
    }

    const blocks = (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", args.formId))
        .collect()
    ).filter((b) => b.kind === "field");
    const byId = new Map(blocks.map((b) => [b._id as string, b]));

    const answers = args.answers
      .filter((a) => byId.has(a.blockId))
      .map((a) => ({
        ...a,
        question: byId.get(a.blockId)!.title ?? "Question",
      }));

    // The respondent's name and email come from whichever fields collect them.
    const named = answers.find((a) => byId.get(a.blockId)!.type === "short-text");
    const mailed = answers.find((a) => byId.get(a.blockId)!.type === "email");

    const resumeToken =
      args.resumeOf && (await ctx.db.get(args.resumeOf))?.resumeToken
        ? (await ctx.db.get(args.resumeOf))!.resumeToken!
        : crypto.randomUUID();

    const record = {
      formId: args.formId,
      ownerId: form.ownerId,
      submittedAt: Date.now(),
      partial: args.partial,
      answeredCount: answers.filter((a) => a.value || a.values?.length || a.fileId).length,
      totalCount: blocks.length,
      answers,
      respondentName: named?.value,
      respondentEmail: mailed?.value,
      device: args.device,
      source: args.source,
      durationMs: args.durationMs,
      status: "new" as const,
      resumeToken,
      versionNumber: form.liveVersion,
    };

    const responseId = args.resumeOf
      ? (await ctx.db.replace(args.resumeOf, record), args.resumeOf)
      : await ctx.db.insert("responses", record);

    await ctx.runMutation(internal.responses.recount, { formId: args.formId });

    // A response limit closes the form as soon as it is reached.
    const after = await ctx.db.get(args.formId);
    if (after && shouldAutoClose(after, Date.now())) {
      await ctx.db.patch(args.formId, {
        status: "closed",
        closing: { ...(after.closing ?? {}), closedBy: "automatically", closedAt: Date.now() },
      });
    }

    if (!args.partial) {
      await ctx.scheduler.runAfter(0, internal.notifications.onResponse, { responseId });
    }

    return { responseId, resumeToken };
  },
});
