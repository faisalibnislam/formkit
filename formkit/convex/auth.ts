import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { DataModel } from "./_generated/dataModel";
import { ResendResetOTP, ResendVerifyOTP, normaliseEmail } from "./email";

/**
 * Email and password only. Faisal's instruction: authentication is Convex's,
 * with no third-party identity provider.
 */
const FormkitPassword = Password<DataModel>({
  verify: ResendVerifyOTP,
  reset: ResendResetOTP,
  profile(params) {
    return {
      // The same spelling the Email providers compare against.
      email: normaliseEmail(params.email),
      name: typeof params.name === "string" ? params.name.trim() : undefined,
    };
  },
  validatePasswordRequirements(password) {
    // The sign-up card states this rule, so the error can name the fix.
    if (password.length < 10) {
      throw new Error("Passwords need at least 10 characters — add a few more.");
    }
  },
});

/**
 * How the first staff account comes to exist.
 *
 * The admin console is gated on `staffRole`, and nothing in the product can
 * grant it — so without this, a fresh deployment has a console nobody can
 * reach. `STAFF_EMAILS` on the Convex deployment is a comma-separated list of
 * addresses that get the owner role the first time they sign in. Everyone
 * else's role is only ever changed from inside the console.
 */
function bootstrapStaff(email: string | undefined) {
  if (!email) return undefined;
  const listed = (process.env.STAFF_EMAILS ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  return listed.includes(email.toLowerCase()) ? ("owner" as const) : undefined;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [FormkitPassword],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      // Only on the way in — an existing person's role is the console's to set.
      if (existingUserId) return;
      const user = await ctx.db.get(userId);
      const role = bootstrapStaff(user?.email);
      if (role) await ctx.db.patch(userId, { staffRole: role });
    },
  },
});
