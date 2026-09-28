import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { requireUser } from "./identity";

/** Turns a title into the slug half of a public link. */
export function slugify(title: string) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return base || "untitled-form";
}

export async function uniqueSlug(ctx: MutationCtx, title: string) {
  const base = slugify(title);
  let candidate = base;
  for (let n = 2; n < 200; n++) {
    const clash = await ctx.db
      .query("forms")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!clash) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

/**
 * The form, if the signed-in person may act on it.
 *
 * An Editor edits the form *and* reads its responses from their own account, so
 * they pass `write`. A Commenter or Viewer reads only.
 */
export async function formFor(
  ctx: QueryCtx | MutationCtx,
  formId: Id<"forms">,
  need: "read" | "write" = "write",
): Promise<Doc<"forms">> {
  const user = await requireUser(ctx);
  const form = await ctx.db.get(formId);
  if (!form) throw new Error("That form no longer exists.");
  if (form.ownerId === user._id) return form;

  const share = await ctx.db
    .query("collaborators")
    .withIndex("by_form", (q) => q.eq("formId", formId))
    .filter((q) => q.eq(q.field("userId"), user._id))
    .first();

  if (!share || share.status !== "active") throw new Error("You do not have access to that form.");
  if (need === "write" && share.role !== "editor") {
    throw new Error("Your role on this form is read-only.");
  }
  return form;
}

/**
 * Every mutation must refuse while a support view is open.
 *
 * `Formkit Main App?viewAs=…` shows staff a customer's dashboard read-only. The
 * flag lives on the request, not the document, so the guard is a parameter the
 * client passes and the server re-checks against the staff role.
 */
export async function refuseIfSupport(ctx: MutationCtx, supportView: boolean | undefined) {
  if (!supportView) return;
  const user = await requireUser(ctx);
  if (user.staffRole) throw new Error("The support view is read-only.");
}

/** Completion rate, recomputed from what is actually stored. */
export function completionRate(form: Doc<"forms">) {
  if (!form.responsesCount) return 0;
  return Math.round((form.completedCount / form.responsesCount) * 1000) / 10;
}

/** A closing rule that has elapsed flips the form to closed on the next read. */
export function shouldAutoClose(form: Doc<"forms">, now: number) {
  if (form.status !== "published" || !form.closing) return false;
  if (form.closing.closeAt && form.closing.closeAt <= now) return true;
  if (form.closing.closeAfter && form.responsesCount >= form.closing.closeAfter) return true;
  return false;
}

/**
 * A question as a template or a version stores it — everything but the
 * identity fields, which are re-made when it is inserted back into a form.
 */
export type StoredBlock = Omit<Doc<"blocks">, "_id" | "_creationTime" | "formId" | "order">;

/** Strips the system and ownership fields off a stored question. */
export function storedBlock(value: unknown): StoredBlock {
  const { _id, _creationTime, formId, order, ...rest } = value as Doc<"blocks">;
  return { ...rest, kind: rest.kind ?? "field" };
}

/**
 * The extra logos a form's theme carries, with somewhere to load each from.
 * The theme stores storage ids; a URL is only ever handed out on read.
 */
export async function themeLogos(ctx: QueryCtx, theme: unknown) {
  const list = ((theme as { logos?: { name?: string; storageId?: string }[] } | null)?.logos ??
    []) as { name?: string; storageId?: string }[];
  return Promise.all(
    list.slice(0, 3).map(async (l) => ({
      name: l.name ?? "",
      url: l.storageId ? await ctx.storage.getUrl(l.storageId as Id<"_storage">) : null,
    })),
  );
}

/**
 * A form's question and page counts, stored on the form so the forms list
 * need not read every block of every form. Called after anything that adds or
 * removes blocks; editing a question's text does not change them.
 */
export async function recount(ctx: MutationCtx, formId: Id<"forms">) {
  const counts = countBlocks(
    await ctx.db
      .query("blocks")
      .withIndex("by_form_order", (q) => q.eq("formId", formId))
      .collect(),
  );
  await ctx.db.patch(formId, { questionCount: counts.questions, pageCount: counts.pages });
}

export function countBlocks(blocks: { kind: string }[]) {
  return {
    questions: blocks.filter((b) => b.kind === "field").length,
    pages: blocks.filter((b) => b.kind === "pagebreak").length + 1,
  };
}

/** The identity a form is published under, as its respondents see it. */
export async function brandOf(ctx: QueryCtx, form: Doc<"forms">) {
  const identity =
    form.brand === "me"
      ? await ctx.db.get(form.ownerId)
      : await ctx.db.get(form.brand as Id<"companies">);
  return {
    name: (identity as { name?: string } | null)?.name ?? "Formkit",
    logoUrl:
      identity && "logoId" in identity && identity.logoId
        ? await ctx.storage.getUrl(identity.logoId)
        : null,
    color: (identity as { brandColor?: string } | null)?.brandColor ?? null,
    // A company can switch the "Made with Formkit" credit off; a person's own
    // forms always carry it.
    badge: (identity as { badge?: boolean } | null)?.badge !== false,
  };
}

/** Who a form is published under: its name and lead logo. */
export async function formIdentity(ctx: QueryCtx, form: Doc<"forms">) {
  if (form.brand === "me") {
    const user = await ctx.db.get(form.ownerId);
    return { kind: "me" as const, name: user?.name ?? "You", logoUrl: null, handle: user?.handle ?? null };
  }
  const co = await ctx.db.get(form.brand as Id<"companies">);
  return {
    kind: "company" as const,
    name: co?.name ?? "Your company",
    logoUrl: co?.logoId ? await ctx.storage.getUrl(co.logoId) : null,
    handle: co?.handle ?? null,
  };
}

/**
 * Everything a form owns, gone: its questions, rules, responses and the files
 * people uploaded to them, versions, comments, people, links, activity and
 * view counts. Used by the bin, the 60-day sweep, and account deletion.
 */
export async function purgeFormData(ctx: MutationCtx, form: Doc<"forms">) {
  // `blocks` is indexed by form *and* order, so it is swept on its own.
  const blocks = await ctx.db
    .query("blocks")
    .withIndex("by_form_order", (q) => q.eq("formId", form._id))
    .collect();
  for (const row of blocks) await ctx.db.delete(row._id);

  const responses = await ctx.db
    .query("responses")
    .withIndex("by_form", (q) => q.eq("formId", form._id))
    .collect();
  for (const r of responses) {
    for (const a of r.answers) if (a.fileId) await ctx.storage.delete(a.fileId).catch(() => undefined);
    await ctx.db.delete(r._id);
  }

  for (const table of [
    "logicRules",
    "versions",
    "comments",
    "collaborators",
    "presence",
    "joinLinks",
    "activity",
  ] as const) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_form", (q) => q.eq("formId", form._id))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }
  const events = await ctx.db
    .query("formEvents")
    .withIndex("by_form_at", (q) => q.eq("formId", form._id))
    .collect();
  for (const row of events) await ctx.db.delete(row._id);
  await ctx.db.delete(form._id);
}
