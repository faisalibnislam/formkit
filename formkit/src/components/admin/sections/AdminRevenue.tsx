"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, Sparkles, TrendingUp } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { StatCard } from "@/components/app/ds";
import { relativeTime } from "@/components/app/bits";

/**
 * Admin → Plans and revenue. Who is on which plan, what it is worth each
 * month, how that has moved, and where more of it could come from.
 *
 * Plans are an ordinal scale — Free, Pro, Business — drawn in one blue from
 * light to dark (validated: monotone lightness, visible steps).
 */

const PLAN_COLOR = { free: "#86b6ef", pro: "#2a78d6", business: "#104281" } as const;
const PLAN_NAME = { free: "Free", pro: "Pro", business: "Business" } as const;
const SERIES = "#2a78d6";

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 === 0 ? 0 : 2 });

function monthLabel(key: string, long = false) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    ...(long ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** One series of monthly bars, with the value on hover and the last one labelled. */
function Bars({ data, label }: { data: { month: string; value: number; show: string }[]; label: string }) {
  const peak = Math.max(1, ...data.map((d) => d.value));
  const last = data[data.length - 1];
  return (
    <>
      <div className="fk-rev-bars" role="img" aria-label={`${label}. ${data.map((d) => `${monthLabel(d.month, true)}: ${d.show}`).join("; ")}`}>
        {data.map((d, i) => (
          <span key={d.month} className="fk-rev-bar" data-tip={`${monthLabel(d.month, true)} · ${d.show}`}>
            {i === data.length - 1 && d.value > 0 && <em>{d.show}</em>}
            <i style={{ height: `${d.value ? Math.max(3, (d.value / peak) * 100) : 0}%`, background: SERIES }} />
          </span>
        ))}
      </div>
      <div className="fk-admin-axis">
        <span>{monthLabel(data[0]!.month, true)}</span>
        <span>{last ? monthLabel(last.month, true) : ""}</span>
      </div>
    </>
  );
}

/** Sign-ups a month, stacked by the plan those people are on now. */
function StackedSignups({ data }: { data: { month: string; free: number; pro: number; business: number }[] }) {
  const peak = Math.max(1, ...data.map((d) => d.free + d.pro + d.business));
  return (
    <>
      <div className="fk-rev-legend">
        {(["free", "pro", "business"] as const).map((p) => (
          <span key={p}>
            <i style={{ background: PLAN_COLOR[p] }} />
            {PLAN_NAME[p]}
          </span>
        ))}
      </div>
      <div
        className="fk-rev-bars"
        role="img"
        aria-label={`Sign-ups a month by plan. ${data.map((d) => `${monthLabel(d.month, true)}: ${d.free} Free, ${d.pro} Pro, ${d.business} Business`).join("; ")}`}
      >
        {data.map((d) => {
          const total = d.free + d.pro + d.business;
          return (
            <span
              key={d.month}
              className="fk-rev-bar"
              data-tip={`${monthLabel(d.month, true)} · ${total} sign-ups — ${d.free} Free, ${d.pro} Pro, ${d.business} Business`}
            >
              <span className="fk-rev-stack" style={{ height: `${total ? Math.max(3, (total / peak) * 100) : 0}%` }}>
                {(["business", "pro", "free"] as const).map((p) =>
                  d[p] ? <i key={p} style={{ flex: d[p], background: PLAN_COLOR[p] }} /> : null,
                )}
              </span>
            </span>
          );
        })}
      </div>
      <div className="fk-admin-axis">
        <span>{monthLabel(data[0]!.month, true)}</span>
        <span>{monthLabel(data[data.length - 1]!.month, true)}</span>
      </div>
    </>
  );
}

const MOVE_LABEL: Record<string, string> = {
  started: "Started paying",
  upgraded: "Upgraded",
  downgraded: "Downgraded",
  switched: "Changed billing",
  cancelling: "Will cancel",
  resumed: "Stayed on",
  past_due: "Payment failed",
  ended: "Stopped paying",
};

export function AdminRevenue() {
  const router = useRouter();
  const data = useQuery(api.revenue.overview, {});
  if (!data) return null;
  const t = data.totals;
  const open = (id: string) => router.push(`/admin?section=users&open=${id}`, { scroll: false });
  const thisMonth = data.moves[data.moves.length - 1]!;
  const lastMrr = data.mrrSeries[data.mrrSeries.length - 2]?.mrr ?? 0;
  const mrrChange = t.mrr - lastMrr;

  return (
    <>
      <div className="fk-grid" data-cols="stats-sm">
        <StatCard
          label="Monthly recurring revenue"
          value={usd(t.mrr)}
          caption={`${mrrChange >= 0 ? "+" : "−"}${usd(Math.abs(mrrChange))} since last month · ${usd(t.arr)} a year`}
        />
        <StatCard label="Paying customers" value={t.paying.toLocaleString()} caption={`${t.conversion}% of ${t.users.toLocaleString()} accounts`} />
        <StatCard label="Revenue per customer" value={usd(t.arpu)} caption="a month, on average" />
        <StatCard label="Collected, last 30 days" value={usd(t.collected30)} caption={`${usd(t.collectedAll)} since billing began`} />
      </div>

      <div className="fk-grid" data-cols="two">
        <section className="fk-panel">
          <h3>Accounts by plan</h3>
          <p className="fk-panel-lede">
            {t.paying} paying, {t.comped} given a plan by staff, the rest on Free.
          </p>
          <div className="fk-rev-split" role="img" aria-label={data.byPlan.map((p) => `${PLAN_NAME[p.plan]}: ${p.total}`).join(", ")}>
            {data.byPlan.map((p) =>
              p.total ? <i key={p.plan} style={{ flex: p.total, background: PLAN_COLOR[p.plan] }} title={`${PLAN_NAME[p.plan]} · ${p.total}`} /> : null,
            )}
          </div>
          <table className="fk-rev-table">
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Accounts</th>
                <th scope="col">Monthly</th>
                <th scope="col">Yearly</th>
                <th scope="col">Given</th>
                <th scope="col">MRR</th>
              </tr>
            </thead>
            <tbody>
              {data.byPlan.map((p) => (
                <tr key={p.plan}>
                  <th scope="row">
                    <i className="fk-rev-dot" style={{ background: PLAN_COLOR[p.plan] }} />
                    {PLAN_NAME[p.plan]}
                  </th>
                  <td>{p.total.toLocaleString()}</td>
                  <td>{p.plan === "free" ? "—" : p.monthly}</td>
                  <td>{p.plan === "free" ? "—" : p.yearly}</td>
                  <td>{p.plan === "free" ? "—" : p.comped}</td>
                  <td>{p.plan === "free" ? "—" : usd(p.mrr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="fk-panel">
          <h3>Monthly and yearly payers</h3>
          <p className="fk-panel-lede">Yearly payers pay up front and rarely leave mid-year.</p>
          <div className="fk-rev-pair">
            <div>
              <strong>{t.monthlyPayers}</strong>
              <span>pay monthly</span>
            </div>
            <div>
              <strong>{t.yearlyPayers}</strong>
              <span>pay yearly</span>
            </div>
          </div>
          <div className="fk-rev-split" aria-hidden>
            {t.monthlyPayers ? <i style={{ flex: t.monthlyPayers, background: "#86b6ef" }} /> : null}
            {t.yearlyPayers ? <i style={{ flex: t.yearlyPayers, background: "#104281" }} /> : null}
            {!t.monthlyPayers && !t.yearlyPayers && <i style={{ flex: 1, background: "var(--neutral-150)" }} />}
          </div>
          <div className="fk-rev-callouts">
            <div className="fk-rev-callout" data-tone={t.cancelling ? "warn" : undefined}>
              <CalendarClock size={16} strokeWidth={1.8} aria-hidden />
              <span>
                <b>{t.cancelling} set to cancel</b>
                {usd(t.cancellingMrr)} a month ends with their period
              </span>
            </div>
            <div className="fk-rev-callout" data-tone={t.pastDue ? "bad" : undefined}>
              <AlertTriangle size={16} strokeWidth={1.8} aria-hidden />
              <span>
                <b>{t.pastDue} payment{t.pastDue === 1 ? "" : "s"} failing</b>
                {usd(t.pastDueMrr)} a month while Polar retries
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="fk-grid" data-cols="two">
        <section className="fk-panel">
          <h3>Monthly recurring revenue</h3>
          <p className="fk-panel-lede">At the end of each month, from plan changes as they happened.</p>
          <Bars label="Monthly recurring revenue" data={data.mrrSeries.map((d) => ({ month: d.month, value: d.mrr, show: usd(d.mrr) }))} />
        </section>
        <section className="fk-panel">
          <h3>Money collected</h3>
          <p className="fk-panel-lede">Paid Polar orders each month, before tax.</p>
          <Bars label="Money collected" data={data.revenueSeries.map((d) => ({ month: d.month, value: d.amount, show: usd(d.amount) }))} />
        </section>
      </div>

      <div className="fk-grid" data-cols="two">
        <section className="fk-panel">
          <h3>Sign-ups, by the plan they are on now</h3>
          <p className="fk-panel-lede">Each month&rsquo;s new accounts, and how many of them have gone on to pay.</p>
          <StackedSignups data={data.signups} />
        </section>
        <section className="fk-panel">
          <h3>Movement</h3>
          <p className="fk-panel-lede">
            This month: {thisMonth.started} started, {thisMonth.upgraded} upgraded, {thisMonth.downgraded} downgraded,{" "}
            {thisMonth.ended} stopped.
          </p>
          <table className="fk-rev-table">
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">New</th>
                <th scope="col">Up</th>
                <th scope="col">Down</th>
                <th scope="col">Cancelling</th>
                <th scope="col">Stopped</th>
              </tr>
            </thead>
            <tbody>
              {data.moves
                .slice(-6)
                .reverse()
                .map((m) => (
                  <tr key={m.month}>
                    <th scope="row">{monthLabel(m.month, true)}</th>
                    <td>{m.started}</td>
                    <td>{m.upgraded}</td>
                    <td>{m.downgraded}</td>
                    <td>{m.cancelling}</td>
                    <td>{m.ended}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="fk-panel">
        <h3>
          <Sparkles size={17} strokeWidth={1.8} aria-hidden style={{ display: "inline-block", verticalAlign: -2, marginRight: 8 }} />
          Revenue possibilities
        </h3>
        <p className="fk-panel-lede">
          {data.potential.activeFree.toLocaleString()} of {data.potential.freeTotal.toLocaleString()} Free accounts are
          active — a live form or an edit in the last 30 days.
        </p>
        <div className="fk-rev-scenarios">
          {data.potential.scenarios.map((s) => (
            <div key={s.pct}>
              <span>If {s.pct}% of active Free took Pro</span>
              <strong>+{usd(s.mrr)}</strong>
              <em>
                a month · {s.accounts} account{s.accounts === 1 ? "" : "s"}
              </em>
            </div>
          ))}
          <div>
            <span>Monthly payers moved to yearly</span>
            <strong>{usd(data.potential.yearly.cashUpfront)}</strong>
            <em>
              up front from {data.potential.yearly.payers} · {usd(Math.abs(data.potential.yearly.yearValueChange))} less a year
            </em>
          </div>
          <div>
            <span>Team-sized Pro accounts on Business</span>
            <strong>+{usd(data.potential.businessUpside)}</strong>
            <em>a month · {data.businessLeads.length} account{data.businessLeads.length === 1 ? "" : "s"}</em>
          </div>
        </div>
      </section>

      <div className="fk-grid" data-cols="two">
        <section className="fk-panel" data-pad="none">
          <div style={{ padding: "22px 24px 6px" }}>
            <h3>
              <TrendingUp size={17} strokeWidth={1.8} aria-hidden style={{ display: "inline-block", verticalAlign: -2, marginRight: 8 }} />
              Free accounts ready for Pro
            </h3>
            <p className="fk-panel-lede">Busy Free accounts, and what makes them look ready.</p>
          </div>
          {data.leads.length === 0 ? (
            <p className="fk-admin-quiet" style={{ padding: "0 24px 22px" }}>
              Nobody stands out yet.
            </p>
          ) : (
            <div className="fk-rows">
              {data.leads.map((l) => (
                <button key={l._id} type="button" className="fk-row" onClick={() => open(l._id)}>
                  <span className="fk-row-main">
                    <span className="fk-row-title">{l.name || l.email}</span>
                    <span className="fk-row-meta">
                      {l.email} · {l.reasons.join(" · ")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {data.businessLeads.length > 0 && (
            <>
              <div style={{ padding: "18px 24px 6px" }}>
                <h3 style={{ fontSize: 15 }}>Pro accounts that look like teams</h3>
              </div>
              <div className="fk-rows">
                {data.businessLeads.map((l) => (
                  <button key={l._id} type="button" className="fk-row" onClick={() => open(l._id)}>
                    <span className="fk-row-main">
                      <span className="fk-row-title">{l.name || l.email}</span>
                      <span className="fk-row-meta">
                        {l.forms} forms · {l.responses.toLocaleString()} responses
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="fk-panel" data-pad="none">
          <div style={{ padding: "22px 24px 6px" }}>
            <h3>
              <AlertTriangle size={17} strokeWidth={1.8} aria-hidden style={{ display: "inline-block", verticalAlign: -2, marginRight: 8 }} />
              Revenue at risk
            </h3>
            <p className="fk-panel-lede">Customers set to cancel, and payments Polar is still retrying.</p>
          </div>
          {data.risk.length === 0 ? (
            <p className="fk-admin-quiet" style={{ padding: "0 24px 22px" }}>
              Nothing at risk right now.
            </p>
          ) : (
            <div className="fk-rows">
              {data.risk.map((r) => (
                <button key={r._id} type="button" className="fk-row" onClick={() => open(r._id)}>
                  <span className="fk-row-main">
                    <span className="fk-row-title">{r.name || r.email}</span>
                    <span className="fk-row-meta">
                      {r.why} · {PLAN_NAME[r.plan]} {r.interval === "year" ? "yearly" : "monthly"}
                      {r.endsAt ? ` · ends ${new Date(r.endsAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}` : ""}
                    </span>
                  </span>
                  <span className="fk-row-side">{usd(r.mrr)}/mo</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: "18px 24px 6px" }}>
            <h3 style={{ fontSize: 15 }}>Latest plan changes</h3>
          </div>
          {data.recent.length === 0 ? (
            <p className="fk-admin-quiet" style={{ padding: "0 24px 22px" }}>
              Plan changes appear here as Polar reports them.
            </p>
          ) : (
            <div className="fk-rows">
              {data.recent.map((e, i) => (
                <div key={i} className="fk-row" data-static="true">
                  <span className="fk-row-main">
                    <span className="fk-row-title">
                      {MOVE_LABEL[e.kind]} · {PLAN_NAME[e.plan]}
                      {e.interval ? ` ${e.interval === "year" ? "yearly" : "monthly"}` : ""}
                    </span>
                    <span className="fk-row-meta">
                      {e.who} · {relativeTime(e.at)}
                    </span>
                  </span>
                  <span className="fk-row-side fk-rev-delta" data-dir={e.delta > 0 ? "up" : e.delta < 0 ? "down" : undefined}>
                    {e.delta > 0 ? <ArrowUpRight size={14} aria-hidden /> : e.delta < 0 ? <ArrowDownRight size={14} aria-hidden /> : null}
                    {e.delta === 0 ? "—" : `${usd(Math.abs(e.delta))}/mo`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
