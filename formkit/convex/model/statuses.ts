import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { spaceOfForm } from "./spaces";
import type { SpaceRef } from "./plans";

/**
 * Response statuses, set per company: what the team calls the stages a
 * response goes through. Two are built in and can be renamed but not taken
 * away: "new" (unread; every response arrives with it) and "read" (set when
 * someone opens it). Everything else is the company's own, up to twelve in
 * all. A company that has never changed them has the original three.
 */

export const TONES = ["info", "neutral", "success", "warning", "error", "draft"] as const;
export type Tone = (typeof TONES)[number];
export type Status = { key: string; label: string; tone: Tone };

export const BUILT_IN = ["new", "read"] as const;
export const MAX_STATUSES = 12;

export const DEFAULT_STATUSES: Status[] = [
  { key: "new", label: "New", tone: "info" },
  { key: "read", label: "Read", tone: "neutral" },
  { key: "reviewed", label: "Reviewed", tone: "success" },
];

const brandOf = (space: SpaceRef) => (space.brand === "me" ? "me" : (space.brand as string));

export async function statusRow(ctx: QueryCtx | MutationCtx, space: SpaceRef) {
  return ctx.db
    .query("responseStatuses")
    .withIndex("by_space", (q) => q.eq("ownerId", space.ownerId).eq("brand", brandOf(space)))
    .first();
}

export async function statusesOf(ctx: QueryCtx | MutationCtx, space: SpaceRef): Promise<Status[]> {
  const row = await statusRow(ctx, space);
  return row ? (row.list as Status[]) : DEFAULT_STATUSES;
}

export async function statusesOfForm(ctx: QueryCtx | MutationCtx, form: Pick<Doc<"forms">, "ownerId" | "brand">) {
  return statusesOf(ctx, spaceOfForm(form));
}

/** A label for a status key, even one since taken away. */
export function labelOf(list: Status[], key: string) {
  return list.find((s) => s.key === key)?.label ?? (key === "new" ? "New" : key === "read" ? "Read" : key);
}

/** A tidy key for a new status: its words, made safe, and unique among the rest. */
export function keyFor(label: string, taken: Set<string>) {
  const base = label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "status";
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
  return key;
}

export type { Id };
