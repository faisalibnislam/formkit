import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import Google from "@auth/core/providers/google";
import { ConvexError } from "convex/values";
import { DataModel } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { ResendResetOTP, ResendVerifyOTP, normaliseEmail } from "./email";
import { bootstrapStaffRole, googleProfile } from "./model/oauthProfile";
import { checkAssertion, readClientData, relyingParty, type Assertion } from "./model/webauthn";

/**
 * Email and password, run by Convex, plus passkeys and Google sign-in for
 * everyone when Google's OAuth app is set on the deployment. Business
 * companies can require Google for their domain (see convex/sso.ts).
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
      throw new Error("Passwords need at least 10 characters. Add a few more.");
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
      const names = rule.providers.map(() => "Google").join(" or ");
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

// Google only ever vouches for an address it has verified (see
// model/oauthProfile.ts): otherwise it could sign someone into another
// person's account.
const oauth = [
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [Google({ profile: (p) => googleProfile(p as unknown as Record<string, unknown>) })]
    : []),
];

/**
 * "Sign in with a passkey": the browser's signed answer to a challenge from
 * passkeys.signInOptions. Checked here (model/webauthn.ts), it opens a session
 * that has passed two-factor, since the passkey verified the person too.
 * Companies that require single sign-on are refused, as with passwords.
 */
const Passkey = ConvexCredentials<DataModel>({
  id: "passkey",
  authorize: async (params, ctx) => {
    let assertion: Assertion;
    try {
      assertion = JSON.parse(String(params.assertion)) as Assertion;
      if (![assertion.id, assertion.clientDataJSON, assertion.authenticatorData, assertion.signature].every((x) => typeof x === "string")) {
        throw new Error();
      }
    } catch {
      throw new ConvexError({ code: "passkey", message: "The browser's reply can't be read. Try again." });
    }
    const client = readClientData(assertion.clientDataJSON);
    const key = await ctx.runMutation(internal.passkeys.forSignIn, { challenge: client.challenge, credentialId: assertion.id });
    if (!key.ok) throw new ConvexError({ code: "passkey", message: key.message });
    if (key.email) {
      const rule = await ctx.runQuery(internal.sso.ruleFor, { email: key.email });
      if (rule) {
        const names = rule.providers.map(() => "Google").join(" or ");
        throw new ConvexError({ code: "sso", providers: rule.providers, message: `${rule.domain} signs in with ${names || "single sign-on"}. Use the button below.` });
      }
    }
    let signCount: number;
    try {
      ({ signCount } = await checkAssertion(assertion, key, relyingParty()));
    } catch (e) {
      throw new ConvexError({ code: "passkey", message: e instanceof Error ? e.message : "That passkey didn't check out." });
    }
    const sessionId = await ctx.runMutation(internal.passkeys.signedIn, { id: key.id, signCount });
    return { userId: key.userId, sessionId };
  },
});

/**
 * How the first staff account comes to exist.
 *
 * The admin console is gated on `staffRole`, and nothing in the product can
 * grant it - so without this, a fresh deployment has a console nobody can
 * reach. `STAFF_EMAILS` on the Convex deployment is a comma-separated list of
 * addresses that get the owner role once, when a new account proves it owns
 * one of them (the emailed code, or a provider-verified sign-in). Everyone
 * else's role is only ever changed from inside the console.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [FormkitPassword, Passkey, ...oauth],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId }) {
      // Runs on sign-up and again when the emailed code is entered, which is
      // when a password account's address becomes verified.
      const user = await ctx.db.get(userId);
      const role = bootstrapStaffRole(user, process.env.STAFF_EMAILS, Date.now());
      if (role) await ctx.db.patch(userId, { staffRole: role, staffBootstrapAt: Date.now() });
    },
  },
});
