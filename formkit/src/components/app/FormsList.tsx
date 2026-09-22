"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Inbox,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Trash2,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge, Button, EmptyState, IconButton, Input, PillTabs } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ShareDialog } from "./dialogs/ShareDialog";
import { CreateFormDialog } from "./CreateFormDialog";
import { relativeTime } from "./bits";

/**
 * The forms list, and the bin.
 *
 * Deleting is never immediate: a form sits in Deleted for sixty days with its
 * responses, and the row says how long is left. "Delete forever" is the only
 * thing here that cannot be undone, and it says so.
 */
type Filter = "all" | "draft" | "published" | "closed" | "deleted";

export function FormsList() {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [term, setTerm] = useState("");
  const [share, setShare] = useState<Id<"forms"> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const data = useQuery(api.forms.list, { filter, search: term || undefined });
  const softDelete = useMutation(api.forms.softDelete);
  const restore = useMutation(api.forms.restore);
  const purge = useMutation(api.forms.purge);
  const duplicate = useMutation(api.forms.duplicate);

  const counts = data?.counts;
  const forms = data?.forms ?? [];
  const inBin = filter === "deleted";

  return (
    <>
      <div className="fk-panel" data-pad="tight">
        <div className="fk-toolbar">
          <PillTabs
            ariaLabel="Which forms"
            value={filter}
            onChange={setFilter}
            tabs={[
              { value: "all", label: `All${counts ? ` ${counts.all}` : ""}` },
              { value: "published", label: `Collecting${counts ? ` ${counts.published}` : ""}` },
              { value: "draft", label: `Drafts${counts ? ` ${counts.draft}` : ""}` },
              { value: "closed", label: `Closed${counts ? ` ${counts.closed}` : ""}` },
              { value: "deleted", label: `Deleted${counts ? ` ${counts.deleted}` : ""}` },
            ]}
          />
          <span className="fk-toolbar-spacer" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search forms"
            icon={<Search size={17} strokeWidth={1.8} aria-hidden />}
            style={{ width: 220 }}
          />
          <Button iconLeft={<Plus size={16} strokeWidth={1.8} aria-hidden />} onClick={() => setCreateOpen(true)}>
            Create form
          </Button>
        </div>
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
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {forms.map((f) => (
            <div key={f._id} className="fk-panel" data-pad="tight">
              <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                <FileText size={20} strokeWidth={1.8} aria-hidden />
                <Link
                  href={`/app/forms/${f._id}`}
                  style={{ flex: 1, minWidth: 220, color: "inherit" }}
                >
                  <span style={{ display: "block", fontSize: 17, fontWeight: 500, letterSpacing: "-.012em" }}>
                    {f.title}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: "var(--color-text-tertiary)",
                    }}
                  >
                    {f.description || f.url}
                  </span>
                </Link>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    flexWrap: "wrap",
                    fontSize: 13.5,
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  <span>{f.questions} questions</span>
                  <span>{f.responses} responses</span>
                  {f.responses > 0 && <span>{f.completionRate}% completed</span>}
                  <span>edited {relativeTime(f.updatedAt)}</span>
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

                <Badge
                  tone={f.status === "published" ? "success" : f.status === "closed" ? "neutral" : "draft"}
                >
                  {f.status === "published" ? "Collecting" : f.status === "closed" ? "Closed" : "Draft"}
                </Badge>

                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {inBin ? (
                    <>
                      <IconButton
                        label="Restore this form"
                        onClick={async () => {
                          await restore({ formId: f._id });
                          toast(`“${f.title}” is back in your drafts`);
                        }}
                      >
                        <RotateCcw size={16} strokeWidth={1.8} aria-hidden />
                      </IconButton>
                      <IconButton
                        label="Delete forever"
                        tone="danger"
                        onClick={async () => {
                          await purge({ formId: f._id });
                          toast(`“${f.title}” is gone`, {
                            detail: "Its responses went with it.",
                          });
                        }}
                      >
                        <Trash2 size={16} strokeWidth={1.8} aria-hidden />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <Link href={`/app/forms/${f._id}?tab=responses`}>
                        <IconButton label="Responses">
                          <Inbox size={16} strokeWidth={1.8} aria-hidden />
                        </IconButton>
                      </Link>
                      <IconButton label="Share" onClick={() => setShare(f._id)}>
                        <Share2 size={16} strokeWidth={1.8} aria-hidden />
                      </IconButton>
                      <IconButton
                        label="Duplicate"
                        onClick={async () => {
                          await duplicate({ formId: f._id });
                          toast(`Copied “${f.title}”`, { detail: "The copy is a draft." });
                        }}
                      >
                        <Copy size={16} strokeWidth={1.8} aria-hidden />
                      </IconButton>
                      {f.status === "published" && (
                        <a href={`https://${f.url}`} target="_blank" rel="noreferrer">
                          <IconButton label="Open the live form">
                            <ExternalLink size={16} strokeWidth={1.8} aria-hidden />
                          </IconButton>
                        </a>
                      )}
                      <IconButton
                        label="Move to the bin"
                        tone="danger"
                        onClick={async () => {
                          await softDelete({ formId: f._id });
                          toast(`“${f.title}” is in the bin`, {
                            detail: "It stays there for 60 days.",
                          });
                        }}
                      >
                        <Trash2 size={16} strokeWidth={1.8} aria-hidden />
                      </IconButton>
                    </>
                  )}
                </div>
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
