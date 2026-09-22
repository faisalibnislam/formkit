"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Settings2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button, EmptyState } from "@/components/ui";
import { Drawer } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { relativeTime } from "./bits";

/**
 * The bell. It lists the last few responses, and "unread" is the same `status`
 * the inbox uses — opening a response in either place clears it in both, rather
 * than keeping a second read-state that drifts.
 */
export function NotificationsDrawer({ onClose }: { onClose: () => void }) {
  const data = useQuery(api.notifications.recent, {});
  const setStatus = useMutation(api.responses.setStatus);
  const toast = useToast();

  const items = data?.items ?? [];
  const unread = items.filter((i) => i.unread);

  return (
    <Drawer
      title="Notifications"
      onClose={onClose}
      footer={
        <Link href="/app/settings?tab=notifications" onClick={onClose}>
          <Button variant="ghost" size="sm" iconLeft={<Settings2 size={15} strokeWidth={1.8} aria-hidden />}>
            Notification settings
          </Button>
        </Link>
      }
    >
      {unread.length > 0 && (
        <div style={{ padding: "0 0 12px" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await setStatus({ ids: unread.map((i) => i._id), status: "read" });
              toast("All caught up");
            }}
          >
            Mark all as read
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description="Answers land here the moment someone submits one of your forms."
        />
      ) : (
        <div className="fk-rows">
          {items.map((n) => (
            <Link
              key={n._id}
              href={`/app/forms/${n.formId}?tab=responses&open=${n._id}`}
              className="fk-row"
              onClick={onClose}
            >
              {n.unread && <span className="fk-row-unread" aria-label="Unread" />}
              <span className="fk-row-main">
                <span className="fk-row-title">
                  {n.who} {n.partial ? "started" : "answered"} {n.form}
                </span>
                <span className="fk-row-meta">{relativeTime(n.at)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </Drawer>
  );
}
