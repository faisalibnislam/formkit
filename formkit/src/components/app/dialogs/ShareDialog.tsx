"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Code2, Copy, Link2, QrCode } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, Field, Input, Modal, PillTabs, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/**
 * Share owns the public link and nothing else.
 *
 * There is no on/off switch here — whether a form collects is decided by
 * Publish, and the shape of the link by a claimed handle. Putting a third
 * control in this panel is what made the three read as one thing, and it was
 * removed deliberately.
 */
export function ShareDialog({ formId, onClose }: { formId: Id<"forms">; onClose: () => void }) {
  const form = useQuery(api.forms.get, { formId });
  const viewer = useQuery(api.users.viewer, {});
  const claim = useMutation(api.companies.claim);
  const toast = useToast();

  const [tab, setTab] = useState<"link" | "embed" | "qr">("link");
  const [handle, setHandle] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const url = form ? `https://${form.url}` : "";
  const embed = `<iframe src="${url}" title="${form?.title ?? "Form"}" style="width:100%;height:760px;border:0" loading="lazy"></iframe>`;

  async function copy(what: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      toast("Formkit could not reach the clipboard", {
        detail: "Select the text and copy it by hand.",
        tone: "error",
      });
    }
  }

  const unclaimed = form?.brand === "me" ? !viewer?.handle : form?.url.includes("/f/");

  return (
    <Modal
      title="Share this form"
      description={
        form?.status === "published"
          ? "Anyone with this link can answer."
          : "This form is not collecting yet — publish it and the link goes live."
      }
      onClose={onClose}
      width={580}
    >
      <PillTabs
        ariaLabel="How to share"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "link", label: "Link", icon: <Link2 size={15} strokeWidth={1.8} aria-hidden /> },
          { value: "embed", label: "Embed", icon: <Code2 size={15} strokeWidth={1.8} aria-hidden /> },
          { value: "qr", label: "QR code", icon: <QrCode size={15} strokeWidth={1.8} aria-hidden /> },
        ]}
      />

      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 18 }}>
        {tab === "link" && (
          <>
            <Field label="Public link">
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} wrapStyle={{ flex: 1 }} />
                <Button
                  variant="secondary"
                  onClick={() => copy("link", url)}
                  iconLeft={
                    copied === "link" ? (
                      <Check size={15} strokeWidth={1.8} aria-hidden />
                    ) : (
                      <Copy size={15} strokeWidth={1.8} aria-hidden />
                    )
                  }
                >
                  {copied === "link" ? "Copied" : "Copy"}
                </Button>
              </div>
            </Field>

            {unclaimed && (
              <div className="fk-note" data-tone="info" style={{ display: "block" }}>
                <p style={{ margin: "0 0 12px" }}>
                  Claim a name and this form moves to{" "}
                  <strong>formkit.app/your-name/{form?.slug}</strong>. One name covers every
                  form you publish under this identity.
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <Input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="your-name"
                    inputSize="sm"
                    style={{ flex: 1, minWidth: 160 }}
                  />
                  <Button
                    size="sm"
                    disabled={handle.trim().length < 3}
                    onClick={async () => {
                      try {
                        await claim({
                          handle,
                          owner: form?.brand ?? "me",
                        });
                        toast(`formkit.app/${handle.trim().toLowerCase()} is yours`);
                        setHandle("");
                      } catch (e) {
                        toast("That name could not be claimed", {
                          detail: e instanceof Error ? e.message : undefined,
                          tone: "error",
                        });
                      }
                    }}
                  >
                    Claim it
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "embed" && (
          <Field
            label="Paste this where the form should appear"
            help="It resizes to its container. Set your own height if 760 pixels is not right."
          >
            <Textarea rows={4} readOnly value={embed} onFocus={(e) => e.currentTarget.select()} />
            <div style={{ marginTop: 10 }}>
              <Button variant="secondary" size="sm" onClick={() => copy("embed", embed)}>
                {copied === "embed" ? "Copied" : "Copy the code"}
              </Button>
            </div>
          </Field>
        )}

        {tab === "qr" && (
          <div style={{ textAlign: "center" }}>
            {/* Generated by the same public service the print sheet uses, so the
                code always matches the live link rather than a cached image. */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(url)}`}
              alt={`QR code for ${url}`}
              width={260}
              height={260}
              style={{ borderRadius: 20, background: "var(--neutral-0)" }}
            />
            <p style={{ marginTop: 12, fontSize: 14, color: "var(--color-text-tertiary)" }}>
              Point a camera at it and the form opens. Good for a poster, a table card or a
              conference badge.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
