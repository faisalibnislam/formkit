import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { aiAllowed, aiLimit, currentUser, requireUser, twoFactorPassed } from "./model/identity";
import { planSummary } from "./model/plans";

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
      role: v.union(v.string(), v.null()),
      skyPref: v.union(
        v.literal("sync"),
        v.literal("morning"),
        v.literal("afternoon"),
        v.literal("evening"),
      ),
      appTheme: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
      /** Signed in with a password, but this session still owes its code. */
      twoFactorNeeded: v.boolean(),
      onboarded: v.boolean(),
      deactivated: v.boolean(),
      /** When a deleted account is erased for good, if it has been deleted. */
      suspended: v.boolean(),
      restoreUntil: v.union(v.number(), v.null()),
      inAppPrefs: v.object({
        responses: v.boolean(),
        sharedResponses: v.boolean(),
        comments: v.boolean(),
        sharing: v.boolean(),
        forms: v.boolean(),
        security: v.boolean(),
      }),
      emailPrefs: v.object({
        newResponse: v.boolean(),
        comments: v.boolean(),
        daily: v.boolean(),
        weekly: v.boolean(),
        to: v.string(),
        subject: v.string(),
        body: v.string(),
      }),
      emailCopy: v.object({ on: v.boolean(), to: v.string() }),
      staffRole: v.union(v.string(), v.null()),
      /** See model/plans.ts `planSummary`. */
      plan: v.any(),
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
      role: user.role ?? null,
      skyPref: user.skyPref ?? "sync",
      appTheme: user.appTheme ?? "light",
      twoFactorNeeded: !(await twoFactorPassed(ctx, user)),
      onboarded: user.onboardedAt !== undefined,
      deactivated: user.deactivatedAt !== undefined,
      /** Suspended by staff, as against deleted by the person themselves. */
      suspended: user.deactivatedAt !== undefined && user.selfDeletedAt === undefined,
      restoreUntil: user.selfDeletedAt ? user.selfDeletedAt + 30 * 24 * 60 * 60 * 1000 : null,
      inAppPrefs: {
        responses: user.inAppPrefs?.responses !== false,
        sharedResponses: user.inAppPrefs?.sharedResponses === true,
        comments: user.inAppPrefs?.comments !== false,
        sharing: user.inAppPrefs?.sharing !== false,
        forms: user.inAppPrefs?.forms !== false,
        security: user.inAppPrefs?.security !== false,
      },
      emailPrefs: {
        newResponse: user.emailPrefs?.newResponse ?? true,
        comments: user.emailPrefs?.comments !== false,
        daily: user.emailPrefs?.daily ?? false,
        weekly: user.emailPrefs?.weekly ?? true,
        to: user.emailPrefs?.to ?? user.email ?? "",
        subject: user.emailPrefs?.subject ?? "New response to {{form_name}}",
        body: user.emailPrefs?.body ?? "{{name}} ({{email}}) just submitted {{form_name}}.",
      },
      emailCopy: user.emailCopy ?? { on: false, to: user.email ?? "" },
      staffRole: user.staffRole ?? null,
      plan: planSummary(user),
      ai: {
        allowed,
        // Credits count within the month; last month's use has already reset.
        used:
          allowed && user.aiPeriod === new Date().toISOString().slice(0, 7) ? (user.aiUsed ?? 0) : 0,
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

/**
 * Settings → Preferences, Notifications and Exports. Each field is optional so
 * one switch saves on its own.
 */
export const setPreferences = mutation({
  args: {
    skyPref: v.optional(
      v.union(v.literal("sync"), v.literal("morning"), v.literal("afternoon"), v.literal("evening")),
    ),
    appTheme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),
    inAppPrefs: v.optional(
      v.object({
        responses: v.optional(v.boolean()),
        sharedResponses: v.optional(v.boolean()),
        comments: v.optional(v.boolean()),
        sharing: v.optional(v.boolean()),
        forms: v.optional(v.boolean()),
        security: v.optional(v.boolean()),
      }),
    ),
    emailPrefs: v.optional(
      v.object({
        newResponse: v.optional(v.boolean()),
        comments: v.optional(v.boolean()),
        daily: v.optional(v.boolean()),
        weekly: v.optional(v.boolean()),
        to: v.optional(v.string()),
        subject: v.optional(v.string()),
        body: v.optional(v.string()),
      }),
    ),
    emailCopy: v.optional(v.object({ on: v.optional(v.boolean()), to: v.optional(v.string()) })),
  },
  returns: v.null(),
  handler: async (ctx, { skyPref, appTheme, inAppPrefs, emailPrefs, emailCopy }) => {
    const user = await requireUser(ctx);
    const clean = (s?: string) => (s === undefined ? undefined : s.trim().slice(0, 2000));
    await ctx.db.patch(user._id, {
      ...(skyPref ? { skyPref } : {}),
      ...(appTheme ? { appTheme } : {}),
      ...(inAppPrefs
        ? {
            inAppPrefs: {
              ...(user.inAppPrefs ?? {}),
              ...Object.fromEntries(Object.entries(inAppPrefs).filter(([, val]) => val !== undefined)),
            },
          }
        : {}),
      ...(emailPrefs
        ? {
            emailPrefs: {
              ...(user.emailPrefs ?? {}),
              ...Object.fromEntries(
                Object.entries(emailPrefs)
                  .filter(([, val]) => val !== undefined)
                  .map(([k, val]) => [k, typeof val === "string" ? clean(val) : val]),
              ),
            },
          }
        : {}),
      ...(emailCopy
        ? {
            emailCopy: {
              on: emailCopy.on ?? user.emailCopy?.on ?? false,
              to: clean(emailCopy.to) ?? user.emailCopy?.to ?? user.email ?? "",
            },
          }
        : {}),
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
