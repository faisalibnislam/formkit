"use client";

import { useEffect, useState } from "react";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { Download, Mail, Paperclip, Search, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Input,
  PillTabs,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { Stat, fullTime, relativeTime } from "./bits";

/**
 * The response inbox, for one form or for everything.
 *
 * A partial response is a real record: it keeps what was answered before the
 * person left, is counted on its own rather than folded into Completed, and
 * carries a link that puts them back where they stopped.
 */
export function ResponsesInbox({
  formId,
  openId,
}: {
  formId?: Id<"forms">;
  openId?: string | null;
}) {
  const toast = useToast();
  const convex = useConvex();

  const [completeness, setCompleteness] = useState<"all" | "complete" | "partial">("all");
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(openId ?? null);
  const [note, setNote] = useState("");
  const [emailTo, setEmailTo] = useState("");

  const data = useQuery(api.responses.list, {
    formId,
    completeness,
    search: term || undefined,
  });
  const setStatus = useMutation(api.responses.setStatus);
  const addNote = useMutation(api.responses.addNote);
  const remove = useMutation(api.responses.remove);
  const exportByEmail = useAction(api.notifications.exportByEmail);

  const rows = data?.responses ?? [];
  const current = rows.find((r) => r._id === open) ?? null;

  // Opening a response marks it read, in the inbox and in the bell alike.
  useEffect(() => {
    if (current && current.status === "new") {
      void setStatus({ ids: [current._id], status: "read" });
    }
    setNote(current?.note ?? "");
  }, [current, setStatus]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function download(kind: "csv" | "excel") {
    if (!formId) {
      toast("Pick a form first", { detail: "Exports come from one form at a time." });
      return;
    }
    const data = await convex.query(api.responses.forExport, {
      formId,
      ids: picked.size ? (Array.from(picked) as Id<"responses">[]) : undefined,
    });
    const sep = kind === "excel" ? "\t" : ",";
    const cell = (v: string) =>
      kind === "excel"
        ? v.replace(/[\t\r\n]/g, " ")
        : /[",\r\n]/.test(v)
          ? `"${v.replace(/"/g, '""')}"`
          : v;
    const text = [data.columns, ...data.rows].map((r) => r.map(cell).join(sep)).join("\r\n");
    // Excel reads a tab-separated file as a spreadsheet without a converter.
    const blob = new Blob([kind === "csv" ? "﻿" + text : text], {
      type: kind === "csv" ? "text/csv;charset=utf-8" : "text/tab-separated-values;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.filename}.${kind === "csv" ? "csv" : "xls"}`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`${data.rows.length} ${data.rows.length === 1 ? "response" : "responses"} exported`);
  }

  return (
    <>
      <div className="fk-grid" data-cols="stats">
        <Stat label="Total" value={data?.stats.total ?? 0} />
        <Stat label="Completed" value={data?.stats.completed ?? 0} note="Partials counted separately" />
        <Stat label="Partial" value={data?.stats.partial ?? 0} note="Started but left" />
        <Stat label="Unread" value={data?.stats.unread ?? 0} />
      </div>

      <div className="fk-panel" data-pad="tight">
        <div className="fk-toolbar">
          <PillTabs
            ariaLabel="Which responses"
            value={completeness}
            onChange={setCompleteness}
            tabs={[
              { value: "all", label: "All" },
              { value: "complete", label: "Complete" },
              { value: "partial", label: "Partial" },
            ]}
          />
          <span className="fk-toolbar-spacer" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search answers"
            icon={<Search size={17} strokeWidth={1.8} aria-hidden />}
            style={{ width: 220 }}
          />
          {formId && (
            <>
              <Button variant="secondary" size="sm" onClick={() => download("csv")} iconLeft={<Download size={15} strokeWidth={1.8} aria-hidden />}>
                CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={() => download("excel")}>
                Excel
              </Button>
            </>
          )}
        </div>

        {picked.size > 0 && (
          <div className="fk-toolbar" style={{ marginTop: 12 }}>
            <span style={{ fontSize: 14 }}>
              {picked.size} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await setStatus({ ids: Array.from(picked) as Id<"responses">[], status: "read" });
                setPicked(new Set());
              }}
            >
              Mark as read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await setStatus({ ids: Array.from(picked) as Id<"responses">[], status: "reviewed" });
                setPicked(new Set());
              }}
            >
              Mark as reviewed
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const n = picked.size;
                await remove({ ids: Array.from(picked) as Id<"responses">[] });
                setPicked(new Set());
                setOpen(null);
                toast(`${n} ${n === 1 ? "response" : "responses"} deleted`);
              }}
            >
              <Trash2 size={15} strokeWidth={1.8} aria-hidden /> Delete
            </Button>
            <span className="fk-toolbar-spacer" />
            <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>
              Clear
            </Button>
          </div>
        )}
      </div>

      <div className="fk-resp-layout">
        <section className="fk-panel" data-pad="none">
          {rows.length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState
                title={term ? `Nothing matches “${term}”` : "Nothing in yet"}
                description={
                  term
                    ? "Try a shorter search."
                    : "Answers land here the moment someone submits."
                }
              />
            </div>
          ) : (
            <div className="fk-rows">
              {rows.map((r) => (
                <div
                  key={r._id}
                  className="fk-row"
                  onClick={() => setOpen(r._id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpen(r._id);
                    }
                  }}
                  style={open === r._id ? { background: "var(--blue-50)" } : undefined}
                >
                  <span onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      label=""
                      checked={picked.has(r._id)}
                      onChange={() => toggle(r._id)}
                    />
                  </span>
                  <span className="fk-row-main">
                    <span className="fk-row-title">
                      {r.respondentName ?? r.respondentEmail ?? "Someone"}
                    </span>
                    <span className="fk-row-meta">
                      {relativeTime(r.submittedAt)} ·{" "}
                      {r.partial
                        ? `${r.answeredCount} of ${r.totalCount} answered`
                        : `${r.answeredCount} answers`}
                      {r.files.length > 0 && ` · ${r.files.length} attached`}
                    </span>
                  </span>
                  <span className="fk-row-side">
                    {r.partial && <Badge tone="warning">Partial</Badge>}
                    {r.status === "new" && <Badge tone="info">New</Badge>}
                    {r.status === "reviewed" && <Badge tone="success">Reviewed</Badge>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="fk-panel" style={{ position: "sticky", top: 90 }}>
          {!current ? (
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--color-text-tertiary)" }}>
              Pick a response and it opens here.
            </p>
          ) : (
            <>
              <h3 style={{ marginBottom: 2 }}>
                {current.respondentName ?? current.respondentEmail ?? "Someone"}
              </h3>
              <p className="fk-panel-lede" style={{ marginBottom: 14 }}>
                {fullTime(current.submittedAt)}
                {current.device ? ` · ${current.device}` : ""}
                {current.source ? ` · ${current.source}` : ""}
              </p>

              {current.partial && current.resumeToken && (
                <div className="fk-note" style={{ marginBottom: 14, display: "block" }}>
                  <p style={{ margin: "0 0 10px" }}>
                    They stopped after {current.answeredCount} of {current.totalCount} questions.
                    This link puts them back where they left off.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      const link = `${window.location.origin}/r/${current.resumeToken}`;
                      await navigator.clipboard.writeText(link);
                      toast("Resume link copied");
                    }}
                  >
                    Copy the resume link
                  </Button>
                </div>
              )}

              <div>
                {current.answers.map((a, i) => (
                  <div key={i} className="fk-answer">
                    <div className="fk-answer-q">{a.question}</div>
                    <div className="fk-answer-a">
                      {a.fileName ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <Paperclip size={15} strokeWidth={1.8} aria-hidden />
                          {a.fileName}
                        </span>
                      ) : (
                        a.value || <span style={{ color: "var(--color-text-tertiary)" }}>Not answered</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {current.files.length > 0 && (
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  {current.files.map(
                    (f, i) =>
                      f.url && (
                        <a key={i} href={f.url} download={f.name} className="fk-chip" style={{ width: "fit-content" }}>
                          Download {f.name}
                        </a>
                      ),
                  )}
                </div>
              )}

              <div style={{ marginTop: 18 }}>
                <Textarea
                  rows={2}
                  value={note}
                  aria-label="A note for yourself"
                  placeholder="A note for yourself — nobody else sees this."
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => addNote({ responseId: current._id, note })}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setStatus({ ids: [current._id], status: "reviewed" })}
                >
                  Mark as reviewed
                </Button>
                {current.respondentEmail && (
                  <a href={`mailto:${current.respondentEmail}`}>
                    <Button variant="ghost" size="sm" iconLeft={<Mail size={15} strokeWidth={1.8} aria-hidden />}>
                      Reply
                    </Button>
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await remove({ ids: [current._id] });
                    setOpen(null);
                    toast("Response deleted");
                  }}
                >
                  Delete
                </Button>
              </div>
            </>
          )}
        </aside>
      </div>

      {formId && (
        <section className="fk-panel">
          <h3>Send the export by email</h3>
          <p className="fk-panel-lede">
            The same rows as the download, attached as a spreadsheet. Useful when the file is large,
            or when it needs to reach somebody who does not have a Formkit account.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Input
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="Leave blank to send it to yourself"
              style={{ flex: 1, minWidth: 220 }}
            />
            <Button
              variant="secondary"
              onClick={async () => {
                const result = await exportByEmail({
                  formId,
                  to: emailTo.trim() || undefined,
                  ids: picked.size ? (Array.from(picked) as Id<"responses">[]) : undefined,
                });
                if (result.state === "sent") toast(`Sent to ${result.to}`);
                else
                  toast("That export did not go out", { detail: result.detail, tone: "error" });
              }}
            >
              Email it
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
