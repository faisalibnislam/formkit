"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "./i18n";

/**
 * A signature: drawn with a finger, mouse or pen, and the signer's typed
 * name beside it, which stays the record of who signed. The drawing is sent
 * as a PNG once each stroke ends; Clear takes it away again.
 */
export function SignaturePad({
  name,
  drawn,
  failed,
  accent,
  radius,
  label,
  onName,
  onDrawing,
  onClear,
  inputProps,
}: {
  name: string;
  drawn: boolean;
  failed?: boolean;
  accent: string;
  radius: number;
  label: string;
  onName: (name: string) => void;
  onDrawing: (file: File) => void;
  onClear: () => void;
  inputProps: Record<string, unknown>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [inked, setInked] = useState(false);
  const tx = useT();

  // Sharp on high-density screens: the bitmap matches the drawn size.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * ratio);
    c.height = Math.round(height * ratio);
    const g = c.getContext("2d");
    if (!g) return;
    g.scale(ratio, ratio);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = 2.4;
    g.strokeStyle = "#21282E";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function finish() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    canvas.current?.toBlob((blob) => {
      if (blob) onDrawing(new File([blob], "signature.png", { type: "image/png" }));
    }, "image/png");
  }

  function clear() {
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setInked(false);
    onClear();
  }

  return (
    <div className="fk-sign">
      <div className="fk-sign-pad" style={{ borderRadius: radius }}>
        <canvas
          ref={canvas}
          role="img"
          aria-label={`Sign here with a finger, mouse or pen, for ${label}`}
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            last.current = point(e);
          }}
          onPointerMove={(e) => {
            if (!drawing.current || !last.current) return;
            const g = canvas.current?.getContext("2d");
            const p = point(e);
            if (!g) return;
            g.beginPath();
            g.moveTo(last.current.x, last.current.y);
            g.lineTo(p.x, p.y);
            g.stroke();
            last.current = p;
            if (!inked) setInked(true);
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
        />
        {!inked && !drawn && <span className="fk-sign-hint">{tx("signHere")}</span>}
        {(inked || drawn) && (
          <button type="button" className="fk-sign-clear" onClick={clear} style={{ color: accent }}>
            {tx("clear")}
          </button>
        )}
      </div>
      {failed && <p className="fk-live-error">That signature did not save. Clear it and sign again.</p>}
      <input
        {...inputProps}
        className="fk-sign-name"
        autoComplete="name"
        placeholder={tx("typeName")}
        value={name}
        onChange={(e) => onName(e.target.value)}
      />
    </div>
  );
}
