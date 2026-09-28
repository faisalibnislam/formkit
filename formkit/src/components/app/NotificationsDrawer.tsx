"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, CheckCheck, Megaphone, Settings2, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button, Drawer, EmptyState, IconButton, Segmented } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { relativeTime } from "./bits";

/**
 * The bell. Everything that happened that concerns this person - someone
 * added them to a form, replied to them, a form closed itself, responses came
 * in - plus announcements from Formkit. Opening a row marks it read.
 */

const DAY = 24 * 60 * 60 * 1000;

function dayOf(at: number, now: number) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (at >= start.getTime()) return "Today";
  if (at >= start.getTime() - DAY) return "Yesterday";
  return "Earlier";
}

export function NotificationsDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const data = useQuery(api.inbox.list, {});
  const markRead = useMutation(api.inbox.markRead);
  const markUnread = useMutation(api.inbox.markUnread);
  const markAll = useMutation(api.inbox.markAllRead);
  const remove = useMutation(api.inbox.remove);
  const seeAnnouncement = useMutation(api.inbox.seeAnnouncement);
  const [show, setShow] = useState<"all" | "unread">("all");
  const [now] = useState(() => Date.now());

  const items = (data?.items ?? []).filter((i) => (show === "unread" ? !i.read : true));
  const announcements = (data?.announcements ?? []).filter((a) => (show === "unread" ? !a.read : true));
  const unread = data?.unread ?? 0;

  const groups: { label: string; rows: typeof items }[] = [];
  for (const row of items) {
    const label = dayOf(row.at, now);
    const g = groups.find((x) => x.label === label);
    if (g) g.rows.push(row);
    else groups.push({ label, rows: [row] });
  }

  function open(row: (typeof items)[number]) {
    if (!row.read) void markRead({ ids: [row._id as Id<"inbox">] });
    if (row.href) {
      onClose();
      router.push(row.href);
    }
  }

  return (
    <Drawer title="Notifications" onClose={onClose}>
      <div className="fk-bell-head">
        <Button
          variant="ghost"
          size="sm"
          disabled={!unread}
          iconLeft={<CheckCheck size={15} strokeWidth={1.8} aria-hidden />}
          onClick={async () => {
            await markAll({});
            toast("All caught up");
          }}
        >
          Mark all read
        </Button>
        <span className="fk-section-spacer" />
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<Settings2 size={15} strokeWidth={1.8} aria-hidden />}
          onClick={() => {
            onClose();
            router.push("/app/settings?tab=notifications");
          }}
        >
          Settings
        </Button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Segmented
          size="sm"
          ariaLabel="Which notifications"
          value={show}
          onChange={setShow}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: unread ? `Unread · ${unread}` : "Unread" },
          ]}
        />
      </div>

      {announcements.map((a) => (
        <div key={a._id} className="fk-bell-news" data-read={a.read ? "true" : undefined}>
          <span className="fk-bell-news-mark" aria-hidden>
            <Megaphone size={16} strokeWidth={1.8} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="fk-bell-kicker">From Formkit · {relativeTime(a.at)}</span>
            <span className="fk-bell-title">{a.title}</span>
            <span className="fk-bell-body">{a.body}</span>
          </span>
          {!a.read && (
            <IconButton
              tip
              label="Got it"
              onClick={() => void seeAnnouncement({ announcementId: a._id as Id<"announcements"> })}
            >
              <X size={15} strokeWidth={1.8} aria-hidden />
            </IconButton>
          )}
        </div>
      ))}

      {data && items.length === 0 && announcements.length === 0 ? (
        <EmptyState
          title={show === "unread" ? "You're all caught up" : "Nothing yet"}
          description={
            show === "unread"
              ? "Everything here has been read."
              : "Invitations, comments and replies, new responses and changes to your forms show up here."
          }
        />
      ) : (
        groups.map((g) => (
          <div key={g.label} className="fk-bell-group">
            <div className="fk-bell-day">{g.label}</div>
            {g.rows.map((n) => (
              <div key={n._id} className="fk-bell-row" data-read={n.read ? "true" : undefined}>
                <button type="button" className="fk-bell-dot" onClick={() => {
                  if (n.read) void markUnread({ id: n._id as Id<"inbox"> });
                  else void markRead({ ids: [n._id as Id<"inbox">] });
                }} aria-label={n.read ? "Mark as unread" : "Mark as read"} title={n.read ? "Mark as unread" : "Mark as read"}>
                  <span className="fk-bell-pip" data-on={n.read ? undefined : "true"} aria-hidden />
                </button>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <button type="button" className="fk-bell-open" onClick={() => open(n)} disabled={!n.href && n.read}>
                    <span className="fk-bell-title">{n.title}</span>
                    {n.body && <span className="fk-bell-body">{n.body}</span>}
                    <span className="fk-bell-when">{relativeTime(n.at)}</span>
                  </button>
                  {n.href && (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconRight={<ArrowRight size={14} strokeWidth={1.8} aria-hidden />}
                      onClick={() => open(n)}
                    >
                      {n.action ?? "Open"}
                    </Button>
                  )}
                </span>
                <IconButton tip label="Remove" onClick={() => void remove({ id: n._id as Id<"inbox"> })}>
                  <X size={15} strokeWidth={1.8} aria-hidden />
                </IconButton>
              </div>
            ))}
          </div>
        ))
      )}
    </Drawer>
  );
}
