import { ConvexError, v } from "convex/values";
import {
  getAuthSessionId,
  getAuthUserId,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { currentUser, requireUser } from "./model/identity";
import { newSecret, otpauthUri, verifyTotp } from "./model/totp";
import { purgeFormData } from "./model/forms";
import { normaliseEmail } from "./email";
import { send } from "./notifications";
import { renderAuthCodeEmail } from "./emails/authCode";
import { renderSignInAlert } from "./emails/response";
import { notify } from "./model/inbox";

/** A security notice in the person's own bell, beside any email. */
async function securityNotice(ctx: MutationCtx, userId: Id<"users">, title: string, body: string) {
  await notify(ctx, userId, { kind: "security", title, body, href: "/app/settings", action: "Review security", icon: "shield" });
}

/**
 * Settings → Account → Password and Security.
 *
 * Two-factor is real: an authenticator app's six-digit code, checked on every
 * new session before `requireUser` lets that session read anything. Recovery
 * codes are stored hashed and each works once. Sessions are Convex Auth's own;
 * Formkit keeps a note of each one's device and when it was last seen, which
 * is what the sessions list, sign-in alerts and "Sign out everywhere" use.
 */

const SITE = process.env.SITE_URL ?? "https://formkit.app";
const DAY = 24 * 60 * 60 * 1000;
export const RESTORE_DAYS = 30;
const LOCK_AFTER = 5;
const LOCK_MS = 5 * 60 * 1000;

async function sha256(text: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function recoveryCodes(n = 8) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: n }, () => {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
}

async function infoFor(ctx: QueryCtx | MutationCtx, sessionId: Id<"authSessions">) {
  return ctx.db
    .query("sessionInfo")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .first();
}

/** Ends sessions, keeping the ones listed. Returns how many ended. */
async function endSessions(ctx: MutationCtx, userId: Id<"users">, keep: (Id<"authSessions"> | null)[]) {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();
  let n = 0;
  for (const s of sessions) {
    if (keep.includes(s._id)) continue;
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", s._id))
      .collect();
    for (const t of tokens) await ctx.db.delete(t._id);
    const info = await infoFor(ctx, s._id);
    if (info) await ctx.db.delete(info._id);
    await ctx.db.delete(s._id);
    n++;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* What Settings shows                                                 */
/* ------------------------------------------------------------------ */

export const status = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const current = await getAuthSessionId(ctx);
    const now = Date.now();
    const sessions = (
      await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .collect()
    ).filter((s) => s.expirationTime > now);
    const rows = await Promise.all(
      sessions.map(async (s) => {
        const info = await infoFor(ctx, s._id);
        return {
          _id: s._id,
          device: info?.device ?? "A browser",
          firstSeen: info?.firstSeen ?? s._creationTime,
          lastSeen: info?.lastSeen ?? s._creationTime,
          current: s._id === current,
        };
      }),
    );
    return {
      twoFactor: user.twoFactor
        ? { on: true, enabledAt: user.twoFactor.enabledAt, recoveryLeft: user.twoFactor.recovery.length }
        : { on: false, enabledAt: null, recoveryLeft: 0 },
      signInAlerts: user.signInAlerts !== false,
      emailChange: user.emailChange && user.emailChange.expiresAt > now ? { email: user.emailChange.email } : null,
      sessions: rows.sort((a, b) => Number(b.current) - Number(a.current) || b.lastSeen - a.lastSeen),
    };
  },
});

/**
 * Called by the app shell as it opens: remembers this session's device, and
 * the first time a session is seen for someone who has signed in before,
 * sends a sign-in alert unless they turned those off.
 */
export const touch = mutation({
  args: { device: v.string() },
  returns: v.null(),
  handler: async (ctx, { device }) => {
    const user = await currentUser(ctx);
    const sessionId = await getAuthSessionId(ctx);
    if (!user || !sessionId || user.deactivatedAt) return null;
    const now = Date.now();
    const label = device.slice(0, 80) || "A browser";
    const info = await infoFor(ctx, sessionId);
    if (info) {
      if (now - info.lastSeen > 60_000 || info.device !== label) {
        await ctx.db.patch(info._id, { lastSeen: now, device: label });
      }
      return null;
    }
    const before = await ctx.db
      .query("sessionInfo")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    await ctx.db.insert("sessionInfo", {
      sessionId,
      userId: user._id,
      device: label,
      firstSeen: now,
      lastSeen: now,
    });
    if (before && user.signInAlerts !== false) {
      await securityNotice(
        ctx,
        user._id,
        `New sign-in: ${label}`,
        "If this was not you, change your password and sign out everywhere.",
      );
    }
    if (before && user.signInAlerts !== false && user.email) {
      await ctx.scheduler.runAfter(0, internal.security.sendSignInAlert, {
        userId: user._id,
        to: user.email,
        device: label,
        at: now,
        zone: user.timezone ?? "UTC",
      });
    }
    return null;
  },
});

export const sendSignInAlert = internalAction({
  args: { userId: v.id("users"), to: v.string(), device: v.string(), at: v.number(), zone: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, to, device, at, zone }) => {
    let when: string;
    try {
      when = new Date(at).toLocaleString("en-GB", { timeZone: zone, dateStyle: "long", timeStyle: "short" });
    } catch {
      when = new Date(at).toUTCString();
    }
    const subject = "New sign-in to Formkit";
    const result = await send({
      to: [to],
      subject,
      html: renderSignInAlert({ device, when, link: `${SITE}/app/settings` }),
    });
    await ctx.runMutation(internal.notifications.record, { userId, kind: "security", to, subject, ...result });
    return null;
  },
});

export const setSignInAlerts = mutation({
  args: { on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { on }) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { signInAlerts: on });
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Two-factor                                                          */
/* ------------------------------------------------------------------ */

export const startTwoFactor = mutation({
  args: {},
  returns: v.object({ secret: v.string(), uri: v.string() }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user.twoFactor) throw new Error("Two-factor is already on.");
    const secret = newSecret();
    await ctx.db.patch(user._id, { twoFactorPending: { secret, at: Date.now() } });
    return { secret, uri: otpauthUri(secret, user.email ?? "you") };
  },
});

export const enableTwoFactor = mutation({
  args: { code: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), recovery: v.array(v.string()) }),
    v.object({ ok: v.literal(false), message: v.string() }),
  ),
  handler: async (ctx, { code }) => {
    const user = await requireUser(ctx);
    const pending = user.twoFactorPending;
    if (!pending || Date.now() - pending.at > 30 * 60 * 1000) {
      return { ok: false as const, message: "That setup expired. Start again to get a fresh code." };
    }
    const step = verifyTotp(pending.secret, code, Date.now());
    if (step === null) {
      return { ok: false as const, message: "That code did not match. Check the app and try the newest one." };
    }
    const codes = recoveryCodes();
    await ctx.db.patch(user._id, {
      twoFactor: {
        secret: pending.secret,
        enabledAt: Date.now(),
        lastStep: step,
        recovery: await Promise.all(codes.map((c) => sha256(`${user._id}:${c}`))),
      },
      twoFactorPending: undefined,
    });
    // The session that turned it on has just proved it.
    const sessionId = await getAuthSessionId(ctx);
    if (sessionId) {
      const info = await infoFor(ctx, sessionId);
      if (info) await ctx.db.patch(info._id, { twoFactorAt: Date.now() });
      else
        await ctx.db.insert("sessionInfo", {
          sessionId,
          userId: user._id,
          device: "This browser",
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          twoFactorAt: Date.now(),
        });
    }
    await securityNotice(ctx, user._id, "Two-factor is on", "Signing in now asks for a code from your authenticator app.");
    return { ok: true as const, recovery: codes };
  },
});

/** A six-digit code, or one of the recovery codes (which is then spent). */
async function checkSecondFactor(ctx: MutationCtx, user: Doc<"users">, code: string) {
  const tf = user.twoFactor;
  if (!tf) return true;
  const step = verifyTotp(tf.secret, code, Date.now(), tf.lastStep);
  if (step !== null) {
    await ctx.db.patch(user._id, { twoFactor: { ...tf, lastStep: step } });
    return true;
  }
  const hash = await sha256(`${user._id}:${code.trim().toLowerCase()}`);
  if (tf.recovery.includes(hash)) {
    await ctx.db.patch(user._id, { twoFactor: { ...tf, recovery: tf.recovery.filter((r) => r !== hash) } });
    return true;
  }
  return false;
}

export const disableTwoFactor = mutation({
  args: { code: v.string() },
  returns: v.object({ ok: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, { code }) => {
    const user = await requireUser(ctx);
    if (!user.twoFactor) return { ok: true };
    if (!(await checkSecondFactor(ctx, user, code))) {
      return { ok: false, message: "That code did not match. Use the newest one from your app, or a recovery code." };
    }
    await ctx.db.patch(user._id, { twoFactor: undefined });
    await securityNotice(ctx, user._id, "Two-factor is off", "Signing in now asks only for your password.");
    return { ok: true };
  },
});

export const newRecoveryCodes = mutation({
  args: { code: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), recovery: v.array(v.string()) }),
    v.object({ ok: v.literal(false), message: v.string() }),
  ),
  handler: async (ctx, { code }) => {
    const user = await requireUser(ctx);
    if (!user.twoFactor) return { ok: false as const, message: "Two-factor is off." };
    if (!(await checkSecondFactor(ctx, user, code))) {
      return { ok: false as const, message: "That code did not match." };
    }
    const fresh = (await ctx.db.get(user._id))!.twoFactor!;
    const codes = recoveryCodes();
    await ctx.db.patch(user._id, {
      twoFactor: { ...fresh, recovery: await Promise.all(codes.map((c) => sha256(`${user._id}:${c}`))) },
    });
    return { ok: true as const, recovery: codes };
  },
});

/**
 * The sign-in step after the password, for an account with two-factor on.
 * Reached through `currentUser`, since `requireUser` is exactly what refuses
 * this session until it succeeds. Five wrong codes lock it for five minutes.
 */
export const verifySession = mutation({
  args: { code: v.string() },
  returns: v.object({ ok: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, { code }) => {
    const user = await currentUser(ctx);
    const sessionId = await getAuthSessionId(ctx);
    if (!user || !sessionId) return { ok: false, message: "Sign in again to continue." };
    if (!user.twoFactor) return { ok: true };
    const now = Date.now();
    let info = await infoFor(ctx, sessionId);
    if (!info) {
      const id = await ctx.db.insert("sessionInfo", {
        sessionId,
        userId: user._id,
        device: "A browser",
        firstSeen: now,
        lastSeen: now,
      });
      info = (await ctx.db.get(id))!;
    }
    if (info.lockedUntil && info.lockedUntil > now) {
      const mins = Math.ceil((info.lockedUntil - now) / 60000);
      return { ok: false, message: `Too many tries. Wait ${mins} ${mins === 1 ? "minute" : "minutes"} and try again.` };
    }
    if (await checkSecondFactor(ctx, user, code)) {
      await ctx.db.patch(info._id, { twoFactorAt: now, failures: 0, lockedUntil: undefined });
      return { ok: true };
    }
    const failures = (info.failures ?? 0) + 1;
    await ctx.db.patch(info._id, {
      failures: failures >= LOCK_AFTER ? 0 : failures,
      lockedUntil: failures >= LOCK_AFTER ? now + LOCK_MS : undefined,
    });
    return { ok: false, message: "That code did not match. Use the newest one from your app, or a recovery code." };
  },
});

/* ------------------------------------------------------------------ */
/* Sessions and password                                               */
/* ------------------------------------------------------------------ */

export const signOutOthers = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const current = await getAuthSessionId(ctx);
    return endSessions(ctx, user._id, [current]);
  },
});

export const signOutSession = mutation({
  args: { sessionId: v.id("authSessions") },
  returns: v.null(),
  handler: async (ctx, { sessionId }) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== user._id) return null;
    const others = (
      await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .collect()
    )
      .filter((s) => s._id !== sessionId)
      .map((s) => s._id);
    await endSessions(ctx, user._id, others);
    return null;
  },
});

export const me = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return { userId: user._id, email: user.email ?? null };
  },
});

export const endOtherSessions = internalMutation({
  args: { userId: v.id("users"), keep: v.optional(v.id("authSessions")) },
  returns: v.number(),
  handler: async (ctx, { userId, keep }) => {
    const n = await endSessions(ctx, userId, [keep ?? null]);
    await securityNotice(
      ctx,
      userId,
      "Your password was changed",
      n ? `${n} other ${n === 1 ? "device was" : "devices were"} signed out.` : "If this was not you, reset it now.",
    );
    return n;
  },
});

/**
 * Changing the password needs the current one. Every other session is signed
 * out afterwards; this one stays.
 */
export const changePassword = action({
  args: { current: v.string(), next: v.string() },
  returns: v.object({ signedOut: v.number() }),
  handler: async (ctx, { current, next }): Promise<{ signedOut: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in to do that.");
    const who: { userId: Id<"users">; email: string | null } = await ctx.runQuery(internal.security.me, {});
    if (!who.email) throw new ConvexError("This account has no email to sign in with.");
    if (next.length < 10) throw new ConvexError("Use at least 10 characters.");
    if (next === current) throw new ConvexError("That is the password you already have.");
    try {
      await retrieveAccount(ctx, { provider: "password", account: { id: who.email, secret: current } });
    } catch {
      throw new ConvexError("Your current password is not right.");
    }
    await modifyAccountCredentials(ctx, { provider: "password", account: { id: who.email, secret: next } });
    const keep = (await getAuthSessionId(ctx)) ?? undefined;
    const signedOut: number = await ctx.runMutation(internal.security.endOtherSessions, { userId, keep });
    return { signedOut };
  },
});

/* ------------------------------------------------------------------ */
/* Changing the sign-in email                                          */
/* ------------------------------------------------------------------ */

export const requestEmailChange = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, { email }) => {
    const user = await requireUser(ctx);
    const next = normaliseEmail(email);
    if (!next || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) throw new ConvexError("That does not look like an email address.");
    if (next === user.email) throw new ConvexError("That is already your email.");
    const taken =
      (await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", next))
        .first()) ??
      (await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", next))
        .first());
    if (taken) throw new ConvexError("Another Formkit account already uses that email.");
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const code = String(bytes[0]! % 1_000_000).padStart(6, "0");
    const expiresAt = Date.now() + 15 * 60 * 1000;
    await ctx.db.patch(user._id, {
      emailChange: { email: next, codeHash: await sha256(`${user._id}:${code}`), expiresAt, tries: 0 },
    });
    await ctx.scheduler.runAfter(0, internal.security.sendEmailCode, {
      userId: user._id,
      to: next,
      code,
      expiresAt,
    });
    return null;
  },
});

export const sendEmailCode = internalAction({
  args: { userId: v.id("users"), to: v.string(), code: v.string(), expiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { userId, to, code, expiresAt }) => {
    const subject = `${code} is your Formkit code`;
    const result = await send({
      to: [to],
      subject,
      html: renderAuthCodeEmail({
        token: code,
        expires: new Date(expiresAt),
        heading: "Confirm your new email",
        lede: "Enter this code in Settings to make this your Formkit sign-in address.",
      }),
    });
    await ctx.runMutation(internal.notifications.record, { userId, kind: "security", to, subject, ...result });
    return null;
  },
});

export const confirmEmailChange = mutation({
  args: { code: v.string() },
  returns: v.object({ ok: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, { code }) => {
    const user = await requireUser(ctx);
    const pending = user.emailChange;
    if (!pending || pending.expiresAt < Date.now()) {
      return { ok: false, message: "That code has expired. Ask for a new one." };
    }
    if (pending.tries >= 5) return { ok: false, message: "Too many tries. Ask for a new code." };
    if ((await sha256(`${user._id}:${code.trim()}`)) !== pending.codeHash) {
      await ctx.db.patch(user._id, { emailChange: { ...pending, tries: pending.tries + 1 } });
      return { ok: false, message: "That code did not match." };
    }
    const clash = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", pending.email))
      .first();
    if (clash) return { ok: false, message: "Another Formkit account took that email in the meantime." };
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id).eq("provider", "password"))
      .collect();
    for (const a of accounts) await ctx.db.patch(a._id, { providerAccountId: pending.email });
    await ctx.db.patch(user._id, {
      email: pending.email,
      emailVerificationTime: Date.now(),
      emailChange: undefined,
    });
    await securityNotice(ctx, user._id, "Your sign-in email changed", `You sign in with ${pending.email} from now on.`);
    return { ok: true };
  },
});

export const cancelEmailChange = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { emailChange: undefined });
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Deleting and restoring the account                                  */
/* ------------------------------------------------------------------ */

/**
 * Deleting deactivates straight away: every collecting form closes, every
 * session ends, and the data waits 30 days in case they change their mind.
 */
export const deleteAccount = mutation({
  args: { confirm: v.string() },
  returns: v.object({ purgeAt: v.number() }),
  handler: async (ctx, { confirm }) => {
    const user = await requireUser(ctx);
    if (confirm.trim().toLowerCase() !== "delete") throw new ConvexError('Type "delete" to confirm.');
    const now = Date.now();
    const forms = await ctx.db
      .query("forms")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    for (const f of forms) {
      if (f.status !== "published") continue;
      await ctx.db.patch(f._id, {
        status: "closed",
        closing: { ...(f.closing ?? {}), closedBy: "account", closedAt: now },
      });
    }
    await ctx.db.patch(user._id, { deactivatedAt: now, selfDeletedAt: now });
    await endSessions(ctx, user._id, []);
    return { purgeAt: now + RESTORE_DAYS * DAY };
  },
});

/** Inside the 30 days, one click brings it all back the way it was left. */
export const reactivate = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    // Only a person who deleted their own account can bring it back; a
    // suspension is lifted by staff, never from here.
    if (!user?.selfDeletedAt) return null;
    if (Date.now() - user.selfDeletedAt > RESTORE_DAYS * DAY) {
      throw new ConvexError("The 30 days have passed, so this account can no longer be restored.");
    }
    await ctx.db.patch(user._id, { deactivatedAt: undefined, selfDeletedAt: undefined });
    const forms = await ctx.db
      .query("forms")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    for (const f of forms) {
      if (f.status === "closed" && f.closing?.closedBy === "account") {
        const { closedBy: _by, closedAt: _at, ...rest } = f.closing;
        void _by;
        void _at;
        await ctx.db.patch(f._id, { status: "published", closing: rest });
      }
    }
    return null;
  },
});

/**
 * Accounts their owners deleted more than 30 days ago are erased for good. A
 * suspension by staff is never erased by this.
 */
export const purgeDeactivated = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - RESTORE_DAYS * DAY;
    const users = (
      await ctx.db
        .query("users")
        .withIndex("by_self_deleted", (q) => q.gt("selfDeletedAt", 0).lt("selfDeletedAt", cutoff))
        .take(20)
    ).filter((u) => !u.staffRole && u.deactivatedAt !== undefined);
    // One account per run keeps each transaction small; the cron comes back.
    const user = users[0];
    if (!user) return 0;
    const forms = await ctx.db
      .query("forms")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    for (const f of forms) await purgeFormData(ctx, f);
    for (const table of ["companies", "templates"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect();
      for (const row of rows) {
        if (table === "companies" && "logoId" in row && row.logoId) await ctx.storage.delete(row.logoId).catch(() => undefined);
        if (table === "companies" && "markId" in row && row.markId) await ctx.storage.delete(row.markId).catch(() => undefined);
        await ctx.db.delete(row._id);
      }
    }
    const handles = await ctx.db
      .query("handles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const h of handles) await ctx.db.delete(h._id);
    const logs = await ctx.db
      .query("emailLog")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of logs) await ctx.db.delete(row._id);
    const exports = await ctx.db
      .query("exports")
      .withIndex("by_user_at", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of exports) await ctx.db.delete(row._id);
    const infos = await ctx.db
      .query("sessionInfo")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of infos) await ctx.db.delete(row._id);
    await endSessions(ctx, user._id, []);
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
      .collect();
    for (const a of accounts) await ctx.db.delete(a._id);
    if (user.avatarId) await ctx.storage.delete(user.avatarId).catch(() => undefined);
    await ctx.db.delete(user._id);
    return users.length - 1;
  },
});
