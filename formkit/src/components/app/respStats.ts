/**
 * The inbox's counts for a narrowed list (one owner, one form), worked out in
 * the browser. Mirrors `stats` in convex/responses.ts, which counts the whole
 * inbox on the server; "today" here is the reader's own midnight.
 */

const DAY = 24 * 60 * 60 * 1000;

type Row = { submittedAt: number; partial: boolean; preview: boolean; status: string };

export function responseStats(rows: readonly Row[], now: number) {
  const real = rows.filter((r) => !r.preview);
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const today = midnight.getTime();
  const week = now - 7 * DAY;
  const pct = (a: number, b: number) => (b === 0 ? null : Math.round(((a - b) / b) * 100));
  const inToday = real.filter((r) => r.submittedAt >= today).length;
  const inYesterday = real.filter((r) => r.submittedAt >= today - DAY && r.submittedAt < today).length;
  const inWeek = real.filter((r) => r.submittedAt >= week).length;
  const inLastWeek = real.filter((r) => r.submittedAt >= week - 7 * DAY && r.submittedAt < week).length;
  return {
    total: real.length,
    completed: real.filter((r) => !r.partial).length,
    partial: real.filter((r) => r.partial).length,
    today: inToday,
    todayChange: inToday - inYesterday,
    week: inWeek,
    weekChange: pct(inWeek, inLastWeek),
    unread: real.filter((r) => r.status === "new" && !r.partial).length,
    previews: rows.length - real.length,
  };
}
