import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireStaff } from "./model/identity";
import { aiStatus } from "./model/aiMeter";
import { endComp, giveComp, giveCredits } from "./model/grants";
import { resolveSpace, spaceKey } from "./model/spaces";
import { billingOf, standing } from "./model/standing";
import { mergeSorted, scanPage } from "./model/scan";
import { readReport, type CompaniesReport } from "./adminReports";

/**
 * Admin → Companies: every company on Formkit, personal ones included, with
 * who owns it, its plan and how it is had (paid, given free, inherited from
 * the owner, or Free), its seats and forms. Staff with billing can give a
 * company Pro or Business free of charge, for a while or for good, and give
 * it AI credits. Everything given is kept in `planGrants` (model/grants.ts).
 */

const DAY = 86_400_000;

const planArg = v.union(v.literal("pro"), v.literal("business"));

const PAGE = 25;
/** Accounts and companies read for one page at most; past it the pager carries on from there. */
const SCAN = 2000;
/** Team members read for "Most seats", at most. */
const MEMBERS_CAP = 5000;
/** Forms counted per owner on a page, at most. */
const FORMS_PER_OWNER = 2000;
/** Matches a search gathers from each place it looks. */
const SEARCH_EACH = 100;

type Candidate = {
  key: string;
  owner: Doc<"users"> | null;
  company: Doc<"companies"> | null;
  /** Accounts that are only staff have no company of their own to list. */
  listed: boolean;
  created: number;
  name: string | undefined;
};

const planFilter = v.union(
  v.literal("all"),
  v.literal("free"),
  v.literal("pro"),
  v.literal("business"),
  v.literal("paid"),
  v.literal("given"),
  v.literal("ending"),
  v.literal("inherited"),
);

/**
 * Admin → Companies: every company on Formkit, personal ones included, a
 * page at a time. Lists are read through indexes, a page and a bounded number
 * of rows at a time, so the page works however many accounts there are; the
 * cards above come from the hourly count (adminReports.ts).
 */
export const list = query({
  args: {
    search: v.optional(v.string()),
    kind: v.optional(v.union(v.literal("all"), v.literal("company"), v.literal("me"))),
    plan: v.optional(planFilter),
    owner: v.optional(v.id("users")),
    sort: v.optional(v.union(v.literal("newest"), v.literal("name"), v.literal("seats"))),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { search, kind = "all", plan = "all", owner, sort = "newest", cursor = null }) => {
    await requireStaff(ctx, "users.view");
    const now = Date.now();
    const report = await readReport<CompaniesReport>(ctx, "companies");

    const owners = new Map<string, Doc<"users"> | null>();
    const ownerOf = async (id: Id<"users">) => {
      if (!owners.has(id)) owners.set(id, await ctx.db.get(id));
      return owners.get(id)!;
    };
    const personal = (u: Doc<"users">): Candidate => ({
      key: `me:${u._id}`,
      owner: u,
      company: null,
      listed: !u.staffRole || !!u.planComp || !!u.plan,
      created: u._creationTime,
      name: u.name,
    });
    const ofCompany = async (c: Doc<"companies">): Promise<Candidate> => ({
      key: c._id,
      owner: await ownerOf(c.ownerId),
      company: c,
      listed: true,
      created: c._creationTime,
      name: c.name,
    });
    const seatsOf = async (c: Candidate) => {
      const rows = c.company
        ? await ctx.db
            .query("teamMembers")
            .withIndex("by_company", (q) => q.eq("companyId", c.company!._id))
            .collect()
        : (
            await ctx.db
              .query("teamMembers")
              .withIndex("by_owner", (q) => q.eq("ownerId", c.owner!._id))
              .collect()
          ).filter((m) => !m.companyId);
      return {
        active: rows.filter((m) => m.status === "active").length,
        pending: rows.filter((m) => m.status !== "active").length,
      };
    };

    /** The row as the table shows it, or null when the filters leave it out. */
    const shape = (c: Candidate) => {
      const o = c.owner;
      if (!c.listed || !o) return null;
      if (kind !== "all" && kind !== (c.company ? "company" : "me")) return null;
      if (owner && o._id !== owner) return null;
      const s = standing(o, c.company);
      const comp = s.source === "given" ? { plan: s.holder.planComp!, endsAt: s.holder.compEndsAt ?? null } : null;
      switch (plan) {
        case "all":
          break;
        case "paid":
        case "given":
        case "inherited":
          if (s.source !== plan) return null;
          break;
        case "ending":
          if (!(s.source === "given" && comp?.endsAt && comp.endsAt < now + 30 * DAY)) return null;
          break;
        default:
          if (s.plan !== plan) return null;
      }
      return { c, s, comp };
    };
    type Shaped = NonNullable<ReturnType<typeof shape>>;

    let picked: Shaped[];
    let next: string | null = null;
    let total: number | null = null;
    const term = search?.trim().toLowerCase();

    if (owner || term) {
      // A bounded set - one owner's, or what a search finds - sorted and paged in memory.
      const found = new Map<string, Candidate>();
      let capped = false;
      const each = <T,>(rows: T[]) => {
        if (rows.length === SEARCH_EACH) capped = true;
        return rows;
      };
      const addUser = async (u: Doc<"users"> | null) => {
        if (!u) return;
        found.set(`me:${u._id}`, personal(u));
        const theirs = await ctx.db
          .query("companies")
          .withIndex("by_owner", (q) => q.eq("ownerId", u._id))
          .take(SEARCH_EACH);
        for (const c of theirs) found.set(c._id, await ofCompany(c));
      };
      if (owner) await addUser(await ownerOf(owner));
      if (term) {
        const raw = search!.trim();
        const upTo = `${term}\uffff`;
        for (const c of await ctx.db
          .query("companies")
          .withSearchIndex("search_name", (q) => q.search("name", raw))
          .take(SEARCH_EACH)
          .then(each))
          found.set(c._id, await ofCompany(c));
        for (const c of await ctx.db.query("companies").withIndex("by_handle", (q) => q.gte("handle", term).lt("handle", upTo)).take(SEARCH_EACH).then(each))
          found.set(c._id, await ofCompany(c));
        const people = [
          ...each(
            await ctx.db
              .query("users")
              .withSearchIndex("search_name", (q) => q.search("name", raw))
              .take(SEARCH_EACH),
          ),
          ...each(
            await ctx.db
              .query("users")
              .withIndex("email", (q) => q.gte("email", term).lt("email", upTo))
              .take(SEARCH_EACH),
          ),
          ...each(
            await ctx.db
              .query("users")
              .withIndex("by_handle", (q) => q.gte("handle", term).lt("handle", upTo))
              .take(SEARCH_EACH),
          ),
        ];
        for (const u of people) await addUser(u);
        // A pasted key finds its company.
        const asCompany = ctx.db.normalizeId("companies", raw);
        const asUser = ctx.db.normalizeId("users", raw.replace(/^me:/, ""));
        if (asCompany) {
          const c = await ctx.db.get(asCompany);
          if (c) found.set(c._id, await ofCompany(c));
        }
        if (asUser) await addUser(await ctx.db.get(asUser));
      }
      const rows = [...found.values()].map(shape).filter((r): r is Shaped => r !== null);
      const seats = new Map<string, number>();
      if (sort === "seats") for (const r of rows) seats.set(r.c.key, 1 + (await seatsOf(r.c)).active);
      const label = (r: Shaped) => (r.c.company ? r.c.company.name : r.c.owner!.name?.trim() || r.c.owner!.email || "Personal");
      rows.sort((a, b) =>
        sort === "name"
          ? label(a).localeCompare(label(b))
          : sort === "seats"
            ? seats.get(b.c.key)! - seats.get(a.c.key)! || b.c.created - a.c.created
            : b.c.created - a.c.created,
      );
      const at = cursor ? Number(cursor) : 0;
      picked = rows.slice(at, at + PAGE);
      next = at + PAGE < rows.length ? String(at + PAGE) : null;
      // A search that filled a source may have found more than it read.
      total = capped ? null : rows.length;
    } else {
      const newest = (before: number | null, skip: Set<string> | null) =>
        mergeSorted<Candidate>(
          (async function* () {
            for await (const u of ctx.db
              .query("users")
              .withIndex("by_creation_time", (q) => (before === null ? q : q.lt("_creationTime", before)))
              .order("desc"))
              if (!skip?.has(`me:${u._id}`)) yield personal(u);
          })(),
          (async function* () {
            for await (const c of ctx.db
              .query("companies")
              .withIndex("by_creation_time", (q) => (before === null ? q : q.lt("_creationTime", before)))
              .order("desc"))
              if (!skip?.has(c._id)) yield await ofCompany(c);
          })(),
          (x, y) => x.created > y.created,
        );

      if (sort === "name") {
        // By name through each table's name index (capitals sort before
        // lower case); accounts with no name, shown by their email, come last.
        const at: [string | null, number] | null = cursor ? JSON.parse(cursor) : null;
        const after = (c: Candidate) => !at || (c.name ?? null) !== at[0] || c.created > at[1];
        const before = (x: Candidate, y: Candidate) =>
          x.name === y.name ? x.created < y.created : x.name === undefined ? false : y.name === undefined ? true : x.name < y.name;
        const inTail = at !== null && at[0] === null;
        const from = at?.[0] ?? "";
        const source = mergeSorted<Candidate>(
          (async function* () {
            if (!inTail)
              for await (const u of ctx.db.query("users").withIndex("by_name", (q) => q.gte("name", from))) {
                const c = personal(u);
                if (after(c)) yield c;
              }
            for await (const u of ctx.db.query("users").withIndex("by_name", (q) => q.eq("name", undefined))) {
              const c = personal(u);
              if (after(c)) yield c;
            }
          })(),
          (async function* () {
            if (inTail) return;
            for await (const co of ctx.db.query("companies").withIndex("by_name", (q) => q.gte("name", from))) {
              const c = await ofCompany(co);
              if (after(c)) yield c;
            }
          })(),
          before,
        );
        const page = await scanPage(source, shape, (c) => JSON.stringify([c.name ?? null, c.created]), PAGE, SCAN);
        picked = page.rows;
        next = page.next;
      } else if (sort === "seats") {
        // Companies with members first, most seats first, then everyone else newest first.
        const members = await ctx.db.query("teamMembers").take(MEMBERS_CAP);
        const count = new Map<string, number>();
        for (const m of members)
          if (m.status === "active") {
            const key = m.companyId ?? `me:${m.ownerId}`;
            count.set(key, (count.get(key) ?? 0) + 1);
          }
        const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
        const teams = new Set(ranked);
        picked = [];
        let phase2: number | null = null;
        if (!cursor || cursor.startsWith("t:")) {
          let at = cursor ? Number(cursor.slice(2)) : 0;
          for (; at < ranked.length && picked.length < PAGE; at++) {
            const key = ranked[at]!;
            const c = key.startsWith("me:")
              ? await (async () => {
                  const u = await ctx.db.get(key.slice(3) as Id<"users">);
                  return u ? personal(u) : null;
                })()
              : await (async () => {
                  const co = await ctx.db.get(key as Id<"companies">);
                  return co ? await ofCompany(co) : null;
                })();
            const r = c && shape(c);
            if (r) picked.push(r);
          }
          next = at < ranked.length ? `t:${at}` : "n:";
          if (picked.length === PAGE) phase2 = null;
          else phase2 = -1;
        } else phase2 = Number(cursor.slice(2)) || -1;
        if (phase2 !== null) {
          const page = await scanPage(newest(phase2 === -1 ? null : phase2, teams), shape, (c) => `n:${c.created}`, PAGE - picked.length, SCAN);
          picked.push(...page.rows);
          next = page.next;
        }
      } else {
        const at = cursor ? Number(cursor) : null;
        const page = await scanPage(newest(at, null), shape, (c) => String(c.created), PAGE, SCAN);
        picked = page.rows;
        next = page.next;
      }

      // How many in all, when the hourly count knows: one filter at most.
      const r = report?.data;
      if (r) {
        const byKind = kind === "company" ? r.companies : kind === "me" ? r.personal : r.companies + r.personal;
        if (plan === "all") total = byKind;
        else if (kind === "all")
          total =
            plan === "paid" ? r.paid : plan === "given" ? r.given : plan === "inherited" ? r.inherited : plan === "ending" ? r.ending : r.byPlan[plan];
      }
    }

    // Seats, forms and pictures for the rows shown only.
    const work = new Map<string, { forms: number; responses: number; more: boolean }>();
    for (const ownerId of new Set(picked.map((r) => r.c.owner!._id))) {
      const theirs = await ctx.db
        .query("forms")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .take(FORMS_PER_OWNER);
      const more = theirs.length === FORMS_PER_OWNER;
      for (const f of theirs) {
        if (f.deletedAt) continue;
        const key = f.brand && f.brand !== "me" ? (f.brand as string) : `me:${f.ownerId}`;
        const w = work.get(key) ?? { forms: 0, responses: 0, more };
        w.forms++;
        w.responses += f.responsesCount;
        work.set(key, w);
      }
    }
    return {
      total,
      next,
      pageSize: PAGE,
      asOf: report?.at ?? null,
      summary: report?.data ?? null,
      rows: await Promise.all(
        picked.map(async ({ c, s, comp }) => {
          const o = c.owner!;
          const count = await seatsOf(c);
          const markId = c.company?.markId ?? c.company?.logoId ?? null;
          return {
            key: c.key,
            kind: c.company ? ("company" as const) : ("me" as const),
            name: c.company ? c.company.name : o.name?.trim() || o.email || "Personal",
            handle: (c.company ? c.company.handle : o.handle) ?? null,
            brandColor: c.company?.brandColor ?? null,
            owner: { _id: o._id, name: o.name ?? null, email: o.email ?? null, suspended: !!o.deactivatedAt },
            plan: s.plan,
            source: s.source,
            comp,
            billing: s.own ? billingOf(s.holder, s.plan, 1 + count.active) : null,
            seats: 1 + count.active,
            pending: count.pending,
            createdAt: c.created,
            forms: work.get(c.key)?.forms ?? 0,
            responses: work.get(c.key)?.responses ?? 0,
            /** More forms than were counted. */
            formsMore: work.get(c.key)?.more ?? false,
            imageUrl: markId ? await ctx.storage.getUrl(markId) : c.company ? null : await avatarOf(ctx, o),
          };
        }),
      ),
    };
  },
});

async function avatarOf(ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } }, u: Doc<"users">) {
  return u.avatarId ? await ctx.storage.getUrl(u.avatarId) : (u.image ?? null);
}

/** One company, for the side panel. */
export const detail = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireStaff(ctx, "users.view");
    const space = await resolveSpace(ctx, key);
    if (!space) return null;
    const owner = await ctx.db.get(space.ownerId);
    if (!owner) return null;
    const company = space.brand === "me" ? null : await ctx.db.get(space.brand);

    const rows = await ctx.db
      .query("teamMembers")
      .withIndex("by_owner", (q) => q.eq("ownerId", space.ownerId))
      .collect();
    const mine = rows.filter((r) => (r.companyId ?? "me") === space.brand);
    const people = await Promise.all(
      mine.map(async (r) => {
        const u = r.userId ? await ctx.db.get(r.userId) : null;
        return { _id: r._id, name: u?.name ?? null, email: r.email, role: r.role, status: r.status, userId: r.userId ?? null };
      }),
    );
    const seats = 1 + mine.filter((r) => r.status === "active").length;
    const s = standing(owner, company);

    const allForms = (
      await ctx.db
        .query("forms")
        .withIndex("by_owner", (q) => q.eq("ownerId", space.ownerId))
        .collect()
    ).filter((f) => !f.deletedAt && (f.brand ?? "me") === space.brand);

    const comp =
      s.source === "given"
        ? {
            plan: s.holder.planComp!,
            endsAt: s.holder.compEndsAt ?? null,
            note: s.holder.compNote ?? null,
            at: s.holder.compAt ?? null,
            by: s.holder.compBy ? ((await ctx.db.get(s.holder.compBy))?.name ?? "Staff") : null,
          }
        : null;

    const history = await ctx.db
      .query("planGrants")
      .withIndex("by_space", (q) => q.eq("space", spaceKey(space)))
      .order("desc")
      .take(25);

    return {
      key: spaceKey(space),
      kind: company ? ("company" as const) : ("me" as const),
      name: company ? company.name : owner.name?.trim() || owner.email || "Personal",
      handle: (company ? company.handle : owner.handle) ?? null,
      imageUrl: company
        ? company.markId
          ? await ctx.storage.getUrl(company.markId)
          : company.logoId
            ? await ctx.storage.getUrl(company.logoId)
            : null
        : await avatarOf(ctx, owner),
      brandColor: company?.brandColor ?? null,
      website: company?.website ?? null,
      createdAt: company ? company._creationTime : owner._creationTime,
      owner: {
        _id: owner._id,
        name: owner.name ?? null,
        email: owner.email ?? null,
        suspended: !!owner.deactivatedAt,
        companies: (
          await ctx.db
            .query("companies")
            .withIndex("by_owner", (q) => q.eq("ownerId", owner._id))
            .collect()
        ).length,
      },
      plan: s.plan,
      source: s.source,
      comp,
      // Whatever the company pays through Polar, even while a free plan covers it.
      billing: s.own ? billingOf(s.holder, s.plan, seats) : null,
      inheritedFrom: s.source === "inherited" ? billingOf(owner, s.plan, 1) : null,
      seats,
      members: people.sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1)),
      forms: {
        count: allForms.length,
        live: allForms.filter((f) => f.status === "published").length,
        responses: allForms.reduce((n, f) => n + f.responsesCount, 0),
        recent: allForms
          .sort((a, b) => (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime))
          .slice(0, 5)
          .map((f) => ({ _id: f._id, title: f.title, status: f.status, responses: f.responsesCount })),
      },
      ai: await aiStatus(ctx, space),
      history: history.map((h) => ({
        _id: h._id,
        what: h.what,
        plan: h.plan ?? null,
        endsAt: h.endsAt ?? null,
        credits: h.credits ?? null,
        note: h.note ?? null,
        byName: h.byName,
        at: h.at,
      })),
    };
  },
});

/** Gives, changes or extends a free plan. */
export const give = mutation({
  args: {
    key: v.string(),
    plan: planArg,
    endsAt: v.union(v.number(), v.null()),
    note: v.optional(v.string()),
    tell: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { key, ...opts }) => {
    const staff = await requireStaff(ctx, "billing");
    const space = await resolveSpace(ctx, key);
    if (!space) throw new ConvexError("That company no longer exists.");
    await giveComp(ctx, staff, space, opts);
    return null;
  },
});

/** Ends a free plan now. */
export const end = mutation({
  args: { key: v.string(), note: v.optional(v.string()), tell: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { key, ...opts }) => {
    const staff = await requireStaff(ctx, "billing");
    const space = await resolveSpace(ctx, key);
    if (!space) throw new ConvexError("That company no longer exists.");
    if (!(await endComp(ctx, staff, space, opts))) throw new ConvexError("That company has no free plan to end.");
    return null;
  },
});

export const credits = mutation({
  args: { key: v.string(), credits: v.number(), note: v.optional(v.string()), tell: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { key, ...opts }) => {
    const staff = await requireStaff(ctx, "billing");
    const space = await resolveSpace(ctx, key);
    if (!space) throw new ConvexError("That company no longer exists.");
    await giveCredits(ctx, staff, space, opts);
    return null;
  },
});

/** Free plans ended in one run, at most; the rest wait for the next hour. */
const EXPIRE_BATCH = 200;

/** Hourly: free plans whose end date has come are ended, and their owners told. */
export const expireComps = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let n = 0;
    // Only plans with an end date that has passed are read.
    for (const u of await ctx.db
      .query("users")
      .withIndex("by_comp_ends", (q) => q.gt("compEndsAt", 0).lte("compEndsAt", now))
      .take(EXPIRE_BATCH)) {
      if (u.planComp && u.compEndsAt && u.compEndsAt <= now) {
        await endComp(ctx, null, { ownerId: u._id, brand: "me" }, { expired: true });
        n++;
      }
    }
    for (const c of await ctx.db
      .query("companies")
      .withIndex("by_comp_ends", (q) => q.gt("compEndsAt", 0).lte("compEndsAt", now))
      .take(EXPIRE_BATCH)) {
      if (c.planComp && c.compEndsAt && c.compEndsAt <= now) {
        await endComp(ctx, null, { ownerId: c.ownerId, brand: c._id }, { expired: true });
        n++;
      }
    }
    return n;
  },
});
