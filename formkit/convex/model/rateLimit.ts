import type { MutationCtx } from "../_generated/server";

/**
 * Limits on what anyone may do without signing in: open a form, start one,
 * ask for an upload, send answers, tell the help centre something.
 *
 * A mutation cannot see the visitor's address, so each limit is kept per form
 * and, where the browser sends one, per device (the random id a live form
 * keeps in local storage). A caller that sends no device id shares one
 * tighter allowance per form. Counts are kept per fixed window in
 * `rateLimits`; old windows are cleared daily (`clearOld`).
 */

export type Rule = { max: number; windowMs: number };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const RULES = {
  /** Views and starts counted per form; past this they are not counted. */
  viewsPerForm: { max: 3000, windowMs: MINUTE },
  viewsPerDevice: { max: 30, windowMs: HOUR },
  /** Quiz attempts started. */
  quizPerForm: { max: 600, windowMs: MINUTE },
  quizPerDevice: { max: 10, windowMs: HOUR },
  /** Upload addresses handed out. */
  uploadsPerForm: { max: 500, windowMs: HOUR },
  uploadsPerDevice: { max: 40, windowMs: HOUR },
  /** New responses, complete or partial. */
  responsesPerForm: { max: 300, windowMs: MINUTE },
  responsesPerDevice: { max: 20, windowMs: HOUR },
  /** Help centre signals, for everyone together. */
  helpSignals: { max: 2000, windowMs: HOUR },
} satisfies Record<string, Rule>;

/** Used when a caller sends no device id: one allowance per form, shared. */
export const NO_DEVICE = "-";

/** Counts one go against `key`; false once the window's allowance is used. */
export async function allow(ctx: MutationCtx, key: string, rule: Rule) {
  const now = Date.now();
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!row) {
    await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
    return true;
  }
  if (now - row.windowStart >= rule.windowMs) {
    await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    return true;
  }
  if (row.count >= rule.max) return false;
  await ctx.db.patch(row._id, { count: row.count + 1 });
  return true;
}

/** Both the form's allowance and the device's (or the shared no-device one). */
export async function allowForm(
  ctx: MutationCtx,
  name: string,
  formId: string,
  deviceId: string | undefined,
  perForm: Rule,
  perDevice: Rule,
) {
  const device = deviceId?.trim().slice(0, 64) || NO_DEVICE;
  // Without a device id everyone shares one allowance a tenth of the form's.
  const deviceRule = device === NO_DEVICE ? { max: Math.max(1, Math.floor(perForm.max / 10)), windowMs: perForm.windowMs } : perDevice;
  if (!(await allow(ctx, `${name}:${formId}:${device}`, deviceRule))) return false;
  return await allow(ctx, `${name}:${formId}`, perForm);
}
