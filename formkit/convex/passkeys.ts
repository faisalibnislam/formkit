import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./model/identity";
import { notify } from "./model/inbox";
import { ES256, RS256, checkRegistration, relyingParty } from "./model/webauthn";
import { b64url } from "./model/webPush";

/**
 * Settings → Account → Passkeys, and "Sign in with a passkey".
 *
 * Adding one: `registerOptions`, the browser makes the key, `register` checks
 * it. Signing in: `signInOptions`, the browser signs, and the "passkey"
 * provider in auth.ts checks the signature (model/webauthn.ts) and opens a
 * session that has passed two-factor - the passkey checked the person.
 */

const CHALLENGE_MS = 5 * 60 * 1000;
const MAX_PASSKEYS = 10;
/** Convex Auth's own session length. */
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

async function issue(ctx: MutationCtx, kind: "register" | "signIn", userId?: Id<"users">) {
  // Old challenges nobody answered go a few at a time.
  for (const old of await ctx.db
    .query("passkeyChallenges")
    .withIndex("by_expires", (q) => q.lt("expiresAt", Date.now()))
    .take(20)) {
    await ctx.db.delete(old._id);
  }
  const challenge = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await ctx.db.insert("passkeyChallenges", { challenge, kind, userId, expiresAt: Date.now() + CHALLENGE_MS });
  return challenge;
}

/** Uses up a challenge: true only the first time, before it expires. */
async function consume(ctx: MutationCtx, challenge: string, kind: "register" | "signIn", userId?: Id<"users">) {
  const row = await ctx.db
    .query("passkeyChallenges")
    .withIndex("by_challenge", (q) => q.eq("challenge", challenge))
    .unique();
  if (!row) return false;
  await ctx.db.delete(row._id);
  return row.kind === kind && row.userId === userId && row.expiresAt > Date.now();
}

const shown = (p: Doc<"passkeys">) => ({ _id: p._id, name: p.name, createdAt: p.createdAt, lastUsedAt: p.lastUsedAt ?? null });

export const list = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const rows = await ctx.db
      .query("passkeys")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .take(MAX_PASSKEYS);
    return rows.map(shown);
  },
});

/** What the browser needs to make a passkey for this account. */
export const registerOptions = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const mine = await ctx.db
      .query("passkeys")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .take(MAX_PASSKEYS);
    if (mine.length >= MAX_PASSKEYS) throw new ConvexError(`An account can have ${MAX_PASSKEYS} passkeys. Remove one first.`);
    const rp = relyingParty();
    return {
      challenge: await issue(ctx, "register", me._id),
      rp: { id: rp.id, name: "Formkit" },
      user: { id: b64url(new TextEncoder().encode(me._id)), name: me.email ?? me._id, displayName: me.name ?? me.email ?? "Formkit" },
      pubKeyCredParams: [
        { type: "public-key" as const, alg: ES256 },
        { type: "public-key" as const, alg: RS256 },
      ],
      authenticatorSelection: { residentKey: "required" as const, requireResidentKey: true, userVerification: "required" as const },
      attestation: "none" as const,
      excludeCredentials: mine.map((p) => ({ type: "public-key" as const, id: p.credentialId, transports: p.transports })),
      timeout: CHALLENGE_MS,
    };
  },
});

const newCredential = v.object({
  id: v.string(),
  clientDataJSON: v.string(),
  attestationObject: v.string(),
  transports: v.optional(v.array(v.string())),
});

/** Checks the new passkey the browser made, and keeps it. */
export const register = action({
  args: { credential: newCredential, name: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { credential, name }) => {
    let checked;
    try {
      checked = await checkRegistration(credential, relyingParty());
    } catch (e) {
      throw new ConvexError(e instanceof Error ? e.message : "That passkey couldn't be added.");
    }
    await ctx.runMutation(internal.passkeys.store, {
      ...checked,
      transports: credential.transports?.filter((t) => /^[a-z-]{2,20}$/.test(t)).slice(0, 6),
      name: name?.trim().slice(0, 60) || "Passkey",
    });
    return null;
  },
});

export const store = internalMutation({
  args: {
    challenge: v.string(),
    credentialId: v.string(),
    alg: v.number(),
    publicKey: v.string(),
    signCount: v.number(),
    transports: v.optional(v.array(v.string())),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { challenge, ...key }) => {
    const me = await requireUser(ctx);
    if (!(await consume(ctx, challenge, "register", me._id))) throw new ConvexError("That took too long. Try adding the passkey again.");
    const taken = await ctx.db
      .query("passkeys")
      .withIndex("by_credential", (q) => q.eq("credentialId", key.credentialId))
      .first();
    if (taken) throw new ConvexError("That passkey is already on an account.");
    await ctx.db.insert("passkeys", { ...key, userId: me._id, createdAt: Date.now() });
    await notify(ctx, me._id, {
      kind: "security",
      title: "A passkey was added to your account",
      body: `“${key.name}” can now sign you in. If this wasn't you, remove it and change your password.`,
      href: "/app/settings?tab=account",
      icon: "key-round",
    });
    return null;
  },
});

export const rename = mutation({
  args: { id: v.id("passkeys"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, name }) => {
    const me = await requireUser(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.userId !== me._id) throw new ConvexError("That passkey isn't on your account.");
    await ctx.db.patch(id, { name: name.trim().slice(0, 60) || "Passkey" });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("passkeys") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const me = await requireUser(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.userId !== me._id) throw new ConvexError("That passkey isn't on your account.");
    await ctx.db.delete(id);
    await notify(ctx, me._id, {
      kind: "security",
      title: "A passkey was removed from your account",
      body: `“${row.name}” can no longer sign you in.`,
      href: "/app/settings?tab=account",
      icon: "key-round",
    });
    return null;
  },
});

/** What the browser needs to sign in with any passkey for this site. */
export const signInOptions = mutation({
  args: {},
  handler: async (ctx) => ({
    challenge: await issue(ctx, "signIn"),
    rpId: relyingParty().id,
    userVerification: "required" as const,
    timeout: CHALLENGE_MS,
  }),
});

/** Sign-in, step one: the challenge is used up, and the passkey looked up. */
export const forSignIn = internalMutation({
  args: { challenge: v.string(), credentialId: v.string() },
  handler: async (ctx, { challenge, credentialId }) => {
    if (!(await consume(ctx, challenge, "signIn"))) return { ok: false as const, message: "That took too long. Try again." };
    const key = await ctx.db
      .query("passkeys")
      .withIndex("by_credential", (q) => q.eq("credentialId", credentialId))
      .first();
    const user = key ? await ctx.db.get(key.userId) : null;
    if (!key || !user || user.selfDeletedAt) {
      return { ok: false as const, message: "That passkey isn't on a Formkit account. Sign in with your password, then add it again." };
    }
    return {
      ok: true as const,
      id: key._id,
      userId: user._id,
      email: user.email ?? null,
      alg: key.alg,
      publicKey: key.publicKey,
      signCount: key.signCount,
    };
  },
});

/** Sign-in, step two: the signature checked out, so a session opens. */
export const signedIn = internalMutation({
  args: { id: v.id("passkeys"), signCount: v.number() },
  returns: v.id("authSessions"),
  handler: async (ctx, { id, signCount }) => {
    const key = await ctx.db.get(id);
    if (!key) throw new ConvexError("That passkey was just removed.");
    const now = Date.now();
    await ctx.db.patch(id, { signCount, lastUsedAt: now });
    const sessionId = await ctx.db.insert("authSessions", { userId: key.userId, expirationTime: now + SESSION_MS });
    // The passkey checked the person as well as the device: two factors.
    await ctx.db.insert("sessionInfo", {
      sessionId,
      userId: key.userId,
      device: "A browser",
      firstSeen: now,
      lastSeen: now,
      twoFactorAt: now,
    });
    return sessionId;
  },
});
