import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./model/identity";
import { formFor } from "./model/forms";

/**
 * People on a form.
 *
 * This is the second of the three separate things sharing means. Collaborators
 * owns *people* — who can edit, comment or read. The public link belongs to the
 * Share panel, and the shape of that link belongs to a claimed handle. None of
 * the three is a switch inside another.
 *
 * An Editor edits the form and reads its responses from their own account. A
 * Commenter can leave comments but change nothing. A Viewer reads.
 */

const role = v.union(v.literal("editor"), v.literal("commenter"), v.literal("viewer"));

export const list = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId, "read");
    const owner = await ctx.db.get(form.ownerId);
    const rows = await ctx.db
      .query("collaborators")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();

    return {
      owner: {
        name: owner?.name ?? "The owner",
        email: owner?.email ?? "",
        image: owner?.image ?? null,
      },
      people: await Promise.all(
        rows
          .sort((a, b) => a.invitedAt - b.invitedAt)
          .map(async (r) => {
            const person = r.userId ? await ctx.db.get(r.userId) : null;
            return {
              _id: r._id,
              email: r.email,
              name: person?.name ?? null,
              image: person?.image ?? null,
              role: r.role,
              status: r.status,
              invitedAt: r.invitedAt,
              note: r.note ?? null,
            };
          }),
      ),
    };
  },
});

export const invite = mutation({
  args: {
    formId: v.id("forms"),
    email: v.string(),
    role,
    note: v.optional(v.string()),
  },
  returns: v.id("collaborators"),
  handler: async (ctx, { formId, email, role: theirRole, note }) => {
    const form = await formFor(ctx, formId);
    const address = email.trim().toLowerCase();
    if (!address.includes("@")) throw new Error("That does not look like an email address.");

    const owner = await ctx.db.get(form.ownerId);
    if (owner?.email?.toLowerCase() === address) {
      throw new Error("You already own this form.");
    }

    const already = (
      await ctx.db
        .query("collaborators")
        .withIndex("by_form", (q) => q.eq("formId", formId))
        .collect()
    ).find((r) => r.email === address);
    if (already) throw new Error(`${address} is already on this form.`);

    // If they already have a Formkit account the invitation is live at once;
    // otherwise it waits until they sign up with that address.
    const person = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", address))
      .first();

    return ctx.db.insert("collaborators", {
      formId,
      email: address,
      userId: person?._id,
      role: theirRole,
      status: person ? "active" : "pending",
      invitedAt: Date.now(),
      note: note?.trim() || undefined,
    });
  },
});

export const setRole = mutation({
  args: { collaboratorId: v.id("collaborators"), role },
  returns: v.null(),
  handler: async (ctx, { collaboratorId, role: theirRole }) => {
    const row = await ctx.db.get(collaboratorId);
    if (!row) throw new Error("That person is no longer on this form.");
    await formFor(ctx, row.formId);
    await ctx.db.patch(collaboratorId, { role: theirRole });
    return null;
  },
});

export const remove = mutation({
  args: { collaboratorId: v.id("collaborators") },
  returns: v.null(),
  handler: async (ctx, { collaboratorId }) => {
    const row = await ctx.db.get(collaboratorId);
    if (!row) return null;
    await formFor(ctx, row.formId);
    await ctx.db.delete(collaboratorId);
    return null;
  },
});

/** Forms other people have put this person on, for their own Sharing screen. */
export const sharedWithMe = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user.email) return [];
    const rows = await ctx.db
      .query("collaborators")
      .withIndex("by_email", (q) => q.eq("email", user.email!))
      .collect();

    return Promise.all(
      rows.map(async (r) => {
        const form = await ctx.db.get(r.formId);
        const owner = form ? await ctx.db.get(form.ownerId) : null;
        return {
          _id: r._id,
          formId: r.formId,
          title: form?.title ?? "A form",
          owner: owner?.name ?? owner?.email ?? "Someone",
          role: r.role,
          status: r.status,
        };
      }),
    );
  },
});
