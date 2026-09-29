"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Copy, Globe, Mail, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { openUpgrade, upgradeOnPlanError, useGate } from "@/components/plan/usePlan";
import { Panel, errorText } from "./bits";
import { DomainSetup, useDomainCheck } from "./DomainSetup";

/** DNS records to copy into the customer's DNS provider. */
export function DnsRecords({ records }: { records: { type: string; name: string; value: string; priority?: number }[] }) {
  const toast = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  if (!records.length) return null;
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast("Copy that by hand. The browser blocked it");
    }
  };
  return (
    <div className="fk-dns">
      <div className="fk-dns-row fk-dns-head">
        <span>Type</span>
        <span>Name</span>
        <span>Value</span>
      </div>
      {records.map((r, i) => (
        <div key={i} className="fk-dns-row">
          <span className="fk-dns-type">
            {r.type}
            {r.priority !== undefined ? ` · ${r.priority}` : ""}
          </span>
          <button type="button" className="fk-dns-cell" onClick={() => copy(r.name)} title="Copy">
            <span>{r.name}</span>
            {copied === r.name ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          </button>
          <button type="button" className="fk-dns-cell" onClick={() => copy(r.value)} title="Copy">
            <span>{r.value}</span>
            {copied === r.value ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          </button>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return status === "active" || status === "verified" ? (
    <Badge tone="success">Live</Badge>
  ) : status === "failed" ? (
    <Badge tone="error">Needs attention</Badge>
  ) : (
    <Badge tone="warning">Waiting for DNS</Badge>
  );
}

/**
 * Settings → Company → Custom domains: forms.acme.com for the person or any
 * of their companies. One domain per identity.
 */
export function DomainsPanel({
  identities,
}: {
  identities: { value: "me" | Id<"companies">; label: string; handle: string | null }[];
}) {
  const toast = useToast();
  const data = useQuery(api.domains.mine, {});
  const add = useMutation(api.domains.add);
  const remove = useMutation(api.domains.remove);
  const check = useDomainCheck();
  const gate = useGate("domains");
  const [host, setHost] = useState("");
  const [owner, setOwner] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const free = identities.filter((i) => !data?.domains.some((d) => d.owner === i.value));

  return (
    <Panel
      title="Custom domains"
      lede="Put your forms on a domain of your own: forms.acme.com/intake instead of formkit.app/acme/intake. The formkit.app link keeps working too."
      aside={gate.locked ? <ProChip onClick={() => openUpgrade({ feature: "domains" })} /> : null}
    >
      {(data?.domains ?? []).map((d) => (
        <div key={d._id} className="fk-domainrow">
          <div className="fk-domainrow-head">
            <Globe size={17} strokeWidth={1.8} aria-hidden />
            <strong style={{ fontWeight: 500 }}>{d.host}</strong>
            <StatusBadge status={d.status} />
            <span className="fk-proprow-hint" style={{ margin: 0 }}>
              for {d.identity.name}
            </span>
            <span style={{ flex: 1 }} />
            {d.status === "active" && (
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<RefreshCw size={15} strokeWidth={1.8} aria-hidden />}
                disabled={check.busy === d._id}
                onClick={() => check.run(d._id)}
              >
                {check.busy === d._id ? "Checking…" : "Check again"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Trash2 size={15} strokeWidth={1.8} aria-hidden />}
              onClick={async () => {
                await remove({ domainId: d._id });
                toast(`${d.host} removed`, { detail: "Your formkit.app link is the link again." });
              }}
            >
              Remove
            </Button>
          </div>
          {d.status === "active" ? (
            <p className="fk-domain-live">
              Connected. Share links for {d.identity.name}&rsquo;s forms now use{" "}
              <a href={`https://${d.host}`} target="_blank" rel="noreferrer">
                {d.host}
              </a>
              .
            </p>
          ) : (
            <DomainSetup
              domainId={d._id}
              host={d.host}
              apex={d.apex}
              records={d.records}
              status={d.status}
              detail={d.detail}
              checkedAt={d.checkedAt}
              configured={!!data?.configured}
              checking={check.busy === d._id}
              onCheck={() => check.run(d._id)}
            />
          )}
        </div>
      ))}

      {free.length > 0 && (
        <div className="fk-domainadd">
          <Field label="Domain">
            <Input
              value={host}
              placeholder="forms.acme.com"
              onChange={(e) => setHost(e.target.value)}
              icon={<Globe size={17} strokeWidth={1.8} aria-hidden />}
            />
          </Field>
          {free.length > 1 && (
            <Field label="For">
              <Select
                ariaLabel="Which identity"
                value={owner ?? (free[0]!.value as string)}
                onChange={setOwner}
                options={free.map((i) => ({ value: i.value as string, label: i.label }))}
              />
            </Field>
          )}
          <Button
            disabled={!host.trim() || busy === "add"}
            onClick={gate.guard(async () => {
              setBusy("add");
              try {
                const target = free.length > 1 ? (owner ?? (free[0]!.value as string)) : (free[0]!.value as string);
                await add({ host, owner: target as "me" | Id<"companies"> });
                setHost("");
                toast("Domain added", { detail: "Now add the DNS record shown." });
              } catch (e) {
                if (!upgradeOnPlanError(e)) toast(errorText(e, "That domain could not be added."));
              } finally {
                setBusy(null);
              }
            })}
          >
            {busy === "add" ? "Adding…" : "Add domain"}
          </Button>
        </div>
      )}
      <p className="fk-proprow-hint" style={{ margin: "14px 0 0" }}>
        Use a subdomain like forms.acme.com: it needs one CNAME record and leaves your main website alone. You and each
        company can have one domain.
      </p>
    </Panel>
  );
}

/** Settings → Notifications → Send from your own domain. */
export function EmailDomainPanel() {
  const toast = useToast();
  const row = useQuery(api.emailDomains.mine, {});
  const add = useMutation(api.emailDomains.add);
  const setSender = useMutation(api.emailDomains.setSender);
  const remove = useMutation(api.emailDomains.remove);
  const checkNow = useAction(api.emailDomains.checkNow);
  const gate = useGate("email.domain");
  const [domain, setDomain] = useState("");
  const [local, setLocal] = useState("hello");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Panel
      title="Send from your own domain"
      lede="Confirmation emails to the people who answer come from your address, like Studio Nine <hello@studionine.co>, instead of Formkit's."
      aside={gate.locked ? <ProChip onClick={() => openUpgrade({ feature: "email.domain" })} /> : null}
    >
      {row ? (
        <div className="fk-domainrow">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Mail size={17} strokeWidth={1.8} aria-hidden />
            <strong style={{ fontWeight: 500 }}>
              {row.fromName ? `${row.fromName} <${row.fromLocal}@${row.domain}>` : `${row.fromLocal}@${row.domain}`}
            </strong>
            <StatusBadge status={row.status} />
            <span style={{ flex: 1 }} />
            {row.status !== "verified" && (
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<RefreshCw size={15} strokeWidth={1.8} aria-hidden />}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await checkNow({});
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Checking…" : "Check now"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Trash2 size={15} strokeWidth={1.8} aria-hidden />}
              onClick={async () => {
                await remove({});
                toast("Back to sending from Formkit");
              }}
            >
              Remove
            </Button>
          </div>
          {row.status === "verified" ? (
            <div className="fk-domainadd" style={{ marginTop: 12 }}>
              <Field label="Name people see">
                <Input
                  defaultValue={row.fromName ?? ""}
                  placeholder="Your company's name"
                  onBlur={async (e) => {
                    if ((e.target.value.trim() || null) === row.fromName) return;
                    await setSender({ fromLocal: row.fromLocal, fromName: e.target.value });
                    toast("Saved");
                  }}
                />
              </Field>
              <Field label="Address">
                <Input
                  defaultValue={row.fromLocal}
                  onBlur={async (e) => {
                    if (e.target.value.trim() === row.fromLocal) return;
                    try {
                      await setSender({ fromLocal: e.target.value, fromName: row.fromName ?? undefined });
                      toast("Saved");
                    } catch (err) {
                      toast(errorText(err, "That address did not save."));
                    }
                  }}
                />
              </Field>
            </div>
          ) : (
            <>
              <p className="fk-proprow-hint" style={{ margin: "8px 0 10px" }}>
                {row.detail ?? "Add these records where your domain's DNS is managed."}
              </p>
              <DnsRecords records={row.records} />
            </>
          )}
        </div>
      ) : (
        <div className="fk-domainadd">
          <Field label="Address">
            <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="hello" />
          </Field>
          <Field label="Domain">
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="studionine.co" />
          </Field>
          <Field label="Name people see">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Studio Nine" />
          </Field>
          <Button
            disabled={!domain.trim() || !local.trim() || busy}
            onClick={gate.guard(async () => {
              setBusy(true);
              try {
                await add({ domain, fromLocal: local, fromName: name || undefined });
                toast("Domain added", { detail: "Now add the DNS records shown." });
              } catch (e) {
                if (!upgradeOnPlanError(e)) toast(errorText(e, "That domain could not be added."));
              } finally {
                setBusy(false);
              }
            })}
          >
            {busy ? "Adding…" : "Add domain"}
          </Button>
        </div>
      )}
      <p className="fk-proprow-hint" style={{ margin: "14px 0 0" }}>
        Replies still go to the reply-to address set on each form.
      </p>
    </Panel>
  );
}
