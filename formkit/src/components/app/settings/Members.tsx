"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { FileText, Mail, UserMinus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, IconButton, Modal, Select } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { initials } from "../ds";
import { relativeTime } from "../bits";
import { Panel } from "./bits";

/**
 * Settings → Sharing. Every form belongs to its owner and access is granted
 * one form at a time from Share; this is the view across all of them, where a
 * role change or a removal applies to every form at once.
 */

const ROLES = [
  { value: "editor", label: "Editor" },
  { value: "commenter", label: "Commenter" },
  { value: "viewer", label: "Viewer" },
];

const GUIDE = [
  { role: "You", note: "The owner. Everything, including deleting the form and managing access." },
  {
    role: "Editor",
    note: "Add, edit and reorder questions, and read this form’s responses from their own account. Cannot manage access.",
  },
  { role: "Commenter", note: "Read the form and leave comments. No edits." },
  { role: "Viewer", note: "Read the form and its responses. Nothing else." },
];

export function MembersSection() {
  const toast = useToast();
  const data = useQuery(api.collaborators.people, {});
  const shared = useQuery(api.collaborators.sharedWithMe, {});
  const setRole = useMutation(api.collaborators.setRoleEverywhere);
  const removeAll = useMutation(api.collaborators.removeEverywhere);
  const resend = useMutation(api.collaborators.resend);
  const revoke = useMutation(api.collaborators.remove);
  const [removing, setRemoving] = useState<{ key: string; name: string; forms: number } | null>(null);

  const people = data?.people ?? [];
  const pending = data?.pending ?? [];

  return (
    <>
      <Panel
        title="People you share with"
        lede="Every form belongs to you. Access is granted one form at a time. Open a form and use Share. Changing someone's role here changes it on every form you have shared with them."
      >
        {data && people.length === 0 ? (
          <p className="fk-setpanel-empty">Nobody else can see your forms. Open a form and use Share to invite someone.</p>
        ) : (
          <div className="fk-people">
            {people.map((p) => (
              <div key={p.key} className="fk-person">
                <span className="fk-person-avatar" style={{ background: p.color }} aria-hidden>
                  {initials(p.name ?? p.email)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fk-person-name">{p.name ?? p.email}</div>
                  {p.name && <div className="fk-person-mail">{p.email}</div>}
                  <div className="fk-person-forms">
                    <FileText size={14} strokeWidth={1.8} aria-hidden />
                    <span>
                      {p.forms.length} {p.forms.length === 1 ? "form" : "forms"}
                    </span>
                    {p.forms.slice(0, 3).map((f) => (
                      <Link key={f.collaboratorId} href={`/app/forms/${f.formId}`} title={`${f.title} · ${f.role}`}>
                        {f.title}
                      </Link>
                    ))}
                    {p.forms.length > 3 && <span>+{p.forms.length - 3} more</span>}
                  </div>
                </div>
                <Select
                  size="sm"
                  ariaLabel={`Role for ${p.name ?? p.email}`}
                  value={p.role === "mixed" ? null : p.role}
                  placeholder="Mixed roles"
                  options={ROLES}
                  onChange={async (role) => {
                    const n = await setRole({ key: p.key, role: role as "editor" | "commenter" | "viewer" });
                    toast(`${p.name ?? p.email} is now ${role === "editor" ? "an Editor" : role === "commenter" ? "a Commenter" : "a Viewer"}`, {
                      detail: n ? `On ${n} ${n === 1 ? "form" : "forms"}` : "Nothing needed changing",
                    });
                  }}
                />
                <IconButton
                  tip
                  label="Revoke all access"
                  tone="danger"
                  onClick={() => setRemoving({ key: p.key, name: p.name ?? p.email, forms: p.forms.length })}
                >
                  <UserMinus size={16} strokeWidth={1.8} aria-hidden />
                </IconButton>
              </div>
            ))}
          </div>
        )}
        <div className="fk-setpanel-actions">
          <Link href="/app/forms">
            <Button iconLeft={<FileText size={16} strokeWidth={1.8} aria-hidden />}>Open a form to share</Button>
          </Link>
        </div>
      </Panel>

      {pending.length > 0 && (
        <Panel title="Pending invitations" aside={<Badge>{pending.length}</Badge>}>
          <div className="fk-people">
            {pending.map((i) => (
              <div key={i._id} className="fk-person">
                <span className="fk-person-avatar" data-kind="mail" aria-hidden>
                  <Mail size={16} strokeWidth={1.8} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fk-person-name">{i.email}</div>
                  <div className="fk-person-mail">
                    {i.role[0]!.toUpperCase() + i.role.slice(1)} on {i.formTitle} · sent {relativeTime(i.invitedAt)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await resend({ collaboratorId: i._id as Id<"collaborators"> });
                    toast("Invitation sent again", { detail: i.email });
                  }}
                >
                  Resend
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await revoke({ collaboratorId: i._id as Id<"collaborators"> });
                    toast("Invitation revoked", { detail: i.email });
                  }}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="What each role can do">
        <div className="fk-roleguide">
          {GUIDE.map((r) => (
            <div key={r.role}>
              <span className="fk-roleguide-role">{r.role}</span>
              <span className="fk-roleguide-note">{r.note}</span>
            </div>
          ))}
        </div>
      </Panel>

      {(shared ?? []).length > 0 && (
        <Panel title="Forms shared with you" lede="Other people put you on these from their own Share panel.">
          <div className="fk-people">
            {(shared ?? []).map((s) => (
              <Link key={s._id} href={`/app/forms/${s.formId}`} className="fk-person" data-link="true">
                <span className="fk-person-avatar" data-kind="mail" aria-hidden>
                  <FileText size={16} strokeWidth={1.8} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fk-person-name">{s.title}</div>
                  <div className="fk-person-mail">
                    {s.owner} · you are {s.role === "editor" ? "an" : "a"} {s.role}
                  </div>
                </div>
                <Badge tone={s.status === "active" ? "success" : "warning"}>
                  {s.status === "active" ? "Active" : "Pending"}
                </Badge>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      {removing && (
        <Modal
          title={`Remove ${removing.name}?`}
          description={`They lose access to ${removing.forms === 1 ? "the one form" : `all ${removing.forms} forms`} you shared with them. You can invite them again from any form.`}
          onClose={() => setRemoving(null)}
          width={460}
          footer={
            <>
              <Button variant="secondary" onClick={() => setRemoving(null)}>
                Keep them
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  const r = removing;
                  setRemoving(null);
                  await removeAll({ key: r.key });
                  toast("Access removed", { detail: r.name });
                }}
              >
                Remove everywhere
              </Button>
            </>
          }
        >
          {null}
        </Modal>
      )}
    </>
  );
}
