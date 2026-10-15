"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { currentEndpoint, pushSupported, turnOffPush, turnOnPush } from "@/lib/push";
import { Panel, Row } from "./bits";

/**
 * Settings → Notifications → Push: buzz this phone or computer even when
 * Formkit isn't open. Hidden until push is set up on the deployment.
 */

const KINDS = [
  { key: "responses", label: "New responses", hint: "One notification per form until you look, however busy it gets" },
  { key: "mentions", label: "Mentions and assignments", hint: "Someone @mentions you, replies to you, or gives you a response" },
  { key: "approvals", label: "Approvals", hint: "A form waits for your approval, or yours was approved or sent back" },
] as const;

const day = (at: number) => new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function PushPanel() {
  const toast = useToast();
  const config = useQuery(api.push.config, {});
  const subscribe = useMutation(api.push.subscribe);
  const unsubscribe = useMutation(api.push.unsubscribe);
  const setPrefs = useMutation(api.push.setPrefs);
  const sendTest = useMutation(api.push.test);
  const supported = useSyncExternalStore(
    () => () => {},
    () => pushSupported(),
    () => true,
  );
  // This browser's own address, to mark it in the list and to switch it.
  const [here, setHere] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void currentEndpoint().then((e) => live && setHere(e));
    return () => {
      live = false;
    };
  }, []);

  if (!config?.publicKey || !config.prefs) return null;
  const publicKey = config.publicKey;
  const prefs = config.prefs;
  const onHere = !!here && config.devices.some((d) => d.endpoint === here);

  async function toggleHere(on: boolean) {
    setBusy(true);
    try {
      if (on) {
        const sub = await turnOnPush(publicKey);
        if (sub === "denied") {
          toast("The browser said no", { detail: "Allow notifications for this site in the browser's settings, then try again.", tone: "error" });
        } else if (sub === "unsupported") {
          toast("This browser can't receive push notifications", { tone: "error" });
        } else {
          await subscribe(sub);
          setHere(sub.endpoint);
          toast("Push notifications on", { detail: "On this device" });
        }
      } else {
        const endpoint = (await turnOffPush()) ?? here;
        if (endpoint) await unsubscribe({ endpoint });
        setHere(null);
        toast("Push notifications off", { detail: "On this device" });
      }
    } catch {
      toast("That didn't work", { detail: "The browser couldn't set up push. Try again in a moment.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Push notifications"
      lede="On your phone or computer, even when Formkit isn't open. Each device signs up for itself."
    >
      <Row
        label="This device"
        hint={
          !supported
            ? "This browser can't receive push notifications. On iPhone and iPad, add Formkit to the Home Screen first."
            : onHere
              ? "Signed up"
              : "Not signed up yet"
        }
      >
        <Switch checked={onHere} label="Push notifications on this device" disabled={!supported || busy} onChange={(on) => void toggleHere(on)} />
      </Row>
      {KINDS.map((k) => (
        <Row key={k.key} label={k.label} hint={k.hint}>
          <Switch
            checked={prefs[k.key]}
            label={`${k.label} · push`}
            onChange={async (on) => {
              await setPrefs({ [k.key]: on });
              toast(on ? "Turned on" : "Turned off", { detail: `${k.label} · push` });
            }}
          />
        </Row>
      ))}
      {config.devices.length > 0 && (
        <ul className="fk-push-devices" aria-label="Signed-up devices">
          {config.devices.map((d) => (
            <li key={d.endpoint}>
              <span>
                <strong>{d.device}</strong>
                {d.endpoint === here ? " · this device" : ""}
                <small>Since {day(d.createdAt)}{d.lastSentAt ? ` · last notified ${day(d.lastSentAt)}` : ""}</small>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (d.endpoint === here) await turnOffPush();
                  await unsubscribe({ endpoint: d.endpoint });
                  if (d.endpoint === here) setHere(null);
                  toast("Device removed", { detail: d.device });
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {config.devices.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Button
            size="sm"
            onClick={async () => {
              await sendTest({});
              toast("Test sent", { detail: "It should arrive on every signed-up device in a moment." });
            }}
          >
            Send a test
          </Button>
        </div>
      )}
    </Panel>
  );
}
