"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronLeft, ChevronRight, Gift, Search, Sparkles, UserRound, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PLANS, type PlanId } from "../../../../convex/model/plans";
import { Badge, Button, EmptyState, Field, Input, Modal, PillTabs, ProgressBar, Segmented, Select, Switch, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { StatCard } from "@/components/app/ds";
import { OwnerMark } from "@/components/app/owners";
import { fullTime, relativeTime } from "@/components/app/bits";
import { errorText } from "@/components/app/settings/bits";

/**
 * Companies. Every company on Formkit, personal ones included: who owns it,
 * its plan and how it is had, its seats and forms. Open one for its members,
 * forms, AI and billing, and, with billing access, to give it Pro or Business
 * free of charge (for a while or for good), end that, or give it AI credits.
 * Everything given is kept in the company's history and the audit log.
 *
 * Filters and the open company live in the address, so the Users page can
 * link straight to "companies this person owns".
 */

type Kind = "all" | "company" | "me";
type PlanFilter = "all" | "free" | "pro" | "business" | "paid" | "given" | "ending" | "inherited";
type Sort = "newest" | "name" | "seats";
type Source = "paid" | "given" | "inherited" | "free";

const DAY = 86_400_000;
const date = (at: number) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function AdminCompanies({ permissions }: { permissions: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);

  const kind = (params.get("kind") as Kind | null) ?? "all";
  const plan = (params.get("plan") as PlanFilter | null) ?? "all";
  const sort = (params.get("sort") as Sort | null) ?? "newest";
  const owner = params.get("owner") as Id<"users"> | null;
  const open = params.get("open");

  const setParam = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    q.set("section", "companies");
    for (const [k, val] of Object.entries(next)) {
      if (val === null || val === "all" || (k === "sort" && val === "newest")) q.delete(k);
      else q.set(k, val);
    }
    router.replace(`/admin?${q}`, { scroll: false });
  };
  const filter = (next: Record<string, string | null>) => {
    setPage(0);
    setParam(next);
  };

  const data = useQuery(api.adminCompanies.list, {
    search: term || undefined,
    kind,
    plan,
    sort,
    owner: owner ?? undefined,
    page,
  });
  const filtered = Boolean(term) || kind !== "all" || plan !== "all" || Boolean(owner);
  const s = data?.summary;
  const ownerName = owner ? data?.rows.find((r) => r.owner._id === owner)?.owner : null;

  return (
    <>
      <div className="fk-grid" data-cols="stats-sm">
        <StatCard
          label="Companies"
          value={s ? s.companies.toLocaleString() : "…"}
          caption={s ? `and ${s.personal.toLocaleString()} personal ones` : undefined}
        />
        <StatCard
          label="Paying"
          value={s ? s.paid.toLocaleString() : "…"}
          caption={s ? `${usd(s.mrr)} a month through Polar` : undefined}
        />
        <StatCard
          label="Given free"
          value={s ? s.given.toLocaleString() : "…"}
          caption={s ? (s.ending ? `${s.ending} end within 30 days` : "None end within 30 days") : undefined}
        />
        <StatCard
          label="On Pro or Business"
          value={s ? (s.byPlan.pro + s.byPlan.business).toLocaleString() : "…"}
          caption={s ? `${s.byPlan.pro} Pro · ${s.byPlan.business} Business · ${s.byPlan.free.toLocaleString()} Free` : undefined}
        />
      </div>

      <div className="fk-panel" data-pad="tight">
        <div className="fk-toolbar" style={{ flexWrap: "wrap" }}>
          <PillTabs
            ariaLabel="Kind"
            value={kind}
            onChange={(v) => filter({ kind: v })}
            tabs={[
              { value: "all", label: "All" },
              { value: "company", label: "Companies" },
              { value: "me", label: "Personal" },
            ]}
          />
          <Select
            size="sm"
            ariaLabel="Plan"
            value={plan}
            onChange={(v) => filter({ plan: v })}
            options={[
              { value: "all", label: "Plan: all" },
              { value: "free", label: "Free" },
              { value: "pro", label: "Pro" },
              { value: "business", label: "Business" },
              { value: "paid", label: "Paying" },
              { value: "given", label: "Given free" },
              { value: "ending", label: "Free plan ends within 30 days" },
              { value: "inherited", label: "Covered by the owner’s plan" },
            ]}
          />
          <Select
            size="sm"
            ariaLabel="Sort"
            value={sort}
            onChange={(v) => filter({ sort: v })}
            options={[
              { value: "newest", label: "Newest first" },
              { value: "name", label: "By name" },
              { value: "seats", label: "Most seats" },
            ]}
          />
          {owner && (
            <Badge tone="info">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                Owned by {ownerName?.name || ownerName?.email || "one person"}
                <button type="button" className="fk-admin-chipx" aria-label="Show every owner" onClick={() => filter({ owner: null })}>
                  <X size={12} strokeWidth={2} aria-hidden />
                </button>
              </span>
            </Badge>
          )}
          <span className="fk-toolbar-spacer" />
          <Input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setPage(0);
            }}
            placeholder="Search companies, links or owners"
            icon={<Search size={17} strokeWidth={1.8} aria-hidden />}
            style={{ width: 280 }}
          />
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<X size={15} strokeWidth={1.8} aria-hidden />}
              onClick={() => {
                setTerm("");
                filter({ kind: null, plan: null, owner: null });
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="fk-resp-layout">
        <section className="fk-panel" data-pad="none">
          {data && data.total === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState
                title="No companies match"
                description={filtered ? "Clear the filters, or try a shorter search." : "No companies yet."}
              />
            </div>
          ) : (
            <>
              <table className="fk-admin-table">
                <thead>
                  <tr>
                    <th scope="col">Company</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Seats</th>
                    <th scope="col">Forms</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows ?? []).map((c) => (
                    <tr
                      key={c.key}
                      data-on={open === c.key ? "true" : undefined}
                      tabIndex={0}
                      onClick={() => setParam({ open: c.key })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setParam({ open: c.key });
                      }}
                    >
                      <td>
                        <span className="fk-admin-co">
                          <OwnerMark owner={{ key: c.key, kind: c.kind, name: c.name, imageUrl: c.imageUrl }} size={28} />
                          <span style={{ minWidth: 0 }}>
                            {c.name}
                            <span className="fk-admin-sub">
                              {c.kind === "me" ? "Personal" : c.handle ? `formkit.app/${c.handle}` : "Company"} · {relativeTime(c.createdAt)}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>
                        {c.owner.name || c.owner.email}
                        <span className="fk-admin-sub">{c.owner.suspended ? "Suspended" : c.owner.email}</span>
                      </td>
                      <td>
                        <PlanBadge plan={c.plan} source={c.source} comp={c.comp} interval={c.billing?.interval ?? null} />
                      </td>
                      <td>
                        {c.seats}
                        {c.pending > 0 && <span className="fk-admin-sub">+{c.pending} invited</span>}
                      </td>
                      <td>
                        {c.forms.toLocaleString()}
                        <span className="fk-admin-sub">{c.responses.toLocaleString()} responses</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="fk-rows fk-admin-cards">
                {(data?.rows ?? []).map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="fk-row"
                    onClick={() => setParam({ open: c.key })}
                    style={open === c.key ? { background: "var(--blue-50)" } : undefined}
                  >
                    <OwnerMark owner={{ key: c.key, kind: c.kind, name: c.name, imageUrl: c.imageUrl }} size={32} />
                    <span className="fk-row-main">
                      <span className="fk-row-title">{c.name}</span>
                      <span className="fk-row-meta">
                        {c.owner.name || c.owner.email} · {c.seats} {c.seats === 1 ? "seat" : "seats"} · {c.forms} forms
                      </span>
                    </span>
                    <PlanBadge plan={c.plan} source={c.source} comp={c.comp} interval={c.billing?.interval ?? null} />
                  </button>
                ))}
              </div>

              {data && (
                <div className="fk-admin-pager">
                  <span style={{ flex: 1 }}>
                    {(data.page * data.pageSize + 1).toLocaleString()}–
                    {Math.min(data.total, (data.page + 1) * data.pageSize).toLocaleString()} of {data.total.toLocaleString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={data.page === 0}
                    iconLeft={<ChevronLeft size={15} strokeWidth={1.8} aria-hidden />}
                    onClick={() => setPage(data.page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={(data.page + 1) * data.pageSize >= data.total}
                    iconRight={<ChevronRight size={15} strokeWidth={1.8} aria-hidden />}
                    onClick={() => setPage(data.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="fk-panel fk-admin-aside">
          {open ? (
            <CompanyPanel
              key={open}
              companyKey={open}
              permissions={permissions}
              onOwner={(id) => filter({ owner: id, open: null })}
            />
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-tertiary)" }}>
              Pick a company to see its members, forms, AI and billing, and to give it a plan.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

/** The plan, and how it is had: paying, given free (and until when), or through the owner. */
function PlanBadge({
  plan,
  source,
  comp,
  interval,
}: {
  plan: PlanId;
  source: Source;
  comp: { endsAt: number | null } | null;
  interval: string | null;
}) {
  const how =
    source === "given"
      ? comp?.endsAt
        ? `given, to ${new Date(comp.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : "given"
      : source === "inherited"
        ? "from owner"
        : source === "paid"
          ? interval === "year"
            ? "yearly"
            : "monthly"
          : null;
  return (
    <span className="fk-planbadge" data-plan={plan} data-given={source === "given" ? "true" : undefined}>
      {source === "given" && <Gift size={11} strokeWidth={2} aria-hidden style={{ alignSelf: "center" }} />}
      {PLANS[plan].name}
      {how && <span>{how}</span>}
    </span>
  );
}

function CompanyPanel({
  companyKey,
  permissions,
  onOwner,
}: {
  companyKey: string;
  permissions: string[];
  onOwner: (id: Id<"users">) => void;
}) {
  const router = useRouter();
  const c = useQuery(api.adminCompanies.detail, { key: companyKey });
  const [giving, setGiving] = useState(false);
  const [ending, setEnding] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [now] = useState(() => Date.now());

  if (c === undefined) return null;
  if (c === null) return <p className="fk-admin-quiet">That company no longer exists.</p>;
  const billing = permissions.includes("billing");
  const ownerLabel = c.owner.name || c.owner.email || "The owner";

  return (
    <>
      <div className="fk-admin-cohead">
        <OwnerMark owner={{ key: c.key, kind: c.kind, name: c.name, imageUrl: c.imageUrl }} size={44} />
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>{c.name}</h3>
          <p className="fk-panel-lede" style={{ margin: "2px 0 0" }}>
            {c.kind === "me" ? `${ownerLabel}’s personal company` : `Company · created ${date(c.createdAt)}`}
            {c.handle ? ` · formkit.app/${c.handle}` : ""}
          </p>
        </div>
      </div>

      <div className="fk-admin-stats">
        <div>
          <strong>{c.seats}</strong>
          <span>{c.seats === 1 ? "Seat" : "Seats"}</span>
        </div>
        <div>
          <strong>{c.forms.count.toLocaleString()}</strong>
          <span>Forms, {c.forms.live} live</span>
        </div>
        <div>
          <strong>{c.forms.responses.toLocaleString()}</strong>
          <span>Responses</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Plan */}
        <div className="fk-admin-block">
          <div className="fk-admin-row">
            <span style={{ flex: 1 }}>
              <PlanBadge plan={c.plan} source={c.source} comp={c.comp} interval={c.billing?.interval ?? null} />
            </span>
          </div>
          <p className="fk-admin-plantext">
            {c.source === "given" && c.comp
              ? `Given free of charge${c.comp.by ? ` by ${c.comp.by}` : ""}${c.comp.at ? ` on ${date(c.comp.at)}` : ""}. ${
                  c.comp.endsAt
                    ? `Ends ${date(c.comp.endsAt)}, in ${Math.max(1, Math.ceil((c.comp.endsAt - now) / DAY))} days, then it goes back to ${
                        c.billing?.live ? PLANS[c.billing.plan].name : "Free"
                      }.`
                    : "No end date."
                }`
              : c.source === "paid" && c.billing
                ? `Paying ${usd(c.billing.monthly)} a month through Polar: ${c.billing.seats} ${
                    c.billing.seats === 1 ? "seat" : "seats"
                  }, billed ${c.billing.interval === "year" ? "yearly" : "monthly"}.${
                    c.billing.cancelAtPeriodEnd && c.billing.endsAt ? ` Cancelled; runs until ${date(c.billing.endsAt)}.` : ""
                  }${c.billing.status === "past_due" ? " The last payment failed." : ""}`
                : c.source === "inherited"
                  ? `Covered by ${ownerLabel}’s own subscription, which began before each company had its own plan.`
                  : "On Free. Nothing paid, nothing given."}
          </p>
          {c.source === "given" && c.comp?.note && <blockquote className="fk-admin-note">{c.comp.note}</blockquote>}
          {c.source === "given" && c.billing?.live && !c.billing.cancelAtPeriodEnd && (
            <div className="fk-note" data-tone="warning" style={{ display: "block", fontSize: 13.5 }}>
              They also pay {usd(c.billing.monthly)} a month for {PLANS[c.billing.plan].name} through Polar. The free plan
              wins while it lasts, but Polar keeps charging until that subscription is cancelled in Polar.
            </div>
          )}
          {billing && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button size="sm" iconLeft={<Gift size={15} strokeWidth={1.8} aria-hidden />} onClick={() => setGiving(true)}>
                {c.source === "given" ? "Change or extend" : "Give a plan free"}
              </Button>
              {c.source === "given" && (
                <Button variant="secondary" size="sm" onClick={() => setEnding(true)}>
                  End free plan
                </Button>
              )}
            </div>
          )}
        </div>

        {/* AI */}
        <div className="fk-admin-block">
          <h4>AI this month</h4>
          {(
            [
              ["builds", "Forms built"],
              ["edits", "Edits"],
              ["responses", "Responses"],
              ["reports", "Insights reports"],
            ] as const
          ).map(([k, label]) => (
            <div key={k} className="fk-admin-meter">
              <span>
                {label}
                <em>
                  {c.ai.used[k]} of {c.ai.pool[k]}
                </em>
              </span>
              <ProgressBar value={c.ai.pool[k] ? Math.min(100, (c.ai.used[k] / c.ai.pool[k]) * 100) : 0} />
            </div>
          ))}
          <div className="fk-admin-row" style={{ flexWrap: "wrap" }}>
            <span style={{ flex: "1 1 160px" }}>
              {c.ai.credits.toLocaleString()} AI credits
              <span className="fk-admin-sub">Used once the month’s allowance runs out.</span>
            </span>
            {billing && (
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Sparkles size={15} strokeWidth={1.8} aria-hidden />}
                onClick={() => setCrediting(true)}
              >
                Give credits
              </Button>
            )}
          </div>
        </div>

        {/* People */}
        <div className="fk-admin-block">
          <h4>People</h4>
          <div className="fk-admin-row" style={{ fontSize: 13.5 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              {ownerLabel}
              <span className="fk-admin-sub">{c.owner.suspended ? "Suspended" : c.owner.email}</span>
            </span>
            <Badge tone="info">Owner</Badge>
          </div>
          {c.members.map((m) => (
            <div key={m._id} className="fk-admin-row" style={{ fontSize: 13.5 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                {m.name || m.email}
                <span className="fk-admin-sub">{m.name ? m.email : m.status === "active" ? "Joined" : "Invited, not joined yet"}</span>
              </span>
              <Badge tone={m.status === "active" ? "neutral" : "warning"}>
                {m.status === "active" ? m.role[0]!.toUpperCase() + m.role.slice(1) : "Invited"}
              </Badge>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<UserRound size={15} strokeWidth={1.8} aria-hidden />}
              onClick={() => router.push(`/admin?section=users&open=${c.owner._id}`)}
            >
              Open the owner
            </Button>
            {c.owner.companies > 0 && (
              <Button variant="ghost" size="sm" onClick={() => onOwner(c.owner._id)}>
                All companies they own ({c.owner.companies + 1})
              </Button>
            )}
          </div>
        </div>

        {/* Forms */}
        <div className="fk-admin-block">
          <h4>Recent forms</h4>
          {c.forms.recent.length === 0 ? (
            <p className="fk-admin-quiet" style={{ margin: 0 }}>No forms yet.</p>
          ) : (
            c.forms.recent.map((f) => (
              <div key={f._id} className="fk-admin-row" style={{ fontSize: 13.5 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {f.title || "Untitled form"}
                  <span className="fk-admin-sub">{f.responses.toLocaleString()} responses</span>
                </span>
                <Badge tone={f.status === "published" ? "success" : "draft"}>
                  {f.status === "published" ? "Live" : f.status[0]!.toUpperCase() + f.status.slice(1)}
                </Badge>
              </div>
            ))
          )}
        </div>

        {/* History */}
        <div className="fk-admin-block">
          <h4>What Formkit gave</h4>
          {c.history.length === 0 ? (
            <p className="fk-admin-quiet" style={{ margin: 0 }}>Nothing yet.</p>
          ) : (
            <ol className="fk-admin-history">
              {c.history.map((h) => (
                <li key={h._id}>
                  <span>
                    {h.what === "credits"
                      ? `Gave ${h.credits?.toLocaleString()} AI credits`
                      : h.what === "gave"
                        ? `Gave ${PLANS[h.plan!].name} free${h.endsAt ? ` until ${date(h.endsAt)}` : ", no end date"}`
                        : h.what === "changed"
                          ? `Changed to ${PLANS[h.plan!].name} free${h.endsAt ? ` until ${date(h.endsAt)}` : ", no end date"}`
                          : h.what === "expired"
                            ? `Free ${PLANS[h.plan!].name} reached its end date`
                            : `Ended free ${PLANS[h.plan!].name}`}
                  </span>
                  <span className="fk-admin-sub" title={fullTime(h.at)}>
                    {h.byName} · {relativeTime(h.at)}
                  </span>
                  {h.note && <span className="fk-admin-historynote">{h.note}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {giving && <GiveModal company={c} onClose={() => setGiving(false)} />}
      {ending && <EndModal company={c} onClose={() => setEnding(false)} />}
      {crediting && <CreditsModal company={c} onClose={() => setCrediting(false)} />}
    </>
  );
}

/** One company, as the panel has it. */
type Detail = NonNullable<FunctionReturnType<typeof api.adminCompanies.detail>>;

const LENGTHS = [
  { value: "1", label: "1 month" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "1 year" },
  { value: "forever", label: "No end date" },
  { value: "date", label: "Until a date…" },
];

function monthsFrom(start: number, months: number) {
  const d = new Date(start);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

function GiveModal({ company: c, onClose }: { company: Detail; onClose: () => void }) {
  const toast = useToast();
  const give = useMutation(api.adminCompanies.give);
  const changing = c.source === "given" && !!c.comp;
  const [plan, setPlan] = useState<"pro" | "business">(c.comp?.plan ?? "business");
  const [length, setLength] = useState(changing ? (c.comp?.endsAt ? "date" : "forever") : "12");
  const [on, setOn] = useState(() => {
    const at = c.comp?.endsAt ?? monthsFrom(Date.now(), 12);
    return new Date(at - new Date(at).getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  });
  const [note, setNote] = useState(c.comp?.note ?? "");
  const [tell, setTell] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());

  // Extensions start from the current end date, not today.
  const from = changing && c.comp?.endsAt && c.comp.endsAt > now ? c.comp.endsAt : now;
  const endsAt =
    length === "forever" ? null : length === "date" ? new Date(`${on}T23:59:59`).getTime() : monthsFrom(from, Number(length));
  const invalid = endsAt !== null && (!Number.isFinite(endsAt) || endsAt < now + DAY / 24);
  const after = c.billing?.live ? PLANS[c.billing.plan].name : "Free";

  async function go() {
    setBusy(true);
    try {
      await give({ key: c.key, plan, endsAt, note: note.trim() || undefined, tell });
      toast(`${c.name} is on ${PLANS[plan].name}, free`, {
        detail: endsAt ? `Until ${date(endsAt)}.` : "With no end date.",
      });
      onClose();
    } catch (e) {
      toast(errorText(e, "That could not be saved."));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={changing ? `Change ${c.name}’s free plan` : `Give ${c.name} a plan free`}
      description={`It covers everyone in ${c.name}: ${c.seats} ${c.seats === 1 ? "seat" : "seats"}, with the AI allowance that comes with them. Nothing is charged.`}
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || invalid} onClick={() => void go()} iconLeft={<Gift size={16} strokeWidth={1.8} aria-hidden />}>
            {busy ? "Saving…" : changing ? "Save changes" : `Give ${PLANS[plan].name} free`}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Plan">
          <Segmented
            ariaLabel="Plan to give"
            value={plan}
            onChange={setPlan}
            options={[
              { value: "pro", label: "Pro" },
              { value: "business", label: "Business" },
            ]}
          />
        </Field>
        <Field
          label={changing && c.comp?.endsAt ? "Extend by, or end on" : "For how long"}
          help={
            invalid
              ? "Pick a date after today."
              : endsAt
                ? `Ends ${date(endsAt)}. Then ${c.name} goes back to ${after}, and ${c.owner.name || "the owner"} is told.`
                : `Until you end it here.`
          }
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Select value={length} onChange={setLength} options={LENGTHS} ariaLabel="How long" />
            {length === "date" && (
              <Input type="date" value={on} onChange={(e) => setOn(e.target.value)} aria-label="End date" style={{ maxWidth: 180 }} />
            )}
          </div>
        </Field>
        <Field label="Why" help="Only staff see this, here and in the audit log.">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Partner programme, support gesture, press…" />
        </Field>
        <div className="fk-admin-row">
          <span style={{ flex: 1 }}>
            Tell {c.owner.name || "the owner"}
            <span className="fk-admin-sub">A note in their bell, with a link to the plan.</span>
          </span>
          <Switch checked={tell} onChange={setTell} label="Tell the owner" />
        </div>
        {c.billing?.live && !c.billing.cancelAtPeriodEnd && (
          <div className="fk-note" data-tone="warning" style={{ display: "block", fontSize: 13.5 }}>
            {c.name} pays {usd(c.billing.monthly)} a month through Polar. Giving a plan does not stop that: cancel the
            subscription in Polar if they should stop paying.
          </div>
        )}
      </div>
    </Modal>
  );
}

function EndModal({ company: c, onClose }: { company: Detail; onClose: () => void }) {
  const toast = useToast();
  const end = useMutation(api.adminCompanies.end);
  const [note, setNote] = useState("");
  const [tell, setTell] = useState(true);
  const [busy, setBusy] = useState(false);
  const after = c.billing?.live ? PLANS[c.billing.plan].name : "Free";

  return (
    <Modal
      title={`End ${c.name}’s free plan?`}
      description={`${c.name} goes back to ${after} now. Nothing is deleted: features outside ${after} stop, and come back if they upgrade.`}
      onClose={onClose}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await end({ key: c.key, note: note.trim() || undefined, tell });
                toast("Free plan ended", { detail: `${c.name} is on ${after} now.` });
                onClose();
              } catch (e) {
                toast(errorText(e, "That could not be ended."));
                setBusy(false);
              }
            }}
          >
            {busy ? "Ending…" : "End free plan"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Why" help="Only staff see this.">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="fk-admin-row">
          <span style={{ flex: 1 }}>Tell {c.owner.name || "the owner"}</span>
          <Switch checked={tell} onChange={setTell} label="Tell the owner" />
        </div>
      </div>
    </Modal>
  );
}

function CreditsModal({ company: c, onClose }: { company: Detail; onClose: () => void }) {
  const toast = useToast();
  const give = useMutation(api.adminCompanies.credits);
  const [amount, setAmount] = useState<"50" | "100" | "250" | "500" | "other">("100");
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const [tell, setTell] = useState(true);
  const [busy, setBusy] = useState(false);
  const n = amount === "other" ? Math.round(Number(other)) : Number(amount);
  const valid = Number.isFinite(n) && n > 0 && n <= 100_000;

  return (
    <Modal
      title={`Give ${c.name} AI credits`}
      description="Used once the month’s allowance runs out, like bought ones, and they last a year. A form build is 2 credits, an edit 1, a response 1 and an insights report 3."
      onClose={onClose}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !valid}
            onClick={async () => {
              setBusy(true);
              try {
                await give({ key: c.key, credits: n, note: note.trim() || undefined, tell });
                toast(`${n.toLocaleString()} credits given`, { detail: c.name });
                onClose();
              } catch (e) {
                toast(errorText(e, "Those could not be given."));
                setBusy(false);
              }
            }}
          >
            {busy ? "Giving…" : valid ? `Give ${n.toLocaleString()} credits` : "Give credits"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="How many">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Segmented
              ariaLabel="Credits"
              value={amount}
              onChange={setAmount}
              options={[
                { value: "50", label: "50" },
                { value: "100", label: "100" },
                { value: "250", label: "250" },
                { value: "500", label: "500" },
                { value: "other", label: "Other" },
              ]}
            />
            {amount === "other" && (
              <Input type="number" min={1} value={other} onChange={(e) => setOther(e.target.value)} aria-label="Credits" style={{ maxWidth: 120 }} />
            )}
          </div>
        </Field>
        <Field label="Why" help="Only staff see this.">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="fk-admin-row">
          <span style={{ flex: 1 }}>Tell {c.owner.name || "the owner"}</span>
          <Switch checked={tell} onChange={setTell} label="Tell the owner" />
        </div>
      </div>
    </Modal>
  );
}
