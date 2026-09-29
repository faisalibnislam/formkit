"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, Copy, ExternalLink } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Select } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useViewer } from "@/lib/seed";
import { OwnerMark, type Owner } from "../owners";
import { tracked } from "./saveStatus";

/**
 * Who a form belongs to and where it lives: the company or person it is
 * published under, and its links. The Design and Settings tabs let the owner
 * change it; the publish dialog shows it before and after going live.
 */

type Form = NonNullable<FunctionReturnType<typeof api.forms.get>>;

export function ownerOfForm(form: Form): Owner {
  return {
    key: form.brand,
    kind: form.identity.kind,
    name: form.identity.name,
    imageUrl: form.identity.markUrl ?? form.identity.logoUrl,
  };
}

/** The picker: the person, or one of their companies. */
export function PublishedUnderPicker({ formId, form }: { formId: Id<"forms">; form: Form }) {
  const toast = useToast();
  const viewer = useViewer();
  const update = useMutation(api.forms.update);
  const companies = viewer?.companies ?? [];
  // Only the owner can move a form between their own names.
  if (!viewer || companies.length === 0 || !form.mine) return null;
  const me: Owner = { key: "me", kind: "me", name: viewer.name ?? "You", imageUrl: viewer.image ?? null };

  return (
    <div>
      <Select
        size="sm"
        ariaLabel="Published under"
        value={form.brand}
        onChange={async (v) => {
          await tracked(update({ formId, patch: { brand: v === "me" ? "me" : (v as Id<"companies">) } }));
          const co = companies.find((c) => c._id === v);
          toast(`Published under ${co ? co.name : "your own name"}`, {
            detail:
              co && !co.handle ? "It has no link claimed yet, so this form shares from formkit.app/f/" : undefined,
          });
        }}
        options={[
          { value: "me", label: `${me.name} (you)`, icon: <OwnerMark owner={me} size={20} />, group: "Personal" },
          ...companies.map((c) => ({
            value: c._id,
            label: c.name || "Untitled company",
            icon: (
              <OwnerMark owner={{ key: c._id, kind: "company", name: c.name, imageUrl: c.markUrl ?? c.logoUrl }} size={20} />
            ),
            group: "Companies",
          })),
        ]}
      />
    </div>
  );
}

/** The company or person, and whose account the form is in. */
export function OwnerSummary({ form, action }: { form: Form; action?: React.ReactNode }) {
  const owner = ownerOfForm(form);
  return (
    <div className="fk-pubowner">
      <OwnerMark owner={owner} size={40} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="fk-pubowner-name">{owner.name}</span>
        <span className="fk-pubowner-meta">
          {owner.kind === "company" ? "Company" : "Personal"}
          {form.ownerName && (owner.kind === "company" || owner.name !== form.ownerName)
            ? ` · Owned by ${form.ownerName}`
            : ""}
        </span>
      </span>
      {action}
    </div>
  );
}

/** The form's addresses, each with Copy, and Open once it is live. */
export function FormLinks({
  form,
  live,
  label,
  alsoLabel = "Also at",
}: {
  form: Form;
  live: boolean;
  label?: string;
  alsoLabel?: string;
}) {
  const rows = [
    { url: form.links.primary, note: label ?? (live ? "Link" : "Goes live at") },
    ...(form.links.formkit ? [{ url: form.links.formkit, note: alsoLabel }] : []),
  ];
  return (
    <div className="fk-publinks">
      {rows.map((r) => (
        <LinkRow key={r.url} url={r.url} note={r.note} live={live} />
      ))}
    </div>
  );
}

function LinkRow({ url, note, live }: { url: string; note: string; live: boolean }) {
  const [copied, setCopied] = useState(false);
  const full = `https://${url}`;
  return (
    <div className="fk-publink" data-live={live ? "true" : undefined}>
      <span className="fk-publink-note">{note}</span>
      <span className="fk-publink-url" title={full}>
        {url}
      </span>
      <button
        type="button"
        className="fk-publink-btn"
        aria-label={`Copy ${url}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(full);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          } catch {
            /* The address is on screen to select by hand. */
          }
        }}
      >
        {copied ? <Check size={15} strokeWidth={2} aria-hidden /> : <Copy size={15} strokeWidth={1.8} aria-hidden />}
      </button>
      {live && (
        <Link href={full} target="_blank" rel="noopener" className="fk-publink-btn" aria-label={`Open ${url}`}>
          <ExternalLink size={15} strokeWidth={1.8} aria-hidden />
        </Link>
      )}
    </div>
  );
}
