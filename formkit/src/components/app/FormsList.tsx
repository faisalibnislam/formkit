"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  Clock,
  Copy,
  Eye,
  Inbox,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Trash2,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge, Button, EmptyState, IconButton, Input, Select } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ShareDialog } from "./dialogs/ShareDialog";
import { CreateFormDialog } from "./CreateFormDialog";
import { FormCard, FormMark } from "./ds";
import { relativeTime } from "./bits";

/**
 * The forms list, and the bin.
 *
 * Deleting is never immediate: a form sits in Deleted for sixty days with its
 * responses, and the row says how long is left. "Delete forever" is the only
 * thing here that cannot be undone, and it says so.
 */
type Filter = "all" | "draft" | "published" | "closed" | "deleted";
type Sort = "updated" | "created" | "responses" | "title";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Published" },
  { value: "closed", label: "Closed" },
  { value: "deleted", label: "Deleted" },
];

const SORTS = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Newest first" },
  { value: "responses", label: "Most responses" },
  { value: "title", label: "Name, A to Z" },
];

function accentFor(status: string) {
  if (status === "published") return "var(--blue-300)";
  if (status === "draft") return "var(--yellow-200)";
  return "var(--mint-200)";
}

function markFor(status: string) {
  if (status === "published") return "var(--blue-200)";
  if (status === "draft") return "var(--yellow-200)";
  return "var(--mint-200)";
}

function statusBadge(status: string) {
  if (status === "published") return <Badge tone="success">Published</Badge>;
  if (status === "closed") return <Badge tone="neutral">Closed</Badge>;
  return <Badge tone="draft">Draft</Badge>;
}

export function FormsList() {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<Sort>("updated");
  const [view, setView] = useState<"list" | "grid">("list");
  const [share, setShare] = useState<Id<"forms"> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const data = useQuery(api.forms.list, { filter, search: term || undefined });
  const softDelete = useMutation(api.forms.softDelete);
  const restore = useMutation(api.forms.restore);
  const purge = useMutation(api.forms.purge);
  const duplicate = useMutation(api.forms.duplicate);

  const counts = data?.counts;
  const inBin = filter === "deleted";

  // The query returns newest-edited first; the rest of the orders are the
  // same rows read differently, so they do not need a round trip.
  const forms = [...(data?.forms ?? [])].sort((a, b) => {
    if (sort === "created") return b.createdAt - a.createdAt;
    if (sort === "responses") return b.responses - a.responses;
    if (sort === "title") return a.title.localeCompare(b.title);
    return b.updatedAt - a.updatedAt;
  });

  const countFor = (value: Filter) => (counts ? counts[value] : undefined);

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
              {countFor(f.value) !== undefined && (
                <span className="fk-filter-count">{countFor(f.value)}</span>
              )}
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
          trailing={<span className="fk-kbd">⌘K</span>}
          wrapStyle={{ width: 260 }}
        />

        <Select
          value={sort}
          onChange={(next) => setSort(next as Sort)}
          options={SORTS}
          ariaLabel="Sort forms"
        />

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
                  ? `${counts.deleted} ${counts.deleted === 1 ? "form" : "forms"} in the bin`
                  : "The bin is empty"}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 3,
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  color: "var(--color-text-tertiary)",
                }}
              >
                Forms here are kept for 60 days, then deleted automatically. Restoring puts a form
                back in your drafts with its responses.
              </span>
            </span>
            {!!counts?.deleted && (
              <Button
                variant="destructive"
                iconLeft={<Trash2 size={16} strokeWidth={1.8} aria-hidden />}
                onClick={async () => {
                  await purge({});
                  toast("The bin is empty", { detail: "Those forms and their responses are gone." });
                }}
              >
                Delete all forever
              </Button>
            )}
          </div>
        </div>
      )}

      {data && forms.length === 0 ? (
        <div className="fk-panel">
          <EmptyState
            title={term ? `Nothing matches “${term}”` : "Nothing here yet"}
            description={
              term
                ? "Try a shorter search, or another filter."
                : inBin
                  ? "Deleted forms appear here for sixty days."
                  : "Your first form is waiting to be created."
            }
            action={
              !term && !inBin ? (
                <Button onClick={() => setCreateOpen(true)} iconLeft={<Plus size={16} strokeWidth={1.8} aria-hidden />}>
                  Create form
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : view === "grid" && !inBin ? (
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
              updated={`edited ${relativeTime(f.updatedAt)}`}
              accent={accentFor(f.status)}
              actions={
                <>
                  <IconButton label={`Share ${f.title}`} onClick={() => setShare(f._id)}>
                    <Share2 size={16} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                  <IconButton
                    label={`Duplicate ${f.title}`}
                    onClick={async () => {
                      await duplicate({ formId: f._id });
                      toast(`Copied “${f.title}”`, { detail: "The copy is a draft." });
                    }}
                  >
                    <Copy size={16} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                </>
              }
            />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {forms.map((f) => (
            <div key={f._id} className="fk-formrow">
              <FormMark accent={markFor(f.status)} />

              <Link href={`/app/forms/${f._id}`} className="fk-formrow-main">
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
                {f.daysLeft !== null && (
                  <span className="fk-chip" style={{ background: "var(--red-100)" }}>
                    <Clock size={13} strokeWidth={1.8} aria-hidden style={{ marginRight: 6, verticalAlign: -2 }} />
                    {f.daysLeft} {f.daysLeft === 1 ? "day" : "days"} left
                  </span>
                )}
                {f.closesAt && (
                  <span className="fk-chip" style={{ background: "var(--yellow-100)" }}>
                    closes {new Date(f.closesAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                  </span>
                )}
              </div>

              {statusBadge(f.status)}

              <div className="fk-formrow-actions">
                {inBin ? (
                  <>
                    <IconButton
                      label={`Restore ${f.title}`}
                      onClick={async () => {
                        await restore({ formId: f._id });
                        toast(`“${f.title}” is back in your drafts`);
                      }}
                    >
                      <RotateCcw size={16} strokeWidth={1.8} aria-hidden />
                    </IconButton>
                    <IconButton
                      label={`Delete ${f.title} forever`}
                      tone="danger"
                      onClick={async () => {
                        await purge({ formId: f._id });
                        toast(`“${f.title}” is gone`, { detail: "Its responses went with it." });
                      }}
                    >
                      <Trash2 size={16} strokeWidth={1.8} aria-hidden />
                    </IconButton>
                  </>
                ) : (
                  <>
                    <Link href={`/app/forms/${f._id}`}>
                      <IconButton label={`Edit ${f.title}`}>
                        <Pencil size={16} strokeWidth={1.8} aria-hidden />
                      </IconButton>
                    </Link>
                    {f.status === "published" ? (
                      <a href={`https://${f.url}`} target="_blank" rel="noreferrer">
                        <IconButton label={`Open ${f.title} as a respondent sees it`}>
                          <Eye size={16} strokeWidth={1.8} aria-hidden />
                        </IconButton>
                      </a>
                    ) : (
                      <Link href={`/app/forms/${f._id}?tab=design`}>
                        <IconButton label={`Preview ${f.title}`}>
                          <Eye size={16} strokeWidth={1.8} aria-hidden />
                        </IconButton>
                      </Link>
                    )}
                    <IconButton label={`Share ${f.title}`} onClick={() => setShare(f._id)}>
                      <Share2 size={16} strokeWidth={1.8} aria-hidden />
                    </IconButton>
                    <IconButton
                      label={`Duplicate ${f.title}`}
                      onClick={async () => {
                        await duplicate({ formId: f._id });
                        toast(`Copied “${f.title}”`, { detail: "The copy is a draft." });
                      }}
                    >
                      <Copy size={16} strokeWidth={1.8} aria-hidden />
                    </IconButton>
                    <Link href={`/app/forms/${f._id}?tab=responses`}>
                      <IconButton label={`Responses to ${f.title}`}>
                        <Inbox size={16} strokeWidth={1.8} aria-hidden />
                      </IconButton>
                    </Link>
                    <IconButton
                      label={`Move ${f.title} to the bin`}
                      tone="danger"
                      onClick={async () => {
                        await softDelete({ formId: f._id });
                        toast(`“${f.title}” is in the bin`, { detail: "It stays there for 60 days." });
                      }}
                    >
                      <Trash2 size={16} strokeWidth={1.8} aria-hidden />
                    </IconButton>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {share && <ShareDialog formId={share} onClose={() => setShare(null)} />}
      {createOpen && <CreateFormDialog onClose={() => setCreateOpen(false)} />}
    </>
  );
}
