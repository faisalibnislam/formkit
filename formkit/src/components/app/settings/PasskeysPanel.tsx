"use client";

import { useState, useSyncExternalStore } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { KeyRound } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { cancelled, createPasskey, guessName, passkeysHere, passkeysSupported } from "@/lib/passkeys";
import { SITE_URL } from "@/lib/site";
import { Panel } from "./bits";

/**
 * Settings → Account → Passkeys: sign in with Face ID, a fingerprint or the
 * device's PIN instead of the password. The password stays; a passkey is
 * another way in, and counts as two-factor on its own.
 */

const RP_ID = new URL(SITE_URL).hostname;
const day = (at: number) => new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const message = (e: unknown, fallback: string) => {
  const data = (e as { data?: unknown } | null)?.data;
  if (typeof data === "string") return data;
  return e instanceof Error ? e.message.replace(/^.*(Uncaught )?(Convex)?Error: /, "").split("\n")[0]! : fallback;
};

export function PasskeysPanel() {
  const toast = useToast();
  const keys = useQuery(api.passkeys.list, {});
  const options = useMutation(api.passkeys.registerOptions);
  const register = useAction(api.passkeys.register);
  const remove = useMutation(api.passkeys.remove);
  const rename = useMutation(api.passkeys.rename);
  const [busy, setBusy] = useState(false);
  const [naming, setNaming] = useState<{ id: Id<"passkeys">; name: string } | null>(null);
  const supported = useSyncExternalStore(
    () => () => {},
    () => passkeysSupported(),
    () => true,
  );
  const here = useSyncExternalStore(
    () => () => {},
    () => passkeysHere(RP_ID),
    () => true,
  );

  async function add() {
    setBusy(true);
    try {
      const o = await options({});
      const credential = await createPasskey(o);
      await register({ credential, name: guessName() });
      toast("Passkey added", { detail: "Next time, sign in with it instead of the password." });
    } catch (e) {
      if (!cancelled(e)) toast(message(e, "That passkey couldn't be added."), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const hint = !supported
    ? "This browser can't make passkeys."
    : !here
      ? `Passkeys are made on ${RP_ID}. Open Formkit there to add one.`
      : "Sign in with Face ID, a fingerprint or your device's PIN. Your password still works, and a passkey counts as two-factor.";

  return (
    <Panel
      title="Passkeys"
      lede={hint}
      aside={
        <Button size="sm" variant="secondary" disabled={!supported || !here || busy} onClick={() => void add()}>
          {busy ? "Waiting for the device…" : "Add a passkey"}
        </Button>
      }
    >
      {keys && keys.length > 0 ? (
        <div className="fk-sessions">
          {keys.map((k) => (
            <div key={k._id} className="fk-session">
              <span className="fk-session-mark" aria-hidden>
                <KeyRound size={18} strokeWidth={1.7} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {naming?.id === k._id ? (
                  <input
                    className="fk-passkey-name"
                    aria-label="Passkey name"
                    autoFocus
                    value={naming.name}
                    maxLength={60}
                    onChange={(e) => setNaming({ id: k._id, name: e.target.value })}
                    onBlur={async () => {
                      if (naming.name.trim() && naming.name !== k.name) await rename({ id: k._id, name: naming.name });
                      setNaming(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setNaming(null);
                    }}
                  />
                ) : (
                  <span className="fk-session-name">{k.name}</span>
                )}
                <span className="fk-session-meta">
                  Added {day(k.createdAt)}
                  {k.lastUsedAt ? ` · last used ${day(k.lastUsedAt)}` : " · not used yet"}
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setNaming({ id: k._id, name: k.name })}>
                Rename
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await remove({ id: k._id });
                  toast("Passkey removed", { detail: `${k.name} can no longer sign you in. Remove it from the device too.` });
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        keys && <p className="fk-setpanel-text">No passkeys yet.</p>
      )}
    </Panel>
  );
}
