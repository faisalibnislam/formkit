"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge, Button, Field, Input } from "@/components/ui";
import { StatCard } from "@/components/app/ds";
import { useToast } from "@/components/ui/Toast";
import { errorText } from "@/components/app/settings/bits";

const KEYS = [
  ["pro_month_seat", "Pro, monthly, $6 a seat"],
  ["pro_year_seat", "Pro, yearly, $60 a seat"],
  ["business_month_seat", "Business, monthly, $19 a seat"],
  ["business_year_seat", "Business, yearly, $190 a seat"],
  ["credits_100", "AI credits, 100 for $5"],
  ["credits_420", "AI credits, 420 for $20"],
  ["credits_1050", "AI credits, 1,050 for $50"],
] as const;

/** The fixed-price products from before seats, kept so their subscribers are still recognised. */
const OLDER = [
  ["pro_month", "Pro, monthly (before seats)"],
  ["pro_year", "Pro, yearly (before seats)"],
  ["business_month", "Business, monthly (before seats)"],
  ["business_year", "Business, yearly (before seats)"],
  ["replies_100", "AI replies pack (retired)"],
] as const;

/**
 * Billing: whether Polar is connected, who is paying, and the products: four
 * seat-based plans and three packs of AI credits.
 * The secrets live in the Convex deployment's environment; this page only
 * says whether they are there.
 */
export function AdminBilling() {
  const toast = useToast();
  const status = useQuery(api.billing.adminStatus, {});
  const createProducts = useAction(api.billing.createProducts);
  const saveProducts = useMutation(api.billing.saveProducts);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [creating, setCreating] = useState(false);

  const products = (status?.products ?? {}) as Record<string, string>;
  const ids = draft ?? products;
  const ready = !!status && status.token && status.secret && KEYS.every(([k]) => products[k]);

  return (
    <>
      <div className="fk-grid" data-cols="stats-sm">
        <StatCard label="Paying accounts" value={status ? status.counts.paying.toLocaleString() : "-"} />
        <StatCard label="Monthly revenue" value={status ? `$${status.mrr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"} caption="Yearly plans counted by the month" />
        <StatCard label="On Pro" value={status ? status.counts.pro.toLocaleString() : "-"} />
        <StatCard label="On Business" value={status ? status.counts.business.toLocaleString() : "-"} caption={status?.counts.comped ? `${status.counts.comped} given free` : undefined} />
      </div>

      <section className="fk-panel">
        <h3 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          Polar {status && <Badge tone={ready ? "success" : "warning"}>{ready ? "Ready to sell" : "Not set up yet"}</Badge>}
        </h3>
        <p className="fk-panel-lede">
          Formkit bills through Polar, which handles payment, tax and receipts. The secrets go in the Convex dashboard,
          under the production deployment&rsquo;s Settings → Environment Variables, never here.
          {status?.server === "sandbox"
            ? " Running against Polar’s sandbox: remove POLAR_SERVER when you are ready to take real payments."
            : " To test with Polar’s sandbox first, add POLAR_SERVER with the value sandbox."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Step done={!!status?.token} title="1. An access token">
            In Polar: Settings → Developers → New token, with every scope. Add it in Convex as{" "}
            <code className="fk-admin-code">POLAR_ACCESS_TOKEN</code>
          </Step>
          <Step done={!!status?.secret} title="2. The webhook">
            In Polar: Settings → Webhooks → Add endpoint, format Raw, with the <em>subscription</em> events and{" "}
            <em>order.paid</em> (reply packs are one-off orders), and this URL:
            <code className="fk-admin-code" style={{ display: "block", margin: "8px 0" }}>
              {status?.webhookUrl ?? "…"}
            </code>
            Add the secret Polar shows in Convex as <code className="fk-admin-code">POLAR_WEBHOOK_SECRET</code>
          </Step>
          <Step done={KEYS.every(([k]) => products[k])} title="3. The products">
            Once the token is in, “Create them in Polar” below makes any that are missing (the four seat-based plans
            and three packs of AI credits) at the listed prices. Ones already made are kept. Or paste the ids of products you
            made in Polar yourself.
          </Step>
        </div>
        {status?.lastEvent && (
          <p className="fk-admin-quiet" style={{ margin: "16px 0 0" }}>
            Last webhook: {status.lastEvent.type}, {new Date(status.lastEvent.at).toLocaleString("en-US")}
            {status.lastEvent.matched ? "" : ". No account matched it."}
          </p>
        )}
      </section>

      <section className="fk-panel">
        <h3>Products</h3>
        <p className="fk-panel-lede">A monthly and a yearly product for each paid plan, priced per seat, and the credit packs.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {KEYS.map(([k, label]) => (
            <Field key={k} label={label}>
              <Input
                value={ids[k] ?? ""}
                placeholder="Product id"
                onChange={(e) => setDraft({ ...ids, [k]: e.target.value })}
              />
            </Field>
          ))}
        </div>
        {OLDER.some(([k]) => products[k]) && (
          <details style={{ marginTop: 16 }}>
            <summary className="fk-admin-quiet">Older products</summary>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
              {OLDER.map(([k, label]) => (
                <Field key={k} label={label}>
                  <Input
                    value={ids[k] ?? ""}
                    placeholder="Product id"
                    onChange={(e) => setDraft({ ...ids, [k]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
          </details>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <Button
            size="sm"
            disabled={!draft}
            onClick={async () => {
              try {
                await saveProducts(
                  Object.fromEntries([...KEYS, ...OLDER].map(([k]) => [k, ids[k] ?? ""])) as Record<
                    (typeof KEYS)[number][0] | (typeof OLDER)[number][0],
                    string
                  >,
                );
                setDraft(null);
                toast("Products saved");
              } catch (e) {
                toast(errorText(e, "Those could not be saved."));
              }
            }}
          >
            Save
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!status?.token || creating}
            onClick={async () => {
              setCreating(true);
              try {
                const { made } = await createProducts({});
                setDraft(null);
                toast(
                  made.length
                    ? `${made.length} ${made.length === 1 ? "product" : "products"} created in Polar`
                    : "Every product is already in Polar",
                );
              } catch (e) {
                toast(errorText(e, "Polar did not create them."));
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? "Creating…" : KEYS.some(([k]) => products[k]) ? "Create the missing ones" : "Create them in Polar"}
          </Button>
        </div>
      </section>

      <PolarOrg />
      <PolarLog />
    </>
  );
}

/**
 * What Polar told Formkit lately, and what came of each: the first place to
 * look when someone paid and their company still says Free.
 */
/** Which Polar organization the token is for, and whether several subscriptions are allowed there. */
function PolarOrg() {
  const check = useAction(api.billing.polarOrg);
  const toast = useToast();
  const [orgs, setOrgs] = useState<{ name: string; slug: string; multiple: boolean | null }[] | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="fk-panel">
      <h3>Polar organization</h3>
      <p className="fk-panel-lede">
        Each company is its own subscription, so the organization Formkit’s token belongs to must allow multiple
        subscriptions (Polar → Settings → Subscriptions).
      </p>
      {(orgs ?? []).map((o) => (
        <div key={o.slug} className="fk-admin-row" style={{ fontSize: 13.5 }}>
          <span style={{ flex: 1 }}>
            {o.name}
            <span className="fk-admin-sub">polar.sh/dashboard/{o.slug}</span>
          </span>
          <Badge tone={o.multiple ? "success" : o.multiple === false ? "error" : "neutral"}>
            {o.multiple ? "Multiple subscriptions on" : o.multiple === false ? "Multiple subscriptions off" : "Setting not reported"}
          </Badge>
        </div>
      ))}
      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setOrgs(await check({}));
            } catch (e) {
              toast(errorText(e, "Polar could not be reached."));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Asking Polar…" : orgs ? "Check again" : "Check with Polar"}
        </Button>
      </div>
    </section>
  );
}

function PolarLog() {
  const rows = useQuery(api.billing.recentEvents, {});
  return (
    <section className="fk-panel">
      <h3>What Polar sent</h3>
      <p className="fk-panel-lede">
        Webhooks and checks with Polar, newest first. None at all after a payment means Polar is not reaching Formkit:
        check the webhook address and secret above, and that it sends subscription and order events.
      </p>
      {rows && rows.length === 0 ? (
        <p className="fk-admin-quiet" style={{ margin: 0 }}>Nothing yet.</p>
      ) : (
        (rows ?? []).map((r) => (
          <div key={r._id} className="fk-admin-row" style={{ fontSize: 13.5, alignItems: "flex-start" }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              {r.note}
              <span className="fk-admin-sub">
                {r.type} · {new Date(r.at).toLocaleString("en-US")}
                {r.subscriptionId ? ` · ${r.subscriptionId}` : ""}
              </span>
            </span>
            <Badge tone={r.ok ? "success" : "error"}>{r.ok ? "Applied" : "Not applied"}</Badge>
          </div>
        ))
      )}
    </section>
  );
}

function Step({ done, title, children }: { done: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className="fk-admin-row" style={{ alignItems: "flex-start" }}>
      <span style={{ flex: 1 }}>
        {title}
        <span className="fk-admin-sub" style={{ whiteSpace: "normal", lineHeight: 1.6 }}>
          {children}
        </span>
      </span>
      <Badge tone={done ? "success" : "neutral"}>{done ? "Done" : "To do"}</Badge>
    </div>
  );
}
