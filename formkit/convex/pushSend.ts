"use node";

import { webcrypto } from "node:crypto";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { sendPush, vapidFromEnv } from "./model/webPush";

// Web Crypto is global from Node 19; older runtimes have it under node:crypto.
if (!globalThis.crypto?.subtle) (globalThis as { crypto: unknown }).crypto = webcrypto;

/** Delivers one notification to each of a person's devices (model/push.ts). */
export const send = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.optional(v.string()),
    href: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { userId, ...message }) => {
    const vapid = vapidFromEnv();
    if (!vapid) return null;
    const devices = await ctx.runQuery(internal.push.devicesOf, { userId });
    for (const d of devices) {
      try {
        const res = await sendPush(d, message, vapid);
        if (res.gone) await ctx.runMutation(internal.push.forget, { id: d._id });
        else if (res.ok) await ctx.runMutation(internal.push.sent, { id: d._id });
        else console.warn(`Push to ${new URL(d.endpoint).host} failed: ${res.status}`);
      } catch (e) {
        console.warn("Push failed", e instanceof Error ? e.message : e);
      }
    }
    return null;
  },
});
