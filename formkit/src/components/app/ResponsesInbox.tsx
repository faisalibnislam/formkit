"use client";

import { AiReplyPanel } from "./AiReplyPanel";
import { QuizMarks } from "./QuizMarks";
import { useSeededQuery } from "@/lib/seed";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFirstLoad, useLastDefined } from "./useFirstLoad";
import { INBOX_PAGE } from "@/lib/inbox";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  Clock,
  Building2,
  FileDown,
  FileSpreadsheet,
  FileText,
  Hourglass,
  Inbox,
  Link2,
  Mail,
  MailOpen,
  Monitor,
  Paperclip,
  Plus,
  Printer,
  Search,
  Sunrise,
  Tag,
  Timer,
  Trash2,
  Users,
  X,
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
  Modal,
  PillTabs,
  Segmented,
  Select,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { initials, StatCard } from "./ds";
import { fullTime, relativeTime } from "./bits";
import { useExporter } from "./exporting";
import { useFlag } from "./useFlags";
import { downloadResponsePdf, printResponse, type ResponseDoc } from "./responseDoc";
import { useNarrow } from "./useNarrow";
import { PageSkeleton } from "./Skeleton";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { useGate } from "@/components/plan/usePlan";
import { formOptions, ownerOptions, ownersFrom, OwnerLine, type Owner } from "./owners";

/**
 * The response inbox, for one form or for everything, and - across every
 * form - the people behind the answers.
 *
 * A partial response is a real record: it keeps what was answered before the
 * person left, is counted on its own rather than folded into Completed, and
 * carries a link that puts them back where they stopped. A response sent from
 * the builder's preview is kept under Previews and counted nowhere.
 *
 * The list is one table across the full width - cards on a phone - and a
 * response opens in a drawer over it.
 */

type Data = FunctionReturnType<typeof api.responses.rows>;
type Row = Data["rows"][number];
type Kind = "all" | "complete" | "partial" | "preview";

/** Rows the list shows at first, and adds with each "Load more". */
const PAGE = INBOX_PAGE;
/** A search waits for a pause in typing before it asks the server. */
const SEARCH_DELAY_MS = 250;

/** `value`, once it has stopped changing for `ms`. */
function useDebounced<T>(value: T, ms: number) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return settled;
}

export function ResponsesInbox({ formId, openId }: { formId?: Id<"forms">; openId?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = useState("");
  // Contacts only exist on the all-forms inbox, as the design has it.
  const sub = !formId && params.get("tab") === "contacts" ? "contacts" : "responses";

  function setSub(next: "responses" | "contacts") {
    const q = new URLSearchParams(params.toString());
    if (next === "contacts") q.set("tab", "contacts");
    else q.delete("tab");
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  return (
    <>
      {!formId && (
        <PillTabs
          ariaLabel="Responses or contacts"
          value={sub}
          onChange={setSub}
          tabs={[
            { value: "responses", label: "Responses", icon: <Inbox size={16} strokeWidth={1.8} aria-hidden /> },
            { value: "contacts", label: "Contacts", icon: <Users size={16} strokeWidth={1.8} aria-hidden /> },
          ]}
        />
      )}
      {sub === "contacts" ? (
        <Contacts
          onOpenPerson={(who) => {
            setTerm(who);
            setSub("responses");
          }}
        />
      ) : (
        <Responses formId={formId} openId={openId ?? params.get("open")} term={term} setTerm={setTerm} />
      )}
    </>
  );
}

function statusBadge(r: Pick<Row, "partial" | "preview" | "status">) {
  if (r.preview) return <Badge tone="draft">Preview</Badge>;
  if (r.partial) return <Badge tone="warning">Partial</Badge>;
  if (r.status === "new") return <Badge tone="info">New</Badge>;
  if (r.status === "reviewed") return <Badge tone="success">Reviewed</Badge>;
  return <Badge tone="neutral">Read</Badge>;
}

/** 2500, "usd" → "$25.00". Stripe counts most currencies in cents. */
function payText(p: { amount: number; currency: string }) {
  const major = ["jpy", "krw", "vnd", "clp"].includes(p.currency) ? p.amount : p.amount / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency.toUpperCase() }).format(major);
  } catch {
    return `${major.toFixed(2)} ${p.currency.toUpperCase()}`;
  }
}

const PAY_LABEL = { paid: "Paid", pending: "Awaiting payment", failed: "Not paid", none: "" } as const;

function badgeFor(r: Pick<Row, "partial" | "preview" | "status" | "payment">) {
  const main = statusBadge(r);
  if (!r.payment || r.payment.status === "none") return main;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
      <span className="fk-paychip" data-status={r.payment.status} title={`${PAY_LABEL[r.payment.status]} · ${payText(r.payment)}`}>
        {r.payment.status === "paid" ? payText(r.payment) : PAY_LABEL[r.payment.status]}
      </span>
      {main}
    </span>
  );
}

const who = (r: Pick<Row, "respondentName" | "respondentEmail">) =>
  r.respondentName ?? r.respondentEmail ?? "Someone";

function Responses({
  formId,
  openId,
  term,
  setTerm,
}: {
  formId?: Id<"forms">;
  openId: string | null;
  term: string;
  setTerm: (v: string) => void;
}) {
  const toast = useToast();
  const narrow = useNarrow();
  const exportRows = useExporter();
  const excel = useFlag("exports.xlsx");
  const excelGate = useGate("exports.xlsx");
  const [chosenKind, setKind] = useState<Kind>("all");
  const [pickedForm, setPickedForm] = useState<string>("all");
  const [pickedOwner, setPickedOwner] = useState<string>("all");
  const [limit, setLimit] = useState(PAGE);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(openId);
  const [asc, setAsc] = useState(false);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const search = useDebounced(term.trim(), SEARCH_DELAY_MS);

  // The company's forms and owners, for the pickers, with the whole inbox's figures.
  const base = useSeededQuery(api.responses.summary, formId ? { formId } : {});
  const forms = base?.forms;
  // Whose forms: the person's own, or one company's. Only offered when there
  // is more than one owner to choose between.
  const owners = useMemo(() => ownersFrom(forms), [forms]);
  const ownerOf = useMemo(() => new Map<string, Owner>((forms ?? []).map((f) => [f._id, f.owner])), [forms]);
  const multi = !formId && owners.length > 1;
  const owner = multi && owners.some((o) => o.key === pickedOwner) ? pickedOwner : "all";

  // Narrowed to one form or one owner's forms, the server counts just those.
  const narrowTo = useMemo(() => {
    if (formId) return undefined;
    if (pickedForm !== "all") return [pickedForm as Id<"forms">];
    if (owner !== "all") return (forms ?? []).filter((f) => f.owner.key === owner).map((f) => f._id);
    return undefined;
  }, [formId, pickedForm, owner, forms]);
  const narrowed = narrowTo !== undefined;
  const scope = formId ? { formId } : narrowTo ? { forms: narrowTo } : {};
  const narrowSummary = useLastDefined(useQuery(api.responses.summary, narrowed ? scope : "skip"));
  const s = narrowed ? narrowSummary?.stats : base?.stats;

  const previews = s?.previews ?? 0;
  // Previews with nothing left in them fall back to everything.
  const kind: Kind = chosenKind === "preview" && previews === 0 ? "all" : chosenKind;
  const listArgs = {
    ...scope,
    kind,
    order: asc ? ("asc" as const) : ("desc" as const),
    limit,
    ...(search ? { search } : {}),
  };
  // A new filter keeps the last rows on screen until its own arrive.
  const data = useLastDefined(useSeededQuery(api.responses.rows, listArgs));
  const loaded = useFirstLoad(base && data);
  const setStatus = useMutation(api.responses.setStatus);
  const remove = useMutation(api.responses.remove);
  const readFor = useMutation(api.inbox.readFor);

  // Looking at the responses counts as reading their notices.
  const readForRef = useRef(readFor);
  useEffect(() => {
    readForRef.current = readFor;
  });
  useEffect(() => {
    void readForRef.current({ formId, kinds: ["response"] }).catch(() => {});
  }, [formId]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const more = data?.more ?? false;
  const shownIds = new Set(rows.map((r) => r._id as string));
  const selected = [...picked].filter((id) => shownIds.has(id)) as Id<"responses">[];
  // A response opened from a link may not be among the rows loaded yet.
  const inList = rows.find((r) => r._id === open) ?? null;
  const fetched = useQuery(api.responses.get, open && !inList ? { responseId: open as Id<"responses"> } : "skip");
  const current = inList ?? fetched ?? null;
  const allPicked = rows.length > 0 && selected.length === rows.length;

  /** Any change of filter starts the list again from its first page. */
  function refilter() {
    setLimit(PAGE);
    setPicked(new Set());
  }

  // Opening a response marks it read, in the inbox and in the bell alike.
  useEffect(() => {
    if (current && current.status === "new" && !current.preview) {
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

  // A whole form, or the whole inbox, exports on the server; a search, a kind
  // or one owner's forms exports the rows shown.
  const exportForm = formId ?? (pickedForm !== "all" ? (pickedForm as Id<"forms">) : undefined);
  const byRows = !!search || kind !== "all" || (narrowed && pickedForm === "all");
  function exportHere(format: "csv" | "xlsx") {
    if (rows.length === 0) {
      toast("Nothing to export", { detail: "No responses match what is shown." });
      return;
    }
    void exportRows({
      what: "responses",
      format,
      formId: exportForm,
      ids: byRows ? rows.map((r) => r._id) : undefined,
    });
  }

  if (!loaded) return <PageSkeleton kind="table" />;

  const total = s?.total ?? 0;
  const plus = (n: number, more: boolean | undefined) => `${n.toLocaleString("en-US")}${more ? "+" : ""}`;
  const signed = (n: number | null | undefined, suffix = "") =>
    n === null || n === undefined || n === 0 ? undefined : `${n > 0 ? "+" : "−"}${Math.abs(n)}${suffix}`;

  return (
    <>
      <div className="fk-grid" data-cols="stats-sm">
        <StatCard
          icon={<Inbox size={16} strokeWidth={1.9} aria-hidden />}
          label="Completed"
          value={(s?.completed ?? 0).toLocaleString("en-US")}
        />
        <StatCard
          icon={<Hourglass size={16} strokeWidth={1.9} aria-hidden />}
          label="Partial"
          value={(s?.partial ?? 0).toLocaleString("en-US")}
        />
        <StatCard
          icon={<Sunrise size={16} strokeWidth={1.9} aria-hidden />}
          label="Today"
          value={(s?.today ?? 0).toLocaleString("en-US")}
          delta={signed(s?.todayChange)}
          deltaTone={(s?.todayChange ?? 0) >= 0 ? "up" : "down"}
        />
        <StatCard
          icon={<CalendarDays size={16} strokeWidth={1.9} aria-hidden />}
          label="This week"
          value={plus(s?.week ?? 0, s?.more.week)}
          delta={signed(s?.weekChange, "%")}
          deltaTone={(s?.weekChange ?? 0) >= 0 ? "up" : "down"}
          tone="sky"
        />
        <StatCard
          icon={<MailOpen size={16} strokeWidth={1.9} aria-hidden />}
          label="Unread"
          value={plus(s?.unread ?? 0, s?.more.unread)}
          tone="ink"
        />
      </div>

      <div className="fk-resp-toolbar">
        <Input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            refilter();
          }}
          placeholder="Search responses"
          aria-label="Search responses"
          icon={<Search size={17} strokeWidth={1.8} aria-hidden />}
          wrapStyle={{ width: 260, maxWidth: "100%" }}
        />
        {multi && (
          <Select
            size="sm"
            value={owner}
            onChange={(next) => {
              setPickedOwner(next);
              // A form from another owner no longer belongs in the picker.
              if (next !== "all" && pickedForm !== "all" && ownerOf.get(pickedForm)?.key !== next) setPickedForm("all");
              refilter();
            }}
            ariaLabel="Whose forms"
            options={ownerOptions(owners, forms)}
          />
        )}
        {!formId && (
          <Select
            size="sm"
            value={pickedForm}
            onChange={(next) => {
              setPickedForm(next);
              refilter();
            }}
            ariaLabel="Which form"
            options={formOptions(forms, owner, owners)}
          />
        )}
        <Segmented
          size="sm"
          ariaLabel="Filter responses"
          value={kind}
          onChange={(v) => {
            setKind(v);
            refilter();
          }}
          options={[
            { value: "all", label: "All" },
            { value: "complete", label: "Complete" },
            { value: "partial", label: "Partial" },
            ...(previews ? [{ value: "preview" as const, label: `Previews · ${plus(previews, s?.more.previews)}` }] : []),
          ]}
        />
        <span className="fk-section-spacer" />
        <span className="fk-range-note">
          {plus(rows.length, more)} of {total.toLocaleString("en-US")} responses
        </span>
        {excel && (
          <Button
            variant="secondary"
            onClick={excelGate.guard(() => exportHere("xlsx"))}
            iconLeft={<FileSpreadsheet size={16} strokeWidth={1.8} aria-hidden />}
          >
            Export Excel
            {excelGate.locked && <ProChip />}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => exportHere("csv")}
          iconLeft={<FileText size={16} strokeWidth={1.8} aria-hidden />}
        >
          Export CSV
        </Button>
      </div>

      {total === 0 && kind !== "preview" ? (
        <section className="fk-panel">
          <EmptyState
            title="No responses yet."
            description={
              previews
                ? "Once people start filling out your form, their answers land here, newest first. What you sent from the preview is under Previews."
                : "Once people start filling out your form, their answers land here, newest first."
            }
          />
        </section>
      ) : (
        <>
          {selected.length > 0 && (
            <div className="fk-bulkbar" role="region" aria-label="Selected responses">
              <span style={{ fontWeight: 450 }}>
                {selected.length} {selected.length === 1 ? "response" : "responses"} selected
              </span>
              <span className="fk-section-spacer" />
              <button
                type="button"
                className="fk-bulk-btn"
                onClick={async () => {
                  await setStatus({ ids: selected, status: "read" });
                  toast("Marked as read", {
                    detail: `${selected.length} ${selected.length === 1 ? "response" : "responses"}`,
                  });
                  setPicked(new Set());
                }}
              >
                Mark as read
              </button>
              <button
                type="button"
                className="fk-bulk-btn"
                onClick={() =>
                  void exportRows({
                    what: "responses",
                    format: "csv",
                    formId: formId ?? (pickedForm !== "all" ? (pickedForm as Id<"forms">) : undefined),
                    ids: selected,
                  })
                }
              >
                Export selection
              </button>
              <button type="button" className="fk-bulk-btn" data-tone="danger" onClick={() => setConfirm(selected)}>
                Delete
              </button>
              <button type="button" className="fk-bulk-btn" data-tone="quiet" onClick={() => setPicked(new Set())}>
                Clear
              </button>
            </div>
          )}

          {rows.length === 0 ? (
            <section className="fk-panel">
              <EmptyState
                title={search ? `Nothing matches “${search}”` : "Nothing here"}
                description={search ? "Try a shorter search, or another filter." : "Try another filter."}
              />
            </section>
          ) : narrow ? (
            <div className="fk-resp-cards">
              {rows.map((r) => (
                <button key={r._id} type="button" className="fk-resp-card" onClick={() => setOpen(r._id)}>
                  <span className="fk-resp-card-head">
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="fk-resp-card-name" data-unread={r.status === "new" ? "true" : undefined}>
                        {who(r)}
                      </span>
                      <span className="fk-resp-card-mail">{r.respondentEmail ?? "No email given"}</span>
                    </span>
                    {badgeFor(r)}
                  </span>
                  <span className="fk-resp-card-foot">
                    <span>
                      {r.formTitle}
                      {multi && owner === "all" && ownerOf.get(r.formId) && <> · {ownerOf.get(r.formId)!.name}</>}
                    </span>
                    {r.partial && (
                      <span>
                        {r.answeredCount} of {r.totalCount} answered
                      </span>
                    )}
                    <span style={{ marginLeft: "auto" }}>{relativeTime(r.submittedAt)}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <section className="fk-panel" data-pad="none">
              <div className="fk-table-wrap">
                <table className="fk-table">
                  <thead>
                    <tr>
                      <th scope="col" className="fk-table-pick">
                        <Checkbox
                          label={allPicked ? "Clear the selection" : "Select every response shown"}
                          hideLabel
                          checked={allPicked}
                          onChange={() =>
                            setPicked(allPicked ? new Set() : new Set(rows.map((r) => r._id as string)))
                          }
                        />
                      </th>
                      <th scope="col">Respondent</th>
                      <th scope="col">Email</th>
                      {!formId && <th scope="col">Form</th>}
                      <th scope="col">Answers</th>
                      <th scope="col" aria-sort={asc ? "ascending" : "descending"}>
                        <button
                          type="button"
                          className="fk-th-sort"
                          onClick={() => {
                            setAsc((v) => !v);
                            refilter();
                          }}
                        >
                          Submitted
                          {asc ? (
                            <ArrowUp size={13} strokeWidth={2} aria-hidden />
                          ) : (
                            <ArrowDown size={13} strokeWidth={2} aria-hidden />
                          )}
                        </button>
                      </th>
                      <th scope="col" style={{ textAlign: "right" }}>
                        Status
                      </th>
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
                        data-unread={r.status === "new" && !r.partial ? "true" : undefined}
                        data-picked={picked.has(r._id) ? "true" : undefined}
                      >
                        <td className="fk-table-pick" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            label={`Select the response from ${who(r)}`}
                            hideLabel
                            checked={picked.has(r._id)}
                            onChange={() => toggle(r._id)}
                          />
                        </td>
                        <td className="fk-table-name">{who(r)}</td>
                        <td className="fk-table-quiet">{r.respondentEmail ?? "-"}</td>
                        {!formId && (
                          <td>
                            <span style={{ display: "block" }}>{r.formTitle}</span>
                            {multi && owner === "all" && ownerOf.get(r.formId) && (
                              <OwnerLine owner={ownerOf.get(r.formId)!} />
                            )}
                          </td>
                        )}
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
                          {r.tags.length > 0 && (
                            <span className="fk-resp-tagcount" title={r.tags.join(", ")}>
                              <Tag size={12} strokeWidth={1.8} aria-hidden />
                              {r.tags.length}
                            </span>
                          )}
                        </td>
                        <td className="fk-table-quiet" title={fullTime(r.submittedAt)}>
                          {relativeTime(r.submittedAt)}
                        </td>
                        <td style={{ textAlign: "right" }}>{badgeFor(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {more && rows.length > 0 && (
            <div className="fk-resp-more">
              <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE)}>
                Load {PAGE} more
              </Button>
            </div>
          )}
        </>
      )}

      {current && (
        <ResponseDrawer
          key={current._id}
          response={current}
          onClose={() => setOpen(null)}
          onDelete={() => setConfirm([current._id])}
        />
      )}

      {confirm && (
        <Modal
          title={
            confirm.length === 1 ? "Delete this response?" : `Delete ${confirm.length} responses?`
          }
          description="The answers, any files attached and your notes go for good. Counts and analytics update straight away."
          onClose={() => setConfirm(null)}
          width={460}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                Keep {confirm.length === 1 ? "it" : "them"}
              </Button>
              <Button
                variant="destructive"
                iconLeft={<Trash2 size={16} strokeWidth={1.8} aria-hidden />}
                onClick={async () => {
                  const ids = confirm as Id<"responses">[];
                  setConfirm(null);
                  await remove({ ids });
                  setPicked(new Set());
                  if (open && ids.includes(open as Id<"responses">)) setOpen(null);
                  toast("Deleted", {
                    detail: `${ids.length} ${ids.length === 1 ? "response" : "responses"} removed`,
                  });
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          {null}
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* One response                                                        */
/* ------------------------------------------------------------------ */

function duration(ms: number | null) {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

function ResponseDrawer({
  response,
  onClose,
  onDelete,
}: {
  response: Row;
  onClose: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const exportRows = useExporter();
  const form = useQuery(api.forms.get, { formId: response.formId });
  const setStatus = useMutation(api.responses.setStatus);
  const addNote = useMutation(api.responses.addNote);
  const [note, setNote] = useState(response.note ?? "");

  // Answers grouped by the page they sit on, in the form's own order. A
  // question since removed from the form still shows, at the end.
  const groups = useMemo(() => {
    const byBlock = new Map(response.answers.map((a) => [a.blockId as string, a]));
    const answerOf = (a: Row["answers"][number] | undefined) =>
      a ? (a.fileName ?? (a.value || "-")) : "-";
    // Voice recordings play in place, under their question.
    const sound = new Map(response.files.filter((f) => f.audio && f.url).map((f) => [f.blockId as string, f.url!]));
    const out: { title: string; rows: { q: string; a: string; empty: boolean; file: boolean; audio?: string }[] }[] = [];
    let g: (typeof out)[number] = { title: "Answers", rows: [] };
    const used = new Set<string>();
    for (const b of form?.blocks ?? []) {
      if (b.kind === "pagebreak") {
        if (g.rows.length) out.push(g);
        g = { title: b.pageName || "Next page", rows: [] };
        continue;
      }
      const a = byBlock.get(b._id);
      used.add(b._id);
      g.rows.push({
        q: b.title ?? a?.question ?? "Question",
        a: answerOf(a),
        empty: !a || (!a.value && !a.fileName),
        file: !!a?.fileName,
        audio: sound.get(b._id),
      });
    }
    if (g.rows.length) out.push(g);
    const gone = response.answers.filter((a) => !used.has(a.blockId));
    if (gone.length) {
      out.push({
        title: form ? "No longer on the form" : "Answers",
        rows: gone.map((a) => ({ q: a.question, a: answerOf(a), empty: !a.value && !a.fileName, file: !!a.fileName })),
      });
    }
    // Pro: the form's calculations, as worked out when it was sent.
    const calc = Object.entries(response.calc ?? {});
    if (calc.length) {
      out.push({
        title: "Calculations",
        rows: calc.map(([k, v]) => ({ q: k, a: v.toLocaleString("en-US"), empty: false, file: false })),
      });
    }
    const ending = response.ending ? form?.endings?.find((e) => e.id === response.ending) : undefined;
    if (ending) {
      out.push({ title: "Ending", rows: [{ q: "They finished on", a: ending.name, empty: false, file: false }] });
    }
    if (response.payment && response.payment.status !== "none") {
      out.push({
        title: "Payment",
        rows: [
          { q: "Amount", a: payText(response.payment), empty: false, file: false },
          { q: "Status", a: PAY_LABEL[response.payment.status], empty: false, file: false },
          ...(response.payment.at
            ? [{ q: "Paid", a: fullTime(response.payment.at), empty: false, file: false }]
            : []),
        ],
      });
    }
    return out;
  }, [form, response.answers, response.calc, response.payment, response.ending, response.files]);

  const name = who(response);
  const meta = [
    {
      icon: <CalendarDays size={14} strokeWidth={1.8} aria-hidden />,
      text: new Date(response.submittedAt).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    },
    {
      icon: <Clock size={14} strokeWidth={1.8} aria-hidden />,
      text: new Date(response.submittedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    },
    response.respondentCompany && {
      icon: <Building2 size={14} strokeWidth={1.8} aria-hidden />,
      text: response.respondentCompany,
    },
    {
      icon: <FileText size={14} strokeWidth={1.8} aria-hidden />,
      text: form?.identity ? `${response.formTitle} · ${form.identity.name}` : response.formTitle,
    },
    response.source && { icon: <Link2 size={14} strokeWidth={1.8} aria-hidden />, text: response.source },
    response.device && { icon: <Monitor size={14} strokeWidth={1.8} aria-hidden />, text: response.device },
    duration(response.durationMs) && {
      icon: <Timer size={14} strokeWidth={1.8} aria-hidden />,
      text: `Took ${duration(response.durationMs)}`,
    },
  ].filter(Boolean) as { icon: React.ReactNode; text: string }[];

  const stopped = relativeTime(response.submittedAt);
  const partialNote = response.partial
    ? `They answered ${response.answeredCount} of ${response.totalCount} questions and stopped ${
        stopped === "just now" ? "just now" : stopped.endsWith("ago") ? stopped : `on ${stopped}`
      }.`
    : null;

  function paper(): ResponseDoc {
    return {
      formTitle: response.formTitle,
      name,
      email: response.respondentEmail,
      submitted: fullTime(response.submittedAt),
      meta: [response.respondentPhone, response.respondentCompany, response.source, response.device].filter(
        Boolean,
      ) as string[],
      tags: response.tags,
      partialNote,
      groups: groups.map((g) => ({
        title: g.title,
        rows: g.rows.map((r) => ({ q: r.q, a: r.empty ? "Not answered" : r.file ? `Attached: ${r.a}` : r.a })),
      })),
      note: note.trim() || null,
    };
  }

  return (
    <Drawer
      title="Response"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="secondary"
            iconLeft={<FileDown size={16} strokeWidth={1.8} aria-hidden />}
            onClick={() =>
              void exportRows({ what: "responses", format: "csv", formId: response.formId, ids: [response._id] })
            }
          >
            Export
          </Button>
          <span className="fk-section-spacer" />
          {response.status === "reviewed" ? (
            <Button variant="secondary" onClick={() => setStatus({ ids: [response._id], status: "read" })}>
              Undo reviewed
            </Button>
          ) : (
            <Button
              iconLeft={<Check size={16} strokeWidth={1.8} aria-hidden />}
              onClick={async () => {
                await setStatus({ ids: [response._id], status: "reviewed" });
                toast("Marked as reviewed", { detail: name });
                onClose();
              }}
            >
              Mark as reviewed
            </Button>
          )}
        </>
      }
    >
      <div className="fk-resp-who">
        <span className="fk-resp-avatar" aria-hidden>
          {initials(name)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="fk-resp-who-name">{name}</span>
          <span className="fk-resp-who-mail">
            {[response.respondentEmail, response.respondentPhone].filter(Boolean).join(" · ") || "No email given"}
          </span>
        </span>
        {badgeFor(response)}
      </div>

      <div className="fk-resp-meta">
        {meta.map((m, i) => (
          <span key={i} className="fk-resp-chip">
            {m.icon}
            {m.text}
          </span>
        ))}
      </div>

      {response.partial && (
        <div className="fk-resp-partial">
          <span style={{ flex: 1, minWidth: 200 }}>
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 500 }}>Started, never sent</span>
            <span className="fk-resp-partial-note">{partialNote}</span>
          </span>
          {response.resumeToken && (
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Link2 size={15} strokeWidth={1.8} aria-hidden />}
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}/r/${response.resumeToken}`);
                toast("Resume link copied", { detail: "It opens their answers where they stopped" });
              }}
            >
              Copy resume link
            </Button>
          )}
        </div>
      )}

      <TagEditor responseId={response._id} tags={response.tags} />

      <QuizMarks
        responseId={response._id}
        quiz={response.quiz}
        titles={new Map((form?.blocks ?? []).map((b) => [b._id as string, b.title ?? "Question"]))}
      />

      <AiReplyPanel
        responseId={response._id}
        reply={response.aiReply}
        insight={response.insight}
        hasEmail={!!response.respondentEmail}
      />

      <div className="fk-resp-groups">
        {groups.map((g, i) => (
          <div key={i}>
            <div className="fk-resp-group-title">{g.title}</div>
            {g.rows.map((r, j) => (
              <div key={j} className="fk-answer">
                <div className="fk-answer-q">{r.q}</div>
                <div className="fk-answer-a">
                  {r.empty ? (
                    <span style={{ color: "var(--color-text-tertiary)" }}>Not answered</span>
                  ) : r.audio ? (
                    <audio controls preload="none" src={r.audio} style={{ width: "100%", maxWidth: 360, height: 36 }} aria-label={`Recording for ${r.q}`} />
                  ) : r.file ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <Paperclip size={15} strokeWidth={1.8} aria-hidden />
                      {r.a}
                    </span>
                  ) : (
                    r.a
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {response.files.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {response.files.map(
            (f, i) =>
              f.url && (
                <a key={i} href={f.url} download={f.name} className="fk-chip" style={{ width: "fit-content" }}>
                  <FileDown size={14} strokeWidth={1.8} aria-hidden />
                  {f.audio ? "Download the recording" : `Download ${f.name}`}
                </a>
              ),
          )}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Textarea
          rows={2}
          value={note}
          aria-label="A note for yourself"
          placeholder="A note for yourself. Nobody else sees this."
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== (response.note ?? "")) void addNote({ responseId: response._id, note });
          }}
        />
      </div>

      <div className="fk-resp-actions">
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<Printer size={15} strokeWidth={1.8} aria-hidden />}
          onClick={() => printResponse(paper())}
        >
          Print
        </Button>
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<FileDown size={15} strokeWidth={1.8} aria-hidden />}
          onClick={async () => {
            const file = await downloadResponsePdf(paper(), `${name} ${response.formTitle}`);
            toast("PDF downloaded", { detail: file });
          }}
        >
          Download PDF
        </Button>
        {response.respondentEmail && (
          <a href={`mailto:${response.respondentEmail}`} tabIndex={-1}>
            <Button variant="ghost" size="sm" iconLeft={<Mail size={15} strokeWidth={1.8} aria-hidden />}>
              Reply
            </Button>
          </a>
        )}
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<Trash2 size={15} strokeWidth={1.8} aria-hidden />}
          onClick={onDelete}
        >
          Delete response
        </Button>
      </div>
    </Drawer>
  );
}

function TagEditor({ responseId, tags }: { responseId: Id<"responses">; tags: string[] }) {
  const setTags = useMutation(api.responses.setTags);
  const inUse = useQuery(api.responses.tagsInUse, {});
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const offers = (inUse ?? [])
    .filter((t) => !tags.some((x) => x.toLowerCase() === t.toLowerCase()))
    .filter((t) => (draft.trim() ? t.toLowerCase().includes(draft.trim().toLowerCase()) : true))
    .slice(0, 6);

  function add(tag: string) {
    const t = tag.trim();
    if (!t) return;
    if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) void setTags({ responseId, tags: [...tags, t] });
    setDraft("");
  }

  return (
    <div className="fk-resp-tags">
      <div className="fk-resp-group-title">Tags</div>
      <div className="fk-resp-tagrow">
        {tags.map((t) => (
          <span key={t} className="fk-resp-tag">
            {t}
            <button
              type="button"
              aria-label={`Remove the tag ${t}`}
              onClick={() => void setTags({ responseId, tags: tags.filter((x) => x !== t) })}
            >
              <X size={12} strokeWidth={2} aria-hidden />
            </button>
          </span>
        ))}
        {adding ? (
          <input
            className="fk-resp-taginput"
            autoFocus
            value={draft}
            maxLength={32}
            placeholder="Name a tag"
            aria-label="New tag"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add(draft);
              } else if (e.key === "Escape") {
                e.stopPropagation();
                setDraft("");
                setAdding(false);
              }
            }}
            onBlur={() => {
              add(draft);
              window.setTimeout(() => setAdding(false), 150);
            }}
          />
        ) : (
          <button type="button" className="fk-resp-tagadd" onClick={() => setAdding(true)}>
            <Plus size={13} strokeWidth={2} aria-hidden />
            Add a tag
          </button>
        )}
      </div>
      {adding && offers.length > 0 && (
        <div className="fk-resp-tagrow" style={{ marginTop: 8 }}>
          {offers.map((t) => (
            <button
              key={t}
              type="button"
              className="fk-resp-tagoffer"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Contacts                                                            */
/* ------------------------------------------------------------------ */

function Contacts({ onOpenPerson }: { onOpenPerson: (who: string) => void }) {
  const narrow = useNarrow();
  const exportRows = useExporter();
  const excel = useFlag("exports.xlsx");
  const excelGate = useGate("exports.xlsx");
  const people = useQuery(api.responses.contacts, {});
  const [term, setTerm] = useState("");

  const needle = term.trim().toLowerCase();
  const rows = (people ?? []).filter((c) =>
    needle ? [c.name, c.email, c.phone, c.company, c.source, ...c.tags].join(" ").toLowerCase().includes(needle) : true,
  );
  const tagsOf = (c: (typeof rows)[number]) => (
    <span className="fk-resp-tagrow">
      {c.unread && <Badge tone="info">New</Badge>}
      {c.partialOnly && <Badge tone="warning">Partial</Badge>}
      {c.tags.map((t) => (
        <span key={t} className="fk-resp-tag" data-static="true">
          {t}
        </span>
      ))}
      {!c.unread && !c.partialOnly && c.tags.length === 0 && (
        <span style={{ color: "var(--color-text-tertiary)" }}>-</span>
      )}
    </span>
  );
  const created = (at: number) =>
    new Date(at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <div className="fk-resp-toolbar">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search contacts"
          aria-label="Search contacts"
          icon={<Search size={17} strokeWidth={1.8} aria-hidden />}
          wrapStyle={{ width: 260, maxWidth: "100%" }}
        />
        <span className="fk-range-note">
          {(people?.length ?? 0).toLocaleString("en-US")}{" "}
          {people?.length === 1 ? "contact" : "contacts"}, collected from your forms
        </span>
        <span className="fk-section-spacer" />
        {excel && (
          <Button
            variant="secondary"
            onClick={excelGate.guard(() => void exportRows({ what: "contacts", format: "xlsx" }))}
            iconLeft={<FileSpreadsheet size={16} strokeWidth={1.8} aria-hidden />}
          >
            Export Excel
            {excelGate.locked && <ProChip />}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => void exportRows({ what: "contacts", format: "csv" })}
          iconLeft={<FileText size={16} strokeWidth={1.8} aria-hidden />}
        >
          Export CSV
        </Button>
      </div>

      {people && people.length === 0 ? (
        <section className="fk-panel">
          <EmptyState
            title="No contacts yet."
            description="Everyone who answers one of your forms with a name or an email appears here once, however many times they answer."
          />
        </section>
      ) : rows.length === 0 ? (
        <section className="fk-panel">
          <EmptyState title={`Nobody matches “${term.trim()}”`} description="Try a shorter search." />
        </section>
      ) : narrow ? (
        <div className="fk-resp-cards">
          {rows.map((c) => (
            <button
              key={c.key}
              type="button"
              className="fk-resp-card"
              onClick={() => onOpenPerson(c.email ?? c.name ?? "")}
            >
              <span style={{ display: "block", minWidth: 0 }}>
                <span className="fk-resp-card-name">{c.name ?? c.email}</span>
                <span className="fk-resp-card-mail">{c.email ?? "No email given"}</span>
              </span>
              {(c.phone || c.company) && (
                <span className="fk-resp-card-foot" style={{ boxShadow: "none", paddingTop: 0 }}>
                  {c.phone && <span>{c.phone}</span>}
                  {c.company && <span>{c.company}</span>}
                </span>
              )}
              <span className="fk-resp-card-foot">
                {tagsOf(c)}
                <span style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{created(c.created)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <section className="fk-panel" data-pad="none">
          <div className="fk-table-wrap">
            <table className="fk-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Company</th>
                  <th scope="col">Tags</th>
                  <th scope="col">Source</th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.key}
                    tabIndex={0}
                    title={`See ${c.responses === 1 ? "their response" : `their ${c.responses} responses`}`}
                    onClick={() => onOpenPerson(c.email ?? c.name ?? "")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onOpenPerson(c.email ?? c.name ?? "");
                    }}
                  >
                    <td className="fk-table-name">{c.name ?? "-"}</td>
                    <td className="fk-table-quiet">{c.email ?? "-"}</td>
                    <td className="fk-table-quiet">{c.phone ?? "-"}</td>
                    <td>{c.company ?? "-"}</td>
                    <td>{tagsOf(c)}</td>
                    <td className="fk-table-quiet">
                      {c.source}
                      {c.forms.length > 1 && ` +${c.forms.length - 1}`}
                    </td>
                    <td className="fk-table-quiet" style={{ textAlign: "right" }}>
                      {created(c.created)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
