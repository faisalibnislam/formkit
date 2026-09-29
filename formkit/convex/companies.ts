import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./model/identity";
import { requireFeature } from "./model/plans";
import { canManage, currentSpace, roleIn, spaceForms } from "./model/spaces";
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
        markUrl: c.markId ? await ctx.storage.getUrl(c.markId) : null,
        formCount: forms.filter((f) => f.brand === c._id && !f.deletedAt).length,
      })),
    );
  },
});

/** The company being worked in, for its settings; null when it is the person's own. */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const space = await currentSpace(ctx, user);
    if (space.brand === "me") return null;
    const c = await ctx.db.get(space.brand);
    if (!c) return null;
    const role = await roleIn(ctx, space, user._id);
    return {
      ...c,
      logoUrl: c.logoId ? await ctx.storage.getUrl(c.logoId) : null,
      markUrl: c.markId ? await ctx.storage.getUrl(c.markId) : null,
      formCount: (await spaceForms(ctx, space)).filter((f) => !f.deletedAt).length,
      mine: c.ownerId === user._id,
      canManage: canManage(role),
    };
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
    // As many companies as you like, on any plan: each is its own workspace
    // with its own plan.
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
    const space = company ? { ownerId: company.ownerId, brand: company._id } : null;
    if (!space || !canManage(await roleIn(ctx, space, user._id))) {
      throw new Error("Only the company’s owner and admins can change it.");
    }
    if (patch.badge === false) await requireFeature(ctx, space, "brand.badge");
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
    // A company still paying keeps its subscription running; it is cancelled first.
    if (company.polarSubscriptionId && company.plan && company.plan !== "free" && !company.planCancelAtPeriodEnd) {
      throw new ConvexError("Cancel this company’s plan under Settings → Plan before deleting it.");
    }

    // Its members go, and anyone who had it open goes back to their own company.
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    for (const m of members) {
      if (m.userId) {
        const u = await ctx.db.get(m.userId);
        if (u?.space === companyId) await ctx.db.patch(u._id, { space: undefined });
      }
      await ctx.db.delete(m._id);
    }
    if (user.space === companyId) await ctx.db.patch(user._id, { space: undefined });

    const forms = await ctx.db
      .query("forms")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    for (const form of forms) {
      if (form.brand === companyId) await ctx.db.patch(form._id, { brand: "me" });
    }

    if (company.handle) await releaseHandle(ctx, user._id, company.handle);
    if (company.logoId) await ctx.storage.delete(company.logoId).catch(() => undefined);
    if (company.markId) await ctx.storage.delete(company.markId).catch(() => undefined);
    await ctx.db.delete(companyId);
    return null;
  },
});

/**
 * One claim path for every identity's link. `owner` is "me" for the person, or
 * a company id - the same name cannot be taken twice across an account, and a
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
 * The company's logos: the full one (a wordmark or lockup) and the square one
 * (an icon). `kind` says which; without it, the full one.
 *
 * The same one-use upload URL as an avatar - `users.generateUploadUrl` issues
 * it, since a person may only upload for their own account either way.
 */
export const setLogo = mutation({
  args: {
    companyId: v.id("companies"),
    storageId: v.union(v.id("_storage"), v.null()),
    kind: v.optional(v.union(v.literal("full"), v.literal("square"))),
  },
  returns: v.null(),
  handler: async (ctx, { companyId, storageId, kind = "full" }) => {
    const user = await requireUser(ctx);
    const company = await ctx.db.get(companyId);
    if (!company || !canManage(await roleIn(ctx, { ownerId: company.ownerId, brand: company._id }, user._id))) {
      throw new Error("Only the company’s owner and admins can change its logos.");
    }
    const previous = kind === "square" ? company.markId : company.logoId;
    await ctx.db.patch(companyId, kind === "square" ? { markId: storageId ?? undefined } : { logoId: storageId ?? undefined });
    if (previous && previous !== storageId) await ctx.storage.delete(previous);
    return null;
  },
});
