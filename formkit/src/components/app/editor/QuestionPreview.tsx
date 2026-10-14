"use client";

import { ChevronDown, Mic, Paperclip, PenLine, Star } from "lucide-react";
import { fieldType } from "./fieldTypes";
import { voiceLabel, voiceLength } from "../../../../convex/model/voice";

/**
 * What a question looks like, drawn in the builder canvas.
 *
 * These are not live controls - they are the shape of the answer, so the person
 * building the form recognises it without opening a preview.
 */
export function QuestionPreview({
  type,
  options,
  scaleMin,
  scaleMax,
  maxSeconds,
  imageUrl,
  alt,
  videoUrl,
}: {
  type: string | null;
  options?: string[] | null;
  scaleMin?: number | null;
  scaleMax?: number | null;
  maxSeconds?: number | null;
  /** Content blocks. */
  imageUrl?: string | null;
  alt?: string | null;
  videoUrl?: string | null;
}) {
  const shape = fieldType(type).preview;
  const choices = (options ?? []).slice(0, 4);

  // Content: the text is the card's title and help; a picture or a video shows as itself.
  if (shape === "statement") return null;
  if (shape === "image") {
    return imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element -- a stored upload, already sized by the browser
      <img src={imageUrl} alt={alt ?? ""} className="fk-ghost-image" />
    ) : (
      <div className="fk-ghost" data-tall="true" style={{ display: "grid", placeItems: "center", fontSize: 13 }}>
        Add a picture in its settings
      </div>
    );
  }
  if (shape === "video") {
    return (
      <div className="fk-ghost" data-tall="true" style={{ display: "grid", placeItems: "center", fontSize: 13 }}>
        {videoUrl ? `Video: ${videoUrl}` : "Paste a YouTube or Vimeo link in its settings"}
      </div>
    );
  }

  if (shape === "textarea") return <div className="fk-ghost" data-tall="true" />;

  if (shape === "choice" || shape === "multi") {
    return (
      <>
        {(choices.length ? choices : ["First option", "Second option"]).map((o, i) => (
          <span key={i} className="fk-ghost-choice">
            <span className="fk-ghost-dot" data-square={shape === "multi" ? "true" : undefined} />
            {o}
          </span>
        ))}
        {(options?.length ?? 0) > 4 && (
          <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
            and {options!.length - 4} more
          </span>
        )}
      </>
    );
  }

  if (shape === "yesno") {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <span className="fk-chip">Yes</span>
        <span className="fk-chip">No</span>
      </div>
    );
  }

  if (shape === "dropdown") {
    return (
      <div
        className="fk-ghost"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", fontSize: 14.5, color: "var(--color-text-tertiary)" }}
      >
        {choices[0] ?? "Choose one"}
        <ChevronDown size={16} strokeWidth={1.8} aria-hidden />
      </div>
    );
  }

  if (shape === "rating") {
    return (
      <div style={{ display: "flex", gap: 6, color: "var(--neutral-300)" }}>
        {Array.from({ length: scaleMax ?? 5 }).map((_, i) => (
          <Star key={i} size={22} strokeWidth={1.6} aria-hidden />
        ))}
      </div>
    );
  }

  if (shape === "scale") {
    const from = scaleMin ?? 1;
    const to = scaleMax ?? 5;
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Array.from({ length: Math.max(0, to - from + 1) }).map((_, i) => (
          <span key={i} className="fk-chip" style={{ minWidth: 34, textAlign: "center" }}>
            {from + i}
          </span>
        ))}
      </div>
    );
  }

  if (shape === "file") {
    return (
      <div className="fk-ghost" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 18px", fontSize: 14, color: "var(--color-text-tertiary)" }}>
        <Paperclip size={16} strokeWidth={1.8} aria-hidden />
        A file upload
      </div>
    );
  }

  if (shape === "voice") {
    return (
      <div className="fk-ghost" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 18px", fontSize: 14, color: "var(--color-text-tertiary)" }}>
        <Mic size={16} strokeWidth={1.8} aria-hidden />
        Record a voice answer, up to {voiceLabel(voiceLength(maxSeconds))}
      </div>
    );
  }

  if (shape === "hidden") {
    return (
      <div className="fk-ghost" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 18px", fontSize: 14, color: "var(--color-text-tertiary)" }}>
        Never shown. Filled from the link, or its default
      </div>
    );
  }

  if (shape === "signature") {
    return (
      <div className="fk-ghost" data-tall="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--color-text-tertiary)", fontSize: 14 }}>
        <PenLine size={16} strokeWidth={1.8} aria-hidden />
        Sign here
      </div>
    );
  }

  return <div className="fk-ghost" />;
}
