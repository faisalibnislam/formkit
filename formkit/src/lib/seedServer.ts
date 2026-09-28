import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import type { FunctionReference } from "convex/server";
import { api } from "../../convex/_generated/api";
import { cache } from "react";
import { cookies } from "next/headers";
import { seedKey, type Clock, type Seeds } from "./seedKey";

/**
 * Server half of seed.tsx: fetch a page's opening queries with the visitor's
 * own token, so the first paint already shows their data. Everything here is
 * best effort - a failure just leaves that query to load in the browser as
 * before.
 */

type AnyQuery = FunctionReference<"query">;

export async function token() {
  try {
    return (await convexAuthNextjsToken()) ?? null;
  } catch {
    return null;
  }
}

export async function seedQueries(queries: [AnyQuery, Record<string, unknown>?][], known?: string | null): Promise<Seeds> {
  const t = known === undefined ? await token() : known;
  if (!t) return {};
  const out: Seeds = {};
  await Promise.all(
    queries.map(async ([ref, args = {}]) => {
      try {
        // Plain JSON only: that is what can cross to the browser.
        out[seedKey(ref, args)] = JSON.parse(JSON.stringify(await fetchQuery(ref, args as never, { token: t })) ?? "null");
      } catch {
        /* left to the browser */
      }
    }),
  );
  return out;
}

/** The signed-in person, and their hour and date, for every page - once per request. */
export const seedViewer = cache(async (): Promise<{ seeds: Seeds; clock: Clock | null }> => {
  const t = await token();
  if (!t) return { seeds: { [seedKey(api.users.viewer, {})]: null }, clock: null };
  const seeds = await seedQueries([[api.users.viewer, {}]], t);
  const viewer = seeds[seedKey(api.users.viewer, {})] as { timezone?: string | null } | null | undefined;
  // The zone this browser reported last visit - the clock the page will
  // read - or else the account's own.
  let zone: string | null = null;
  try {
    zone = decodeURIComponent((await cookies()).get("fk_tz")?.value ?? "") || null;
  } catch {
    zone = null;
  }
  zone = zone ?? viewer?.timezone ?? null;
  return { seeds, clock: clockIn(zone) };
});

/** The instant the day began in a zone: the UTC time of local 00:00 today. */
function midnightIn(zone: string, now: Date) {
  const parts = (at: Date) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(at)
        .map((x) => [x.type, Number(x.value)]),
    ) as Record<string, number>;
    return p;
  };
  const p = parts(now);
  const guess = Date.UTC(p.year!, p.month! - 1, p.day!);
  // How far the zone is from UTC at that moment, then step back by it.
  const q = parts(new Date(guess));
  const asUtc = Date.UTC(q.year!, q.month! - 1, q.day!, q.hour!, q.minute!, q.second!);
  return guess - (asUtc - guess);
}

/** Only for a known zone: guessing the server's would be wrong for nearly everyone. */
function clockIn(zone: string | null): Clock | null {
  if (!zone) return null;
  try {
    const now = new Date();
    const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: zone }).format(now));
    const today = now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: zone });
    return Number.isFinite(hour) ? { hour, today, midnight: midnightIn(zone, now) } : null;
  } catch {
    return null;
  }
}
