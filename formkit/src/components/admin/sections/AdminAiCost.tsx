"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { Segmented } from "@/components/ui";
import { StatCard } from "@/components/app/ds";

/**
 * Admin → AI cost. What Gemini costs Formkit, from the token counts Google
 * returns with every answer, priced per model when recorded. Sliced by
 * feature, model, plan and account, and set against what each plan pays.
 */

const FEATURE: Record<string, string> = {
  "ask.build": "Ask Formkit: building forms",
  "ask.edit": "Ask Formkit: editing forms",
  "ask.chat": "Ask Formkit: chat",
  "ask.insight": "Ask Formkit: reading responses",
  reply: "AI replies",
  "reply.try": "AI replies: samples",
  "logic.check": "AI logic checks",
  "logic.write": "AI logic: writing rules",
  insights: "AI insights reports",
};
const PLAN_NAME = { free: "Free", pro: "Pro", business: "Business" } as const;
const SERIES = "#2a78d6";

/** Dollars, showing cents down to a tenth of a cent so small costs are not rounded to nothing. */
function usd(n: number) {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 0.1) return `$${n.toFixed(3)}`;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
const tokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

export function AdminAiCost() {
  const router = useRouter();
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const data = useQuery(api.aiUsage.summary, { days: Number(days) });
  if (!data) return null;
  const t = data.total;
  const perDay = t.usd / data.span;
  const peak = Math.max(1e-9, ...data.daily.map((d) => d.usd));
  const open = (id: string) => router.push(`/admin?section=users&open=${id}`, { scroll: false });

  return (
    <>
      <div className="fk-resp-toolbar">
        <Segmented
          ariaLabel="How far back"
          value={days}
          onChange={setDays}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
        />
        <span className="fk-range-note">
          Priced from Google’s token counts, at each model’s rate on the day. Recorded since tracking began.
        </span>
      </div>

      <div className="fk-grid" data-cols="stats-sm">
        <StatCard label={`AI cost, last ${data.span} days`} value={usd(t.usd)} caption={`${t.calls.toLocaleString()} calls`} />
        <StatCard label="A month at this rate" value={usd(perDay * 30)} caption={`${usd(perDay)} a day on average`} />
        <StatCard label="Tokens in" value={tokens(t.input)} caption="What was sent to the model" />
        <StatCard label="Tokens out" value={tokens(t.output)} caption="Answers and thinking, billed higher" />
      </div>

      <section className="fk-panel">
        <h3>Each day</h3>
        <div
          className="fk-rev-bars"
          role="img"
          aria-label={`AI cost each day. ${data.daily.map((d) => `${d.day}: ${usd(d.usd)}`).join("; ")}`}
        >
          {data.daily.map((d) => (
            <span key={d.day} className="fk-rev-bar" data-rev-tip={`${d.day} · ${usd(d.usd)}`}>
              <i style={{ height: `${d.usd ? Math.max(3, (d.usd / peak) * 100) : 0}%`, background: SERIES }} />
            </span>
          ))}
        </div>
        <div className="fk-admin-axis">
          <span>{data.daily[0]?.day}</span>
          <span>{data.daily[data.daily.length - 1]?.day}</span>
        </div>
      </section>

      <section className="fk-panel">
        <h3>Against what each plan pays</h3>
        <p className="fk-panel-lede">
          AI cost over the period for each plan’s accounts, beside what those accounts pay for the same period at the
          monthly price. Per account divides by every account on the plan, whether or not they used AI.
        </p>
        <table className="fk-rev-table">
          <thead>
            <tr>
              <th scope="col">Plan</th>
              <th scope="col">Accounts</th>
              <th scope="col">Used AI</th>
              <th scope="col">AI cost</th>
              <th scope="col">Per account</th>
              <th scope="col">Per AI user</th>
              <th scope="col">Revenue</th>
              <th scope="col">AI share</th>
            </tr>
          </thead>
          <tbody>
            {data.plans.map((p) => (
              <tr key={p.plan}>
                <th scope="row">{PLAN_NAME[p.plan]}</th>
                <td>{p.accounts.toLocaleString()}</td>
                <td>{p.using.toLocaleString()}</td>
                <td>{usd(p.usd)}</td>
                <td>{usd(p.perAccount)}</td>
                <td>{usd(p.perUser)}</td>
                <td>{p.plan === "free" ? "-" : usd(p.revenue)}</td>
                <td>{p.revenue ? `${Math.round((p.usd / p.revenue) * 100)}%` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.unattributed > 0 && (
          <p className="fk-panel-lede" style={{ margin: "12px 0 0" }}>
            {usd(data.unattributed)} could not be tied to an account.
          </p>
        )}
      </section>

      <div className="fk-grid" data-cols="two" style={{ alignItems: "start" }}>
        <section className="fk-panel">
          <h3>By feature</h3>
          <table className="fk-rev-table">
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Calls</th>
                <th scope="col">Cost</th>
                <th scope="col">Per call</th>
              </tr>
            </thead>
            <tbody>
              {data.byFeature.map((f) => (
                <tr key={f.key}>
                  <th scope="row">{FEATURE[f.key] ?? f.key}</th>
                  <td>{f.calls.toLocaleString()}</td>
                  <td>{usd(f.usd)}</td>
                  <td>{usd(f.calls ? f.usd / f.calls : 0)}</td>
                </tr>
              ))}
              {data.byFeature.length === 0 && (
                <tr>
                  <td colSpan={4}>Nothing recorded in this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="fk-panel">
          <h3>By model</h3>
          <p className="fk-panel-lede">A pricier model here means the cheaper one was busy and the call moved on.</p>
          <table className="fk-rev-table">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Calls</th>
                <th scope="col">Tokens in / out</th>
                <th scope="col">Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.byModel.map((m) => (
                <tr key={m.key}>
                  <th scope="row">{m.key}</th>
                  <td>{m.calls.toLocaleString()}</td>
                  <td>
                    {tokens(m.input)} / {tokens(m.output)}
                  </td>
                  <td>{usd(m.usd)}</td>
                </tr>
              ))}
              {data.byModel.length === 0 && (
                <tr>
                  <td colSpan={4}>Nothing recorded in this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="fk-panel">
        <h3>Accounts costing the most</h3>
        <table className="fk-rev-table">
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Plan</th>
              <th scope="col">Calls</th>
              <th scope="col">Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.topAccounts.map((a) => (
              <tr key={a.who} onClick={() => open(a.who)} style={{ cursor: "pointer" }}>
                <th scope="row">{a.name ?? a.email ?? "An account"}</th>
                <td>{PLAN_NAME[a.plan]}</td>
                <td>{a.calls.toLocaleString()}</td>
                <td>{usd(a.usd)}</td>
              </tr>
            ))}
            {data.topAccounts.length === 0 && (
              <tr>
                <td colSpan={4}>Nothing recorded in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
