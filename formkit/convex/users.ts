import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { aiAllowed, aiLimit, currentUser, requireUser } from "./model/identity";

/**
 * Everything the chrome needs to render: the person, their companies, whether
 * they are staff, and whether Ask Formkit exists for them at all.
 *
 * When AI access is false there is no AI surface anywhere — no launcher, no
 * drawer, no locked state, no mention in Settings. Do not add a request or
 * upsell affordance back; that was removed deliberately.
 */
export const viewer = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      image: v.union(v.string(), v.null()),
      handle: v.union(v.string(), v.null()),
      timezone: v.union(v.string(), v.null()),
      onboarded: v.boolean(),
      deactivated: v.boolean(),
      staffRole: v.union(v.string(), v.null()),
      ai: v.object({
        allowed: v.boolean(),
        used: v.number(),
        limit: v.number(),
        live: v.boolean(),
      }),
      companies: v.array(
        v.object({
          _id: v.id("companies"),
          name: v.string(),
          handle: v.union(v.string(), v.null()),
          logoUrl: v.union(v.string(), v.null()),
          brandColor: v.union(v.string(), v.null()),
          useBranding: v.boolean(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;

    const companies = await ctx.db
      .query("companies")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    const allowed = await aiAllowed(ctx, user._id);

    return {
      _id: user._id,
      name: user.name ?? "Your account",
      email: user.email ?? "",
      image: user.avatarId
        ? await ctx.storage.getUrl(user.avatarId)
        : (user.image ?? null),
      handle: user.handle ?? null,
      timezone: user.timezone ?? null,
      onboarded: user.onboardedAt !== undefined,
      deactivated: user.deactivatedAt !== undefined,
      staffRole: user.staffRole ?? null,
      ai: {
        allowed,
        used: allowed ? (user.aiUsed ?? 0) : 0,
        limit: allowed ? await aiLimit(ctx, user._id) : 0,
        // Live is the default; a saved `false` from before that change is not
        // the same as the person choosing patterns, which `aiLiveSet` records.
        live: user.aiLiveSet ? (user.aiLive ?? true) : true,
      },
      companies: await Promise.all(
        companies.map(async (c) => ({
          _id: c._id,
          name: c.name,
          handle: c.handle ?? null,
          logoUrl: c.logoId ? await ctx.storage.getUrl(c.logoId) : null,
          brandColor: c.brandColor ?? null,
          useBranding: c.useBranding ?? false,
        })),
      ),
    };
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, {
      ...(args.name !== undefined ? { name: args.name.trim() } : {}),
      ...(args.role !== undefined ? { role: args.role } : {}),
      ...(args.timezone !== undefined ? { timezone: args.timezone } : {}),
    });
    return null;
  },
});

/** Records that the person deliberately chose an engine, so the default can
 *  change later without overriding them. */
export const setAiEngine = mutation({
  args: { live: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { live }) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { aiLive: live, aiLiveSet: true });
    return null;
  },
});

export const completeOnboarding = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user.onboardedAt === undefined) {
      await ctx.db.patch(user._id, { onboardedAt: Date.now() });
    }
    return null;
  },
});

/**
 * Uploading a picture of yourself.
 *
 * Convex hands out a one-use URL, the browser posts the file straight to it,
 * and the id that comes back is written to the account. The file never passes
 * through a mutation, so a large one cannot blow the argument limit.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Sets the avatar, and deletes whatever it replaced rather than orphaning it. */
export const setAvatar = mutation({
  args: { storageId: v.union(v.id("_storage"), v.null()) },
  returns: v.null(),
  handler: async (ctx, { storageId }) => {
    const user = await requireUser(ctx);
    const previous = user.avatarId;
    await ctx.db.patch(user._id, {
      avatarId: storageId ?? undefined,
      // A picture of their own wins over whatever an identity provider gave us.
      ...(storageId ? { image: undefined } : {}),
    });
    if (previous && previous !== storageId) await ctx.storage.delete(previous);
    return null;
  },
});
