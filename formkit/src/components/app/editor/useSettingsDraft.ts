"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { tracked } from "./saveStatus";

type Key = "theme" | "notify" | "welcome" | "thanks" | "security";

/**
 * One of a form's settings objects, changed here and saved a moment later.
 *
 * What was changed shows straight away — a colour dragged through the picker
 * repaints the preview on every step — and the keys that changed are merged on
 * the server in one write once the changes pause. A key stops being held
 * locally as soon as the server reads back the same value.
 */
export function useSettingsDraft<T extends object>(
  formId: Id<"forms">,
  key: Key,
  server: T,
): [T, (patch: Partial<T>) => void] {
  const patchSettings = useMutation(api.forms.patchSettings);
  const [held, setHeld] = useState<Partial<T>>({});
  const pending = useRef<Partial<T>>({});
  const timer = useRef<number | null>(null);

  // Drop what the server has caught up with.
  const serverJson = JSON.stringify(server);
  useEffect(() => {
    const s = JSON.parse(serverJson) as Record<string, unknown>;
    setHeld((h) => {
      const next: Record<string, unknown> = {};
      let changed = false;
      for (const [k, v] of Object.entries(h)) {
        if (JSON.stringify(s[k]) === JSON.stringify(v) && !(k in pending.current)) changed = true;
        else next[k] = v;
      }
      return changed ? (next as Partial<T>) : h;
    });
  }, [serverJson]);

  // Leaving the tab mid-pause still saves what was changed.
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      const send = pending.current;
      pending.current = {};
      if (Object.keys(send).length) void tracked(patchSettings({ formId, key, patch: send }));
    };
  });
  useEffect(() => () => flushRef.current(), []);

  const set = (patch: Partial<T>) => {
    setHeld((h) => ({ ...h, ...patch }));
    pending.current = { ...pending.current, ...patch };
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flushRef.current(), 300);
  };

  return [{ ...server, ...held }, set];
}
