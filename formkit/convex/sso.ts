import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { requireUser } from "./model/identity";
import { hasFeature, requireFeature } from "./model/plans";
import { audit } from "./model/team";

/**
 * Business: single sign-on, the practical way. A company proves it owns its
 * email domain with a DNS TXT record; after that, anyone with an address at
 * that domain signs in with Google or Microsoft — the password form refuses
 * them — so leaving the company's directory means losing access here too.
 *
 * Google and Microsoft sign-in need their OAuth apps set on the deployment
 * (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET, AUTH_MICROSOFT_ENTRA_ID_ID /
 * AUTH_MICROSOFT_ENTRA_ID_SECRET). Without them the buttons do not show and
 * enforcement cannot be turned on.
 */

type Provider = "google" | "microsoft-entra-id";

export function configuredProviders(): Provider[] {
  const out: Provider[] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) out.push("google");
  if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) out.push("microsoft-entra-id");
  return out;
}

/** For the sign-in card: which "Continue with…" buttons to show. */
export const providers = query({
  args: {},
  handler: async () => configuredProviders(),
});

const PUBLIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "gmx.com",
  "yandex.com",
]);

function cleanDomain(raw: string) {
  const d = raw.trim().toLowerCase().replace(/^@/, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return null;
  return d;
}

export const settings = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    return {
      sso: me.sso
        ? {
            domain: me.sso.domain,
            verified: me.sso.verified,
            enforce: me.sso.enforce,
            providers: me.sso.providers,
            record: { type: "TXT", name: `_formkit.${me.sso.domain}`, value: `formkit-verify=${me.sso.token}` },
          }
        : null,
      available: configuredProviders(),
    };
  },
});

export const setDomain = mutation({
  args: { domain: v.string() },
  returns: v.null(),
  handler: async (ctx, { domain }) => {
    const me = await requireUser(ctx);
    await requireFeature(ctx, me._id, "sso");
    const d = cleanDomain(domain);
    if (!d) throw new ConvexError("Enter a domain, like acme.com.");
    if (PUBLIC_DOMAINS.has(d)) throw new ConvexError("That is a public email service. Use your company's own domain.");
    const taken = await ctx.db
      .query("users")
      .withIndex("by_sso_domain", (q) => q.eq("sso.domain", d))
      .collect();
    if (taken.some((u) => u._id !== me._id && u.sso?.verified)) {
      throw new ConvexError("Another Formkit account already runs sign-in for that domain.");
    }
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    await ctx.db.patch(me._id, {
      sso: {
        domain: d,
        token: [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(""),
        verified: false,
        enforce: false,
        providers: configuredProviders(),
      },
    });
    await audit(ctx, me._id, me, "Started single sign-on setup", d);
    return null;
  },
});

export const remove = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    if (!me.sso) return null;
    await ctx.db.patch(me._id, { sso: undefined });
    await audit(ctx, me._id, me, "Removed single sign-on", me.sso.domain);
    return null;
  },
});

export const setEnforced = mutation({
  args: { enforce: v.boolean(), providers: v.optional(v.array(v.union(v.literal("google"), v.literal("microsoft-entra-id")))) },
  returns: v.null(),
  handler: async (ctx, { enforce, providers }) => {
    const me = await requireUser(ctx);
    if (!me.sso) throw new ConvexError("Add your domain first.");
    if (enforce) {
      await requireFeature(ctx, me._id, "sso");
      if (!me.sso.verified) throw new ConvexError("Verify the domain first.");
      if (!configuredProviders().length) throw new ConvexError("Google and Microsoft sign-in are not switched on for Formkit yet.");
      // The owner must not lock themselves out: their own address needs a way in.
      if (me.email?.endsWith(`@${me.sso.domain}`) && !(await hasOAuth(ctx, me))) {
        throw new ConvexError("Sign in once with Google or Microsoft yourself before requiring it for everyone.");
      }
    }
    const allowed = (providers ?? me.sso.providers).filter((p) => configuredProviders().includes(p));
    await ctx.db.patch(me._id, { sso: { ...me.sso, enforce, providers: allowed.length ? allowed : configuredProviders() } });
    await audit(ctx, me._id, me, enforce ? "Required single sign-on" : "Stopped requiring single sign-on", me.sso.domain);
    return null;
  },
});

async function hasOAuth(ctx: Parameters<typeof requireUser>[0], user: Doc<"users">) {
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
    .collect();
  return accounts.some((a) => a.provider === "google" || a.provider === "microsoft-entra-id");
}

/** Checks the TXT record over DNS-over-HTTPS. */
export const verify = action({
  args: {},
  returns: v.boolean(),
  handler: async (ctx): Promise<boolean> => {
    const row: { domain: string; token: string } | null = await ctx.runQuery(internal.sso.mine, {});
    if (!row) throw new ConvexError("Add your domain first.");
    const res = await fetch(`https://dns.google/resolve?name=_formkit.${encodeURIComponent(row.domain)}&type=TXT`, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    const data = (res?.ok ? await res.json().catch(() => null) : null) as { Answer?: { data?: string }[] } | null;
    const found = (data?.Answer ?? []).some((a) => (a.data ?? "").replace(/"/g, "").trim() === `formkit-verify=${row.token}`);
    if (found) await ctx.runMutation(internal.sso.markVerified, {});
    return found;
  },
});

export const mine = internalQuery({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    return me.sso ? { domain: me.sso.domain, token: me.sso.token } : null;
  },
});

export const markVerified = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    if (!me.sso) return null;
    await ctx.db.patch(me._id, { sso: { ...me.sso, verified: true } });
    await audit(ctx, me._id, me, "Verified the sign-in domain", me.sso.domain);
    return null;
  },
});

/** Used by the password sign-in: is this address required to use SSO? */
export const ruleFor = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return null;
    const owners = await ctx.db
      .query("users")
      .withIndex("by_sso_domain", (q) => q.eq("sso.domain", domain))
      .collect();
    for (const o of owners) {
      if (o.sso?.verified && o.sso.enforce && (await hasFeature(ctx, o, "sso"))) {
        return { domain, providers: o.sso.providers };
      }
    }
    return null;
  },
});
