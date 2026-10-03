import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * What Formkit does on its own clock.
 *
 * - Closing rules take effect when their date or count arrives, whether or
 *   not anyone has the app open.
 * - The daily summary and weekly report go out at 8am in each person's zone,
 *   so the digest job looks every hour for whoever it is 8am for.
 * - Deleted forms are erased after 60 days in the bin, and deleted accounts
 *   30 days after they were deleted.
 * - The admin overview's platform totals are counted again every hour.
 * - Responses saved before the inbox searched on the server get their search
 *   text, and before contacts were kept, their contact; once every response
 *   has them, each job only checks that it is done.
 */
const crons = cronJobs();

crons.interval("close forms whose rule has arrived", { minutes: 5 }, internal.forms.sweepAllClosing, {});
crons.hourly("daily and weekly digests", { minuteUTC: 0 }, internal.digests.run, {});
crons.hourly("erase forms 60 days in the bin", { minuteUTC: 20 }, internal.forms.purgeExpired, {});
crons.hourly("erase accounts deleted 30 days ago", { minuteUTC: 40 }, internal.security.purgeDeactivated, {});
crons.interval("check custom domains waiting on DNS", { minutes: 10 }, internal.domains.recheckPending, {});
crons.interval("check email domains waiting on DNS", { minutes: 10 }, internal.emailDomains.recheckPending, {});
crons.interval("settle payments nobody came back from", { minutes: 20 }, internal.payments.recheckPending, {});
crons.hourly("erase responses past each account's retention period", { minuteUTC: 50 }, internal.controls.applyRetention, {});
crons.daily("erase account audit lines over a year old", { hourUTC: 3, minuteUTC: 10 }, internal.controls.purgeAudit, {});
crons.hourly("end free plans that reached their date", { minuteUTC: 5 }, internal.adminCompanies.expireComps, {});
crons.interval("give older responses their search text", { minutes: 30 }, internal.responses.backfillSearch, {});
crons.interval("give older responses their contact", { minutes: 30 }, internal.responses.backfillContacts, {});
crons.hourly("count the admin overview", { minuteUTC: 25 }, internal.adminTally.run, {});
crons.daily("forget AI judgements over a month old", { hourUTC: 3, minuteUTC: 30 }, internal.aiLogic.prune, {});

export default crons;
