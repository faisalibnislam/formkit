import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./model/identity";
import { handleProblem, handleTaken, normaliseHandle } from "./model/handles";

/**
 * Is this name free?
 *
 * Claiming lives in `companies.claim`, which is the one claim path for every
 * identity — the person and each of their companies. This only answers the
 * question the field asks while somebody types, and it names the fix rather
 * than saying "invalid".
 */
export const check = query({
  args: { handle: v.string(), companyId: v.optional(v.id("companies")) },
  returns: v.object({
    handle: v.string(),
    ok: v.boolean(),
    problem: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { handle: raw, companyId }) => {
    const user = await requireUser(ctx);
    const handle = normaliseHandle(raw);
    if (!handle) return { handle, ok: false, problem: "Choose a name for your link." };

    const problem = handleProblem(handle);
    if (problem) return { handle, ok: false, problem };

    const existing = await handleTaken(ctx, handle);
    const mine =
      existing &&
      existing.userId === user._id &&
      (companyId ? existing.companyId === companyId : existing.ownerType === "user");

    if (existing && !mine) {
      return { handle, ok: false, problem: `“${handle}” is taken — try another name.` };
    }
    return { handle, ok: true, problem: null };
  },
});
