/**
 * Time zones and wall-clock times.
 *
 * A closing time is typed as a date and a time in a named zone, and stored as
 * one instant. Converting needs the zone's offset at that moment - which DST
 * moves - so it is read from Intl rather than assumed.
 */

const FALLBACK_ZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/** Every zone the browser knows, or a short list where it cannot say. */
function allZones(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.("timeZone");
    if (list?.length) return list.includes("UTC") ? list : ["UTC", ...list];
  } catch {
    // An older engine; the short list will do.
  }
  return FALLBACK_ZONES;
}

export function localZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** "Pacific/Auckland" → "Auckland · GMT+13". */
export function zoneLabel(zone: string, at = Date.now()) {
  const city = zone.split("/").pop()!.replace(/_/g, " ");
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    return part ? `${city} · ${part}` : city;
  } catch {
    return city;
  }
}

export function zoneOptions() {
  const now = Date.now();
  return allZones().map((z) => ({ value: z, label: zoneLabel(z, now), note: z }));
}

function partsIn(epoch: number, zone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const get = (t: string) => Number(f.formatToParts(epoch).find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

/** A date ("2026-10-03") and time ("23:59") in `zone`, as an instant. */
export function zonedToEpoch(date: string, time: string, zone: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  if (!y || !m || !d) return null;
  const wall = Date.UTC(y, m - 1, d, h ?? 0, mi ?? 0);
  let guess = wall;
  // Two passes settle the offset either side of a DST change.
  for (let i = 0; i < 2; i++) {
    const p = partsIn(guess, zone);
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
    guess += wall - shown;
  }
  return guess;
}

/** An instant as the date and time it reads in `zone`. */
export function epochToZoned(epoch: number, zone: string) {
  const p = partsIn(epoch, zone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.mi)}` };
}

/** "Friday 3 October, 11:59 pm" in `zone`. */
export function formatIn(epoch: number, zone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(epoch)
    .replace(" at ", ", ");
}

/** "in 9 days", "in 3 hours", "in 12 minutes", or "already passed". */
export function untilLabel(epoch: number, now = Date.now()) {
  const ms = epoch - now;
  if (ms <= 0) return "already passed";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `in ${min} minute${min === 1 ? "" : "s"}`;
  const h = Math.round(min / 60);
  if (h < 48) return `in ${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.round(h / 24);
  return `in ${d} days`;
}
