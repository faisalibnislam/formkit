"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { LifeBuoy } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Badge, Button, Field, Input, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/**
 * "Contact support": a ticket from inside the app, with the replies so far.
 * Business accounts are answered first, within one business day.
 */
export function ContactSupport({ variant = "secondary" }: { variant?: "primary" | "secondary" | "ghost" }) {
  const toast = useToast();
  const data = useQuery(api.support.mine, {});
  const open = useMutation(api.support.open);
  const [show, setShow] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        iconLeft={<LifeBuoy size={16} strokeWidth={1.8} aria-hidden />}
        onClick={() => setShow(true)}
      >
        Contact support
      </Button>
      {show && (
        <Modal
          title="Contact support"
          description={
            data?.priority
              ? "Your plan has priority support — a person replies within one business day."
              : "A person reads every message. Replies arrive in your notifications."
          }
          onClose={() => setShow(false)}
          width={560}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShow(false)}>
                Cancel
              </Button>
              <Button
                disabled={!subject.trim() || !body.trim() || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await open({ subject, body });
                    setSubject("");
                    setBody("");
                    setShow(false);
                    toast("Sent to Formkit support", { detail: "The reply will arrive in your notifications." });
                  } catch (e) {
                    const d = (e as { data?: unknown }).data;
                    toast(typeof d === "string" ? d : "That did not send. Try again in a moment.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Sending…" : "Send"}
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data?.priority && (
              <span>
                <Badge tone="success">Priority support</Badge>
              </span>
            )}
            <Field label="Subject">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Payments are not showing as paid" />
            </Field>
            <Field label="What is happening?" help="Which form, what you expected, and what happened instead.">
              <textarea
                className="ui-textarea"
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>
            {(data?.tickets ?? []).length > 0 && (
              <div>
                <div className="fk-proprow-hint" style={{ marginBottom: 6 }}>
                  Your recent messages
                </div>
                {data!.tickets.map((t) => (
                  <details key={t._id} className="fk-connect-log" style={{ marginTop: 6 }}>
                    <summary>
                      {t.subject} · {t.state === "open" ? "Waiting for a reply" : t.state === "answered" ? "Answered" : "Closed"}
                    </summary>
                    {t.messages.map((m, i) => (
                      <p key={i} style={{ margin: "8px 0", fontSize: 13.5, whiteSpace: "pre-wrap" }}>
                        <strong style={{ fontWeight: 500 }}>{m.who}:</strong> {m.body}
                      </p>
                    ))}
                  </details>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
