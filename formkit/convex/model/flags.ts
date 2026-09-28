import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Feature flags: a fixed set, each wired to something real in the product.
 *
 * A flag is on or off platform-wide, and when on it reaches a percentage of
 * accounts. Which accounts is decided by a stable hash of the flag and the
 * account, so raising the rollout from 20% to 50% keeps the first 20% and
 * adds more — nobody flickers in and out as the number moves.
 *
 * A flag nobody has touched in the console keeps its default, which is what
 * the product did before flags existed. Adding a key here without code that
 * reads it would put a switch in the console that does nothing, so the list
 * is closed: the console can change these, not invent new ones.
 */
export const FLAGS = [
  {
    key: "ai.live",
    label: "Live AI generation",
    description:
      "Ask Formkit calls the model. Off, it still answers simple questions, but writes and changes nothing, and spends no credits.",
    defaultOn: true,
  },
  {
    key: "ai.brief",
    label: "Build from a brief",
    description: "Ask Formkit can work from a pasted brief, an uploaded document or an existing form.",
    defaultOn: true,
  },
  {
    key: "forms.partials",
    label: "Save partial responses",
    description:
      "When somebody leaves a form half-way, what they answered is kept with a link to carry on. Decided by the form owner's account.",
    defaultOn: true,
  },
  {
    key: "app.dark",
    label: "Dark mode",
    description: "A dark theme for the app, chosen under Settings → General → Appearance.",
    defaultOn: false,
  },
  {
    key: "exports.xlsx",
    label: "Excel export",
    description: "Responses, contacts and analytics download as .xlsx as well as CSV.",
    defaultOn: true,
  },
] as const;

export type FlagKey = (typeof FLAGS)[number]["key"];

export function isFlagKey(key: string): key is FlagKey {
  return FLAGS.some((f) => f.key === key);
}

/** 0–99, the same for a given flag and account every time. */
export function bucketOf(key: string, id: string) {
  let h = 2166136261;
  for (const ch of `${key}:${id}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 100;
}

export async function flagOn(ctx: QueryCtx | MutationCtx, key: FlagKey, userId: Id<"users"> | null) {
  const def = FLAGS.find((f) => f.key === key)!;
  const row = await ctx.db
    .query("featureFlags")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!row) return def.defaultOn;
  if (!row.enabled) return false;
  if (row.rollout >= 100) return true;
  if (!userId) return false;
  return bucketOf(key, userId) < row.rollout;
}

export async function flagsFor(ctx: QueryCtx | MutationCtx, userId: Id<"users"> | null) {
  const out = {} as Record<FlagKey, boolean>;
  for (const f of FLAGS) out[f.key] = await flagOn(ctx, f.key, userId);
  return out;
}
