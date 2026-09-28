import { Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { hasFeature } from "./plans";

/**
 * Claimed links.
 *
 * A handle moves a form's public link from `formkit.app/f/<slug>` to
 * `formkit.app/<handle>/<slug>`. There is one claim path for every identity —
 * the person and each of their companies — keyed the same way, so the same name
 * cannot be taken twice.
 *
 * Build public URLs with `formUrl()`. Never concatenate `formkit.app/f/`.
 */

/** Reserved because they are, or could become, real routes. */
const RESERVED = new Set([
  "admin",
  "api",
  "app",
  "compare",
  "domain",
  "dpa",
  "api-docs",
  "f",
  "formkit",
  "help",
  "onboarding",
  "pay",
  "pricing",
  "privacy",
  "settings",
  "signin",
  "signup",
  "sitemap",
  "robots",
  "templates",
  "terms",
  "www",
]);

export function normaliseHandle(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Errors name the fix rather than saying "Invalid". */
export function handleProblem(handle: string): string | null {
  if (handle.length < 3) return "A link needs at least three characters.";
  if (handle.length > 32) return "A link can be at most 32 characters.";
  if (RESERVED.has(handle)) return `“${handle}” is reserved by Formkit — try another name.`;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(handle)) {
    return "Use letters, numbers and dashes, starting and ending with a letter or number.";
  }
  return null;
}

export async function handleTaken(ctx: QueryCtx | MutationCtx, handle: string) {
  const row = await ctx.db
    .query("handles")
    .withIndex("by_value", (q) => q.eq("value", handle))
    .unique();
  return row ?? null;
}

export async function claimHandle(
  ctx: MutationCtx,
  userId: Id<"users">,
  companyId: Id<"companies"> | null,
  raw: string,
) {
  const handle = normaliseHandle(raw);
  const problem = handleProblem(handle);
  if (problem) throw new Error(problem);

  const existing = await handleTaken(ctx, handle);
  if (existing) {
    const mine =
      existing.userId === userId &&
      (companyId ? existing.companyId === companyId : existing.ownerType === "user");
    if (!mine) throw new Error(`“${handle}” is taken — try another name.`);
    return handle;
  }

  // Release whatever this identity held before, so one identity holds one name.
  if (companyId) {
    const company = await ctx.db.get(companyId);
    if (!company || company.ownerId !== userId) throw new Error("That company is not yours.");
    if (company.handle) await releaseHandle(ctx, userId, company.handle);
    await ctx.db.insert("handles", {
      value: handle,
      ownerType: "company",
      userId,
      companyId,
    });
    await ctx.db.patch(companyId, { handle });
  } else {
    const user = await ctx.db.get(userId);
    if (user?.handle) await releaseHandle(ctx, userId, user.handle);
    await ctx.db.insert("handles", { value: handle, ownerType: "user", userId });
    await ctx.db.patch(userId, { handle });
  }
  return handle;
}

export async function releaseHandle(ctx: MutationCtx, userId: Id<"users">, handle: string) {
  const row = await handleTaken(ctx, handle);
  if (row && row.userId === userId) await ctx.db.delete(row._id);
}

/** The public URL a form goes out at, resolved from its identity. */
export async function formUrl(
  ctx: QueryCtx | MutationCtx,
  form: { brand: "me" | Id<"companies">; slug: string; ownerId: Id<"users"> },
) {
  let handle: string | null = null;
  if (form.brand === "me") {
    handle = (await ctx.db.get(form.ownerId))?.handle ?? null;
  } else {
    handle = (await ctx.db.get(form.brand))?.handle ?? null;
  }
  // A live custom domain for this identity is the link, while the plan has it.
  if (handle) {
    const domain = (
      await ctx.db
        .query("domains")
        .withIndex("by_owner", (q) => q.eq("ownerId", form.ownerId))
        .collect()
    ).find((d) => d.owner === form.brand && d.status === "active");
    if (domain && (await hasFeature(ctx, form.ownerId, "domains"))) return `${domain.host}/${form.slug}`;
  }
  return handle ? `formkit.app/${handle}/${form.slug}` : `formkit.app/f/${form.slug}`;
}
