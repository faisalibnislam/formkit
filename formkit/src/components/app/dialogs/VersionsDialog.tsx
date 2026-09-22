"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, EmptyState, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { fullTime } from "../bits";

/**
 * Version history. Every publish freezes the questions, so restoring is always
 * possible — and restoring snapshots what is there now first, which means the
 * restore itself can be undone.
 */
export function VersionsDialog({ formId, onClose }: { formId: Id<"forms">; onClose: () => void }) {
  const versions = useQuery(api.forms.versions, { formId });
  const restore = useMutation(api.forms.restoreVersion);
  const toast = useToast();

  return (
    <Modal
      title="Version history"
      description="Each publish keeps a copy of the questions as they were."
      onClose={onClose}
      width={560}
    >
      {versions === undefined ? null : versions.length === 0 ? (
        <EmptyState
          title="Nothing published yet"
          description="The first version is saved the moment you publish this form."
        />
      ) : (
        <div className="fk-rows">
          {versions.map((v) => (
            <div key={v._id} className="fk-row" data-static="true">
              <span className="fk-row-main">
                <span className="fk-row-title">
                  Version {v.number} {v.live && <Badge tone="success">Live</Badge>}
                </span>
                <span className="fk-row-meta">
                  {v.label} · {v.questions} questions · {fullTime(v.publishedAt)}
                </span>
              </span>
              {!v.live && (
                <span className="fk-row-side">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      await restore({ versionId: v._id });
                      toast(`Version ${v.number} is back`, {
                        detail: "What was there a moment ago is saved as its own version.",
                      });
                    }}
                  >
                    Restore
                  </Button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
