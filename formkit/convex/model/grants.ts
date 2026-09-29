import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { addCredits } from "./aiMeter";
import { writeAudit } from "./identity";
import { notify } from "./inbox";
import { PLANS, compOf, planOfSpace, type SpaceRef } from "./plans";
import { spaceIdentity, spaceKey } from "./spaces";

/**
 * Free plans and AI credits that staff give a company, one place for all of
 * it: the admin console, the Users page and the hourly sweep that ends free
 * plans on their date. Every change is kept in `planGrants`, written to the
 * audit log, and (unless staff say not to) told to the company's owner.
 */

type Paid = "pro" | "business";
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** The row that holds a company's plan: the owner's account for a personal company. */
async function holderOf(ctx: MutationCtx, space: SpaceRef) {
  const holder = space.brand === "me" ? await ctx.db.get(space.ownerId) : await ctx.db.get(space.brand);
  if (!holder) throw new ConvexError("That company no longer exists.");
  return holder as Doc<"users"> | Doc<"companies">;
}

const day = (at: number) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Where the owner lands: the plan page of that very company. */
const planHref = (space: SpaceRef) => `/app/settings?tab=plan&space=${encodeURIComponent(spaceKey(space))}`;

/** Gives, changes or extends a free plan. `endsAt` null is for good. */
export async function giveComp(
  ctx: MutationCtx,
  staff: Doc<"users">,
  space: SpaceRef,
  opts: { plan: Paid; endsAt: number | null; note?: string; tell?: boolean },
) {
  const now = Date.now();
  if (opts.endsAt !== null && (opts.endsAt < now + 60 * 60 * 1000 || opts.endsAt > now + 10 * YEAR_MS)) {
    throw new ConvexError("Pick an end date between tomorrow and ten years from now.");
  }
  const holder = await holderOf(ctx, space);
  const before = compOf(holder);
  const note = opts.note?.trim().slice(0, 500) || undefined;
  await ctx.db.patch(holder._id, {
    planComp: opts.plan,
    compEndsAt: opts.endsAt ?? undefined,
    compNote: note,
    compBy: staff._id,
    compAt: now,
  });
  await ctx.db.insert("planGrants", {
    space: spaceKey(space),
    ownerId: space.ownerId,
    what: before ? "changed" : "gave",
    plan: opts.plan,
    endsAt: opts.endsAt ?? undefined,
    note,
    byId: staff._id,
    byName: staff.name ?? staff.email ?? "Formkit",
    at: now,
  });

  const { name } = await spaceIdentity(ctx, space);
  const plan = PLANS[opts.plan].name;
  const until = opts.endsAt ? ` until ${day(opts.endsAt)}` : "";
  await writeAudit(ctx, staff, `${before ? "Changed a free plan to" : "Gave"} ${plan} free of charge${until}`, name, note);
  if (opts.tell !== false) {
    await notify(ctx, space.ownerId, {
      kind: "support",
      title: `${name} is on ${plan}, free of charge`,
      body: opts.endsAt
        ? `A gift from Formkit, until ${day(opts.endsAt)}. Everything in ${plan} is on now, for everyone in ${name}.`
        : `A gift from Formkit. Everything in ${plan} is on now, for everyone in ${name}.`,
      href: planHref(space),
      action: "See the plan",
      icon: "gift",
    });
  }
}

/**
 * Ends a free plan, by hand or on its date. The company goes back to what it
 * pays for, or Free. Nothing is deleted; features outside the plan stop.
 */
export async function endComp(
  ctx: MutationCtx,
  staff: Doc<"users"> | null,
  space: SpaceRef,
  opts: { note?: string; tell?: boolean; expired?: boolean } = {},
) {
  const holder = await holderOf(ctx, space);
  const was = holder.planComp;
  if (!was) return false;
  await ctx.db.patch(holder._id, {
    planComp: undefined,
    compEndsAt: undefined,
    compNote: undefined,
    compBy: undefined,
    compAt: undefined,
  });
  const note = opts.note?.trim().slice(0, 500) || undefined;
  await ctx.db.insert("planGrants", {
    space: spaceKey(space),
    ownerId: space.ownerId,
    what: opts.expired ? "expired" : "ended",
    plan: was,
    note,
    byId: staff?._id,
    byName: staff ? (staff.name ?? staff.email ?? "Formkit") : "Formkit",
    at: Date.now(),
  });

  const { name } = await spaceIdentity(ctx, space);
  const now = PLANS[await planOfSpace(ctx, space)].name;
  await writeAudit(ctx, staff, opts.expired ? `A free ${PLANS[was].name} plan reached its end date` : `Ended a free ${PLANS[was].name} plan`, name, note);
  if (opts.tell !== false) {
    await notify(ctx, space.ownerId, {
      kind: "support",
      title: `${name}’s free ${PLANS[was].name} plan has ended`,
      body: `${name} is on ${now} now. Nothing was deleted: features outside ${now} stop, and come back if you upgrade.`,
      href: planHref(space),
      action: "See plans",
      icon: "gift",
    });
  }
  return true;
}

/** AI credits as a gift: the same lots a purchase makes, lasting a year. */
export async function giveCredits(
  ctx: MutationCtx,
  staff: Doc<"users">,
  space: SpaceRef,
  opts: { credits: number; note?: string; tell?: boolean },
) {
  const credits = Math.round(opts.credits);
  if (!(credits > 0 && credits <= 100_000)) throw new ConvexError("Give between 1 and 100,000 credits.");
  await holderOf(ctx, space);
  await addCredits(ctx, space, credits);
  const note = opts.note?.trim().slice(0, 500) || undefined;
  await ctx.db.insert("planGrants", {
    space: spaceKey(space),
    ownerId: space.ownerId,
    what: "credits",
    credits,
    note,
    byId: staff._id,
    byName: staff.name ?? staff.email ?? "Formkit",
    at: Date.now(),
  });
  const { name } = await spaceIdentity(ctx, space);
  await writeAudit(ctx, staff, `Gave ${credits.toLocaleString("en-US")} AI credits`, name, note);
  if (opts.tell !== false) {
    await notify(ctx, space.ownerId, {
      kind: "support",
      title: `${credits.toLocaleString("en-US")} AI credits for ${name}`,
      body: "A gift from Formkit. They are used once the month’s AI allowance runs out, and last a year.",
      href: planHref(space),
      action: "See AI this month",
      icon: "sparkles",
    });
  }
}
