"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Check, Copy, KeyRound, Trash2, Unplug } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { SCOPES, SCOPE_TEXT, type Scope } from "../../../../convex/model/apiAuth";
import { Button, Checkbox, Field, Input, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { SITE_URL } from "@/lib/site";
import { relativeTime } from "../bits";
import { Panel, errorText } from "./bits";

/**
 * Settings → Developers, on every plan: API keys, connecting an AI assistant
 * over MCP, and the apps already connected.
 */

const MCP_URL = `${SITE_URL}/api/mcp`;
const STARTER: Scope[] = ["forms:read", "forms:write", "forms:publish", "responses:read"];

function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="fk-dns-cell fk-copyline"
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", textAlign: "left" }}>{text}</span>
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
    </button>
  );
}

function KeysPanel() {
  const toast = useToast();
  const keys = useQuery(api.controls.apiKeys, {});
  const create = useMutation(api.controls.createApiKey);
  const revoke = useMutation(api.controls.revokeApiKey);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<Scope>>(new Set(STARTER));
  const [fresh, setFresh] = useState<string | null>(null);
  return (
    <Panel
      title="API keys"
      lede={
        <>
          For your own code, Zapier, and AI tools that take a key (Claude Code, Cursor). Each key does only what you tick.{" "}
          <Link href="/api-docs" className="fk-linkbtn" target="_blank">
            How the API works
          </Link>
        </>
      }
    >
      <Field label="Name" help="What it is for, so you know which to revoke.">
        <Input value={name} placeholder="Claude Code on my laptop" onChange={(e) => setName(e.target.value)} />
      </Field>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "14px 0" }}>
        {SCOPES.map((s) => (
          <Checkbox
            key={s}
            label={SCOPE_TEXT[s].label}
            description={SCOPE_TEXT[s].detail}
            checked={scopes.has(s)}
            onChange={(on) =>
              setScopes((p) => {
                const next = new Set(p);
                if (on) next.add(s);
                else next.delete(s);
                return next;
              })
            }
          />
        ))}
      </div>
      <Button
        iconLeft={<KeyRound size={16} strokeWidth={1.8} aria-hidden />}
        disabled={scopes.size === 0}
        onClick={async () => {
          try {
            setFresh(await create({ name, scopes: [...scopes] }));
            setName("");
          } catch (e) {
            toast(errorText(e, "That key was not made."));
          }
        }}
      >
        Create key
      </Button>
      {(keys ?? []).length > 0 && (
        <div className="fk-rows" style={{ marginTop: 16 }}>
          {keys!.map((k) => (
            <div key={k._id} className="fk-row" data-static="true">
              <span className="fk-row-main">
                <span className="fk-row-title">{k.name}</span>
                <span className="fk-row-meta">
                  {k.prefix}… · {k.scopes.map((s) => SCOPE_TEXT[s].label.toLowerCase()).join(", ")} · made {relativeTime(k.createdAt)} ·{" "}
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
          <CopyLine text={fresh} />
        </Modal>
      )}
    </Panel>
  );
}

function McpPanel() {
  return (
    <Panel
      title="Use Formkit from an AI assistant"
      lede="Ask Claude, ChatGPT or Cursor to build a form, publish it, or tell you what people said. It works on every plan, and the assistant never deletes anything."
    >
      <Field label="Claude, ChatGPT and other apps" help="Add a custom connector with this address. You will be asked to sign in and choose what it may do.">
        <CopyLine text={MCP_URL} />
      </Field>
      <div style={{ height: 14 }} />
      <Field label="Claude Code" help="Make a key above, then run this in a terminal.">
        <CopyLine text={`claude mcp add --transport http formkit ${MCP_URL} --header "Authorization: Bearer YOUR_KEY"`} />
      </Field>
      <div style={{ height: 14 }} />
      <Field label="Cursor and others that read mcp.json" help="Make a key above and put it in place of YOUR_KEY.">
        <CopyLine text={JSON.stringify({ mcpServers: { formkit: { url: MCP_URL, headers: { Authorization: "Bearer YOUR_KEY" } } } }, null, 2)} />
      </Field>
    </Panel>
  );
}

function AppsPanel() {
  const toast = useToast();
  const apps = useQuery(api.oauth.connectedApps, {});
  const disconnect = useMutation(api.oauth.disconnect);
  if (!apps?.length) return null;
  return (
    <Panel title="Connected apps" lede="Apps you allowed to use your Formkit. Disconnecting one stops it at once.">
      <div className="fk-rows">
        {apps.map((a) => (
          <div key={a.clientId} className="fk-row" data-static="true">
            <span className="fk-row-main">
              <span className="fk-row-title">{a.name}</span>
              <span className="fk-row-meta">
                {a.scopes.join(", ")} · connected {relativeTime(a.since)}
                {a.lastUsedAt ? ` · last used ${relativeTime(a.lastUsedAt)}` : ""}
              </span>
            </span>
            <span className="fk-row-side">
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<Unplug size={15} strokeWidth={1.8} aria-hidden />}
                onClick={async () => {
                  await disconnect({ clientId: a.clientId });
                  toast(`${a.name} disconnected`);
                }}
              >
                Disconnect
              </Button>
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function DevelopersSection() {
  return (
    <>
      <McpPanel />
      <AppsPanel />
      <KeysPanel />
    </>
  );
}
