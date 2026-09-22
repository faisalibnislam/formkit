import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { DataModel } from "./_generated/dataModel";
import { ResendResetOTP, ResendVerifyOTP } from "./email";

/**
 * Email and password only. Faisal's instruction: authentication is Convex's,
 * with no third-party identity provider.
 */
const FormkitPassword = Password<DataModel>({
  verify: ResendVerifyOTP,
  reset: ResendResetOTP,
  profile(params) {
    return {
      email: String(params.email ?? "")
        .trim()
        .toLowerCase(),
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

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [FormkitPassword],
});
