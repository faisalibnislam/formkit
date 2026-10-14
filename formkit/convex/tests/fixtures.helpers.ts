import { convexTest } from "convex-test";
import schema from "../schema";
import { modules } from "../test.setup";
import type { Id } from "../_generated/dataModel";

/**
 * Helpers for tests: a fresh backend, people, a form, its collaborators and
 * responses. Rows carry only the fields the schema requires plus what a test
 * asks for.
 */
export function backend() {
  return convexTest(schema, modules);
}
export type Backend = ReturnType<typeof backend>;

/** A user plus a session, and a client signed in as them (Convex Auth's subject is "user|session"). */
export async function person(t: Backend, email: string) {
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email, name: email.split("@")[0] });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86_400_000 });
    return { userId, sessionId };
  });
  return { ...ids, as: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}

export async function form(t: Backend, ownerId: Id<"users">, extra: Record<string, unknown> = {}) {
  return await t.run(async (ctx) =>
    ctx.db.insert("forms", {
      ownerId,
      title: "Test form",
      slug: `test-${Math.random().toString(36).slice(2, 8)}`,
      brand: "me",
      status: "published",
      responsesCount: 0,
      completedCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...extra,
    } as never),
  );
}

export async function share(
  t: Backend,
  formId: Id<"forms">,
  user: { userId: Id<"users"> },
  role: "editor" | "commenter" | "viewer",
) {
  await t.run(async (ctx) => {
    const u = await ctx.db.get(user.userId);
    await ctx.db.insert("collaborators", {
      formId,
      userId: user.userId,
      email: u!.email!,
      role,
      status: "active",
      invitedAt: Date.now(),
    } as never);
  });
}

export async function response(t: Backend, formId: Id<"forms">, ownerId: Id<"users">, extra: Record<string, unknown> = {}) {
  return await t.run(async (ctx) =>
    ctx.db.insert("responses", {
      formId,
      ownerId,
      submittedAt: Date.now(),
      partial: false,
      answeredCount: 0,
      totalCount: 0,
      answers: [],
      status: "new",
      ...extra,
    } as never),
  );
}
