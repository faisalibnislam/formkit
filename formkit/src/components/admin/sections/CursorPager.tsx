"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";

type Stop = { cursor: string | null; start: number };

/**
 * Pages of an admin list read a stretch at a time (convex/model/scan.ts):
 * Next carries on from where the last page stopped, Previous goes back the
 * way it came. Changing `resetKey` (the filters) starts again at the top.
 */
export function useCursorPages(resetKey: string) {
  const [stack, setStack] = useState<Stop[]>([{ cursor: null, start: 0 }]);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    setKey(resetKey);
    setStack([{ cursor: null, start: 0 }]);
  }
  const top = stack[stack.length - 1]!;
  return {
    cursor: top.cursor,
    start: top.start,
    canBack: stack.length > 1,
    back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    forward: (next: string, shown: number) => setStack((s) => [...s, { cursor: next, start: s[s.length - 1]!.start + shown }]),
  };
}

export function CursorPager({
  pages,
  shown,
  next,
  total,
  labels = ["Previous", "Next"],
}: {
  pages: ReturnType<typeof useCursorPages>;
  shown: number;
  next: string | null;
  /** How many in all, when known. */
  total: number | null;
  labels?: [string, string];
}) {
  const range = shown ? `${(pages.start + 1).toLocaleString()}–${(pages.start + shown).toLocaleString()}` : "None here";
  return (
    <div className="fk-admin-pager">
      <span style={{ flex: 1 }}>
        {range}
        {total !== null && shown ? ` of ${total.toLocaleString()}` : ""}
        {!shown && next ? ", more to look through" : ""}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={!pages.canBack}
        iconLeft={<ChevronLeft size={15} strokeWidth={1.8} aria-hidden />}
        onClick={pages.back}
      >
        {labels[0]}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={!next}
        iconRight={<ChevronRight size={15} strokeWidth={1.8} aria-hidden />}
        onClick={() => next && pages.forward(next, shown)}
      >
        {labels[1]}
      </Button>
    </div>
  );
}
