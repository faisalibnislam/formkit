import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { currentUser, requireUser } from "./model/identity";
import { deviceName, queuePush } from "./model/push";
import { flagOn } from "./model/flags";

/** Settings → Notifications → On this device: model/push.ts. */

const MAX_DEVICES = 10;

/** Whether push is set up here, and the key a browser subscribes with. */
export const config = query({
  args: {},
  handler: async (ctx) => {
    const me = await currentUser(ctx);
    const publicKey = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PUBLIC_KEY : null;
    if (!me || !publicKey || !(await flagOn(ctx, "notify.push", me._id))) return { publicKey: null, prefs: null, devices: [] };
    const devices = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .take(MAX_DEVICES);
    return {
      publicKey,
      prefs: {
        responses: me.pushPrefs?.responses !== false,
        mentions: me.pushPrefs?.mentions !== false,
        approvals: me.pushPrefs?.approvals !== false,
      },
      devices: devices.map((d) => ({ endpoint: d.endpoint, device: d.device, createdAt: d.createdAt, lastSentAt: d.lastSentAt ?? null })),
    };
  },
});

const isPushService = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.includes(".");
  } catch {
    return false;
  }
};

export const subscribe = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string(), userAgent: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { endpoint, p256dh, auth, userAgent }) => {
    const me = await requireUser(ctx);
    if (!isPushService(endpoint) || endpoint.length > 1000) throw new ConvexError("That isn't a push address.");
    if (!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) throw new ConvexError("Those push keys can't be read.");
    // One browser, one row - even if it signed up under someone else before.
    for (const old of await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .take(5)) {
      await ctx.db.delete(old._id);
    }
    const mine = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .take(MAX_DEVICES + 1);
    // The oldest device makes room.
    if (mine.length >= MAX_DEVICES) await ctx.db.delete(mine.sort((a, b) => a.createdAt - b.createdAt)[0]!._id);
    await ctx.db.insert("pushSubscriptions", {
      userId: me._id,
      endpoint,
      p256dh,
      auth,
      device: deviceName(userAgent ?? "").slice(0, 60),
      createdAt: Date.now(),
    });
    return null;
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  returns: v.null(),
  handler: async (ctx, { endpoint }) => {
    const me = await requireUser(ctx);
    for (const row of await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .take(5)) {
      if (row.userId === me._id) await ctx.db.delete(row._id);
    }
    return null;
  },
});

export const setPrefs = mutation({
  args: { responses: v.optional(v.boolean()), mentions: v.optional(v.boolean()), approvals: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, prefs) => {
    const me = await requireUser(ctx);
    await ctx.db.patch(me._id, { pushPrefs: { ...me.pushPrefs, ...prefs } });
    return null;
  },
});

/** "Send a test" beside the device list. */
export const test = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    await queuePush(ctx, { ...me, pushPrefs: undefined }, {
      kind: "response",
      title: "Notifications are on",
      body: "This is how a new response will look.",
      href: "/app/settings?tab=notifications",
      tag: "test",
    });
    return null;
  },
});

export const devicesOf = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) =>
    await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_DEVICES),
});

export const forget = internalMutation({
  args: { id: v.id("pushSubscriptions") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    if (await ctx.db.get(id)) await ctx.db.delete(id);
    return null;
  },
});

export const sent = internalMutation({
  args: { id: v.id("pushSubscriptions") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    if (await ctx.db.get(id)) await ctx.db.patch(id, { lastSentAt: Date.now() });
    return null;
  },
});
