import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./model/identity";
import {
  currentSpace,
  resolveSpace,
  roleIn,
  seatsOf,
  spaceIdentity,
  spaceKey,
  spacePlanId,
  spacesOf,
} from "./model/spaces";

/**
 * The company switcher: every company someone can open, and which one the
 * app is showing. Switching is remembered on the account, so every page and
 * query follows it.
 */

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const current = spaceKey(await currentSpace(ctx, user));
    const all = await spacesOf(ctx, user);
    const rows = await Promise.all(
      all.map(async ({ space, role }) => {
        const who = await spaceIdentity(ctx, space);
        return {
          key: spaceKey(space),
          kind: who.kind,
          name: who.name,
          imageUrl: who.imageUrl,
          role,
          plan: await spacePlanId(ctx, space),
          seats: await seatsOf(ctx, space),
          mine: space.ownerId === user._id,
        };
      }),
    );
    return { current, spaces: rows };
  },
});

/** Opens a company. Refused for one this person is not a member of. */
export const setCurrent = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, { key }) => {
    const user = await requireUser(ctx);
    const space = await resolveSpace(ctx, key);
    if (!space || !(await roleIn(ctx, space, user._id))) throw new ConvexError("You are not a member of that company.");
    await ctx.db.patch(user._id, { space: spaceKey(space) === `me:${user._id}` ? undefined : spaceKey(space) });
    return null;
  },
});

/** Makes a company and opens it. */
export const create = mutation({
  args: { name: v.string() },
  returns: v.string(),
  handler: async (ctx, { name }) => {
    const user = await requireUser(ctx);
    const clean = name.trim().slice(0, 80);
    if (!clean) throw new ConvexError("A company needs a name.");
    const id = await ctx.db.insert("companies", { ownerId: user._id, name: clean, useBranding: false });
    await ctx.db.patch(user._id, { space: id });
    return id as string;
  },
});
