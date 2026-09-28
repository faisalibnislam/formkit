import type { FunctionReference } from "convex/server";
import { api } from "../../convex/_generated/api";
import { seedKey, type Clock, type Seeds } from "../../src/lib/seedKey";
import { fixtureFor } from "./fixtures";

/** Stands in for `src/lib/seedServer.ts` while `FK_PREVIEW=1`: seeds come from the fixtures. */
type AnyQuery = FunctionReference<"query">;

export async function token() {
  return "preview";
}

function nameOf(ref: AnyQuery) {
  return seedKey(ref).split("|")[0]!;
}

export async function seedQueries(queries: [AnyQuery, Record<string, unknown>?][]): Promise<Seeds> {
  const out: Seeds = {};
  for (const [ref, args = {}] of queries) out[seedKey(ref, args)] = JSON.parse(JSON.stringify(fixtureFor(nameOf(ref))) ?? "null");
  return out;
}

export async function seedViewer(): Promise<{ seeds: Seeds; clock: Clock | null }> {
  const now = new Date();
  return {
    seeds: await seedQueries([[api.users.viewer, {}]]),
    clock: {
      hour: now.getHours(),
      today: now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" }),
      midnight: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
    },
  };
}
