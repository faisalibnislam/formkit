"use client";

import { Scroller } from "./Scroller";
import { useSeededQuery } from "@/lib/seed";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import {
  Bookmark,
  ChartPie,
  ChevronDown,
  Eye,
  GitBranch,
  History,
  Inbox,
  Layers,
  Lock,
  MessageSquare,
  Palette,
  Rocket,
  Settings2,
  Share2,
  Unlock,
  UserPlus,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useEscape } from "@/components/ui/useEscape";
import { ClientTab, TabSummary } from "./ds";
import { useCommentRequests, usePresence, usePresenceBeat } from "./editor/collab";
import { usePreviewRequests, type PreviewRequest } from "./editor/previewBus";
import { THEME_PRESETS, themeOf } from "./editor/themes";
import { resetSaveStatus, tracked, useSaveStatus } from "./editor/saveStatus";

/**
 * The header's dialogs open on a click, so they are not part of the first
 * load; they are fetched in the background once the editor is up, so a
 * click never waits on the network.
 */
const DIALOGS = {
  CloseFormDialog: () => import("./dialogs/CloseFormDialog").then((m) => m.CloseFormDialog),
  CollaboratorsDialog: () => import("./dialogs/CollaboratorsDialog").then((m) => m.CollaboratorsDialog),
  CommentsDrawer: () => import("./dialogs/CommentsDrawer").then((m) => m.CommentsDrawer),
  PreviewOverlay: () => import("./dialogs/PreviewOverlay").then((m) => m.PreviewOverlay),
  SaveTemplateDialog: () => import("./dialogs/SaveTemplateDialog").then((m) => m.SaveTemplateDialog),
  PublishDialog: () => import("./dialogs/PublishDialog").then((m) => m.PublishDialog),
  ShareDialog: () => import("./dialogs/ShareDialog").then((m) => m.ShareDialog),
  VersionsDialog: () => import("./dialogs/VersionsDialog").then((m) => m.VersionsDialog),
};
const CloseFormDialog = dynamic(DIALOGS.CloseFormDialog);
const CollaboratorsDialog = dynamic(DIALOGS.CollaboratorsDialog);
const CommentsDrawer = dynamic(DIALOGS.CommentsDrawer);
const PreviewOverlay = dynamic(DIALOGS.PreviewOverlay);
const SaveTemplateDialog = dynamic(DIALOGS.SaveTemplateDialog);
const PublishDialog = dynamic(DIALOGS.PublishDialog);
const ShareDialog = dynamic(DIALOGS.ShareDialog);
const VersionsDialog = dynamic(DIALOGS.VersionsDialog);

/**
 * The editor's own header: the form's name, edited in place, what it is doing
 * right now, and the publish control.
 *
 * Publishing and sharing are separate. This button decides whether the form is
 * live; the Share dialog owns the public link and never carries an on/off
 * switch of its own.
 */

const TABS = [
  { id: "build", name: "Build", meta: "Questions and pages", icon: <Layers size={15} strokeWidth={1.8} aria-hidden /> },
  { id: "design", name: "Design", meta: "Theme and branding", icon: <Palette size={15} strokeWidth={1.8} aria-hidden /> },
  { id: "logic", name: "Logic", meta: "Conditional rules", icon: <GitBranch size={15} strokeWidth={1.8} aria-hidden /> },
  { id: "responses", name: "Responses", meta: "Submissions", icon: <Inbox size={15} strokeWidth={1.8} aria-hidden /> },
  { id: "analytics", name: "Analytics", meta: "Views and drop-off", icon: <ChartPie size={15} strokeWidth={1.8} aria-hidden /> },
  { id: "settings", name: "Settings", meta: "Access and replies", icon: <Settings2 size={15} strokeWidth={1.8} aria-hidden /> },
] as const;

export function EditorHeader({ formId, tab }: { formId: Id<"forms">; tab: string }) {
  const router = useRouter();
  const form = useSeededQuery(api.forms.get, { formId });
  const pending = useSeededQuery(api.forms.unpublishedChanges, { formId });
  const update = useMutation(api.forms.update);

  // Starts from the server's copy, so the first paint shows the real title.
  const [title, setTitle] = useState(() => form?.title ?? "");
  const [actionsOpen, setActionsOpen] = useState(false);
  useEscape(actionsOpen, () => setActionsOpen(false));
  const [dialog, setDialog] = useState<
    null | "share" | "versions" | "people" | "template" | "close" | "publish"
  >(null);
  const known = useRef<string | null>(form?._id ?? null);
  const saved = useSaveStatus(form?.updatedAt);
  const counts = useSeededQuery(api.comments.counts, { formId });
  const others = usePresence(formId);
  usePresenceBeat(formId);

  const [preview, setPreview] = useState<PreviewRequest | null>(null);
  const [comments, setComments] = useState<{ blockId: string | null } | null>(null);
  usePreviewRequests(useCallback((r: PreviewRequest) => setPreview(r), []));

  useEffect(() => {
    const t = window.setTimeout(() => Object.values(DIALOGS).forEach((load) => void load()), 1500);
    return () => window.clearTimeout(t);
  }, []);

  // The forms list can open a form straight into its preview or share panel.
  const search = useSearchParams();
  const pathname = usePathname();
  // The parameter is removed once handled, so it cannot fire twice; a later
  // link to the same form (a notification, say) sets it again and is obeyed.
  useEffect(() => {
    const want = search.get("open");
    // `open` also carries a response id for the inbox; only these are ours.
    if (want !== "preview" && want !== "share" && want !== "comments" && want !== "publish") return;
    const t = window.setTimeout(() => {
      if (want === "preview") setPreview({});
      // The command palette's "Publish this form"; a closed form reopens instead.
      else if (want === "publish") setDialog(form?.status === "closed" ? "close" : "publish");
      else if (want === "share") setDialog("share");
      else if (want === "comments") setComments({ blockId: null });
      const next = new URLSearchParams(search.toString());
      next.delete("open");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    }, 0);
    return () => window.clearTimeout(t);
  }, [pathname, router, search, form?.status]);
  useCommentRequests(useCallback((r: { blockId: string | null }) => setComments(r), []));
  const openThreads = Object.values(counts ?? {}).reduce((a, b) => a + b, 0);

  useEffect(() => resetSaveStatus(), [formId]);

  // The input is uncontrolled by the server after the first load, so typing is
  // never yanked back by a round trip.
  useEffect(() => {
    if (form && known.current !== form._id) {
      known.current = form._id;
      setTitle(form.title);
    }
  }, [form]);

  if (!form) {
    return (
      <div className="fk-app-hero">
        <div className="fk-app-hero-text">
          <h1 style={{ opacity: 0.35 }}>Loading…</h1>
        </div>
      </div>
    );
  }

  const statusLabel =
    form.status === "published"
      ? "Collecting"
      : form.status === "closed"
        ? "Closed"
        : form.status === "archived"
          ? "Archived"
          : "Draft";

  const publishLabel =
    form.status === "published"
      ? (pending ?? 0) > 0
        ? "Publish changes"
        : "Collecting"
      : form.status === "closed"
        ? "Reopen"
        : "Publish";

  async function commitTitle() {
    const next = title.trim();
    if (!next || !form || next === form.title) return;
    await tracked(update({ formId, patch: { title: next } }));
  }

  function onPublish() {
    if (!form) return;
    setDialog(form.status === "closed" ? "close" : "publish");
  }

  const summaries: Record<string, string> = {
    build: String(form.questions),
    design:
      THEME_PRESETS.find((p) => p.id === themeOf(form.theme).preset)?.name ?? "Custom",
    logic: String(form.rules.length),
    responses: String(form.responses),
    analytics: `${form.completionRate}%`,
    settings: statusLabel,
  };
  const summaryLabels: Record<string, string> = {
    build: "Questions:",
    design: "Theme:",
    logic: "Rules:",
    responses: "Responses:",
    analytics: "Completion:",
    settings: "Status:",
  };

  return (
    <>
      <div className="fk-app-hero" style={{ display: "block" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
              <Link href="/app/forms" className="fk-app-back" style={{ marginBottom: 0 }}>
                ← Forms
              </Link>
              <span style={{ fontSize: 14.5, color: "var(--neutral-0)", opacity: 0.6 }}>/</span>
              <span style={{ fontSize: 14.5, color: "var(--neutral-0)" }}>{statusLabel}</span>
              {saved.label && (
                <span className="fk-savestatus" data-tone={saved.tone} role="status" aria-live="polite">
                  {saved.label}
                </span>
              )}
            </div>

            <input
              className="fk-app-title-input"
              value={title}
              aria-label="Form name"
              title="Click to rename"
              placeholder="Untitled form"
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <span className="fk-pill-glass">
                Questions <strong>{form.questions}</strong>
              </span>
              <span className="fk-pill-glass">
                Responses <strong>{form.responses}</strong>
              </span>
              <span className="fk-pill-glass">
                Pages <strong>{form.pages}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            {others.length > 0 && (
              <span className="fk-presence" aria-label={`${others.length} other ${others.length === 1 ? "person" : "people"} here`}>
                {others.slice(0, 4).map((p) => (
                  <span key={p.userId} className="fk-presence-face" style={{ background: p.color }} title={`${p.name} is here`}>
                    {p.image ? (
                      <img src={p.image} alt="" />
                    ) : (
                      p.name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase()
                    )}
                  </span>
                ))}
                {others.length > 4 && <span className="fk-presence-face" data-more="true">+{others.length - 4}</span>}
              </span>
            )}
            <span className="fk-bell">
              <button
                type="button"
                className="fk-ring-btn"
                data-on-sky="true"
                aria-label={openThreads ? `Comments, ${openThreads} open` : "Comments"}
                title="Comments"
                onClick={() => setComments({ blockId: null })}
              >
                <MessageSquare size={18} strokeWidth={1.8} aria-hidden />
              </button>
              {openThreads > 0 && <span className="fk-bell-count">{openThreads}</span>}
            </span>
            <span
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                height: 48,
                borderRadius: "var(--radius-pill)",
                background: "var(--neutral-900)",
                boxShadow: "var(--shadow-float)",
              }}
            >
              <button
                type="button"
                onClick={onPublish}
                className="fk-publish"
                title={form.status === "published" ? "Publishing and status" : undefined}
              >
                <Rocket size={16} strokeWidth={1.8} aria-hidden />
                <span>{publishLabel}</span>
              </button>
              <span style={{ width: 1, height: 20, background: "rgba(255,255,255,.24)" }} />
              <button
                type="button"
                className="fk-publish fk-publish-caret"
                aria-haspopup="menu"
                aria-expanded={actionsOpen}
                aria-label="More form actions"
                onClick={() => setActionsOpen((v) => !v)}
              >
                <ChevronDown size={15} strokeWidth={1.8} aria-hidden />
              </button>

              {actionsOpen && (
                <>
                  <span className="fk-menu-scrim" onClick={() => setActionsOpen(false)} aria-hidden />
                  <span className="fk-menu" data-align="right" role="menu" style={{ top: 56 }}>
                    <button className="fk-menu-item" role="menuitem" onClick={() => { setActionsOpen(false); setDialog("publish"); }}>
                      <Rocket size={16} strokeWidth={1.8} aria-hidden />{" "}
                      {form.status === "draft" ? "Publish this form" : "Publishing and status"}
                    </button>
                    <button className="fk-menu-item" role="menuitem" onClick={() => { setActionsOpen(false); setDialog("versions"); }}>
                      <History size={16} strokeWidth={1.8} aria-hidden /> Version history
                    </button>
                    <button className="fk-menu-item" role="menuitem" onClick={() => { setActionsOpen(false); setPreview({}); }}>
                      <Eye size={16} strokeWidth={1.8} aria-hidden /> Preview
                    </button>
                    <button className="fk-menu-item" role="menuitem" onClick={() => { setActionsOpen(false); setComments({ blockId: null }); }}>
                      <MessageSquare size={16} strokeWidth={1.8} aria-hidden /> Comments
                    </button>
                    <button className="fk-menu-item" role="menuitem" onClick={() => { setActionsOpen(false); setDialog("share"); }}>
                      <Share2 size={16} strokeWidth={1.8} aria-hidden /> Share
                    </button>
                    <button className="fk-menu-item" role="menuitem" onClick={() => { setActionsOpen(false); setDialog("people"); }}>
                      <UserPlus size={16} strokeWidth={1.8} aria-hidden /> Collaborators
                    </button>
                    <button className="fk-menu-item" role="menuitem" onClick={() => { setActionsOpen(false); setDialog("template"); }}>
                      <Bookmark size={16} strokeWidth={1.8} aria-hidden /> Save as template
                    </button>
                    <span className="fk-menu-rule" />
                    <button className="fk-menu-item" role="menuitem" onClick={() => { setActionsOpen(false); setDialog("close"); }}>
                      {form.status === "closed" ? (
                        <>
                          <Unlock size={16} strokeWidth={1.8} aria-hidden /> Reopen this form
                        </>
                      ) : (
                        <>
                          <Lock size={16} strokeWidth={1.8} aria-hidden /> Close this form
                        </>
                      )}
                    </button>
                  </span>
                </>
              )}
            </span>
          </div>
        </div>

      </div>

      <Scroller className="fk-dock" shellClassName="fk-dock-shell">
        {TABS.map((t) => (
          <ClientTab
            key={t.id}
            href={`/app/forms/${formId}?tab=${t.id}`}
            name={t.name}
            meta={t.meta}
            mark={t.icon}
            active={t.id === tab}
          >
            {t.id === tab && (
              <TabSummary label={summaryLabels[t.id]!} value={summaries[t.id]!} />
            )}
          </ClientTab>
        ))}
      </Scroller>

      {dialog === "share" && <ShareDialog formId={formId} onClose={() => setDialog(null)} />}
      {dialog === "versions" && <VersionsDialog formId={formId} onClose={() => setDialog(null)} />}
      {preview && (
        <PreviewOverlay
          formId={formId}
          device={preview.device}
          closed={preview.closed}
          onClose={() => setPreview(null)}
        />
      )}
      {comments && (
        <CommentsDrawer
          formId={formId}
          blockId={comments.blockId}
          onScope={(blockId) => setComments({ blockId })}
          onClose={() => setComments(null)}
        />
      )}
      {dialog === "publish" && (
        <PublishDialog
          formId={formId}
          onClose={() => setDialog(null)}
          onVersions={() => setDialog("versions")}
          onPublished={() => setDialog("share")}
        />
      )}
      {dialog === "people" && <CollaboratorsDialog formId={formId} onClose={() => setDialog(null)} />}
      {dialog === "template" && (
        <SaveTemplateDialog formId={formId} title={form.title} description={form.description} onClose={() => setDialog(null)} />
      )}
      {dialog === "close" && (
        <CloseFormDialog
          formId={formId}
          status={form.status}
          onClose={() => setDialog(null)}
          onDone={() => router.refresh()}
        />
      )}
    </>
  );
}
