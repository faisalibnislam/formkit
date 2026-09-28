import { query } from "./_generated/server";
import { currentUser } from "./model/identity";
import { flagsFor } from "./model/flags";

/** Which flags are on for whoever is looking. Signed out, the defaults. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    return flagsFor(ctx, user?._id ?? null);
  },
});
