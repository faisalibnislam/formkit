"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { PLANS, type PlanId } from "../../../../convex/model/plans";
import { ChevronLeft, ChevronRight, Eye, Search, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, EmptyState, Field, Input, PillTabs, Segmented, Select, Switch, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { fullTime, relativeTime } from "@/components/app/bits";

/**
 * Users. A filtered, paged list - a table on a wide screen, cards on a narrow
 * one - and a side panel for whoever is open: their numbers, Ask Formkit,
 * a message into their bell, the emails Formkit sent them, their standing, and
 * deletion, which asks for their email typed out because it destroys every
 * form and response they own.
 *
 * Filters and the open person live in the address, so another section can
 * link straight to "suspended users" or to one person.
 */
type Status = "all" | "active" | "suspended" | "staff";
type Ai = "all" | "on" | "off";
type PlanFilter = "all" | "free" | "pro" | "business" | "paying" | "comped";

export function AdminUsers({ permissions }: { permissions: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);

  const status = (params.get("status") as Status | null) ?? "all";
  const ai = (params.get("ai") as Ai | null) ?? "all";
  const plan = (params.get("plan") as PlanFilter | null) ?? "all";
  const open = params.get("open") as Id<"users"> | null;

  const setParam = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    q.set("section", "users");
    for (const [k, val] of Object.entries(next)) {
      if (val === null || val === "all") q.delete(k);
      else q.set(k, val);
    }
    router.replace(`/admin?${q}`, { scroll: false });
  };

  const data = useQuery(api.admin.usersPage, { search: term || undefined, status, ai, plan, page });
  const filtered = Boolean(term) || status !== "all" || ai !== "all" || plan !== "all";

  return (
    <>
      <div className="fk-panel" data-pad="tight">
        <div className="fk-toolbar" style={{ flexWrap: "wrap" }}>
          <PillTabs
            ariaLabel="Standing"
            value={status}
            onChange={(v) => {
              setPage(0);
              setParam({ status: v });
            }}
            tabs={[
              { value: "all", label: "Everyone" },
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
              { value: "staff", label: "Staff" },
            ]}
          />
          <Select
            size="sm"
            ariaLabel="Ask Formkit"
            value={ai}
            onChange={(v) => {
              setPage(0);
              setParam({ ai: v });
            }}
            options={[
              { value: "all", label: "AI: everyone" },
              { value: "on", label: "AI: on" },
              { value: "off", label: "AI: off" },
            ]}
          />
          <Select
            size="sm"
            ariaLabel="Plan"
            value={plan}
            onChange={(v) => {
              setPage(0);
              setParam({ plan: v });
            }}
            options={[
              { value: "all", label: "Plan: all" },
              { value: "free", label: "Free" },
              { value: "pro", label: "Pro" },
              { value: "business", label: "Business" },
              { value: "paying", label: "Paying" },
              { value: "comped", label: "Given free" },
            ]}
          />
          <span className="fk-toolbar-spacer" />
          <Input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setPage(0);
            }}
            placeholder="Search by name, email or link"
            icon={<Search size={17} strokeWidth={1.8} aria-hidden />}
            style={{ width: 260 }}
          />
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<X size={15} strokeWidth={1.8} aria-hidden />}
              onClick={() => {
                setTerm("");
                setPage(0);
                setParam({ status: null, ai: null, plan: null });
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
              <EmptyState title="Nobody matches" description={filtered ? "Clear the filters, or try a shorter search." : "No accounts yet."} />
            </div>
          ) : (
            <>
              <table className="fk-admin-table">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Forms</th>
                    <th scope="col">Responses</th>
                    <th scope="col">Status</th>
                    <th scope="col">AI</th>
                    <th scope="col">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows ?? []).map((u) => (
                    <tr
                      key={u._id}
                      data-on={open === u._id ? "true" : undefined}
                      tabIndex={0}
                      onClick={() => setParam({ open: u._id })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setParam({ open: u._id });
                      }}
                    >
                      <td>
                        {u.name || u.email}
                        <span className="fk-admin-sub">{u.email}</span>
                      </td>
                      <td>
                        <PlanBadge plan={u.plan} />
                      </td>
                      <td>{u.forms.toLocaleString()}</td>
                      <td>{u.responses.toLocaleString()}</td>
                      <td>
                        <Standing u={u} />
                      </td>
                      <td>{u.ai.allowed ? `${u.ai.used} of ${u.ai.limit}` : "Off"}</td>
                      <td>{relativeTime(u.joinedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="fk-rows fk-admin-cards">
                {(data?.rows ?? []).map((u) => (
                  <button
                    key={u._id}
                    type="button"
                    className="fk-row"
                    onClick={() => setParam({ open: u._id })}
                    style={open === u._id ? { background: "var(--blue-50)" } : undefined}
                  >
                    <span className="fk-row-main">
                      <span className="fk-row-title">{u.name || u.email}</span>
                      <span className="fk-row-meta">
                        {u.forms} forms · {u.responses} responses · {u.ai.allowed ? `AI ${u.ai.used}/${u.ai.limit}` : "AI off"}
                      </span>
                    </span>
                    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <PlanBadge plan={u.plan} />
                      <Standing u={u} />
                    </span>
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
                    Newer
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={(data.page + 1) * data.pageSize >= data.total}
                    iconRight={<ChevronRight size={15} strokeWidth={1.8} aria-hidden />}
                    onClick={() => setPage(data.page + 1)}
                  >
                    Older
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="fk-panel" style={{ position: "sticky", top: 24 }}>
          {open ? (
            <UserPanel key={open} userId={open} permissions={permissions} onClosed={() => setParam({ open: null })} />
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-tertiary)" }}>
              Pick somebody and their account opens here.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

type Row = { staffRole: string | null; deactivatedAt: number | null };

function Standing({ u }: { u: Row }) {
  if (u.staffRole) return <Badge tone="info">{u.staffRole}</Badge>;
  if (u.deactivatedAt) return <Badge tone="error">Suspended</Badge>;
  return <Badge tone="success">Active</Badge>;
}

function UserPanel({
  userId,
  permissions,
  onClosed,
}: {
  userId: Id<"users">;
  permissions: string[];
  onClosed: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const current = useQuery(api.admin.user, { userId });
  const mail = useQuery(api.admin.mail, { userId, limit: 5 });
  const setStanding = useMutation(api.admin.setStanding);
  const deleteUser = useMutation(api.admin.deleteUser);
  const setAiAccess = useMutation(api.admin.setAiAccess);
  const compPlan = useMutation(api.billing.compPlan);
  const message = useMutation(api.admin.messageUser);
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState({ title: "", body: "" });
  const [limit, setLimit] = useState<string | null>(null);

  if (current === undefined) return null;
  if (current === null) return <p className="fk-admin-quiet">That account no longer exists.</p>;

  const can = (p: string) => permissions.includes(p);

  return (
    <>
      <h3 style={{ marginBottom: 2 }}>{current.name || current.email}</h3>
      <p className="fk-panel-lede">
        {current.email} · joined {fullTime(current.joinedAt)}
        {current.handle ? ` · formkit.app/${current.handle}` : ""}
      </p>

      <div className="fk-admin-stats">
        <div>
          <strong>{current.forms.toLocaleString()}</strong>
          <span>Forms</span>
        </div>
        <div>
          <strong>{current.responses.toLocaleString()}</strong>
          <span>Responses</span>
        </div>
        <div>
          <strong>{current.ai.allowed ? `${current.ai.used}/${current.ai.limit}` : "Off"}</strong>
          <span>AI this month</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {can("users.view") && (
          <div>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Eye size={15} strokeWidth={1.8} aria-hidden />}
              onClick={() =>
                window.open(
                  `/app?viewAs=${current._id}&who=${encodeURIComponent(current.name || current.email || "")}`,
                  "_blank",
                  "noopener",
                )
              }
            >
              Open support view
            </Button>
          </div>
        )}

        {can("billing") && (
          <div className="fk-admin-block">
            <div className="fk-admin-row">
              <span style={{ flex: 1 }}>
                Plan: {PLANS[current.plan.id as PlanId].name}
                <span className="fk-admin-sub" style={{ whiteSpace: "normal" }}>
                  {current.plan.comp
                    ? "Given free of charge from this console."
                    : current.plan.billed
                      ? `Paying through Polar, ${current.plan.interval === "year" ? "yearly" : "monthly"} · ${current.plan.status ?? "active"}${
                          current.plan.endsAt ? ` · ends ${new Date(current.plan.endsAt).toLocaleDateString("en-US", { dateStyle: "medium" })}` : ""
                        }`
                      : "Not paying."}
                </span>
              </span>
            </div>
            <Field label="Give a plan free of charge" help="Wins over anything they pay for. Ending it puts them back on what they pay for, or Free.">
              <Segmented
                ariaLabel="Plan given free of charge"
                size="sm"
                value={(current.plan.comp ?? "none") as "none" | "pro" | "business"}
                onChange={async (next) => {
                  await compPlan({ userId: current._id, plan: next === "none" ? null : next });
                  toast(next === "none" ? "Free plan ended" : `${PLANS[next].name} given free of charge`, {
                    detail: current.name || current.email,
                  });
                }}
                options={[
                  { value: "none", label: "None" },
                  { value: "pro", label: "Pro" },
                  { value: "business", label: "Business" },
                ]}
              />
            </Field>
          </div>
        )}

        {can("ai.access") && (
          <div className="fk-admin-block">
            <div className="fk-admin-row">
              <span style={{ flex: 1 }}>Ask Formkit</span>
              <Switch
                checked={current.ai.allowed}
                label="Ask Formkit for this account"
                onChange={async (on) => {
                  await setAiAccess({ userId: current._id, enabled: on });
                  toast(on ? "Ask Formkit turned on" : "Ask Formkit turned off", {
                    detail: on ? "It appears in their app straight away." : "Every AI surface disappears from their app.",
                  });
                }}
              />
            </div>
            {current.ai.allowed && (
              <>
                <Field label="Monthly limit" help={`${current.ai.used} used this month.`}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Input
                      type="number"
                      min={0}
                      value={limit ?? String(current.ai.limit)}
                      onChange={(e) => setLimit(e.target.value)}
                      onBlur={async () => {
                        if (limit === null || Number(limit) === current.ai.limit || limit === "") return setLimit(null);
                        await setAiAccess({ userId: current._id, limitOverride: Math.max(0, Number(limit)) });
                        setLimit(null);
                        toast(`Their limit is now ${limit} a month`);
                      }}
                      style={{ maxWidth: 120 }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await setAiAccess({ userId: current._id, useDefault: true });
                        setLimit(null);
                        toast("Back on the platform default");
                      }}
                    >
                      Use default
                    </Button>
                  </div>
                </Field>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      await setAiAccess({ userId: current._id, grant: 5 });
                      toast("Five extra credits granted", { detail: "They are told in their bell." });
                    }}
                  >
                    Grant 5 extra
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await setAiAccess({ userId: current._id, resetUsage: true });
                      toast("This month's usage reset");
                    }}
                  >
                    Reset usage
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {can("support") && (
          <div className="fk-admin-block">
            <h4>Message them</h4>
            <Input
              inputSize="sm"
              placeholder="Subject"
              value={note.title}
              onChange={(e) => setNote((n) => ({ ...n, title: e.target.value }))}
            />
            <Textarea
              rows={3}
              placeholder="It arrives in their bell, from Formkit."
              value={note.body}
              onChange={(e) => setNote((n) => ({ ...n, body: e.target.value }))}
            />
            <div>
              <Button
                size="sm"
                disabled={!note.title.trim() || !note.body.trim()}
                onClick={async () => {
                  await message({ userId: current._id, title: note.title, body: note.body });
                  setNote({ title: "", body: "" });
                  toast("Sent", { detail: "It is in their bell now." });
                }}
              >
                Send message
              </Button>
            </div>
          </div>
        )}

        <div className="fk-admin-block">
          <h4>Their emails</h4>
          {mail && mail.length === 0 ? (
            <p className="fk-admin-quiet" style={{ margin: 0 }}>Nothing sent to them in the last 30 days.</p>
          ) : (
            (mail ?? []).map((m) => (
              <div key={m._id} className="fk-admin-row" style={{ fontSize: 13.5 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {m.subject}
                  <span className="fk-admin-sub">
                    {m.kind} · {relativeTime(m.at)}
                  </span>
                </span>
                <Badge tone={m.state === "sent" ? "success" : "error"}>{m.state === "sent" ? "Sent" : "Failed"}</Badge>
              </div>
            ))
          )}
          <div>
            <Button variant="ghost" size="sm" onClick={() => router.push(`/admin?section=mail&user=${current._id}`)}>
              All their emails
            </Button>
          </div>
        </div>

        {can("users.suspend") && !current.staffRole && (
          <div className="fk-admin-block">
            <div className="fk-admin-row">
              <span style={{ flex: 1 }}>
                {current.deactivatedAt ? "Suspended" : "Active"}
                <span className="fk-admin-sub">
                  {current.deactivatedAt ? "They cannot sign in. Their forms stay as they are." : "They can sign in and use Formkit."}
                </span>
              </span>
              <Button
                variant={current.deactivatedAt ? "primary" : "secondary"}
                size="sm"
                onClick={async () => {
                  const suspend = !current.deactivatedAt;
                  await setStanding({ userId: current._id, deactivated: suspend });
                  toast(suspend ? "Account suspended" : "Account reactivated", {
                    detail: suspend ? "Their forms keep collecting; they cannot sign in." : "They can sign in again.",
                  });
                }}
              >
                {current.deactivatedAt ? "Reactivate" : "Suspend"}
              </Button>
            </div>
          </div>
        )}

        {can("users.delete") && !current.staffRole && (
          <div className="fk-note" data-tone="danger" style={{ display: "block" }}>
            <p style={{ margin: "0 0 10px" }}>
              Deleting destroys {current.forms} forms and {current.responses} responses. There is no bin and no undo.
              Type <strong>{current.email}</strong> to confirm.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Input
                inputSize="sm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={current.email}
                style={{ flex: 1, minWidth: 180 }}
              />
              <Button
                variant="destructive"
                size="sm"
                disabled={confirm !== current.email}
                onClick={async () => {
                  await deleteUser({ userId: current._id, confirm });
                  toast("Account deleted");
                  onClosed();
                }}
              >
                Delete user
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Free, Pro or Business - with how it is paid, or that staff gave it. */
function PlanBadge({ plan }: { plan: { id: "free" | "pro" | "business"; comp: string | null; interval: string | null; status: string | null } }) {
  const name = plan.id === "free" ? "Free" : plan.id === "pro" ? "Pro" : "Business";
  const how = plan.id === "free" ? null : plan.comp ? "given" : plan.interval === "year" ? "yearly" : "monthly";
  return (
    <span className="fk-planbadge" data-plan={plan.id} title={plan.status ? `Polar: ${plan.status}` : undefined}>
      {name}
      {how && <span>{how}</span>}
    </span>
  );
}
