"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui";
import { TicketThread } from "./ContactSupport";

/** A support conversation behind its private link: read it and reply, signed in or not. */
export function SupportThread({ token }: { token: string }) {
  const t = useQuery(api.support.thread, { token });
  const reply = useMutation(api.support.replyByToken);
  if (t === undefined) return <div className="fk-support-form" aria-busy="true" style={{ minHeight: 240 }} />;
  if (!t) {
    return (
      <div className="fk-support-form">
        <h2 className="fk-support-title">This conversation is not here</h2>
        <p className="fk-support-lede">
          The link may be incomplete. Write to us again on the <Link href="/contact">contact page</Link>.
        </p>
      </div>
    );
  }
  return (
    <div className="fk-support-form">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 className="fk-support-title" style={{ flex: 1 }}>
          {t.subject}
        </h2>
        <Badge tone={t.state === "answered" ? "success" : t.state === "closed" ? "neutral" : "info"}>
          {t.state === "open" ? "Waiting for a reply" : t.state === "answered" ? "Answered" : "Closed"}
        </Badge>
      </div>
      <p className="fk-support-lede">Anyone with this link can read and reply here, so keep it to yourself.</p>
      <TicketThread messages={t.messages} closed={t.state === "closed"} onReply={async (body) => void (await reply({ token, body }))} />
    </div>
  );
}
