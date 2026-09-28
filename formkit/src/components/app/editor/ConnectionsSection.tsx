"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Copy, CreditCard, Hash, Link2, Send, Sheet, Trash2, Unplug, Webhook } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, Field, Input, Modal, Select, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { openUpgrade, upgradeOnPlanError, useGate } from "@/components/plan/usePlan";
import { errorText } from "../settings/bits";
import { fullTime } from "../bits";

type Kind = "webhook" | "slack" | "sheets";

const KINDS: { kind: Kind; label: string; icon: React.ReactNode; hint: string; feature: "connect.webhooks" | "connect.slack" | "connect.sheets" }[] = [
  {
    kind: "webhook",
    label: "Webhook",
    icon: <Webhook size={17} strokeWidth={1.8} aria-hidden />,
    hint: "Every new response, as JSON, to an address of yours. Zapier's and Make's “catch hook” addresses work here too.",
    feature: "connect.webhooks",
  },
  {
    kind: "slack",
    label: "Slack",
    icon: <Hash size={17} strokeWidth={1.8} aria-hidden />,
    hint: "A short message in a channel for each new response.",
    feature: "connect.slack",
  },
  {
    kind: "sheets",
    label: "Google Sheets",
    icon: <Sheet size={17} strokeWidth={1.8} aria-hidden />,
    hint: "A sheet that keeps itself up to date from a private link.",
    feature: "connect.sheets",
  },
];

function useCopy() {
  const toast = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast("Copy that by hand — the browser blocked it");
    }
  };
  return { copied, copy };
}

function CopyLine({ text }: { text: string }) {
  const { copied, copy } = useCopy();
  return (
    <button type="button" className="fk-dns-cell fk-copyline" onClick={() => copy(text)} title="Copy">
      <span>{text}</span>
      {copied === text ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
    </button>
  );
}

const SCRIPT = (feed: string) => `function refreshFormkit() {
  var res = UrlFetchApp.fetch("${feed}.json");
  var data = JSON.parse(res.getContentText());
  var sheet = SpreadsheetApp.getActiveSheet();
  sheet.clearContents();
  var rows = [data.columns].concat(data.rows);
  sheet.getRange(1, 1, rows.length, data.columns.length).setValues(rows);
}`;

/** The form's Settings → Connections. */
export function ConnectionsSection({
  formId,
  features,
}: {
  formId: Id<"forms">;
  features?: Record<string, boolean> | null;
}) {
  const toast = useToast();
  const rows = useQuery(api.connections.forForm, { formId });
  const add = useMutation(api.connections.add);
  const setEnabled = useMutation(api.connections.setEnabled);
  const remove = useMutation(api.connections.remove);
  const rotate = useMutation(api.connections.rotateToken);
  const test = useAction(api.connections.test);
  const hooks = useGate("connect.webhooks", features);
  const slack = useGate("connect.slack", features);
  const sheets = useGate("connect.sheets", features);
  const gates = { webhook: hooks, slack, sheets };

  const [adding, setAdding] = useState<Kind | null>(null);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);

  const start = (kind: Kind) => {
    if (gates[kind].locked) {
      openUpgrade({ feature: KINDS.find((k) => k.kind === kind)!.feature });
      return;
    }
    if (kind === "sheets") {
      void create("sheets");
      return;
    }
    setUrl("");
    setLabel("");
    setAdding(kind);
  };

  async function create(kind: Kind) {
    setBusy("add");
    try {
      const r = await add({ formId, kind, url: kind === "sheets" ? undefined : url, label: label || undefined });
      setAdding(null);
      if (r.secret) setSecret(r.secret);
      else toast(kind === "sheets" ? "Sheets link made" : "Connected");
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "That did not connect."));
    } finally {
      setBusy(null);
    }
  }

  const hasSheet = rows?.some((r) => r.kind === "sheets");

  return (
    <section className="fk-panel">
      <h3 style={{ margin: "0 0 6px" }}>Connections</h3>
      <p className="fk-panel-lede">Send each new response somewhere else the moment it arrives.</p>

      <div className="fk-connect-kinds">
        {KINDS.filter((k) => k.kind !== "sheets" || !hasSheet).map((k) => (
          <button key={k.kind} type="button" className="fk-connect-kind" onClick={() => start(k.kind)}>
            <span className="fk-connect-icon">{k.icon}</span>
            <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }}>
                {k.label}
                {gates[k.kind].locked && <ProChip />}
              </span>
              <span className="fk-proprow-hint">{k.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {(rows ?? []).map((c) => {
        const meta = KINDS.find((k) => k.kind === c.kind)!;
        return (
          <div key={c._id} className="fk-domainrow">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="fk-connect-icon">{meta.icon}</span>
              <strong style={{ fontWeight: 500 }}>{c.label ?? meta.label}</strong>
              {c.last ? (
                c.last.ok ? (
                  <Badge tone="success">Delivered</Badge>
                ) : (
                  <Badge tone="error">Last one failed</Badge>
                )
              ) : c.kind !== "sheets" ? (
                <Badge tone="neutral">Nothing sent yet</Badge>
              ) : null}
              <span style={{ flex: 1 }} />
              <Switch
                checked={c.enabled}
                label={c.enabled ? "On" : "Off"}
                onChange={(enabled) => void setEnabled({ connectionId: c._id, enabled })}
              />
              {c.kind !== "sheets" && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<Send size={15} strokeWidth={1.8} aria-hidden />}
                  disabled={busy === c._id}
                  onClick={async () => {
                    setBusy(c._id);
                    try {
                      const r = await test({ connectionId: c._id });
                      if (r.ok) toast("Test delivered");
                      else toast("The test did not arrive", { detail: r.detail ?? `Answered ${r.status}`, tone: "error" });
                    } catch (e) {
                      toast(errorText(e, "The test did not go out."));
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === c._id ? "Sending…" : "Send a test"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<Trash2 size={15} strokeWidth={1.8} aria-hidden />}
                onClick={async () => {
                  await remove({ connectionId: c._id });
                  toast(`${meta.label} removed`);
                }}
              >
                Remove
              </Button>
            </div>

            {c.url && <p className="fk-proprow-hint fk-connect-url">{c.url}</p>}

            {c.feed && (
              <div className="fk-connect-sheet">
                <p className="fk-proprow-hint" style={{ margin: "10px 0 8px" }}>
                  In any cell of a Google Sheet, type this. The sheet refreshes it about once an hour:
                </p>
                <CopyLine text={`=IMPORTDATA("${c.feed}")`} />
                <p className="fk-proprow-hint" style={{ margin: "12px 0 0" }}>
                  Want it every few minutes?{" "}
                  <button type="button" className="fk-linkbtn" onClick={() => setScript(c.feed)}>
                    Use the Apps Script instead
                  </button>
                  . Anyone with the link can read the responses, so keep it private —{" "}
                  <button
                    type="button"
                    className="fk-linkbtn"
                    onClick={async () => {
                      await rotate({ connectionId: c._id });
                      toast("New link made", { detail: "The old one no longer works — update your sheet." });
                    }}
                  >
                    make a new link
                  </button>{" "}
                  if it got out.
                </p>
              </div>
            )}

            {c.recent.length > 0 && (
              <details className="fk-connect-log">
                <summary>Recent deliveries</summary>
                {c.recent.map((d, i) => (
                  <div key={i} className="fk-connect-logrow">
                    <span className="fk-chip" style={{ background: d.ok ? "var(--green-100)" : "var(--red-100)" }}>
                      {d.status || "—"}
                    </span>
                    <span>{fullTime(d.at)}</span>
                    {d.attempt > 1 && <span className="fk-proprow-hint">try {d.attempt}</span>}
                    {d.detail && <span className="fk-proprow-hint fk-connect-detail">{d.detail}</span>}
                  </div>
                ))}
              </details>
            )}
          </div>
        );
      })}

      <p className="fk-proprow-hint" style={{ margin: "14px 0 0" }}>
        A delivery that fails is tried again after a minute, then after ten. Webhooks are signed —{" "}
        <a href="/api-docs#webhooks" target="_blank" className="fk-linkbtn">
          how to check the signature
        </a>
        .
      </p>

      {adding && (
        <Modal
          title={adding === "slack" ? "Post to Slack" : "Add a webhook"}
          description={
            adding === "slack"
              ? "In Slack, add the Incoming Webhooks app to the channel, then paste the address it gives you."
              : "Paste the address that should receive each response. For Zapier, use a “Catch Hook” trigger; for Make, a “Custom webhook”."
          }
          onClose={() => setAdding(null)}
          width={520}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAdding(null)}>
                Cancel
              </Button>
              <Button disabled={!url.trim() || busy === "add"} onClick={() => void create(adding)}>
                {busy === "add" ? "Connecting…" : "Connect"}
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Address">
              <Input
                value={url}
                autoFocus
                placeholder={adding === "slack" ? "https://hooks.slack.com/services/…" : "https://hooks.zapier.com/…"}
                onChange={(e) => setUrl(e.target.value)}
                icon={<Link2 size={17} strokeWidth={1.8} aria-hidden />}
              />
            </Field>
            <Field label="Name" help="Only you see this.">
              <Input
                value={label}
                placeholder={adding === "slack" ? "#new-leads" : "Zapier — add to CRM"}
                onChange={(e) => setLabel(e.target.value)}
              />
            </Field>
          </div>
        </Modal>
      )}

      {secret && (
        <Modal
          title="Webhook added"
          description="This is the secret that signs every delivery. Copy it now — it is not shown again."
          onClose={() => setSecret(null)}
          width={520}
          footer={<Button onClick={() => setSecret(null)}>Done</Button>}
        >
          <CopyLine text={secret} />
        </Modal>
      )}

      {script && (
        <Modal
          title="Refresh with Apps Script"
          description="In your sheet, open Extensions → Apps Script, paste this, and save. Then under Triggers, run refreshFormkit every 5 or 10 minutes."
          onClose={() => setScript(null)}
          width={620}
          footer={<Button onClick={() => setScript(null)}>Done</Button>}
        >
          <pre className="fk-codeblock">{SCRIPT(script)}</pre>
          <div style={{ marginTop: 10 }}>
            <CopyScript text={SCRIPT(script)} />
          </div>
        </Modal>
      )}
    </section>
  );
}

function CopyScript({ text }: { text: string }) {
  const { copied, copy } = useCopy();
  return (
    <Button
      variant="secondary"
      size="sm"
      iconLeft={copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
      onClick={() => copy(text)}
    >
      {copied ? "Copied" : "Copy the script"}
    </Button>
  );
}

/** The form's Settings → Payments. */
export function PaymentsSection({
  formId,
  features,
}: {
  formId: Id<"forms">;
  features?: Record<string, boolean> | null;
}) {
  const toast = useToast();
  const data = useQuery(api.payments.settings, { formId });
  const connect = useAction(api.payments.connect);
  const disconnect = useMutation(api.payments.disconnect);
  const save = useMutation(api.payments.setFormPayment);
  const gate = useGate("payments", features);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ amount: string; currency: string; source: string; label: string } | null>(null);

  if (!data) return null;
  const p = data.payment;
  const decimals = (c: string) => (c === "jpy" ? 0 : 2);
  const current = draft ?? {
    amount: p?.amount !== undefined ? (p.amount / 10 ** decimals(p.currency)).toFixed(decimals(p.currency)) : "",
    currency: p?.currency ?? "usd",
    source: p?.fromCalc ?? "",
    label: p?.label ?? "",
  };
  const patch = (x: Partial<typeof current>) => setDraft({ ...current, ...x });

  async function apply(enabled: boolean) {
    try {
      await save({
        formId,
        enabled,
        currency: current.currency,
        amount: current.source ? undefined : Number(current.amount) || undefined,
        fromCalc: current.source || undefined,
        label: current.label || undefined,
      });
      setDraft(null);
      toast(enabled ? "Payment on" : "Payment off");
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "That did not save."));
    }
  }

  return (
    <section className="fk-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h3 style={{ margin: "0 0 6px", flex: 1 }}>Take a payment</h3>
        {gate.locked && <ProChip onClick={() => openUpgrade({ feature: "payments" })} />}
      </div>
      <p className="fk-panel-lede">
        After someone sends the form, they go on to pay through your own Stripe account. The money goes straight to you —
        Formkit takes nothing.
      </p>

      {!data.account ? (
        data.mine ? (
          <div className="fk-domainrow">
            <p className="fk-proprow-hint" style={{ margin: "0 0 12px" }}>
              In Stripe, go to Developers → API keys → Create restricted key. Give it <strong>Write</strong> access to{" "}
              <strong>Checkout Sessions</strong> and nothing else, then paste it here.
            </p>
            <div className="fk-domainadd">
              <Field label="Restricted key">
                <Input
                  value={key}
                  type="password"
                  autoComplete="off"
                  placeholder="rk_live_…"
                  onChange={(e) => setKey(e.target.value)}
                  icon={<CreditCard size={17} strokeWidth={1.8} aria-hidden />}
                />
              </Field>
              <Button
                disabled={!key.trim() || busy}
                onClick={gate.guard(async () => {
                  setBusy(true);
                  try {
                    const r = await connect({ key });
                    setKey("");
                    toast(r.name ? `Connected to ${r.name}` : "Stripe connected", {
                      detail: r.live ? undefined : "This is a test key — no real money moves.",
                    });
                  } catch (e) {
                    if (!upgradeOnPlanError(e)) toast(errorText(e, "That key did not connect."));
                  } finally {
                    setBusy(false);
                  }
                })}
              >
                {busy ? "Checking…" : "Connect Stripe"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="fk-proprow-hint">The form&rsquo;s owner needs to connect their Stripe account first.</p>
        )
      ) : (
        <>
          <div className="fk-domainrow">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <CreditCard size={17} strokeWidth={1.8} aria-hidden />
              <strong style={{ fontWeight: 500 }}>{data.account.name ?? "Stripe"}</strong>
              <span className="fk-proprow-hint">key ending {data.account.last4}</span>
              <Badge tone={data.account.live ? "success" : "warning"}>{data.account.live ? "Live" : "Test mode"}</Badge>
              <span style={{ flex: 1 }} />
              {data.mine && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<Unplug size={15} strokeWidth={1.8} aria-hidden />}
                  onClick={async () => {
                    await disconnect({});
                    toast("Stripe disconnected", { detail: "Forms stop asking for payment." });
                  }}
                >
                  Disconnect
                </Button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
            <Field label="Amount">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {data.calcNames.length > 0 && (
                  <div style={{ minWidth: 200 }}>
                    <Select
                      ariaLabel="Where the amount comes from"
                      value={current.source}
                      onChange={(source) => patch({ source })}
                      options={[
                        { value: "", label: "A fixed amount" },
                        ...data.calcNames.map((n) => ({ value: n, label: `The result of ${n}` })),
                      ]}
                    />
                  </div>
                )}
                {!current.source && (
                  <div style={{ width: 150 }}>
                    <Input
                      value={current.amount}
                      inputMode="decimal"
                      placeholder="25.00"
                      onChange={(e) => patch({ amount: e.target.value.replace(/[^0-9.]/g, "") })}
                    />
                  </div>
                )}
                <div style={{ width: 120 }}>
                  <Select
                    ariaLabel="Currency"
                    value={current.currency}
                    onChange={(currency) => patch({ currency })}
                    options={data.currencies.map((c) => ({ value: c, label: c.toUpperCase() }))}
                  />
                </div>
              </div>
            </Field>
            <Field label="What it is for" help="Shown on the Stripe page and the receipt. Leave it blank to use the form's name.">
              <Input
                value={current.label}
                placeholder="Workshop ticket"
                onChange={(e) => patch({ label: e.target.value })}
              />
            </Field>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {p?.enabled ? (
                <>
                  <Badge tone="success">Taking payments</Badge>
                  {draft && <Button onClick={() => void apply(true)}>Save changes</Button>}
                  <Button variant="secondary" onClick={() => void apply(false)}>
                    Turn off
                  </Button>
                </>
              ) : (
                <Button onClick={gate.guard(() => void apply(true))}>Start taking payments</Button>
              )}
            </div>
          </div>
        </>
      )}
      <p className="fk-proprow-hint" style={{ margin: "16px 0 0" }}>
        Responses show whether they are paid, and exports gain a Payment column. Refunds are made in Stripe.
      </p>
    </section>
  );
}
