"use client";

import { useState } from "react";
import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { LifeBuoy, Send } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Badge, Button, Field, Input } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/**
 * Support lives on its own page, /contact. Elsewhere, "Contact support" is a
 * link there rather than a pop-up over whatever you were reading.
 */
export function ContactSupport({ variant = "secondary" }: { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <Link href="/contact" className="ui-btn" data-variant={variant}>
      <LifeBuoy size={16} strokeWidth={1.8} aria-hidden />
      Contact support
    </Link>
  );
}

/**
 * The message form on /contact: a ticket, with the replies so far. Replies
 * arrive in the app's notifications. Business accounts are answered first,
 * within one business day. Signed out, it says how to write in instead.
 */
export function SupportForm() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return <div className="fk-support-form" aria-busy="true" style={{ minHeight: 320 }} />;
  if (!isAuthenticated) {
    return (
      <div className="fk-support-form">
        <h2 className="fk-support-title">Send us a message</h2>
        <p className="fk-support-lede">
          Sign in and write to us here: we will know which account it is about, and the reply lands in your
          notifications. Or email any of the addresses on this page.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/signin?next=/contact" className="fk-pill fk-pill-dark">
            Sign in to send a message
          </Link>
          <a href="mailto:support@formkit.app" className="fk-pill">
            Email support@formkit.app
          </a>
        </div>
      </div>
    );
  }
  return <SignedInForm />;
}

function SignedInForm() {
  const toast = useToast();
  const data = useQuery(api.support.mine, {});
  const open = useMutation(api.support.open);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      await open({ subject, body });
      setSubject("");
      setBody("");
      toast("Sent to Formkit support", { detail: "The reply will arrive in your notifications." });
    } catch (e) {
      const d = (e as { data?: unknown }).data;
      toast(typeof d === "string" ? d : "That did not send. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fk-support-form">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 className="fk-support-title" style={{ flex: 1 }}>
          Send us a message
        </h2>
        {data?.priority && <Badge tone="success">Priority support</Badge>}
      </div>
      <p className="fk-support-lede">
        {data?.priority
          ? "Your plan has priority support. A person replies within one business day."
          : "A person reads every message. The reply arrives in your notifications."}
      </p>
      <form
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (subject.trim() && body.trim() && !busy) void send();
        }}
      >
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Payments are not showing as paid" />
        </Field>
        <Field label="What is happening?" help="Which form, what you expected, and what happened instead.">
          <textarea className="ui-textarea" rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div>
          <Button type="submit" disabled={!subject.trim() || !body.trim() || busy} iconLeft={<Send size={16} strokeWidth={1.8} aria-hidden />}>
            {busy ? "Sending…" : "Send message"}
          </Button>
        </div>
      </form>

      {(data?.tickets ?? []).length > 0 && (
        <div className="fk-support-history">
          <div className="fk-support-history-title">Your recent messages</div>
          {data!.tickets.map((t) => (
            <details key={t._id} className="fk-connect-log">
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
  );
}
