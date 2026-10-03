"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Code2, Copy, Download, Link2, QrCode } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, Input, Modal, PillTabs, Segmented } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/** The QR encoder, fetched when the dialog first draws a code. */
const loadQr = () => import("qrcode").then((m) => m.default);

/**
 * Share owns the public link and nothing else: the URL, the QR code, the
 * embed snippet and the claimed-handle note.
 *
 * There is no on/off switch here - whether a form collects is decided by
 * Publish (and Close), and the shape of the link by a claimed handle. A third
 * control in this panel is what made the three read as one thing, and it was
 * removed deliberately.
 */

type Kind = "inline" | "popup" | "fullscreen";

export function ShareDialog({ formId, onClose }: { formId: Id<"forms">; onClose: () => void }) {
  const form = useQuery(api.forms.get, { formId });
  const claim = useMutation(api.companies.claim);
  const toast = useToast();

  const [tab, setTab] = useState<"link" | "qr" | "embed">("link");
  const [kind, setKind] = useState<Kind>("inline");
  const [handle, setHandle] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://formkit.app");

  const url = form ? `https://${form.url}` : "";

  useEffect(() => {
    const t = window.setTimeout(() => setOrigin(window.location.origin), 0);
    return () => window.clearTimeout(t);
  }, []);

  // Drawn here, from the live link, so nobody else is ever sent the URL. The
  // code carries ?src=qr so Analytics can tell scans from clicks.
  const qrUrl = url ? `${url}${url.includes("?") ? "&" : "?"}src=qr` : url;
  useEffect(() => {
    if (!qrUrl) return;
    let alive = true;
    loadQr()
      .then((QRCode) =>
        QRCode.toString(qrUrl, { type: "svg", margin: 1, color: { dark: "#21282E", light: "#ffffff" } }),
      )
      .then((svg) => {
        if (alive) setQr(svg);
      })
      .catch(() => {
        if (alive) setQr(null);
      });
    return () => {
      alive = false;
    };
  }, [qrUrl]);

  const script = "scr" + "ipt";
  const embed = {
    inline: `<iframe src="${url}" title="${form?.title ?? "Form"}" width="100%" height="720" style="border:0" loading="lazy"></iframe>`,
    popup: `<${script} src="${origin}/embed.js" data-form="${url}" data-mode="popup" data-label="Open the form" async></${script}>`,
    fullscreen: `<${script} src="${origin}/embed.js" data-form="${url}" data-mode="fullscreen" async></${script}>`,
  }[kind];

  async function copy(what: string, value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      toast(message);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      toast("Formkit could not reach the clipboard", {
        detail: "Select the text and copy it by hand.",
        tone: "error",
      });
    }
  }

  async function downloadQr() {
    if (!form) return;
    const QRCode = await loadQr();
    const png = await QRCode.toDataURL(qrUrl, {
      width: 1024,
      margin: 2,
      color: { dark: "#21282E", light: "#ffffff" },
    });
    const a = document.createElement("a");
    a.href = png;
    a.download = `${form.slug}-qr.png`;
    a.click();
    toast("QR downloaded", { detail: `${form.slug}-qr.png` });
  }

  const identityName = form?.identity?.name ?? "you";
  const claimed = !!form?.identity?.handle;
  const [host, ...path] = (form?.url ?? "").split("/");
  const live = form?.status === "published";

  return (
    <Modal
      title={live ? "Your form is live" : "Your form is ready"}
      description={
        live
          ? "Anyone with the link can answer it now."
          : form?.status === "closed"
            ? "It is closed, so the link shows your closing message until you reopen it."
            : "Share the link, or embed it on your own site. It starts collecting once you publish."
      }
      onClose={onClose}
      width={580}
    >
      <div style={{ marginBottom: 22 }}>
        <PillTabs
          ariaLabel="How to share"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "link", label: "Link", icon: <Link2 size={15} strokeWidth={1.8} aria-hidden /> },
            { value: "qr", label: "QR code", icon: <QrCode size={15} strokeWidth={1.8} aria-hidden /> },
            { value: "embed", label: "Embed", icon: <Code2 size={15} strokeWidth={1.8} aria-hidden /> },
          ]}
        />
      </div>

      {tab === "link" && (
        <div>
          <div className="fk-sharelink">
            <Link2 size={17} strokeWidth={1.9} aria-hidden style={{ color: "var(--color-text-tertiary)" }} />
            <span className="fk-sharelink-url" title={url}>
              <span style={{ color: "var(--color-text-tertiary)" }}>{host}/</span>
              <span>{path.join("/")}</span>
            </span>
            <button
              type="button"
              className="fk-sharelink-copy"
              onClick={() => copy("link", url, "Link copied")}
            >
              {copied === "link" ? (
                <Check size={15} strokeWidth={2} aria-hidden />
              ) : (
                <Copy size={15} strokeWidth={1.8} aria-hidden />
              )}
              {copied === "link" ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="fk-proprow-hint" style={{ margin: "16px 0 0", fontSize: 14, lineHeight: 1.55 }}>
            Anyone with this link can answer. Add a password in Settings if you would rather keep it
            private.
          </p>
          <p className="fk-proprow-hint" style={{ margin: "10px 0 0", lineHeight: 1.55 }}>
            {claimed
              ? `This form is published under ${identityName}, so its links sit at formkit.app/${form?.identity?.handle}. Change that under Design → Branding.`
              : `No link is claimed for ${identityName} yet. Claim one and this becomes formkit.app/your-name/${form?.slug}.`}
          </p>

          {!claimed && form && (
            <div className="fk-claim">
              <Input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="your-name"
                aria-label="A name for your links"
                inputSize="sm"
                wrapStyle={{ flex: 1, minWidth: 160 }}
              />
              <Button
                size="sm"
                disabled={handle.trim().length < 3}
                onClick={async () => {
                  try {
                    await claim({ handle, owner: form.brand });
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
          )}
        </div>
      )}

      {tab === "qr" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div
            className="fk-qr"
            role="img"
            aria-label={`QR code for ${url}`}
            dangerouslySetInnerHTML={qr ? { __html: qr } : undefined}
          />
          <p className="fk-proprow-hint" style={{ margin: 0, fontSize: 14, textAlign: "center", maxWidth: "44ch" }}>
            Point a camera at it and the form opens. Good for a poster, a table card or a
            conference badge.
          </p>
          <Button
            variant="secondary"
            iconLeft={<Download size={16} strokeWidth={1.8} aria-hidden />}
            onClick={downloadQr}
          >
            Download QR
          </Button>
        </div>
      )}

      {tab === "embed" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Segmented
            ariaLabel="How the form sits on your page"
            value={kind}
            onChange={setKind}
            options={[
              { value: "inline", label: "Inline" },
              { value: "popup", label: "Popup" },
              { value: "fullscreen", label: "Full screen" },
            ]}
          />
          <p className="fk-proprow-hint" style={{ margin: 0, fontSize: 13.5 }}>
            {kind === "inline"
              ? "The form sits in the page where you paste this, 720 pixels tall. Change the height to suit."
              : kind === "popup"
                ? "A button that opens the form over your page. Change the label to whatever you like."
                : "The form fills the window as soon as the page loads, with a close button."}
          </p>
          <pre className="fk-embedcode">{embed}</pre>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              iconLeft={
                copied === "embed" ? (
                  <Check size={16} strokeWidth={2} aria-hidden />
                ) : (
                  <Copy size={16} strokeWidth={1.8} aria-hidden />
                )
              }
              onClick={() => copy("embed", embed, "Embed code copied")}
            >
              {copied === "embed" ? "Copied" : "Copy embed code"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
