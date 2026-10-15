import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { flagOn } from "./flags";
import type { InboxKind } from "./inbox";

/**
 * Push notifications: the few things worth a buzz on someone's phone - a new
 * response, a mention or an assignment, and approvals. Everything else stays
 * in the bell. Each kind can be switched off under Settings → Notifications;
 * absent means on, once a device has signed up.
 */

export type PushGroup = "responses" | "mentions" | "approvals";

export const PUSH_GROUP: Partial<Record<InboxKind, PushGroup>> = {
  response: "responses",
  mention: "mentions",
  reply: "mentions",
  assigned: "mentions",
  approval: "approvals",
  approved: "approvals",
  declined: "approvals",
};

export function pushWanted(user: Doc<"users">, group: PushGroup) {
  return user.pushPrefs?.[group] !== false;
}

/** Sends a bell item on to the person's devices, if they asked for it. */
export async function queuePush(
  ctx: MutationCtx,
  user: Doc<"users">,
  item: { kind: string; title: string; body?: string; href?: string; tag?: string },
) {
  const group = PUSH_GROUP[item.kind as InboxKind];
  if (!group || !pushWanted(user, group)) return;
  const device = await ctx.db
    .query("pushSubscriptions")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  if (!device) return;
  if (!(await flagOn(ctx, "notify.push", user._id))) return;
  await ctx.scheduler.runAfter(0, internal.pushSend.send, {
    userId: user._id,
    title: item.title,
    body: item.body,
    href: item.href,
    tag: item.tag,
  });
}

/** "Chrome on macOS", from a user agent. */
export function deviceName(ua: string) {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "A browser";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}
