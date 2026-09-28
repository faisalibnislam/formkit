"use client";

import { useState } from "react";
import { Check, Download, MessageSquare, Paperclip } from "lucide-react";
import { Ticks } from "./Ticks";
import { ANSWER_ROWS, COMPLETION_TICKS, DROP_ROWS, INBOX_ROWS } from "@/content/landing";

/**
 * UNDERSTAND. The completed answer has become a row in the inbox, with its
 * detail, its attachment and the figures it moved.
 *
 * Avatars render initials, as the app itself does - there is no photography in
 * this system.
 */
const BADGE_TONE: Record<string, { bg: string; ink: string }> = {
  New: { bg: "var(--green-100)", ink: "var(--green-600)" },
  Read: { bg: "var(--neutral-100)", ink: "var(--neutral-600)" },
  Partial: { bg: "var(--yellow-100)", ink: "var(--yellow-600)" },
  Reviewed: { bg: "var(--neutral-100)", ink: "var(--neutral-600)" },
};

export function InboxScene() {
  const [selected, setSelected] = useState("maya");
  const [read, setRead] = useState<Record<string, boolean>>({});
  const [reviewed, setReviewed] = useState(false);
  const [noted, setNoted] = useState(false);

  const detailBadge = reviewed ? "Reviewed" : "New";

  return (
    <section id="understand" style={{ position: "relative", background: "#ffffff" }}>
      <div
        className="fk-inbox"
        style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}
      >
        <div style={{ minWidth: 0, borderRight: "1px solid var(--neutral-200)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "16px clamp(20px,3vw,34px)",
              borderBottom: "1px solid var(--neutral-200)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500 }}>Responses</span>
            <span style={{ fontSize: 12.5, color: "var(--color-text-tertiary)" }}>
              Client onboarding
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12.5, color: "var(--color-text-tertiary)" }}>
              <span data-count="248">0</span> total
            </span>
          </div>

          {INBOX_ROWS.map((r) => {
            const badge = read[r.key] && r.badge === "New" ? "Read" : r.badge;
            const tone = BADGE_TONE[badge]!;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => {
                  setSelected(r.key);
                  setRead((m) => ({ ...m, [r.key]: true }));
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "14px clamp(20px,3vw,34px)",
                  border: "none",
                  borderBottom: "1px solid var(--neutral-200)",
                  background: selected === r.key ? "var(--blue-50)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background .2s ease",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    flex: "0 0 auto",
                    borderRadius: "50%",
                    background: "var(--neutral-100)",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--neutral-700)",
                  }}
                >
                  {r.initials}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 14.5,
                      color: "var(--neutral-900)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.name}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 2,
                      fontSize: 12,
                      color: "var(--color-text-tertiary)",
                    }}
                  >
                    {r.meta}
                  </span>
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: 22,
                    padding: "0 9px",
                    flex: "0 0 auto",
                    borderRadius: "var(--radius-pill)",
                    background: tone.bg,
                    color: tone.ink,
                    fontSize: 11.5,
                    transition: "background .3s ease,color .3s ease",
                  }}
                >
                  {badge}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "16px clamp(20px,3vw,34px)",
              borderBottom: "1px solid var(--neutral-200)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500 }}>Maya Okafor</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 22,
                padding: "0 9px",
                borderRadius: "var(--radius-pill)",
                background: BADGE_TONE[detailBadge]!.bg,
                color: BADGE_TONE[detailBadge]!.ink,
                fontSize: 11.5,
                transition: "background .3s ease,color .3s ease",
              }}
            >
              {detailBadge}
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12.5, color: "var(--color-text-tertiary)" }}>
              2 minutes ago
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              padding: "clamp(18px,2.6vw,30px) clamp(20px,3vw,34px)",
            }}
          >
            {ANSWER_ROWS.map((a) => (
              <span key={a.q} style={{ display: "block" }}>
                <span
                  style={{ display: "block", fontSize: 12, color: "var(--color-text-tertiary)" }}
                >
                  {a.q}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 5,
                    fontSize: 15,
                    lineHeight: 1.5,
                    color: "var(--neutral-900)",
                  }}
                >
                  {a.a}
                </span>
              </span>
            ))}

            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "12px 14px",
                borderRadius: 10,
                background: "var(--neutral-50)",
              }}
            >
              <Paperclip size={15} strokeWidth={1.8} aria-hidden />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--neutral-800)" }}>
                northstar-brand-2026.pdf
              </span>
              <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>2.4 MB</span>
            </span>

            <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 2 }}>
              <ActionButton primary onClick={() => setReviewed(true)}>
                <Check size={14} strokeWidth={2} aria-hidden />
                {reviewed ? "Reviewed" : "Mark reviewed"}
              </ActionButton>
              <ActionButton onClick={() => setNoted((n) => !n)}>
                <MessageSquare size={14} strokeWidth={1.8} aria-hidden />
                Add a note
              </ActionButton>
              <ActionButton onClick={() => undefined}>
                <Download size={14} strokeWidth={1.8} aria-hidden />
                Export
              </ActionButton>
            </div>

            {noted && (
              <div
                style={{
                  padding: "13px 15px",
                  borderRadius: 10,
                  background: "var(--yellow-100)",
                  fontSize: 13.5,
                  color: "var(--neutral-800)",
                }}
              >
                Note added · &ldquo;Budget fits the March slot. Send the scope by Friday.&rdquo;
              </div>
            )}
          </div>

          <span style={{ flex: 1 }} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(min(170px,100%),1fr))",
              borderTop: "1px solid var(--neutral-200)",
            }}
          >
            <div
              style={{
                padding: "18px clamp(20px,3vw,34px)",
                borderRight: "1px solid var(--neutral-200)",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
                Completion rate
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: "clamp(28px,3vw,40px)",
                  fontWeight: 300,
                  letterSpacing: "-.03em",
                }}
              >
                <span data-count="72.5" data-dec="1" data-suffix="%">
                  0%
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 4,
                  height: 34,
                  marginTop: 10,
                }}
              >
                {COMPLETION_TICKS.map((h, i) => (
                  <span
                    key={i}
                    data-tickh={h}
                    style={{
                      flex: 1,
                      height: 0,
                      borderRadius: 2,
                      background: i > 8 ? "var(--green-400)" : "var(--neutral-200)",
                      transition: "height .6s cubic-bezier(.22,.8,.24,1)",
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ padding: "18px clamp(20px,3vw,34px)" }}>
              <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
                Where people stop
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}
              >
                {DROP_ROWS.map((d) => (
                  <span key={d.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 13,
                        color: "var(--neutral-800)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.label}
                    </span>
                    <span style={{ flex: "0 0 104px", height: 20 }}>
                      <Ticks
                        total={d.total}
                        filled={d.filled}
                        fill={d.fill}
                        short
                        height="100%"
                      />
                    </span>
                    <span
                      style={{
                        flex: "0 0 32px",
                        fontSize: 12,
                        color: "var(--color-text-tertiary)",
                        textAlign: "right",
                      }}
                    >
                      {d.pctLabel}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fk-plate" style={{ padding: "clamp(26px,4vh,44px) clamp(20px,4vw,46px)" }}>
        <div>
          <span className="fk-plate-eyebrow">UNDERSTAND</span>
          <h3>Answers land in one place, ready to read.</h3>
        </div>
        <p>
          248 answers in one inbox. People who stopped halfway are kept too, counted on their own.
        </p>
      </div>
    </section>
  );
}

function ActionButton({
  children,
  primary,
  onClick,
}: {
  children: React.ReactNode;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 38,
        padding: "0 15px",
        border: primary ? "none" : "1px solid var(--neutral-200)",
        borderRadius: "var(--radius-pill)",
        background: primary ? "var(--neutral-900)" : "#ffffff",
        color: primary ? "var(--neutral-0)" : "var(--neutral-900)",
        fontSize: 13.5,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
