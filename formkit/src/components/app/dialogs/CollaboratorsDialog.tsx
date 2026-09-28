"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  History,
  Link2,
  LogIn,
  Mail,
  MessageSquare,
  Rocket,
  Send,
  Shield,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, IconButton, Input, Modal, PillTabs, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { relativeTime } from "../bits";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { openUpgrade, upgradeOnPlanError } from "@/components/plan/usePlan";

/**
 * Collaborators owns people, and only people: who can edit, comment or read
 * this form. The link the answering public uses belongs to Share. What each
 * role can do is spelled out rather than left to the word alone.
 */

type Role = "editor" | "commenter" | "viewer";

const ROLES: { value: Role; label: string; note: string }[] = [
  { value: "editor", label: "Editor", note: "Edits the form and reads its responses" },
  { value: "commenter", label: "Commenter", note: "Reads the form and leaves comments" },
  { value: "viewer", label: "Viewer", note: "Reads the form and its responses" },
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

const ACTIVITY_ICONS: Record<string, typeof Users> = {
  "user-plus": UserPlus,
  "user-minus": UserMinus,
  shield: Shield,
  "message-square": MessageSquare,
  check: Check,
  "log-in": LogIn,
  rocket: Rocket,
};

function Face({ name, color, image, size = 40 }: { name: string; color: string; image?: string | null; size?: number }) {
  return (
    <span className="fk-face" style={{ width: size, height: size, background: color, fontSize: size * 0.34 }}>
      {image ? <img src={image} alt="" /> : name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase()}
    </span>
  );
}

export function CollaboratorsDialog({ formId, onClose }: { formId: Id<"forms">; onClose: () => void }) {
  const data = useQuery(api.collaborators.list, { formId });
  const form = useQuery(api.forms.get, { formId });
  const cap = form?.ownerPlan?.limits.collaborators ?? null;
  const activity = useQuery(api.collaborators.activity, { formId });
  const invite = useMutation(api.collaborators.invite);
  const resend = useMutation(api.collaborators.resend);
  const setRole = useMutation(api.collaborators.setRole);
  const remove = useMutation(api.collaborators.remove);
  const joinLink = useMutation(api.collaborators.joinLink);
  const toast = useToast();

  const [tab, setTab] = useState<"people" | "activity">("people");
  const [email, setEmail] = useState("");
  const [role, setRoleValue] = useState<Role>("editor");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const owner = data?.owner;
  const manage = data?.myRole === "owner";
  const active = (data?.people ?? []).filter((p) => p.status === "active");
  const pending = (data?.people ?? []).filter((p) => p.status === "pending");

  async function send() {
    setBusy(true);
    try {
      await invite({ formId, email, role, note: note.trim() || undefined });
      toast("Invitation sent", { detail: email.trim() });
      setEmail("");
      setNote("");
    } catch (e) {
      if (upgradeOnPlanError(e)) return;
      toast("That invitation did not go out", {
        detail: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      const { url } = await joinLink({ formId, role });
      await navigator.clipboard.writeText(url);
      toast("Invite link copied", {
        detail: `${url.replace(/^https?:\/\//, "")} · joins as ${ROLES.find((r) => r.value === role)?.label}, expires in 7 days`,
      });
    } catch (e) {
      toast("The invite link was not copied", {
        detail: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  }

  return (
    <Modal title="Collaborators" description="Everyone here works on the same form, at the same time." onClose={onClose} width={640}>
      <div style={{ marginBottom: 22 }}>
        <PillTabs
          ariaLabel="Collaborators or activity"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "people", label: "Collaborators", icon: <Users size={15} strokeWidth={1.8} aria-hidden /> },
            { value: "activity", label: "Activity", icon: <History size={15} strokeWidth={1.8} aria-hidden /> },
          ]}
        />
      </div>

      {tab === "people" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {manage && (
            <div className="fk-invite">
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 14, fontWeight: 500 }}>
                Invite someone to this form
                {cap !== null && (
                  <span className="fk-proprow-hint" style={{ fontWeight: 400 }}>
                    {active.length + pending.length} of {cap} people. Unlimited on Pro
                  </span>
                )}
                {cap !== null && active.length + pending.length >= cap && (
                  <ProChip onClick={() => openUpgrade({ feature: "collaborators" })} />
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Input
                  icon={<Mail size={17} strokeWidth={1.8} aria-hidden />}
                  type="email"
                  placeholder="name@company.com"
                  aria-label="Their email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && email.includes("@")) void send();
                  }}
                  wrapStyle={{ flex: 1, minWidth: 220 }}
                />
                <div style={{ width: 170 }}>
                  <Select
                    ariaLabel="Their role"
                    value={role}
                    onChange={(v) => setRoleValue(v as Role)}
                    options={ROLES}
                  />
                </div>
              </div>
              <Textarea
                rows={3}
                placeholder="Adding you to the onboarding form. Can you check the budget question?"
                aria-label="A note with the invitation"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  iconLeft={<Send size={16} strokeWidth={1.8} aria-hidden />}
                  disabled={busy || !email.includes("@")}
                  onClick={send}
                >
                  Send invitation
                </Button>
                <Button variant="secondary" iconLeft={<Link2 size={16} strokeWidth={1.8} aria-hidden />} onClick={copyLink}>
                  Copy invite link
                </Button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>On this form</span>
              <Badge>{String(active.length + 1)}</Badge>
            </div>
            {owner && (
              <div className="fk-person">
                <span style={{ position: "relative", flex: "0 0 auto" }}>
                  <Face name={owner.name} color={owner.color} image={owner.image} />
                  {owner.online && <span className="fk-online" title="Here now" />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>
                    {owner.name}
                    {owner.you ? " (you)" : ""}
                  </div>
                  <div className="fk-proprow-hint" style={{ fontSize: 13.5 }}>
                    {owner.email} · {owner.seen}
                  </div>
                </div>
                <span style={{ fontSize: 14, color: "var(--color-text-tertiary)", paddingRight: 8 }}>Owner</span>
              </div>
            )}
            {active.map((p) => (
              <div key={p._id} className="fk-person">
                <span style={{ position: "relative", flex: "0 0 auto" }}>
                  <Face name={p.name ?? p.email} color={p.color} image={p.image} />
                  {p.online && <span className="fk-online" title="Here now" />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>
                    {p.name ?? p.email}
                    {p.you ? " (you)" : ""}
                  </div>
                  <div className="fk-proprow-hint" style={{ fontSize: 13.5 }}>
                    {p.email} · {p.seen}
                  </div>
                </div>
                {manage ? (
                  <>
                    <div style={{ width: 172, flex: "0 0 auto" }}>
                      <Select
                        size="sm"
                        ariaLabel={`Role for ${p.name ?? p.email}`}
                        value={p.role}
                        options={ROLES}
                        onChange={async (v) => {
                          await setRole({ collaboratorId: p._id, role: v as Role });
                          toast("Role changed", { detail: `${p.name ?? p.email} is now ${ROLES.find((r) => r.value === v)?.label}` });
                        }}
                      />
                    </div>
                    <IconButton
                      label="Remove from form"
                      onClick={async () => {
                        await remove({ collaboratorId: p._id });
                        toast("Removed from the form", { detail: p.name ?? p.email });
                      }}
                    >
                      <UserMinus size={16} strokeWidth={1.8} aria-hidden />
                    </IconButton>
                  </>
                ) : (
                  <span style={{ fontSize: 14, color: "var(--color-text-tertiary)", paddingRight: 8 }}>
                    {ROLES.find((r) => r.value === p.role)?.label}
                  </span>
                )}
              </div>
            ))}
          </div>

          {pending.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>Pending invitations</span>
                <Badge>{String(pending.length)}</Badge>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pending.map((p) => (
                  <div key={p._id} className="fk-person" data-pending="true">
                    <span className="fk-face" style={{ width: 36, height: 36, background: "var(--neutral-100)", color: "var(--color-text-tertiary)" }}>
                      <Mail size={16} strokeWidth={1.8} aria-hidden />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5 }}>{p.email}</div>
                      <div className="fk-proprow-hint" style={{ fontSize: 13.5 }}>
                        {ROLES.find((r) => r.value === p.role)?.label} · Sent {relativeTime(p.invitedAt)}
                      </div>
                    </div>
                    {manage && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await resend({ collaboratorId: p._id });
                            toast("Invitation resent", { detail: p.email });
                          }}
                        >
                          Resend
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await remove({ collaboratorId: p._id });
                            toast("Invitation revoked", { detail: p.email });
                          }}
                        >
                          Revoke
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="fk-roleguide">
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>What each role can do</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {GUIDE.map((r) => (
                <div key={r.role} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                  <span style={{ flex: "0 0 96px", fontSize: 14, fontWeight: 500 }}>{r.role}</span>
                  <span className="fk-proprow-hint" style={{ flex: 1, fontSize: 13.5, margin: 0 }}>
                    {r.note}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--color-text-tertiary)", lineHeight: 1.55 }}>
            <Link2 size={15} strokeWidth={1.8} aria-hidden style={{ flex: "0 0 auto" }} />
            <span>Sharing the form with the people answering it is a different thing. That lives under Share.</span>
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {activity && activity.length === 0 && (
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-tertiary)" }}>
              Nothing yet. Publishing, invitations and comments all show up here.
            </p>
          )}
          {(activity ?? []).map((a) => {
            const Icon = (a.icon && ACTIVITY_ICONS[a.icon]) || History;
            return (
              <div key={a._id} className="fk-activity">
                <Face name={a.who} color={a.color} image={a.image} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, lineHeight: 1.5 }}>
                    <strong style={{ fontWeight: 500 }}>{a.who}</strong> {a.what}
                  </div>
                  <div className="fk-proprow-hint" style={{ margin: "3px 0 0" }}>
                    {relativeTime(a.at)}
                  </div>
                </div>
                <Icon size={16} strokeWidth={1.8} aria-hidden style={{ color: "var(--color-text-tertiary)", flex: "0 0 auto" }} />
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
