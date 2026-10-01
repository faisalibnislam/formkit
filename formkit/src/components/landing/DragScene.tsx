"use client";

import { useEffect, useRef, useState } from "react";
import { AtSign, CircleDot, FileUp, GripVertical, Mic, Star, TextCursorInput } from "lucide-react";
import { SceneFrame, useInView, useReducedMotion, useStep, type SceneProps } from "@/components/site/scenes/shared";

/**
 * The builder's canvas, playing by itself: a field is dragged from the
 * library and dropped where the blue line shows, then a card is picked up by
 * its grip and moved. The same moves the real builder makes.
 */

const TILES = [
  { t: "Short text", icon: TextCursorInput },
  { t: "Email", icon: AtSign },
  { t: "File upload", icon: FileUp },
  { t: "Choice", icon: CircleDot },
  { t: "Rating", icon: Star },
  { t: "Voice", icon: Mic },
];
const DRAGGED = 2;

type Card = { id: string; q: string; type: string; icon: typeof AtSign };
const START: Card[] = [
  { id: "name", q: "Your name", type: "Short text", icon: TextCursorInput },
  { id: "email", q: "Where should we reply?", type: "Email", icon: AtSign },
  { id: "need", q: "What do you need?", type: "Choice", icon: CircleDot },
  { id: "more", q: "Anything else?", type: "Long text", icon: TextCursorInput },
];
const NEW: Card = { id: "files", q: "Share your brand files", type: "File upload", icon: FileUp };
const ROW = 50;

/** 0 rest, 1 dragging a tile in, 2 dropped, 3 moving a card, 4 moved. */
const PHASE_MS = [1300, 1300, 1500, 1300, 2200];

export function DragScene({ compact }: SceneProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const tile = useRef<HTMLSpanElement | null>(null);
  const canvas = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref, 0.25);
  const still = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const [from, setFrom] = useState({ x: 0, y: 0, tx: 0, ty: 0 });
  const shown = still ? 4 : phase;

  useStep(seen && !still, PHASE_MS[phase]!, () => setPhase((phase + 1) % PHASE_MS.length), [phase]);

  // Where the dragged tile starts and where it lands, relative to the scene.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const root = ref.current?.getBoundingClientRect();
      const a = tile.current?.getBoundingClientRect();
      const c = canvas.current?.getBoundingClientRect();
      if (!root || !a || !c) return;
      setFrom({ x: a.left - root.left, y: a.top - root.top, tx: c.left - root.left + 12, ty: c.top - root.top + ROW });
    });
    return () => cancelAnimationFrame(raf);
  }, [seen]);

  let cards = [...START];
  // The new field lands under the first question; then "What do you need?" moves up above it.
  if (shown >= 2) cards = [cards[0]!, NEW, ...cards.slice(1)];
  if (shown >= 4) cards = [cards[0]!, cards[3]!, cards[1]!, cards[2]!, ...cards.slice(4)];
  const lifted = shown === 3 ? "need" : null;
  const order = cards.map((c) => c.id);
  const all = [...START, NEW];

  return (
    <div ref={ref} className="fk-dd" data-compact={compact || undefined}>
      <SceneFrame title="Builder · Client intake" label="Dragging a field onto the form, then moving a question" right={<span className="fk-dd-saved">Saved</span>}>
        <div className="fk-dd-body">
          <div className="fk-dd-lib" aria-hidden>
            <span className="fk-dd-lib-head">Fields</span>
            {TILES.map((t, i) => (
              <span
                key={t.t}
                ref={i === DRAGGED ? tile : undefined}
                className="fk-dd-tile"
                data-on={(i === DRAGGED && (shown === 0 || shown === 1)) || undefined}
              >
                <t.icon size={13} strokeWidth={2} /> {t.t}
              </span>
            ))}
          </div>

          <div ref={canvas} className="fk-dd-canvas" style={{ height: 5 * ROW }}>
            {all.map((c) => {
              const i = order.indexOf(c.id);
              if (i < 0) return null;
              const up = c.id === lifted;
              return (
                <div
                  key={c.id}
                  className="fk-dd-card"
                  data-new={(c.id === NEW.id && shown === 2) || undefined}
                  data-lifted={up || undefined}
                  style={{ transform: `translateY(${(up ? 0.6 : i) * ROW}px)${up ? " scale(1.03)" : ""}` }}
                >
                  <GripVertical size={14} strokeWidth={2} className="fk-dd-grip" aria-hidden />
                  <span className="fk-dd-n">{i + 1}</span>
                  <span className="fk-dd-q">{c.q}</span>
                  <span className="fk-dd-type">
                    <c.icon size={12} strokeWidth={2} aria-hidden /> {c.type}
                  </span>
                </div>
              );
            })}
            <span className="fk-dd-line" data-on={shown === 1 || shown === 3 || undefined} style={{ top: ROW - 5 }} aria-hidden />
          </div>

          <span
            className="fk-dd-ghost"
            data-on={shown === 1 || undefined}
            style={{
              left: from.x,
              top: from.y,
              transform: shown === 1 ? `translate(${from.tx - from.x}px, ${from.ty - from.y}px) rotate(-2deg)` : "none",
            }}
            aria-hidden
          >
            <FileUp size={13} strokeWidth={2} /> File upload
          </span>
        </div>
      </SceneFrame>
    </div>
  );
}
