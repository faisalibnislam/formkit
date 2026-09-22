"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Trash2, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/**
 * Putting a picture on an account or a company.
 *
 * The file never passes through a mutation: Convex hands out a one-use URL, the
 * browser posts straight to it, and only the storage id that comes back is
 * written down. The old file is deleted by the mutation that replaces it, so
 * nothing is orphaned.
 *
 * The cap is 5 MB and the reason is stated rather than the upload simply
 * failing. Uploads elsewhere in Formkit — a respondent's attachment — are
 * capped at 10 MB; a logo has no business being that large.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export function ImageUpload({
  preview,
  hasImage,
  label,
  help,
  onUploaded,
  onCleared,
}: {
  /** What the picture looks like now — an avatar, or a logo plate. */
  preview: ReactNode;
  hasImage: boolean;
  label: string;
  help?: string;
  onUploaded: (storageId: Id<"_storage">) => Promise<unknown>;
  onCleared: () => Promise<unknown>;
}) {
  const toast = useToast();
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!TYPES.includes(file.type)) {
      toast("That file is not an image", {
        detail: "PNG, JPEG, WebP or SVG.",
        tone: "error",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast("That image is too large", {
        detail: `The limit is 5 MB, and this one is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
        tone: "error",
      });
      return;
    }

    setBusy(true);
    try {
      const url = await generateUploadUrl({});
      const sent = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!sent.ok) throw new Error(`The upload was refused (${sent.status}).`);
      const { storageId } = (await sent.json()) as { storageId: Id<"_storage"> };
      await onUploaded(storageId);
      toast(`${label} updated`);
    } catch (error) {
      // Naming what went wrong rather than leaving the picture unchanged and
      // silent about it.
      toast(`${label} was not saved`, {
        detail: error instanceof Error ? error.message : "Try again in a moment.",
        tone: "error",
      });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="fk-upload">
      {preview}
      <div className="fk-upload-actions">
        <input
          ref={input}
          type="file"
          accept={TYPES.join(",")}
          className="fk-visually-hidden"
          aria-label={`Choose an image for ${label.toLowerCase()}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            iconLeft={<Upload size={15} strokeWidth={1.8} aria-hidden />}
            onClick={() => input.current?.click()}
          >
            {busy ? "Uploading…" : hasImage ? "Replace" : "Upload"}
          </Button>
          {hasImage && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              iconLeft={<Trash2 size={15} strokeWidth={1.8} aria-hidden />}
              onClick={async () => {
                setBusy(true);
                try {
                  await onCleared();
                  toast(`${label} removed`);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remove
            </Button>
          )}
        </div>
        {help && <p className="fk-upload-help">{help}</p>}
      </div>
    </div>
  );
}
