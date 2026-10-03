import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Contacts: everyone who has answered, once each. People are matched on
 * their email; someone who never gave one is matched on their name within
 * the same form. Partial respondents are included - they are people too, and
 * often the ones most worth following up.
 */

type Keyed = Pick<Doc<"responses">, "formId" | "respondentEmail" | "respondentName">;

/** The person a response belongs to, or undefined when it names nobody. */
export function contactKeyOf(r: Keyed) {
  const email = r.respondentEmail?.trim().toLowerCase();
  if (email) return email;
  const name = r.respondentName?.trim();
  return name ? `${r.formId}:${name.toLowerCase()}` : undefined;
}

/** Records that `key` answered at `at`, keeping the latest time. */
export async function notePerson(ctx: MutationCtx, ownerId: Id<"users">, key: string, at: number) {
  const had = await ctx.db
    .query("people")
    .withIndex("by_owner_key", (q) => q.eq("ownerId", ownerId).eq("key", key))
    .unique();
  if (!had) await ctx.db.insert("people", { ownerId, key, last: at });
  else if (at > had.last) await ctx.db.patch(had._id, { last: at });
}

/** Responses read for one person, at most. */
const PER_PERSON = 500;

export type Contact = {
  key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  created: number;
  last: number;
  responses: number;
  partialOnly: boolean;
  unread: boolean;
  tags: string[];
  forms: string[];
};

/**
 * One person as a contact, from their own responses on the forms in `titles`
 * (form id to title). Null when none of their responses are on those forms.
 */
export async function contactOf(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  key: string,
  titles: Map<string, string>,
): Promise<Contact | null> {
  const rows = (
    await ctx.db
      .query("responses")
      .withIndex("by_owner_contact", (q) => q.eq("ownerId", ownerId).eq("contactKey", key))
      .take(PER_PERSON)
  )
    .filter((r) => !r.preview && titles.has(r.formId))
    .sort((a, b) => a.submittedAt - b.submittedAt);
  if (!rows.length) return null;

  const first = rows[0]!;
  const c: Contact = {
    key,
    name: null,
    email: first.respondentEmail?.trim().toLowerCase() || null,
    phone: null,
    company: null,
    source: titles.get(first.formId) ?? "A form",
    created: first.submittedAt,
    last: first.submittedAt,
    responses: 0,
    partialOnly: true,
    unread: false,
    tags: [],
    forms: [],
  };
  // The newest thing they told us wins; the first form they used stays the source.
  for (const r of rows) {
    c.name = r.respondentName?.trim() || c.name;
    c.phone = r.respondentPhone ?? c.phone;
    c.company = r.respondentCompany ?? c.company;
    c.last = r.submittedAt;
    c.responses += 1;
    c.partialOnly = c.partialOnly && r.partial;
    c.unread = c.unread || (r.status === "new" && !r.partial);
    for (const t of r.tags ?? []) if (!c.tags.includes(t)) c.tags.push(t);
    const title = titles.get(r.formId) ?? "A form";
    if (!c.forms.includes(title)) c.forms.push(title);
  }
  return c;
}
