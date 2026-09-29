"use client";

import type { SelectOption } from "@/components/ui";
import { initials } from "./ds";

/**
 * Who a form belongs to: the person, or one of their companies. Lists that
 * span every form (the inbox, analytics) name the owner beside each form and
 * let you narrow to one, since someone running two companies otherwise sees
 * one undifferentiated pile.
 */

export type Owner = { key: string; kind: "me" | "company"; name: string; imageUrl: string | null };
type Owned = { _id: string; title: string; owner: Owner };

/** A company's logo or a person's picture, or their initials. */
export function OwnerMark({ owner, size = 20 }: { owner: Owner; size?: number }) {
  return (
    <span
      className="fk-owner-mark"
      data-kind={owner.kind}
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {owner.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={owner.imageUrl} alt="" />
      ) : (
        initials(owner.name)
      )}
    </span>
  );
}

/** The owner's mark and name, as a quiet line under a form's title. */
export function OwnerLine({ owner }: { owner: Owner }) {
  return (
    <span className="fk-owner-line">
      <OwnerMark owner={owner} size={16} />
      <span>{owner.name}</span>
    </span>
  );
}

/** Everyone who owns one of these forms, the person first, then companies A to Z. */
export function ownersFrom(forms: readonly Owned[] | undefined): Owner[] {
  const seen = new Map<string, Owner>();
  for (const f of forms ?? []) if (!seen.has(f.owner.key)) seen.set(f.owner.key, f.owner);
  return [...seen.values()].sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "me" ? -1 : 1,
  );
}

/** Options for the "Whose forms" picker. */
export function ownerOptions(owners: Owner[], forms: readonly Owned[] | undefined): SelectOption[] {
  const count = (key: string) => (forms ?? []).filter((f) => f.owner.key === key).length;
  return [
    { value: "all", label: "All owners" },
    ...owners.map((o) => {
      const n = count(o.key);
      return {
        value: o.key,
        label: o.name,
        icon: <OwnerMark owner={o} size={20} />,
        note: `${o.kind === "me" ? "You" : "Company"} · ${n} ${n === 1 ? "form" : "forms"}`,
      };
    }),
  ];
}

/**
 * Options for the form picker: only the chosen owner's forms, or every form
 * grouped under its owner's name when there is more than one owner.
 */
export function formOptions(forms: readonly Owned[] | undefined, owner: string, owners: Owner[]): SelectOption[] {
  const list = (forms ?? []).filter((f) => owner === "all" || f.owner.key === owner);
  const grouped = owner === "all" && owners.length > 1;
  const ordered = grouped
    ? owners.flatMap((o) => list.filter((f) => f.owner.key === o.key))
    : list;
  return [
    { value: "all", label: "All forms" },
    ...ordered.map((f) => ({ value: f._id, label: f.title, group: grouped ? f.owner.name : undefined })),
  ];
}
