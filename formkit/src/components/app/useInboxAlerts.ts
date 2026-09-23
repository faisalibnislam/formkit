"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useToast } from "@/components/ui/Toast";

/**
 * What happens the moment something new reaches the bell while Formkit is
 * open: a toast with a way straight to it, a system notification when this
 * browser has been allowed them and the tab is in the background, and the
 * unread count in the tab's title.
 *
 * Browser alerts are a per-browser choice — the permission itself belongs to
 * the browser — so the switch is kept in this browser, not on the account.
 */

type Inbox = FunctionReturnType<typeof api.inbox.list>;

const KEY = "fk.browserAlerts";

export function browserAlertsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function browserAlertsOn() {
  if (!browserAlertsSupported()) return false;
  try {
    return window.localStorage.getItem(KEY) === "on" && Notification.permission === "granted";
  } catch {
    return false;
  }
}

/** Asks the browser the first time; resolves to whether alerts are now on. */
export async function setBrowserAlerts(on: boolean): Promise<"on" | "off" | "denied" | "unsupported"> {
  if (!browserAlertsSupported()) return "unsupported";
  try {
    if (!on) {
      window.localStorage.removeItem(KEY);
      return "off";
    }
    const permission =
      Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") return "denied";
    window.localStorage.setItem(KEY, "on");
    return "on";
  } catch {
    return "unsupported";
  }
}

const TITLE_COUNT = /^\(\d+\+?\)\s/;

export function useInboxAlerts(inbox: Inbox | undefined) {
  const toast = useToast();
  const router = useRouter();
  const markRead = useMutation(api.inbox.markRead);
  const seen = useRef<Set<string> | null>(null);

  // Toasts and system notifications for rows that arrived since last look.
  useEffect(() => {
    if (!inbox) return;
    const ids = inbox.items.map((i) => i._id as string);
    if (seen.current === null) {
      // The first load is what was already there, not news.
      seen.current = new Set(ids);
      return;
    }
    const fresh = inbox.items.filter((i) => !i.read && !seen.current!.has(i._id));
    for (const id of ids) seen.current.add(id);
    // Several at once — a burst of responses — become one toast.
    if (fresh.length > 1) {
      toast(`${fresh.length} new notifications`, {
        detail: fresh[0]!.title,
        action: { label: "Show", onClick: () => window.dispatchEvent(new Event("fk:open-bell")) },
      });
    } else if (fresh.length === 1) {
      const n = fresh[0]!;
      toast(n.title, {
        detail: n.body ?? undefined,
        action: n.href
          ? {
              label: "Open",
              onClick: () => {
                void markRead({ ids: [n._id as Id<"inbox">] });
                router.push(n.href!);
              },
            }
          : undefined,
      });
    }
    if (fresh.length && document.hidden && browserAlertsOn()) {
      for (const n of fresh.slice(0, 3)) {
        try {
          const alert = new Notification(n.title, { body: n.body ?? undefined, icon: "/icon.png", tag: n._id });
          alert.onclick = () => {
            window.focus();
            void markRead({ ids: [n._id as Id<"inbox">] });
            if (n.href) router.push(n.href);
            alert.close();
          };
        } catch {
          /* some browsers only allow notifications from a service worker */
        }
      }
    }
  }, [inbox, toast, router, markRead]);

  // "(3) Formkit" in the tab, kept even as pages change their own titles.
  const unread = inbox?.unread ?? 0;
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(TITLE_COUNT, "");
      const next = unread ? `(${unread > 99 ? "99+" : unread}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    const title = document.querySelector("title");
    if (!title) return;
    const watch = new MutationObserver(apply);
    watch.observe(title, { childList: true, characterData: true, subtree: true });
    return () => {
      watch.disconnect();
      document.title = document.title.replace(TITLE_COUNT, "");
    };
  }, [unread]);
}
