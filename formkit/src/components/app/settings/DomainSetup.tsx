"use client";

import { useCallback, useEffect, useState } from "react";
import { useAction } from "convex/react";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { errorText } from "./bits";

/**
 * Connecting a custom domain, in three steps a person who has never touched
 * DNS can follow: where to go, exactly what to type, and whether it worked.
 *
 * Public DNS is read on the way (see `domains.inspect`) to name the company
 * that hosts the domain's DNS, so the steps are theirs, and to say what the
 * name points at right now.
 */

type Rec = { type: string; name: string; value: string };
type Inspected = FunctionReturnType<typeof api.domains.inspect>;

type Provider = {
  id: string;
  name: string;
  url?: string;
  /** Steps for one record; `host` is what goes in the name field. */
  steps: (apex: string, r: Rec, host: string) => string[];
  hostLabel?: string;
  valueLabel?: string;
};

const PROVIDERS: Provider[] = [
  {
    id: "namecheap",
    name: "Namecheap",
    url: "https://ap.www.namecheap.com/domains/list/",
    steps: (apex, r, host) => [
      `Sign in to Namecheap and open Domain List.`,
      `Click Manage next to ${apex}, then open the Advanced DNS tab.`,
      `Under Host records, click Add new record and choose ${r.type} Record.`,
      `In Host, type ${host}. In ${r.type === "A" ? "IP Address" : "Value"}, paste ${r.value}. Leave TTL on Automatic.`,
      `Click the green tick to save.`,
    ],
  },
  {
    id: "godaddy",
    name: "GoDaddy",
    url: "https://dcc.godaddy.com/control/portfolio",
    steps: (apex, r, host) => [
      `Sign in to GoDaddy and open My Products → Domains.`,
      `Click DNS next to ${apex}.`,
      `Click Add New Record and choose ${r.type}.`,
      `In Name, type ${host}. In ${r.type === "A" ? "Value" : "Value"}, paste ${r.value}. Leave TTL as it is.`,
      `Click Save.`,
    ],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    url: "https://dash.cloudflare.com/",
    steps: (apex, r, host) => [
      `Sign in to Cloudflare and click ${apex}.`,
      `Open DNS → Records and click Add record.`,
      `Choose ${r.type}. In Name, type ${host}. In ${r.type === "A" ? "IPv4 address" : "Target"}, paste ${r.value}.`,
      `Turn Proxy status off, so the cloud is grey and says DNS only. This matters: with the orange cloud on, the domain cannot connect.`,
      `Click Save.`,
    ],
  },
  {
    id: "squarespace",
    name: "Squarespace (and former Google Domains)",
    url: "https://account.squarespace.com/domains",
    steps: (apex, r, host) => [
      `Sign in to Squarespace and open Domains, then click ${apex}.`,
      `Open DNS → DNS Settings and scroll to Custom records.`,
      `Click Add record and choose ${r.type}.`,
      `In Host, type ${host}. In Data, paste ${r.value}.`,
      `Click Save.`,
    ],
  },
  {
    id: "route53",
    name: "Amazon Route 53",
    url: "https://console.aws.amazon.com/route53/v2/hostedzones",
    steps: (apex, r, host) => [
      `Open Route 53 → Hosted zones and click ${apex}.`,
      `Click Create record.`,
      `In Record name, type ${host === "@" ? "nothing (leave it empty)" : host}. Choose Record type ${r.type}. In Value, paste ${r.value}.`,
      `Click Create records.`,
    ],
  },
  {
    id: "vercel",
    name: "Vercel",
    url: "https://vercel.com/dashboard/domains",
    steps: (apex, r, host) => [
      `Open Vercel → Domains and click ${apex}.`,
      `Under DNS Records, fill in Name: ${host === "@" ? "leave empty" : host}, Type: ${r.type}, Value: ${r.value}.`,
      `Click Add.`,
    ],
  },
  {
    id: "hostinger",
    name: "Hostinger",
    url: "https://hpanel.hostinger.com/domains",
    steps: (apex, r, host) => [
      `Sign in to hPanel and open Domains, then Manage next to ${apex}.`,
      `Open DNS / Nameservers.`,
      `Under Manage DNS records choose Type ${r.type}, Name ${host}, ${r.type === "A" ? "Points to" : "Target"} ${r.value}.`,
      `Click Add Record.`,
    ],
  },
  {
    id: "porkbun",
    name: "Porkbun",
    url: "https://porkbun.com/account/domainsSpeedy",
    steps: (apex, r, host) => [
      `Sign in to Porkbun and open Domain Management.`,
      `Click DNS next to ${apex}.`,
      `Choose Type ${r.type}, Host ${host === "@" ? "(leave empty)" : host}, Answer ${r.value}.`,
      `Click Add.`,
    ],
  },
  {
    id: "other",
    name: "Somewhere else",
    steps: (apex, r, host) => [
      `Sign in where ${apex}'s DNS is managed. That is usually where you bought the domain, or your website host.`,
      `Find the DNS settings. They may be called DNS, DNS records, Zone editor or Advanced DNS.`,
      `Add a new ${r.type} record. In Host or Name, type ${host}. In Value, Target or Points to, paste ${r.value}.`,
      `Save it.`,
    ],
  },
];

const byId = (id: string | undefined) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[PROVIDERS.length - 1]!;

function CopyCell({ text, label }: { text: string; label: string }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="fk-dns-cell"
      title={`Copy ${label}`}
      aria-label={`Copy ${label}: ${text}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        } catch {
          toast("Copy that by hand. The browser blocked it");
        }
      }}
    >
      <span>{text}</span>
      {done ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
    </button>
  );
}

export function DomainSetup({
  domainId,
  host,
  apex,
  records,
  status,
  detail,
  checkedAt,
  configured,
  onCheck,
  checking,
}: {
  domainId: Id<"domains">;
  host: string;
  apex: string;
  records: Rec[];
  status: string;
  detail: string | null;
  checkedAt: number | null;
  configured: boolean;
  onCheck: () => Promise<void>;
  checking: boolean;
}) {
  const inspect = useAction(api.domains.inspect);
  const [dns, setDns] = useState<Inspected | null>(null);
  const [reading, setReading] = useState(true);
  const [pick, setPick] = useState<string | null>(null);
  const [help, setHelp] = useState(false);

  const read = useCallback(async () => {
    setReading(true);
    try {
      setDns(await inspect({ domainId }));
    } catch {
      /* The steps still read fine without it. */
    } finally {
      setReading(false);
    }
  }, [inspect, domainId]);

  useEffect(() => {
    let live = true;
    inspect({ domainId })
      .then((r) => live && setDns(r))
      .catch(() => {})
      .finally(() => live && setReading(false));
    return () => {
      live = false;
    };
  }, [inspect, domainId]);

  const provider = byId(pick ?? dns?.provider?.id);
  const main = records.find((r) => r.type === "CNAME" || r.type === "A") ?? records[0];
  const extra = records.filter((r) => r !== main);
  const hostOf = (r: Rec) => r.name || "@";
  const subdomain = main?.type === "CNAME";

  const seen: { tone: "ok" | "wait" | "bad"; text: string } = !dns
    ? { tone: "wait", text: reading ? "Looking up your domain…" : "We could not read public DNS just now." }
    : dns.pointsHere && dns.servedHere === false
      ? {
          tone: "bad",
          text: `Your record is right, but another website on Vercel is answering ${host}, probably your ${apex} site. In Vercel, open that project → Settings → Domains and remove ${host}, or the *.${apex} wildcard, from it. Then press Check now.`,
        }
    : dns.pointsHere
      ? {
          tone: "ok",
          text:
            status === "active"
              ? "Your record is in place and the domain is connected."
              : "We can see your record. Formkit is now confirming it and setting up the secure (https) certificate. This usually takes a few minutes.",
        }
      : dns.proxied
        ? { tone: "bad", text: "Cloudflare's proxy is on for this name. Set the record's Proxy status to DNS only (grey cloud)." }
        : dns.cname.length
          ? { tone: "bad", text: `${host} points to ${dns.cname[0]} at the moment. Change that record's value to ${main?.value}.` }
          : dns.a.length
            ? {
                tone: "bad",
                text: subdomain
                  ? `${host} has an A record (${dns.a.join(", ")}). Delete it, then add the CNAME record below. A name can't have both.`
                  : `${host} points to ${dns.a.join(", ")} at the moment. Change the A record to ${main?.value}.`,
              }
            : { tone: "wait", text: `We can't see a record for ${host} yet. Add it using step 2 above.` };

  return (
    <div className="fk-dsetup">
      {!configured && (
        <p className="fk-dsetup-note">
          <AlertTriangle size={15} strokeWidth={1.8} aria-hidden />
          Formkit&rsquo;s connection to its hosting isn&rsquo;t switched on yet. Add your record now and the domain connects as soon as it is.
        </p>
      )}

      <ol className="fk-dsetup-steps">
        <li>
          <div className="fk-dsetup-num">1</div>
          <div className="fk-dsetup-body">
            <h4>Open your domain&rsquo;s DNS settings</h4>
            <p>
              {dns?.provider ? (
                <>
                  The DNS for <strong>{apex}</strong> is managed at <strong>{dns.provider.name}</strong>. Sign in there.
                </>
              ) : (
                <>
                  Sign in where <strong>{apex}</strong>&rsquo;s DNS is managed. That is usually where you bought the domain
                  (Namecheap, GoDaddy, Cloudflare and so on) or your website host.
                </>
              )}
            </p>
            {provider.url && (
              <a className="fk-dsetup-link" href={provider.url} target="_blank" rel="noreferrer">
                Open {provider.name.replace(/ \(.*\)$/, "")}
                <ExternalLink size={13} strokeWidth={1.8} aria-hidden />
              </a>
            )}
          </div>
        </li>

        <li>
          <div className="fk-dsetup-num">2</div>
          <div className="fk-dsetup-body">
            <h4>Add {records.length > 1 ? "these records" : "this record"}</h4>
            <p>Click a box to copy it.</p>
            <div className="fk-dsetup-table" role="table" aria-label="DNS records to add">
              <div className="fk-dsetup-tr fk-dsetup-th" role="row">
                <span role="columnheader">Type</span>
                <span role="columnheader">Host / Name</span>
                <span role="columnheader">Value / Target</span>
                <span role="columnheader">TTL</span>
              </div>
              {records.map((r, i) => (
                <div key={i} className="fk-dsetup-tr" role="row">
                  <span className="fk-dsetup-type" role="cell">
                    {r.type}
                  </span>
                  <span role="cell">
                    <CopyCell text={hostOf(r)} label="host" />
                  </span>
                  <span role="cell">
                    <CopyCell text={r.value} label="value" />
                  </span>
                  <span className="fk-dsetup-ttl" role="cell">
                    Automatic
                  </span>
                </div>
              ))}
            </div>
            {main && (
              <p className="fk-dsetup-tip">
                {subdomain ? (
                  <>
                    In Host, type only <code>{hostOf(main)}</code>, not the full <code>{host}</code>. Your provider adds{" "}
                    <code>.{apex}</code> by itself.
                  </>
                ) : (
                  <>
                    <code>@</code> means the domain itself, {apex}. Some providers want the Host left empty instead.
                  </>
                )}
                {extra.length > 0 && " The TXT record proves the domain is yours; add it as well."}
              </p>
            )}

            <div className="fk-dsetup-provider">
              <label htmlFor={`prov-${domainId}`}>Steps for</label>
              <span className="fk-dsetup-select">
                <select id={`prov-${domainId}`} value={provider.id} onChange={(e) => setPick(e.target.value)}>
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {dns?.provider?.id === p.id ? " (your DNS)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} strokeWidth={1.8} aria-hidden />
              </span>
            </div>
            {main && (
              <ol className="fk-dsetup-howto">
                {provider.steps(apex, main, hostOf(main)).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
                {extra.map((r, i) => (
                  <li key={`x${i}`}>
                    Add one more record the same way: type {r.type}, host {hostOf(r)}, value {r.value}.
                  </li>
                ))}
              </ol>
            )}
          </div>
        </li>

        <li>
          <div className="fk-dsetup-num">3</div>
          <div className="fk-dsetup-body">
            <h4>Check it</h4>
            <p className="fk-dsetup-seen" data-tone={seen.tone}>
              {seen.tone === "ok" ? (
                <CheckCircle2 size={16} strokeWidth={1.8} aria-hidden />
              ) : seen.tone === "bad" ? (
                <AlertTriangle size={16} strokeWidth={1.8} aria-hidden />
              ) : reading ? (
                <Loader2 size={16} strokeWidth={1.8} aria-hidden className="fk-spin" />
              ) : (
                <RefreshCw size={16} strokeWidth={1.8} aria-hidden />
              )}
              <span>{seen.text}</span>
            </p>
            {configured && detail && status !== "active" && !/Waiting for the DNS record/.test(detail) && (
              <p className="fk-dsetup-detail">{detail}</p>
            )}
            <div className="fk-dsetup-actions">
              <Button
                size="sm"
                iconLeft={<RefreshCw size={14} strokeWidth={1.8} aria-hidden />}
                disabled={checking || reading}
                onClick={async () => {
                  await onCheck();
                  await read();
                }}
              >
                {checking || reading ? "Checking…" : "Check now"}
              </Button>
              <span className="fk-proprow-hint" style={{ margin: 0 }}>
                New records usually show up in 5 to 30 minutes, sometimes a few hours. Formkit also checks by itself every
                ten minutes{checkedAt ? `; last checked ${new Date(checkedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}.
              </span>
            </div>
          </div>
        </li>
      </ol>

      <button type="button" className="fk-dsetup-help" aria-expanded={help} onClick={() => setHelp((h) => !h)}>
        Not working?
        <ChevronDown size={15} strokeWidth={1.8} aria-hidden />
      </button>
      {help && (
        <ul className="fk-dsetup-faq">
          <li>
            <strong>You typed the whole domain in Host.</strong> Most providers add <code>.{apex}</code> for you, so{" "}
            <code>{host}</code> in Host becomes <code>{host}.{apex}</code>. Use only <code>{main ? hostOf(main) : "@"}</code>.
          </li>
          <li>
            <strong>There is already a record with that name.</strong> A name can have one CNAME, and a CNAME can&rsquo;t sit
            next to an A record. Delete or edit the old one.
          </li>
          <li>
            <strong>Your DNS is on Cloudflare.</strong> Set the record to DNS only (grey cloud). The orange proxy hides the
            record from Formkit.
          </li>
          <li>
            <strong>You changed nameservers recently.</strong> Add the record where the domain&rsquo;s nameservers point now
            {dns?.nameservers.length ? ` (${dns.nameservers.slice(0, 2).join(", ")})` : ""}, not at the old host.
          </li>
          <li>
            <strong>It has been more than a day.</strong> Remove the domain here, add it again, and check the record matches
            exactly. Still stuck? Contact support from Settings → Plan.
          </li>
        </ul>
      )}
    </div>
  );
}

export type { Rec as DnsRecord };
export function useDomainCheck() {
  const toast = useToast();
  const checkNow = useAction(api.domains.checkNow);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (domainId: Id<"domains">) => {
    setBusy(domainId);
    try {
      await checkNow({ domainId });
    } catch (e) {
      toast(errorText(e, "That check did not run."));
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}
