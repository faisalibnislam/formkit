"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BatteryFull, Eye, Lock, Monitor, RotateCcw, Smartphone, Tablet, Wifi, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, IconButton, Portal, Segmented } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { FormRunner, type OpenForm, type SubmitArgs } from "@/components/live/FormRunner";
import { themeOf } from "../editor/themes";

/**
 * Preview runs the real form — the same runner as the public link — inside a
 * desktop, tablet or phone frame. Sending it records a response, marked as a
 * preview, so the whole path can be checked end to end. Nothing here needs
 * the form to be published.
 */

type Device = "desktop" | "tablet" | "mobile";

export function PreviewOverlay({
  formId,
  device: initialDevice = "desktop",
  closed = false,
  onClose,
}: {
  formId: Id<"forms">;
  device?: Device;
  closed?: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const data = useQuery(api.publicForm.preview, { formId });
  const submit = useMutation(api.publicForm.submitPreview);
  const uploadUrl = useMutation(api.publicForm.uploadUrl);
  const [device, setDevice] = useState<Device>(initialDevice);
  const [run, setRun] = useState(0);
  const [clock, setClock] = useState("");
  const frame = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const read = () =>
      setClock(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/\s?(AM|PM)$/i, ""));
    const first = window.setTimeout(read, 0);
    const t = window.setInterval(read, 30_000);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [onClose]);

  const onSubmit = useCallback(
    async (args: SubmitArgs) => {
      const r = await submit({
        formId,
        answers: args.answers,
        durationMs: args.durationMs,
        device: device === "mobile" ? "Phone" : device === "tablet" ? "Tablet" : "Desktop",
      });
      toast("Response recorded", { detail: "It is in Responses, marked as a preview" });
      return r;
    },
    [device, formId, submit, toast],
  );

  const upload = useCallback(
    async (file: File) => {
      const url = await uploadUrl({});
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      return ((await res.json()) as { storageId: Id<"_storage"> }).storageId;
    },
    [uploadUrl],
  );

  const theme = themeOf(data?.theme ?? null);
  const url = data?.url ?? "";

  return (
    <Portal>
      <div className="fk-preview" role="dialog" aria-modal="true" aria-label="Preview">
        <div className="fk-preview-bar">
          <Badge>
            <Eye size={13} strokeWidth={1.8} aria-hidden /> Preview
          </Badge>
          <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-.01em" }}>{data?.title}</span>
          {closed && <Badge tone="neutral">Closed screen</Badge>}
          <span style={{ flex: 1, minWidth: 10 }} />
          <Segmented
            ariaLabel="Preview device"
            value={device}
            onChange={setDevice}
            options={[
              { value: "desktop", title: "Desktop", icon: <Monitor size={16} strokeWidth={1.8} aria-hidden /> },
              { value: "tablet", title: "Tablet", icon: <Tablet size={16} strokeWidth={1.8} aria-hidden /> },
              { value: "mobile", title: "Mobile", icon: <Smartphone size={16} strokeWidth={1.8} aria-hidden /> },
            ]}
          />
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<RotateCcw size={15} strokeWidth={1.8} aria-hidden />}
            onClick={() => setRun((n) => n + 1)}
          >
            Start again
          </Button>
          <IconButton label="Close preview" onClick={onClose}>
            <X size={18} strokeWidth={1.8} aria-hidden />
          </IconButton>
        </div>

        <div className="fk-preview-stage">
          <div className="fk-preview-device" data-device={device}>
            {device === "desktop" && (
              <div className="fk-preview-chrome">
                <span className="fk-preview-lights">
                  <span style={{ background: "#ff5f57" }} />
                  <span style={{ background: "#febc2e" }} />
                  <span style={{ background: "#28c840" }} />
                </span>
                <span className="fk-preview-url">
                  <Lock size={12} strokeWidth={1.8} aria-hidden />
                  <span>{url}</span>
                </span>
                <span style={{ width: 54, flex: "0 0 auto" }} />
              </div>
            )}
            {device === "tablet" && (
              <div className="fk-preview-camera">
                <span />
              </div>
            )}
            {device === "mobile" && (
              <div className="fk-preview-status" style={{ background: theme.bg, color: theme.text }}>
                <span style={{ flex: 1, opacity: 0.75 }}>{clock}</span>
                <span className="fk-preview-notch" />
                <span style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: 5, opacity: 0.75 }}>
                  <Wifi size={13} strokeWidth={1.8} aria-hidden />
                  <BatteryFull size={15} strokeWidth={1.8} aria-hidden />
                </span>
              </div>
            )}
            <div className="fk-preview-frame" ref={frame}>
              {data && (
                <FormRunner
                  key={`${run}-${closed}`}
                  data={data as OpenForm}
                  mode="preview"
                  closed={closed}
                  onSubmit={onSubmit}
                  upload={upload}
                  scrollRoot={frame}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
