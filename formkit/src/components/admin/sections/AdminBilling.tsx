"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge, Button, Field, Input } from "@/components/ui";
import { StatCard } from "@/components/app/ds";
import { useToast } from "@/components/ui/Toast";
import { errorText } from "@/components/app/settings/bits";

const KEYS = [
  ["pro_month", "Pro, monthly — $3"],
  ["pro_year", "Pro, yearly — $35"],
  ["business_month", "Business, monthly — $10"],
  ["business_year", "Business, yearly — $99"],
  ["replies_100", "AI replies, 100 — $5 one-off"],
] as const;

/**
 * Billing: whether Polar is connected, who is paying, and the products: four
 * plans and the one-off pack of AI replies.
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
        <StatCard label="Paying accounts" value={status ? status.counts.paying.toLocaleString() : "—"} />
        <StatCard label="Monthly revenue" value={status ? `$${status.mrr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"} caption="Yearly plans counted by the month" />
        <StatCard label="On Pro" value={status ? status.counts.pro.toLocaleString() : "—"} />
        <StatCard label="On Business" value={status ? status.counts.business.toLocaleString() : "—"} caption={status?.counts.comped ? `${status.counts.comped} given free` : undefined} />
      </div>

      <section className="fk-panel">
        <h3 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          Polar {status && <Badge tone={ready ? "success" : "warning"}>{ready ? "Ready to sell" : "Not set up yet"}</Badge>}
        </h3>
        <p className="fk-panel-lede">
          Formkit bills through Polar, which handles payment, tax and receipts. The secrets go in the Convex dashboard,
          under the production deployment&rsquo;s Settings → Environment Variables — never here.
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
            In Polar: Settings → Webhooks → Add endpoint, format Raw, with the <em>subscription</em> events and this URL:
            <code className="fk-admin-code" style={{ display: "block", margin: "8px 0" }}>
              {status?.webhookUrl ?? "…"}
            </code>
            Add the secret Polar shows in Convex as <code className="fk-admin-code">POLAR_WEBHOOK_SECRET</code>
          </Step>
          <Step done={KEYS.every(([k]) => products[k])} title="3. The four products">
            Once the token is in, “Create them in Polar” below makes them at the plan prices. Or paste the ids of
            products you made in Polar yourself.
          </Step>
        </div>
        {status?.lastEvent && (
          <p className="fk-admin-quiet" style={{ margin: "16px 0 0" }}>
            Last webhook: {status.lastEvent.type}, {new Date(status.lastEvent.at).toLocaleString("en-US")}
            {status.lastEvent.matched ? "" : " — no account matched it"}
          </p>
        )}
      </section>

      <section className="fk-panel">
        <h3>Products</h3>
        <p className="fk-panel-lede">A monthly and a yearly product for each paid plan.</p>
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
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <Button
            size="sm"
            disabled={!draft}
            onClick={async () => {
              try {
                await saveProducts({
                  pro_month: ids.pro_month ?? "",
                  pro_year: ids.pro_year ?? "",
                  business_month: ids.business_month ?? "",
                  business_year: ids.business_year ?? "",
                  replies_100: ids.replies_100 ?? "",
                });
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
                await createProducts({});
                setDraft(null);
                toast("Four products created in Polar");
              } catch (e) {
                toast(errorText(e, "Polar did not create them."));
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? "Creating…" : "Create them in Polar"}
          </Button>
        </div>
      </section>
    </>
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
