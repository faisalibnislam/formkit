"use client";

import { useMutation, useQuery } from "convex/react";
import { History } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, Drawer } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { fullTime } from "../bits";
import { tracked } from "../editor/saveStatus";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { openUpgrade } from "@/components/plan/usePlan";

/**
 * Version history, in a drawer. Every publish freezes the questions, so
 * restoring is always possible — and restoring snapshots what is there now
 * first, which means the restore itself can be undone.
 */
export function VersionsDialog({ formId, onClose }: { formId: Id<"forms">; onClose: () => void }) {
  const form = useQuery(api.forms.get, { formId });
  const versions = useQuery(api.forms.versions, { formId });
  const pending = useQuery(api.forms.unpublishedChanges, { formId }) ?? 0;
  const restore = useMutation(api.forms.restoreVersion);
  const toast = useToast();
  const published = form?.status === "published";

  return (
    <Drawer title="Version history" onClose={onClose}>
      <p className="fk-proprow-hint" style={{ margin: "0 0 16px", fontSize: 14 }}>
        {published
          ? "The top one is what people are answering right now."
          : "Nothing is live yet. Publishing saves a version you can come back to."}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {published && pending > 0 && (
          <div className="fk-amber" style={{ fontSize: 13.5 }}>
            {pending === 1
              ? `One question has changed since version ${form?.liveVersion ?? 1}.`
              : `${pending} questions have changed since version ${form?.liveVersion ?? 1}.`}{" "}
            Publish to save them as a new version.
          </div>
        )}
        {form?.ownerPlan?.limits.historyDays != null && (
          <p className="fk-proprow-hint" style={{ margin: 0, fontSize: 13.5 }}>
            Showing the last {form.ownerPlan.limits.historyDays} days of versions. Older ones are kept
            {form.ownerPlan.id === "free" ? " — a year of history comes with Pro" : " — all of it comes with Business"}.{" "}
            <ProChip
              plan={form.ownerPlan.id === "free" ? "pro" : "business"}
              onClick={() => openUpgrade({ plan: form.ownerPlan!.id === "free" ? "pro" : "business" })}
            />
          </p>
        )}
        {versions && versions.length === 0 && (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--color-text-tertiary)" }}>
            No versions yet. The first one is saved the moment you publish.
          </p>
        )}
        {(versions ?? []).map((v, i) => (
          <div key={v._id} className="fk-version">
            <span style={{ flex: 1, minWidth: 170 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>Version {v.number}</span>
                {v.live && published && <span className="fk-livechip">Live</span>}
              </span>
              <span className="fk-proprow-hint" style={{ display: "block", marginTop: 4 }}>
                {[v.label, v.publishedBy, fullTime(v.publishedAt)].filter(Boolean).join(" · ")}
              </span>
              <span className="fk-proprow-hint" style={{ display: "block", marginTop: 2 }}>
                {v.questions === 1 ? "1 question" : `${v.questions} questions`}
              </span>
            </span>
            {i > 0 && (
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<History size={15} strokeWidth={1.8} aria-hidden />}
                aria-label={`Restore version ${v.number}`}
                onClick={async () => {
                  await tracked(restore({ versionId: v._id }));
                  toast(`Version ${v.number} is back`, {
                    detail: "What was there a moment ago is saved as its own version.",
                  });
                }}
              >
                Restore
              </Button>
            )}
          </div>
        ))}
      </div>
    </Drawer>
  );
}
