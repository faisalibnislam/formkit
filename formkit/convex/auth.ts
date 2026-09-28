import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import MicrosoftEntraID from "@auth/core/providers/microsoft-entra-id";
import { ConvexError } from "convex/values";
import { DataModel } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { ResendResetOTP, ResendVerifyOTP, normaliseEmail } from "./email";

/**
 * Email and password, run by Convex. Google and Microsoft sign-in exist only
 * for Business single sign-on, and only when their OAuth apps are set on the
 * deployment (see convex/sso.ts).
 */
const BasePassword = Password<DataModel>({
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
 * The password form refuses addresses at a domain whose company requires
 * single sign-on, and says which button to use instead.
 */
type Authorize = (params: Record<string, unknown>, ctx: { runQuery: (...a: never[]) => Promise<unknown> }) => Promise<unknown>;
const passwordOptions = (BasePassword as unknown as { options: { authorize: Authorize } }).options;
const passwordAuthorize = passwordOptions.authorize;
passwordOptions.authorize = async (params, ctx) => {
  const flow = params.flow;
  if (typeof params.email === "string" && (flow === "signIn" || flow === "signUp" || flow === "reset")) {
    const rule = (await (ctx.runQuery as unknown as (fn: unknown, a: unknown) => Promise<unknown>)(internal.sso.ruleFor, {
      email: normaliseEmail(params.email),
    })) as { domain: string; providers: string[] } | null;
    if (rule) {
      const names = rule.providers.map((p) => (p === "google" ? "Google" : "Microsoft")).join(" or ");
      throw new ConvexError({
        code: "sso",
        providers: rule.providers,
        message: `${rule.domain} signs in with ${names || "single sign-on"}. Use the button below.`,
      });
    }
  }
  return passwordAuthorize(params, ctx);
};
const FormkitPassword = BasePassword;

const oauth = [
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google] : []),
  ...(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
    ? [
        MicrosoftEntraID({
          issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? "https://login.microsoftonline.com/common/v2.0",
        }),
      ]
    : []),
];

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
  providers: [FormkitPassword, ...oauth],
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
