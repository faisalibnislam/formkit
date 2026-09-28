"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Copy, KeyRound, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Badge, Button, Field, Input, Modal, Select, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { openUpgrade, upgradeOnPlanError, useGate } from "@/components/plan/usePlan";
import { ContactSupport } from "@/components/support/ContactSupport";
import { fullTime, relativeTime } from "../bits";
import { DnsRecords } from "./Domains";
import { Panel, Row, errorText } from "./bits";

type Feature = "audit" | "retention" | "api" | "sso";

function chip(feature: Feature) {
  return <ProChip plan="business" onClick={() => openUpgrade({ feature })} />;
}

function AuditPanel() {
  const gate = useGate("audit");
  const [before, setBefore] = useState<number | undefined>(undefined);
  const data = useQuery(api.controls.auditLog, before ? { before } : {});
  return (
    <Panel
      title="Audit log"
      lede="Who did what on the account (publishing, team changes, keys, sign-in rules), kept for a year."
      aside={gate.locked ? chip("audit") : null}
    >
      {gate.locked || !data?.enabled ? (
        <p className="fk-proprow-hint">The log starts as soon as the account is on Business.</p>
      ) : data.rows.length === 0 ? (
        <p className="fk-proprow-hint">Nothing yet.</p>
      ) : (
        <>
          <div className="fk-rows">
            {data.rows.map((r) => (
              <div key={r._id} className="fk-row" data-static="true">
                <span className="fk-row-main">
                  <span className="fk-row-title">
                    {r.action}
                    {r.subject ? `: ${r.subject}` : ""}
                  </span>
                  <span className="fk-row-meta">
                    {r.who} · {fullTime(r.at)}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {before && (
              <Button variant="ghost" size="sm" onClick={() => setBefore(undefined)}>
                Newest
              </Button>
            )}
            {data.more && (
              <Button variant="secondary" size="sm" onClick={() => setBefore(data.rows[data.rows.length - 1]!.at)}>
                Older
              </Button>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

function RetentionPanel() {
  const toast = useToast();
  const gate = useGate("retention");
  const data = useQuery(api.controls.retention, {});
  const save = useMutation(api.controls.setRetention);
  const label = (d: number) => (d % 365 === 0 ? `${d / 365} year${d === 365 ? "" : "s"}` : `${d} days`);
  return (
    <Panel
      title="Data retention"
      lede="Erase responses, and the files uploaded with them, once they reach a certain age. Useful when you should not keep personal data longer than you need it."
      aside={gate.locked ? chip("retention") : null}
    >
      <Row
        label="Keep responses for"
        hint={
          data?.days
            ? `Anything older than ${label(data.days)} is erased every hour. This cannot be undone, so export first if you need a copy.`
            : "Kept until you delete them."
        }
      >
        <div style={{ width: 180 }}>
          <Select
            ariaLabel="Keep responses for"
            value={data?.days ? String(data.days) : "forever"}
            onChange={gate.guard(async (v: string) => {
              try {
                await save({ days: v === "forever" ? null : Number(v) });
                toast(v === "forever" ? "Responses are kept" : `Responses are erased after ${label(Number(v))}`);
              } catch (e) {
                if (!upgradeOnPlanError(e)) toast(errorText(e, "That did not save."));
              }
            })}
            options={[
              { value: "forever", label: "Until I delete them" },
              ...(data?.choices ?? [30, 90, 180, 365, 730]).map((d) => ({ value: String(d), label: label(d) })),
            ]}
          />
        </div>
      </Row>
    </Panel>
  );
}

function ApiPanel() {
  const toast = useToast();
  const gate = useGate("api");
  const keys = useQuery(api.controls.apiKeys, {});
  const create = useMutation(api.controls.createApiKey);
  const revoke = useMutation(api.controls.revokeApiKey);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <Panel
      title="API keys"
      lede={
        <>
          Read your forms and responses from your own code.{" "}
          <Link href="/api-docs" className="fk-linkbtn" target="_blank">
            How the API works
          </Link>
        </>
      }
      aside={gate.locked ? chip("api") : null}
    >
      <div className="fk-domainadd">
        <Field label="Name" help="What it is for, so you know which to revoke.">
          <Input value={name} placeholder="Warehouse sync" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button
          iconLeft={<KeyRound size={16} strokeWidth={1.8} aria-hidden />}
          onClick={gate.guard(async () => {
            try {
              setFresh(await create({ name }));
              setName("");
            } catch (e) {
              if (!upgradeOnPlanError(e)) toast(errorText(e, "That key was not made."));
            }
          })}
        >
          Create key
        </Button>
      </div>
      {(keys ?? []).length > 0 && (
        <div className="fk-rows" style={{ marginTop: 14 }}>
          {keys!.map((k) => (
            <div key={k._id} className="fk-row" data-static="true">
              <span className="fk-row-main">
                <span className="fk-row-title">{k.name}</span>
                <span className="fk-row-meta">
                  {k.prefix}… · made {relativeTime(k.createdAt)} ·{" "}
                  {k.lastUsedAt ? `last used ${relativeTime(k.lastUsedAt)}` : "never used"}
                </span>
              </span>
              <span className="fk-row-side">
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<Trash2 size={15} strokeWidth={1.8} aria-hidden />}
                  onClick={async () => {
                    await revoke({ keyId: k._id });
                    toast("Key revoked", { detail: "Anything using it stops working now." });
                  }}
                >
                  Revoke
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}
      {fresh && (
        <Modal
          title="Your new API key"
          description="Copy it now. Formkit keeps only a fingerprint and cannot show it again."
          onClose={() => setFresh(null)}
          width={560}
          footer={<Button onClick={() => setFresh(null)}>Done</Button>}
        >
          <button
            type="button"
            className="fk-dns-cell fk-copyline"
            onClick={async () => {
              await navigator.clipboard.writeText(fresh).catch(() => {});
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            <span>{fresh}</span>
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          </button>
        </Modal>
      )}
    </Panel>
  );
}

const PROVIDER_NAME = { google: "Google", "microsoft-entra-id": "Microsoft" } as const;

function SsoPanel() {
  const toast = useToast();
  const gate = useGate("sso");
  const data = useQuery(api.sso.settings, {});
  const setDomain = useMutation(api.sso.setDomain);
  const remove = useMutation(api.sso.remove);
  const setEnforced = useMutation(api.sso.setEnforced);
  const verify = useAction(api.sso.verify);
  const [domain, setDomainText] = useState("");
  const [busy, setBusy] = useState(false);
  const sso = data?.sso;
  const available = data?.available ?? [];

  return (
    <Panel
      title="Single sign-on"
      lede="People with an address at your company's domain sign in with Google or Microsoft, and the password form turns them away. Whoever leaves your directory loses access here too."
      aside={gate.locked ? chip("sso") : null}
    >
      {data && available.length === 0 && (
        <p className="fk-proprow-hint" style={{ margin: "0 0 12px" }}>
          Google and Microsoft sign-in are being switched on for Formkit. You can prove your domain now; requiring it
          becomes possible as soon as they are.
        </p>
      )}
      {!sso ? (
        <div className="fk-domainadd">
          <Field label="Your company's email domain">
            <Input value={domain} placeholder="studionine.co" onChange={(e) => setDomainText(e.target.value)} />
          </Field>
          <Button
            disabled={!domain.trim()}
            onClick={gate.guard(async () => {
              try {
                await setDomain({ domain });
                setDomainText("");
              } catch (e) {
                if (!upgradeOnPlanError(e)) toast(errorText(e, "That domain was not added."));
              }
            })}
          >
            Add domain
          </Button>
        </div>
      ) : (
        <div className="fk-domainrow">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <ShieldCheck size={17} strokeWidth={1.8} aria-hidden />
            <strong style={{ fontWeight: 500 }}>@{sso.domain}</strong>
            {sso.verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Waiting for DNS</Badge>}
            {sso.enforce && <Badge tone="info">Required</Badge>}
            <span style={{ flex: 1 }} />
            {!sso.verified && (
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<RefreshCw size={15} strokeWidth={1.8} aria-hidden />}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const ok = await verify({});
                    toast(ok ? "Domain verified" : "The record is not there yet", {
                      detail: ok ? undefined : "DNS changes can take up to a few hours to spread.",
                    });
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
                toast("Single sign-on removed");
              }}
            >
              Remove
            </Button>
          </div>
          {!sso.verified ? (
            <>
              <p className="fk-proprow-hint" style={{ margin: "8px 0 10px" }}>
                Prove the domain is yours: add this record where its DNS is managed, then check.
              </p>
              <DnsRecords records={[sso.record]} />
            </>
          ) : (
            <div style={{ marginTop: 12 }}>
              <Row
                label={`Require Google or Microsoft for @${sso.domain}`}
                hint={
                  sso.enforce
                    ? `Everyone at @${sso.domain} signs in with ${sso.providers.map((p) => PROVIDER_NAME[p]).join(" or ")}.`
                    : "Off. People can still use a password."
                }
              >
                <Switch
                  checked={sso.enforce}
                  label="Require single sign-on"
                  onChange={gate.guard(async (enforce: boolean) => {
                    try {
                      await setEnforced({ enforce });
                      toast(enforce ? "Single sign-on required" : "Passwords allowed again");
                    } catch (e) {
                      if (!upgradeOnPlanError(e)) toast(errorText(e, "That did not save."));
                    }
                  })}
                />
              </Row>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function PaperworkPanel() {
  const gate = useGate("support.priority");
  return (
    <Panel
      title="Paperwork and support"
      lede="The data processing agreement covers how Formkit handles the personal data in your responses on your behalf."
      aside={gate.locked ? <ProChip plan="business" onClick={() => openUpgrade({ feature: "support.priority" })} /> : null}
    >
      <Row label="Data processing agreement" hint="Included with Business. Read it, print it, or ask for a countersigned copy.">
        <Link href="/dpa" target="_blank" className="fk-pill">
          Read the DPA
        </Link>
      </Row>
      <Row
        label={gate.locked ? "Support" : "Priority support"}
        hint={gate.locked ? "A person reads every message." : "Your messages go to the top of the queue, answered within one business day."}
      >
        <ContactSupport />
      </Row>
    </Panel>
  );
}

/** Settings → Controls (Business): audit, retention, API, sign-in, paperwork. */
export function ControlsSection() {
  return (
    <>
      <AuditPanel />
      <RetentionPanel />
      <ApiPanel />
      <SsoPanel />
      <PaperworkPanel />
    </>
  );
}
