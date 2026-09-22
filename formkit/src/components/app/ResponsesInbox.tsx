"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  FileDown,
  Inbox,
  Mail,
  MailOpen,
  Paperclip,
  Search,
  SlidersHorizontal,
  Sunrise,
  Trash2,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  Checkbox,
  Drawer,
  EmptyState,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { StatCard } from "./ds";
import { fullTime, relativeTime } from "./bits";

/**
 * The response inbox, for one form or for everything.
 *
 * A partial response is a real record: it keeps what was answered before the
 * person left, is counted on its own rather than folded into Completed, and
 * carries a link that puts them back where they stopped.
 *
 * The list is one table across the full width and a response opens in a
 * drawer over it, rather than in a column that would leave neither the list nor
 * the answers enough room.
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
  const [status, setStatusFilter] = useState<"all" | "new" | "read" | "reviewed">("all");
  const [pickedForm, setPickedForm] = useState<string>("all");
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(openId ?? null);
  const [emailTo, setEmailTo] = useState("");

  const data = useQuery(api.responses.list, {
    formId,
    completeness,
    search: term || undefined,
  });
  const formsList = useQuery(api.forms.list, { filter: "all" });
  const setStatus = useMutation(api.responses.setStatus);
  const remove = useMutation(api.responses.remove);
  const exportByEmail = useAction(api.notifications.exportByEmail);

  const titles = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of formsList?.forms ?? []) map.set(f._id, f.title);
    return map;
  }, [formsList]);

  const all = data?.responses ?? [];
  const rows = all
    .filter((r) => (status === "all" ? true : r.status === status))
    .filter((r) => (pickedForm === "all" || formId ? true : r.formId === pickedForm));
  const current = all.find((r) => r._id === open) ?? null;

  // Opening a response marks it read, in the inbox and in the bell alike.
  useEffect(() => {
    if (current && current.status === "new") {
      void setStatus({ ids: [current._id], status: "read" });
    }
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
    const sheet = await convex.query(api.responses.forExport, {
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
    const text = [sheet.columns, ...sheet.rows].map((r) => r.map(cell).join(sep)).join("\r\n");
    // Excel reads a tab-separated file as a spreadsheet without a converter.
    const blob = new Blob([kind === "csv" ? "﻿" + text : text], {
      type: kind === "csv" ? "text/csv;charset=utf-8" : "text/tab-separated-values;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.filename}.${kind === "csv" ? "csv" : "xls"}`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`${sheet.rows.length} ${sheet.rows.length === 1 ? "response" : "responses"} exported`);
  }

  const stats = data?.stats;

  return (
    <>
      <div className="fk-grid" data-cols="stats-sm">
        <StatCard
          icon={<Inbox size={16} strokeWidth={1.9} aria-hidden />}
          label="Total responses"
          value={(stats?.total ?? 0).toLocaleString()}
        />
        <StatCard
          icon={<Sunrise size={16} strokeWidth={1.9} aria-hidden />}
          label="Today"
          value={(stats?.today ?? 0).toLocaleString()}
        />
        <StatCard
          icon={<CalendarDays size={16} strokeWidth={1.9} aria-hidden />}
          label="This week"
          value={(stats?.week ?? 0).toLocaleString()}
          tone="sky"
        />
        <StatCard
          icon={<MailOpen size={16} strokeWidth={1.9} aria-hidden />}
          label="Unread"
          value={(stats?.unread ?? 0).toLocaleString()}
          tone="ink"
        />
      </div>

      <div className="fk-toolbar-panel">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search responses"
          aria-label="Search responses"
          icon={<Search size={17} strokeWidth={1.8} aria-hidden />}
          wrapStyle={{ width: 260 }}
        />

        {!formId && (
          <Select
            value={pickedForm}
            onChange={setPickedForm}
            ariaLabel="Which form"
            options={[
              { value: "all", label: "All forms" },
              ...(formsList?.forms ?? []).map((f) => ({ value: f._id, label: f.title })),
            ]}
          />
        )}

        <Select
          value={status}
          onChange={(next) => setStatusFilter(next as typeof status)}
          ariaLabel="Which status"
          options={[
            { value: "all", label: "Status: all" },
            { value: "new", label: "New" },
            { value: "read", label: "Read" },
            { value: "reviewed", label: "Reviewed" },
          ]}
        />

        <Select
          value={completeness}
          onChange={(next) => setCompleteness(next as typeof completeness)}
          ariaLabel="Complete or partial"
          options={[
            { value: "all", label: "All submissions" },
            { value: "complete", label: "Complete only" },
            { value: "partial", label: "Partial only" },
          ]}
        />

        <span className="fk-range-note">
          <SlidersHorizontal size={14} strokeWidth={1.8} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} />
          {rows.length} of {all.length} responses
        </span>

        <span className="fk-section-spacer" />

        {formId && (
          <>
            <Button
              variant="secondary"
              onClick={() => download("excel")}
              iconLeft={<FileDown size={16} strokeWidth={1.8} aria-hidden />}
            >
              Export Excel
            </Button>
            <Button
              variant="secondary"
              onClick={() => download("csv")}
              iconLeft={<FileDown size={16} strokeWidth={1.8} aria-hidden />}
            >
              Export CSV
            </Button>
          </>
        )}
      </div>

      {picked.size > 0 && (
        <div className="fk-bulkbar">
          <span>{picked.size} selected</span>
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
            iconLeft={<Trash2 size={15} strokeWidth={1.8} aria-hidden />}
            onClick={async () => {
              const n = picked.size;
              await remove({ ids: Array.from(picked) as Id<"responses">[] });
              setPicked(new Set());
              setOpen(null);
              toast(`${n} ${n === 1 ? "response" : "responses"} deleted`);
            }}
          >
            Delete
          </Button>
          <span className="fk-section-spacer" />
          <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <section className="fk-panel" data-pad="none">
        {rows.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState
              title={term ? `Nothing matches “${term}”` : "Nothing in yet"}
              description={
                term ? "Try a shorter search." : "Answers land here the moment someone submits."
              }
            />
          </div>
        ) : (
          <div className="fk-table-wrap">
            <table className="fk-table">
              <thead>
                <tr>
                  <th scope="col" className="fk-table-pick">
                    <span className="fk-visually-hidden">Select</span>
                  </th>
                  <th scope="col">Respondent</th>
                  <th scope="col">Email</th>
                  {!formId && <th scope="col">Form</th>}
                  <th scope="col">Answers</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r._id}
                    onClick={() => setOpen(r._id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpen(r._id);
                      }
                    }}
                    data-unread={r.status === "new" ? "true" : undefined}
                  >
                    <td className="fk-table-pick" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        label={`Select the response from ${r.respondentName ?? r.respondentEmail ?? "someone"}`}
                        hideLabel
                        checked={picked.has(r._id)}
                        onChange={() => toggle(r._id)}
                      />
                    </td>
                    <td className="fk-table-name">
                      {r.respondentName ?? r.respondentEmail ?? "Someone"}
                    </td>
                    <td className="fk-table-quiet">{r.respondentEmail ?? "—"}</td>
                    {!formId && <td>{titles.get(r.formId) ?? "A form"}</td>}
                    <td className="fk-table-quiet">
                      {r.partial ? `${r.answeredCount} of ${r.totalCount}` : `${r.answeredCount}`}
                      {r.files.length > 0 && (
                        <Paperclip
                          size={13}
                          strokeWidth={1.8}
                          aria-label={`${r.files.length} attached`}
                          style={{ marginLeft: 6, verticalAlign: -2 }}
                        />
                      )}
                    </td>
                    <td className="fk-table-quiet">{relativeTime(r.submittedAt)}</td>
                    <td>
                      {r.partial ? (
                        <Badge tone="warning">Partial</Badge>
                      ) : r.status === "new" ? (
                        <Badge tone="info">New</Badge>
                      ) : r.status === "reviewed" ? (
                        <Badge tone="success">Reviewed</Badge>
                      ) : (
                        <Badge tone="neutral">Read</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
              aria-label="Where to send the export"
              placeholder="Leave blank to send it to yourself"
              wrapStyle={{ flex: 1, minWidth: 220 }}
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
                else toast("That export did not go out", { detail: result.detail, tone: "error" });
              }}
            >
              Email it
            </Button>
          </div>
        </section>
      )}

      {current && (
        <Drawer
          title={current.respondentName ?? current.respondentEmail ?? "Someone"}
          onClose={() => setOpen(null)}
        >
          {/* Keyed by the response, so its note field starts from that
              response's note rather than being reset by an effect. */}
          <ResponseDetail key={current._id} response={current} onDeleted={() => setOpen(null)} />
        </Drawer>
      )}
    </>
  );
}

/** One response, open. Its own component so the note starts from that response. */
function ResponseDetail({
  response,
  onDeleted,
}: {
  response: {
    _id: Id<"responses">;
    respondentName: string | null;
    respondentEmail: string | null;
    submittedAt: number;
    device: string | null;
    source: string | null;
    partial: boolean;
    answeredCount: number;
    totalCount: number;
    resumeToken: string | null;
    note: string | null;
    answers: { question: string; value: string | null; fileName: string | null }[];
    files: { name: string; url: string | null }[];
  };
  onDeleted: () => void;
}) {
  const toast = useToast();
  const setStatus = useMutation(api.responses.setStatus);
  const addNote = useMutation(api.responses.addNote);
  const remove = useMutation(api.responses.remove);
  const [note, setNote] = useState(response.note ?? "");

  return (
    <>
      <p className="fk-panel-lede" style={{ marginTop: 0, marginBottom: 14 }}>
        {fullTime(response.submittedAt)}
        {response.device ? ` · ${response.device}` : ""}
        {response.source ? ` · ${response.source}` : ""}
      </p>

      {response.partial && response.resumeToken && (
        <div className="fk-note" style={{ marginBottom: 14, display: "block" }}>
          <p style={{ margin: "0 0 10px" }}>
            They stopped after {response.answeredCount} of {response.totalCount} questions. This
            link puts them back where they left off.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(
                `${window.location.origin}/r/${response.resumeToken}`,
              );
              toast("Resume link copied");
            }}
          >
            Copy the resume link
          </Button>
        </div>
      )}

      <div>
        {response.answers.map((a, i) => (
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

      {response.files.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {response.files.map(
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
          onBlur={() => addNote({ responseId: response._id, note })}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setStatus({ ids: [response._id], status: "reviewed" })}
        >
          Mark as reviewed
        </Button>
        {response.respondentEmail && (
          <a href={`mailto:${response.respondentEmail}`}>
            <Button variant="ghost" size="sm" iconLeft={<Mail size={15} strokeWidth={1.8} aria-hidden />}>
              Reply
            </Button>
          </a>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await remove({ ids: [response._id] });
            onDeleted();
            toast("Response deleted");
          }}
        >
          Delete
        </Button>
      </div>
    </>
  );
}
