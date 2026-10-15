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
 * The message form on /contact: a ticket, with the replies so far. Answers
 * arrive by email, with a private link to the conversation, and signed in
 * in the app's notifications too. Business accounts are answered first,
 * within one business day. Signed out, people write in with their address.
 */
export function SupportForm() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return <div className="fk-support-form" aria-busy="true" style={{ minHeight: 320 }} />;
  if (!isAuthenticated) return <GuestForm />;
  return <SignedInForm />;
}

function GuestForm() {
  const toast = useToast();
  const open = useMutation(api.support.openAsGuest);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const ready = email.trim() && subject.trim() && body.trim();

  if (sent) {
    return (
      <div className="fk-support-form" role="status">
        <h2 className="fk-support-title">We have your message</h2>
        <p className="fk-support-lede">
          We have emailed you a link to the conversation. The answer comes to the same address, usually within a day.
        </p>
      </div>
    );
  }

  return (
    <div className="fk-support-form">
      <h2 className="fk-support-title">Send us a message</h2>
      <p className="fk-support-lede">
        A person reads every message, and the answer comes by email.{" "}
        <Link href="/signin?next=/contact">Sign in</Link> first if it is about your account, so we know which one.
      </p>
      <form
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ready || busy) return;
          setBusy(true);
          try {
            await open({ name, email, subject, body, trap: trap || undefined });
            setSent(true);
          } catch (err) {
            const d = (err as { data?: unknown }).data;
            toast(typeof d === "string" ? d : "That did not send. Try again in a moment.", { tone: "error" });
          } finally {
            setBusy(false);
          }
        }}
      >
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <Field label="Your name">
            <Input value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Your email">
            <Input value={email} type="email" autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
        {/* Left empty by people; a script fills it in. */}
        <input style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} tabIndex={-1} autoComplete="off" aria-hidden value={trap} onChange={(e) => setTrap(e.target.value)} name="website" />
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A question about Business" />
        </Field>
        <Field label="What is happening?">
          <textarea className="ui-textarea" rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div>
          <Button type="submit" disabled={!ready || busy} iconLeft={<Send size={16} strokeWidth={1.8} aria-hidden />}>
            {busy ? "Sending…" : "Send message"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** One conversation: the messages, and a reply box. Used on /contact and /support/{token}. */
export function TicketThread({
  messages,
  closed,
  onReply,
}: {
  messages: { who: string; body: string; at: number }[];
  closed?: boolean;
  onReply: (body: string) => Promise<void>;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fk-ticket">
      <ol className="fk-ticket-messages">
        {messages.map((m, i) => (
          <li key={i}>
            <div className="fk-ticket-who">
              <strong>{m.who}</strong> · {new Date(m.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
            </div>
            <p>{m.body}</p>
          </li>
        ))}
      </ol>
      <form
        className="fk-ticket-reply"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim() || busy) return;
          setBusy(true);
          try {
            await onReply(text);
            setText("");
            toast("Reply sent", { detail: "We will answer by email." });
          } catch (err) {
            const d = (err as { data?: unknown }).data;
            toast(typeof d === "string" ? d : "That did not send. Try again in a moment.", { tone: "error" });
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="fk-visually-hidden" htmlFor={`reply-${messages[0]?.at ?? 0}`}>
          Your reply
        </label>
        <textarea
          id={`reply-${messages[0]?.at ?? 0}`}
          className="ui-textarea"
          rows={3}
          placeholder={closed ? "This was closed. Write here to open it again." : "Write a reply"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div>
          <Button type="submit" size="sm" disabled={!text.trim() || busy} iconLeft={<Send size={15} strokeWidth={1.8} aria-hidden />}>
            {busy ? "Sending…" : "Reply"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SignedInForm() {
  const toast = useToast();
  const data = useQuery(api.support.mine, {});
  const open = useMutation(api.support.open);
  const reply = useMutation(api.support.reply);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      await open({ subject, body });
      setSubject("");
      setBody("");
      toast("Sent to Formkit support", { detail: "The answer comes by email and in your notifications." });
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
          : "A person reads every message. The answer comes by email and in your notifications."}
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
              <TicketThread messages={t.messages} closed={t.state === "closed"} onReply={async (body) => void (await reply({ ticketId: t._id, body }))} />
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
