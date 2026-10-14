import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { proratedRefund } from "../billing";
import { isSealed, seal, unseal } from "../model/sealed";
import { backend, form, member, person, response, share } from "./fixtures.helpers";

afterEach(() => vi.unstubAllEnvs());

describe("secrets at rest", () => {
  test("seal and unseal round-trip, and sealed text hides the key", async () => {
    vi.stubEnv("SECRETS_KEY", btoa(String.fromCharCode(...new Uint8Array(32).fill(7))));
    const sealed = await seal("rk_live_abc123SECRET");
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain("SECRET");
    expect(await unseal(sealed)).toBe("rk_live_abc123SECRET");
  });
  test("without SECRETS_KEY values pass through, and old plain values still read", async () => {
    vi.stubEnv("SECRETS_KEY", "");
    expect(await seal("rk_test_x")).toBe("rk_test_x");
    expect(await unseal("rk_test_plain")).toBe("rk_test_plain");
  });
});

describe("prorated refunds", () => {
  const day = 86_400_000;
  test("refunds the unused share of the period", () => {
    // $60 paid, 30-day period, 10 days used: $40 back.
    expect(proratedRefund({ total_amount: 6000 }, 0, 30 * day, 10 * day)).toBe(4000);
  });
  test("subtracts what was already refunded, and skips crumbs and ended periods", () => {
    expect(proratedRefund({ total_amount: 6000, refunded_amount: 3000 }, 0, 30 * day, 15 * day)).toBe(1500);
    expect(proratedRefund({ total_amount: 600 }, 0, 30 * day, 29.99 * day)).toBe(0);
    expect(proratedRefund({ total_amount: 6000 }, 0, 30 * day, 31 * day)).toBe(0);
  });
});

/**
 * Every table, every field: no value left that is the erased user's id or
 * email. The staff audit log is the one exception, by design: it records
 * that the deletion happened.
 */
async function leftovers(t: ReturnType<typeof backend>, userId: Id<"users">, email: string) {
  const tables = Object.keys((schema as unknown as { tables: Record<string, unknown> }).tables).filter((n) => n !== "auditLog");
  return await t.run(async (ctx) => {
    const found: string[] = [];
    for (const table of tables) {
      for (const row of await ctx.db.query(table as never).collect()) {
        const text = JSON.stringify(row);
        if (text.includes(userId) || text.includes(email)) found.push(`${table}: ${text.slice(0, 120)}`);
      }
    }
    return found;
  });
}

async function busyAccount(t: ReturnType<typeof backend>) {
  const user = await person(t, "leaving@example.com");
  const other = await person(t, "other@example.com");
  const formId = await form(t, user.userId);
  await response(t, formId, user.userId);
  const othersForm = await form(t, other.userId);
  await share(t, othersForm, user, "editor");
  await member(t, other.userId, user, "viewer");
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("handles", { value: "leaving", ownerType: "user", userId: user.userId } as never);
    await ctx.db.insert("apiKeys", { ownerId: user.userId, createdBy: user.userId, name: "k", hash: "h", prefix: "fk", createdAt: now } as never);
    await ctx.db.insert("connections", { formId, ownerId: user.userId, kind: "webhook", url: "https://x.example", enabled: true, createdAt: now });
    await ctx.db.insert("paymentAccounts", { ownerId: user.userId, key: "rk_test_x", live: false, addedAt: now });
    await ctx.db.insert("inbox", { userId: user.userId, kind: "ai", title: "hi", at: now });
    await ctx.db.insert("aiAccess", { userId: user.userId, enabled: true, changedAt: now });
    await ctx.db.insert("authAccounts", { userId: user.userId, provider: "password", providerAccountId: "leaving@example.com" });
    await ctx.db.insert("polarOrders", { orderId: "o1", userId: user.userId, email: "leaving@example.com", at: now, amount: 600, currency: "usd" } as never);
  });
  return { user, other, formId, othersForm };
}

describe("erasing an account", () => {
  test("the 30-day purge leaves nothing that names the person", async () => {
    const t = backend();
    const { user } = await busyAccount(t);
    const old = Date.now() - 31 * 86_400_000;
    await t.run((ctx) => ctx.db.patch(user.userId, { selfDeletedAt: old, deactivatedAt: old }));
    await t.mutation(internal.security.purgeDeactivated, {});
    expect(await leftovers(t, user.userId, "leaving@example.com")).toEqual([]);
    // The order is kept for the books, without the person.
    const orders = await t.run((ctx) => ctx.db.query("polarOrders").collect());
    expect(orders).toHaveLength(1);
  });

  test("deleting your own account ends what you pay for", async () => {
    vi.useFakeTimers();
    const t = backend();
    const { user } = await busyAccount(t);
    await user.as.mutation(api.security.deleteAccount, { confirm: "delete" });
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map((s) => s.name)).toContain("billing:endForDeletion");
    vi.useRealTimers();
  });

  test("staff deleting an account erases it at once and ends its plans", async () => {
    vi.useFakeTimers();
    const t = backend();
    const { user } = await busyAccount(t);
    await t.run((ctx) => ctx.db.patch(user.userId, { polarSubscriptionId: "sub_1" }));
    const staff = await person(t, "staff@formkit.app");
    await t.run((ctx) => ctx.db.patch(staff.userId, { staffRole: "owner" }));
    await staff.as.mutation(api.admin.deleteUser, { userId: user.userId, confirm: "leaving@example.com" });
    expect(await leftovers(t, user.userId, "leaving@example.com")).toEqual([]);
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    const end = scheduled.find((s) => s.name === "billing:endForDeletion");
    expect(end?.args[0]).toMatchObject({ subscriptions: [{ subscriptionId: "sub_1" }] });
    vi.useRealTimers();
  });
});
