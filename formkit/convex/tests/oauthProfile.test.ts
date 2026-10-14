import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import { BOOTSTRAP_WINDOW, UnverifiedEmailError, bootstrapStaffRole, googleProfile, microsoftProfile } from "../model/oauthProfile";
import { backend } from "./fixtures.helpers";

describe("Microsoft sign-in only vouches for verified addresses", () => {
  test("refuses an email the tenant has not verified (nOAuth)", () => {
    expect(() => microsoftProfile({ sub: "a", email: "ceo@victim.com" })).toThrow(UnverifiedEmailError);
    expect(() => microsoftProfile({ sub: "a", email: "ceo@victim.com", xms_edov: false })).toThrow(UnverifiedEmailError);
  });
  test("accepts a domain-owner-verified email, normalised", () => {
    const p = microsoftProfile({ sub: "a", name: "Ada", email: " Ada@Acme.com ", xms_edov: true });
    expect(p).toMatchObject({ id: "a", email: "ada@acme.com", emailVerified: true });
    expect(microsoftProfile({ sub: "b", email: "b@acme.com", xms_edov: "1" }).emailVerified).toBe(true);
  });
});

describe("Google sign-in only vouches for verified addresses", () => {
  test("refuses an unverified email", () => {
    expect(() => googleProfile({ sub: "g", email: "x@example.com", email_verified: false })).toThrow(UnverifiedEmailError);
  });
  test("accepts a verified email", () => {
    expect(googleProfile({ sub: "g", email: "x@example.com", email_verified: true }).emailVerified).toBe(true);
  });
});

describe("STAFF_EMAILS bootstrap", () => {
  const now = 1_000_000_000_000;
  const base = { email: "boss@formkit.app", _creationTime: now - 1000 };
  const listed = "boss@formkit.app, other@formkit.app";

  test("grants owner once the address is verified", () => {
    expect(bootstrapStaffRole({ ...base, emailVerificationTime: now }, listed, now)).toBe("owner");
  });
  test("never for an unverified address", () => {
    expect(bootstrapStaffRole(base, listed, now)).toBeUndefined();
  });
  test("never twice, and never to an old account", () => {
    expect(bootstrapStaffRole({ ...base, emailVerificationTime: now, staffBootstrapAt: now - 5 }, listed, now)).toBeUndefined();
    expect(bootstrapStaffRole({ ...base, emailVerificationTime: now, staffRole: "admin" }, listed, now)).toBeUndefined();
    expect(
      bootstrapStaffRole({ ...base, _creationTime: now - BOOTSTRAP_WINDOW - 1, emailVerificationTime: now }, listed, now),
    ).toBeUndefined();
  });
  test("only for listed addresses", () => {
    expect(bootstrapStaffRole({ ...base, email: "someone@else.com", emailVerificationTime: now }, listed, now)).toBeUndefined();
  });
});

test("the link audit finds OAuth accounts added onto password accounts", async () => {
  const t = backend();
  const userId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "victim@acme.com" });
    await ctx.db.insert("authAccounts", { userId, provider: "password", providerAccountId: "victim@acme.com" });
    await ctx.db.insert("authAccounts", { userId, provider: "microsoft-entra-id", providerAccountId: "attacker-sub" });
    const clean = await ctx.db.insert("users", { email: "ms-first@acme.com" });
    await ctx.db.insert("authAccounts", { userId: clean, provider: "microsoft-entra-id", providerAccountId: "sub2" });
    return userId;
  });
  const found = await t.query(internal.security.oauthLinkAudit, {});
  expect(found.map((f) => f.userId)).toEqual([userId]);
});
