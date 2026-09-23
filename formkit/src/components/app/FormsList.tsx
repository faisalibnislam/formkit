"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  ArchiveRestore,
  Bookmark,
  Clock,
  Copy,
  Eye,
  LayoutGrid,
  List,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Trash2,
  Unlock,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge, Button, EmptyState, IconButton, Input, Modal, Select } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ActionMenu } from "./ActionMenu";
import { CloseFormDialog } from "./dialogs/CloseFormDialog";
import { SaveTemplateDialog } from "./dialogs/SaveTemplateDialog";
import { ShareDialog } from "./dialogs/ShareDialog";
import { CreateFormDialog } from "./CreateFormDialog";
import { FormCard, FormMark } from "./ds";
import { relativeTime } from "./bits";

/**
 * The forms list, the archive, and the bin.
 *
 * Deleting is never immediate: a form sits in Deleted for sixty days with its
 * responses, and the row says how long is left. "Delete forever" is the only
 * thing here that cannot be undone, and it asks first.
 */
type Filter = "all" | "draft" | "published" | "closed" | "archived" | "deleted";
type Sort = "updated" | "responses" | "title" | "completion";
type Row = NonNullable<ReturnType<typeof useFormsList>>["forms"][number];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Published" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
  { value: "deleted", label: "Deleted" },
];

const SORTS = [
  { value: "updated", label: "Last updated" },
  { value: "responses", label: "Most responses" },
  { value: "title", label: "Name A–Z" },
  { value: "completion", label: "Completion rate" },
];

const EMPTY: Record<Filter, { title: string; description: string }> = {
  all: { title: "No forms yet", description: "Your first form is waiting to be created." },
  draft: { title: "No drafts", description: "Everything you have started is published or closed." },
  published: { title: "Nothing is collecting", description: "Publish a draft and it shows up here." },
  closed: { title: "Nothing is closed", description: "Close a form to stop answers and keep what came in." },
  archived: { title: "The archive is empty", description: "Archive a form to put it away without deleting it." },
  deleted: { title: "Nothing deleted", description: "Deleted forms wait here for 60 days before they go for good." },
};

function useFormsList(filter: Filter, term: string) {
  return useQuery(api.forms.list, { filter, search: term || undefined });
}

function markFor(status: string) {
  if (status === "published") return "var(--blue-200)";
  if (status === "draft") return "var(--yellow-200)";
  if (status === "archived") return "var(--neutral-150)";
  return "var(--mint-200)";
}

function statusBadge(status: string) {
  if (status === "published") return <Badge tone="success">Published</Badge>;
  if (status === "closed") return <Badge tone="neutral">Closed</Badge>;
  if (status === "archived") return <Badge tone="neutral">Archived</Badge>;
  return <Badge tone="draft">Draft</Badge>;
}

/** "Closes 3 Oct" on the chip; the tip says the whole of it. */
function schedule(f: Row) {
  if (f.status !== "published" || (!f.closesAt && !f.closesAfter)) return null;
  const bits: string[] = [];
  if (f.closesAt) {
    bits.push(
      `Closes ${new Date(f.closesAt).toLocaleString("en-US", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}`,
    );
  }
  if (f.closesAfter) {
    const left = Math.max(0, f.closesAfter - f.responses);
    bits.push(`${f.closesAt ? "or" : "Closes"} after ${f.closesAfter.toLocaleString()} responses — ${left.toLocaleString()} to go`);
  }
  return {
    chip: f.closesAt
      ? `Closes ${new Date(f.closesAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}`
      : `Closes at ${f.closesAfter!.toLocaleString()}`,
    tip: bits.join(", "),
  };
}

export function FormsList() {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<Sort>("updated");
  const [view, setView] = useState<"list" | "grid">("list");
  const [share, setShare] = useState<Id<"forms"> | null>(null);
  const [template, setTemplate] = useState<Row | null>(null);
  const [closing, setClosing] = useState<Row | null>(null);
  const [trash, setTrash] = useState<Row | null>(null);
  const [purgeOne, setPurgeOne] = useState<Row | null>(null);
  const [purgeAll, setPurgeAll] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const data = useFormsList(filter, term);
  const softDelete = useMutation(api.forms.softDelete);
  const restore = useMutation(api.forms.restore);
  const purge = useMutation(api.forms.purge);
  const duplicate = useMutation(api.forms.duplicate);
  const archive = useMutation(api.forms.archive);

  const counts = data?.counts;
  const inBin = filter === "deleted";

  // The query returns newest-edited first; the other orders are the same rows
  // read differently, so they do not need a round trip.
  const forms = [...(data?.forms ?? [])].sort((a, b) => {
    if (sort === "responses") return b.responses - a.responses;
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "completion") return b.completionRate - a.completionRate;
    return b.updatedAt - a.updatedAt;
  });

  async function dup(f: Row) {
    await duplicate({ formId: f._id });
    toast("Duplicated", { detail: `${f.title} (copy) is a draft` });
  }

  async function toggleArchive(f: Row) {
    const putAway = f.status !== "archived";
    await archive({ formId: f._id, archived: putAway });
    toast(putAway ? "Archived" : "Restored to drafts", { detail: f.title });
  }

  const actionsFor = (f: Row) =>
    inBin ? (
      <>
        <IconButton
          tip
          label="Restore"
          onClick={async () => {
            await restore({ formId: f._id });
            toast("Restored", { detail: `${f.title} is back in your drafts` });
          }}
        >
          <RotateCcw size={16} strokeWidth={1.8} aria-hidden />
        </IconButton>
        <IconButton tip label="Delete forever" tone="danger" onClick={() => setPurgeOne(f)}>
          <Trash2 size={16} strokeWidth={1.8} aria-hidden />
        </IconButton>
      </>
    ) : (
      <>
        <Link href={`/app/forms/${f._id}`} tabIndex={-1}>
          <IconButton tip label="Edit">
            <Pencil size={16} strokeWidth={1.8} aria-hidden />
          </IconButton>
        </Link>
        <Link href={`/app/forms/${f._id}?open=preview`} tabIndex={-1}>
          <IconButton tip label="Preview">
            <Eye size={16} strokeWidth={1.8} aria-hidden />
          </IconButton>
        </Link>
        <IconButton tip label="Share" onClick={() => setShare(f._id)}>
          <Share2 size={16} strokeWidth={1.8} aria-hidden />
        </IconButton>
        <ActionMenu
          label="More actions"
          actions={[
            { label: "Duplicate", icon: <Copy size={16} strokeWidth={1.8} aria-hidden />, onSelect: () => dup(f) },
            {
              label: "Save as template",
              icon: <Bookmark size={16} strokeWidth={1.8} aria-hidden />,
              onSelect: () => setTemplate(f),
            },
            ...(f.status === "published" || f.status === "closed"
              ? [
                  {
                    label: f.status === "closed" ? "Reopen" : "Close",
                    icon:
                      f.status === "closed" ? (
                        <Unlock size={16} strokeWidth={1.8} aria-hidden />
                      ) : (
                        <Lock size={16} strokeWidth={1.8} aria-hidden />
                      ),
                    onSelect: () => setClosing(f),
                  },
                ]
              : []),
            {
              label: f.status === "archived" ? "Restore from archive" : "Archive",
              icon:
                f.status === "archived" ? (
                  <ArchiveRestore size={16} strokeWidth={1.8} aria-hidden />
                ) : (
                  <Archive size={16} strokeWidth={1.8} aria-hidden />
                ),
              onSelect: () => toggleArchive(f),
            },
            {
              label: "Move to Deleted",
              icon: <Trash2 size={16} strokeWidth={1.8} aria-hidden />,
              tone: "danger",
              divide: true,
              onSelect: () => setTrash(f),
            },
          ]}
        />
      </>
    );

  return (
    <>
      <div className="fk-toolbar-panel">
        <div className="fk-filters" role="group" aria-label="Which forms">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className="fk-filter"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              {counts && counts[f.value] > 0 && <span className="fk-filter-count">{counts[f.value]}</span>}
            </button>
          ))}
        </div>

        <span className="fk-section-spacer" />

        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search forms"
          aria-label="Search forms"
          icon={<Search size={17} strokeWidth={1.8} aria-hidden />}
          wrapStyle={{ width: 240 }}
        />

        <div style={{ width: 190 }}>
          <Select value={sort} onChange={(next) => setSort(next as Sort)} options={SORTS} ariaLabel="Sort forms" />
        </div>

        <div className="fk-viewtoggle" role="group" aria-label="How to show the forms">
          <button type="button" aria-pressed={view === "list"} aria-label="As a list" onClick={() => setView("list")}>
            <List size={17} strokeWidth={1.8} aria-hidden />
          </button>
          <button type="button" aria-pressed={view === "grid"} aria-label="As cards" onClick={() => setView("grid")}>
            <LayoutGrid size={17} strokeWidth={1.8} aria-hidden />
          </button>
        </div>

        <Button iconLeft={<Plus size={16} strokeWidth={1.8} aria-hidden />} onClick={() => setCreateOpen(true)}>
          Create form
        </Button>
      </div>

      {inBin && (
        <div className="fk-panel" data-pad="tight">
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Trash2 size={18} strokeWidth={1.8} aria-hidden />
            <span style={{ flex: 1, minWidth: 220 }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: 500 }}>
                {counts?.deleted
                  ? counts.deleted === 1
                    ? "1 deleted form"
                    : `${counts.deleted} deleted forms`
                  : "Nothing deleted"}
              </span>
              <span className="fk-proprow-hint" style={{ display: "block", fontSize: 13.5 }}>
                Forms here are kept for 60 days with their responses, then deleted automatically.
                Restoring puts a form back in your drafts.
              </span>
            </span>
            {!!counts?.deleted && (
              <Button
                variant="destructive"
                iconLeft={<Trash2 size={16} strokeWidth={1.8} aria-hidden />}
                onClick={() => setPurgeAll(true)}
              >
                Empty the bin
              </Button>
            )}
          </div>
        </div>
      )}

      {data && forms.length === 0 ? (
        <div className="fk-panel">
          <EmptyState
            title={term ? `Nothing matches “${term}”` : EMPTY[filter].title}
            description={term ? "Try a shorter search, or another filter." : EMPTY[filter].description}
            action={
              !term && (filter === "all" || filter === "draft") ? (
                <Button onClick={() => setCreateOpen(true)} iconLeft={<Plus size={16} strokeWidth={1.8} aria-hidden />}>
                  Create a form
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : view === "grid" ? (
        <div className="fk-grid" data-cols="cards">
          {forms.map((f) => (
            <FormCard
              key={f._id}
              href={`/app/forms/${f._id}`}
              title={f.title}
              description={f.description}
              status={statusBadge(f.status)}
              responses={f.responses}
              fields={f.questions}
              updated={inBin ? `${f.daysLeft} days left` : `edited ${relativeTime(f.updatedAt)}`}
              accent={markFor(f.status)}
              actions={actionsFor(f)}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {forms.map((f) => {
            const sched = schedule(f);
            return (
              <div key={f._id} className="fk-formrow">
                <FormMark accent={markFor(f.status)} />

                <Link href={inBin ? "#" : `/app/forms/${f._id}`} className="fk-formrow-main" aria-disabled={inBin}>
                  <span className="fk-formrow-title">{f.title}</span>
                  <span className="fk-formrow-sub">{f.description || f.url}</span>
                </Link>

                <div className="fk-formrow-figures">
                  <span className="fk-formrow-figure">
                    {f.questions}
                    <span>{f.questions === 1 ? "question" : "questions"}</span>
                  </span>
                  <span className="fk-formrow-figure">
                    {f.responses.toLocaleString()}
                    <span>{f.responses === 1 ? "response" : "responses"}</span>
                  </span>
                  <span className="fk-formrow-figure">
                    {f.completionRate}%<span>completion</span>
                  </span>
                  <span className="fk-formrow-figure" style={{ minWidth: 120 }}>
                    {relativeTime(f.updatedAt)}
                    <span>last updated</span>
                  </span>
                  {inBin && f.daysLeft !== null && (
                    <span className="fk-chip" style={{ background: "var(--red-100)" }}>
                      <Clock size={13} strokeWidth={1.8} aria-hidden style={{ marginRight: 6, verticalAlign: -2 }} />
                      Deleted {relativeTime(f.deletedAt ?? f.updatedAt)} · {f.daysLeft} {f.daysLeft === 1 ? "day" : "days"} left
                    </span>
                  )}
                  {sched && (
                    <span className="fk-chip" style={{ background: "var(--yellow-100)" }} data-tip={sched.tip} tabIndex={0}>
                      <Clock size={13} strokeWidth={1.8} aria-hidden style={{ marginRight: 6, verticalAlign: -2 }} />
                      {sched.chip}
                    </span>
                  )}
                </div>

                {statusBadge(f.status)}

                <div className="fk-formrow-actions">{actionsFor(f)}</div>
              </div>
            );
          })}
        </div>
      )}

      {share && <ShareDialog formId={share} onClose={() => setShare(null)} />}
      {createOpen && <CreateFormDialog onClose={() => setCreateOpen(false)} />}
      {template && (
        <SaveTemplateDialog
          formId={template._id}
          title={template.title}
          description={template.description}
          onClose={() => setTemplate(null)}
        />
      )}
      {closing && (
        <CloseFormDialog formId={closing._id} status={closing.status} onClose={() => setClosing(null)} />
      )}

      {trash && (
        <Modal
          title={`Delete ${trash.title}?`}
          description="It moves to Deleted with its responses, and is removed for good after 60 days. You can restore it any time before then."
          onClose={() => setTrash(null)}
          width={460}
          footer={
            <>
              <Button variant="secondary" onClick={() => setTrash(null)}>
                Keep it
              </Button>
              <Button
                iconLeft={<Trash2 size={16} strokeWidth={1.8} aria-hidden />}
                onClick={async () => {
                  const f = trash;
                  setTrash(null);
                  await softDelete({ formId: f._id });
                  toast("Moved to Deleted", { detail: `${f.title} stays there for 60 days` });
                }}
              >
                Move to Deleted
              </Button>
            </>
          }
        >
          {null}
        </Modal>
      )}

      {(purgeOne || purgeAll) && (
        <Modal
          title={purgeAll ? "Delete every deleted form forever?" : `Delete ${purgeOne!.title} forever?`}
          description={
            purgeAll
              ? `${counts?.deleted ?? 0} ${counts?.deleted === 1 ? "form goes" : "forms go"}, with every response. This cannot be undone.`
              : `${purgeOne!.responses.toLocaleString()} ${purgeOne!.responses === 1 ? "response goes" : "responses go"} with it. This cannot be undone.`
          }
          onClose={() => {
            setPurgeOne(null);
            setPurgeAll(false);
          }}
          width={460}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setPurgeOne(null);
                  setPurgeAll(false);
                }}
              >
                Keep it
              </Button>
              <Button
                variant="destructive"
                iconLeft={<Trash2 size={16} strokeWidth={1.8} aria-hidden />}
                onClick={async () => {
                  const one = purgeOne;
                  setPurgeOne(null);
                  setPurgeAll(false);
                  await purge(one ? { formId: one._id } : { all: true });
                  toast(one ? `${one.title} is gone` : "The bin is empty", {
                    detail: "The responses went with it.",
                  });
                }}
              >
                {purgeAll ? "Delete them forever" : "Delete forever"}
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
