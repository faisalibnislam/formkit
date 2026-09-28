"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, EmptyState, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { fullTime, relativeTime } from "@/components/app/bits";

/** Support tickets. A reply goes out as Formkit, under the person's own name. */
export function AdminSupport() {
  const toast = useToast();
  const tickets = useQuery(api.admin.tickets, {});
  const reply = useMutation(api.admin.replyToTicket);
  const [open, setOpen] = useState<Id<"tickets"> | null>(null);
  const [body, setBody] = useState("");

  const current = tickets?.find((t) => t._id === open) ?? null;

  if (tickets && tickets.length === 0) {
    return (
      <section className="fk-panel">
        <EmptyState title="No tickets" description="Questions customers send appear here." />
      </section>
    );
  }

  return (
    <div className="fk-resp-layout">
      <section className="fk-panel" data-pad="none">
        <div className="fk-rows">
          {(tickets ?? []).map((t) => (
            <div
              key={t._id}
              className="fk-row"
              role="button"
              tabIndex={0}
              onClick={() => {
                setOpen(t._id);
                setBody("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") setOpen(t._id);
              }}
              style={open === t._id ? { background: "var(--blue-50)" } : undefined}
            >
              <span className="fk-row-main">
                <span className="fk-row-title">{t.subject}</span>
                <span className="fk-row-meta">
                  {t.fromName} · {t.fromEmail} · {relativeTime(t.openedAt)}
                </span>
              </span>
              <span className="fk-row-side" style={{ display: "inline-flex", gap: 6 }}>
                {t.priority && <Badge tone="error">Priority</Badge>}
                <Badge
                  tone={t.state === "open" ? "warning" : t.state === "answered" ? "info" : "neutral"}
                >
                  {t.state === "open" ? "Open" : t.state === "answered" ? "Answered" : "Closed"}
                </Badge>
              </span>
            </div>
          ))}
        </div>
      </section>

      <aside className="fk-panel" style={{ position: "sticky", top: 24 }}>
        {!current ? (
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-tertiary)" }}>
            Pick a ticket and the thread opens here.
          </p>
        ) : (
          <>
            <h3 style={{ marginBottom: 2 }}>{current.subject}</h3>
            <p className="fk-panel-lede">
              {current.fromName} · {current.fromEmail}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {current.messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--radius-card-inner)",
                    background: "var(--neutral-50)",
                  }}
                >
                  <div style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
                    {m.who} · {fullTime(m.at)}
                  </div>
                  <div style={{ marginTop: 5, fontSize: 14.5, lineHeight: 1.55 }}>{m.body}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <Textarea
                rows={4}
                value={body}
                aria-label="Your reply"
                placeholder="Answer plainly, and say what happens next."
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <Button
                disabled={!body.trim()}
                onClick={async () => {
                  await reply({ ticketId: current._id, body });
                  setBody("");
                  toast("Reply sent");
                }}
              >
                Send the reply
              </Button>
              <Button
                variant="secondary"
                disabled={!body.trim()}
                onClick={async () => {
                  await reply({ ticketId: current._id, body, close: true });
                  setBody("");
                  toast("Replied and closed");
                }}
              >
                Reply and close
              </Button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
