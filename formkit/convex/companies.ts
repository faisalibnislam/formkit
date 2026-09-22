import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./model/identity";
import { claimHandle, releaseHandle } from "./model/handles";

/**
 * Companies are optional and plural. A person is the account; a company is
 * something they may or may not have, and they may have several.
 */

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const companies = await ctx.db
      .query("companies")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    // Read the forms once, not once per company.
    const forms = await ctx.db
      .query("forms")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    return Promise.all(
      companies.map(async (c) => ({
        ...c,
        logoUrl: c.logoId ? await ctx.storage.getUrl(c.logoId) : null,
        formCount: forms.filter((f) => f.brand === c._id && !f.deletedAt).length,
      })),
    );
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    tagline: v.optional(v.string()),
  },
  returns: v.id("companies"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("A company needs a name.");
    return await ctx.db.insert("companies", {
      ownerId: user._id,
      name,
      tagline: args.tagline?.trim() || undefined,
      useBranding: false,
      badge: true,
    });
  },
});

export const update = mutation({
  args: {
    companyId: v.id("companies"),
    patch: v.object({
      name: v.optional(v.string()),
      legalName: v.optional(v.string()),
      tagline: v.optional(v.string()),
      industry: v.optional(v.string()),
      website: v.optional(v.string()),
      contactEmail: v.optional(v.string()),
      phone: v.optional(v.string()),
      taxId: v.optional(v.string()),
      address: v.optional(v.string()),
      brandColor: v.optional(v.string()),
      logoId: v.optional(v.id("_storage")),
      useBranding: v.optional(v.boolean()),
      badge: v.optional(v.boolean()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { companyId, patch }) => {
    const user = await requireUser(ctx);
    const company = await ctx.db.get(companyId);
    if (!company || company.ownerId !== user._id) throw new Error("That company is not yours.");
    await ctx.db.patch(companyId, patch);
    return null;
  },
});

/** Removing a company sends its forms back to the person. */
export const remove = mutation({
  args: { companyId: v.id("companies") },
  returns: v.null(),
  handler: async (ctx, { companyId }) => {
    const user = await requireUser(ctx);
    const company = await ctx.db.get(companyId);
    if (!company || company.ownerId !== user._id) throw new Error("That company is not yours.");

    const forms = await ctx.db
      .query("forms")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    for (const form of forms) {
      if (form.brand === companyId) await ctx.db.patch(form._id, { brand: "me" });
    }

    if (company.handle) await releaseHandle(ctx, user._id, company.handle);
    await ctx.db.delete(companyId);
    return null;
  },
});

/**
 * One claim path for every identity's link. `owner` is "me" for the person, or
 * a company id — the same name cannot be taken twice across an account, and a
 * handle already held elsewhere is refused.
 */
export const claim = mutation({
  args: {
    owner: v.union(v.literal("me"), v.id("companies")),
    handle: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { owner, handle }) => {
    const user = await requireUser(ctx);
    await claimHandle(ctx, user._id, owner === "me" ? null : owner, handle);
    return null;
  },
});

export const release = mutation({
  args: { owner: v.union(v.literal("me"), v.id("companies")) },
  returns: v.null(),
  handler: async (ctx, { owner }) => {
    const user = await requireUser(ctx);
    if (owner === "me") {
      if (user.handle) await releaseHandle(ctx, user._id, user.handle);
      await ctx.db.patch(user._id, { handle: undefined });
      return null;
    }
    const company = await ctx.db.get(owner);
    if (!company || company.ownerId !== user._id) throw new Error("That company is not yours.");
    if (company.handle) await releaseHandle(ctx, user._id, company.handle);
    await ctx.db.patch(owner, { handle: undefined });
    return null;
  },
});

/**
 * The company's logo.
 *
 * The same one-use upload URL as an avatar — `users.generateUploadUrl` issues
 * it, since a person may only upload for their own account either way.
 */
export const setLogo = mutation({
  args: {
    companyId: v.id("companies"),
    storageId: v.union(v.id("_storage"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { companyId, storageId }) => {
    const user = await requireUser(ctx);
    const company = await ctx.db.get(companyId);
    if (!company || company.ownerId !== user._id) throw new Error("That company is not yours.");
    const previous = company.logoId;
    await ctx.db.patch(companyId, { logoId: storageId ?? undefined });
    if (previous && previous !== storageId) await ctx.storage.delete(previous);
    return null;
  },
});
