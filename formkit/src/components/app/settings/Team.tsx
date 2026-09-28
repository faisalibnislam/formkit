"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { BadgeCheck, Mail, Trash2, UserPlus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, Field, Input, Select, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { openUpgrade, upgradeOnPlanError, useGate } from "@/components/plan/usePlan";
import { relativeTime } from "../bits";
import { Panel, Row, errorText } from "./bits";

const ROLES = [
  { value: "admin", label: "Admin", hint: "Every form, plus the team, approvals and controls" },
  { value: "editor", label: "Editor", hint: "Edits every form and reads its responses" },
  { value: "viewer", label: "Viewer", hint: "Reads every form and its responses" },
];

/** Settings → Team (Business). */
export function TeamSection() {
  const toast = useToast();
  const data = useQuery(api.team.overview, {});
  const waiting = useQuery(api.approvals.waiting, {});
  const invite = useMutation(api.team.invite);
  const setRole = useMutation(api.team.setRole);
  const remove = useMutation(api.team.remove);
  const setApprovals = useMutation(api.approvals.setEnabled);
  const team = useGate("team");
  const approvals = useGate("approvals");
  const [emails, setEmails] = useState("");
  const [role, setNewRole] = useState("editor");
  const [busy, setBusy] = useState(false);

  const chip = (feature: "team" | "approvals") => (
    <ProChip plan="business" onClick={() => openUpgrade({ feature })} />
  );

  return (
    <>
      <Panel
        title="Team"
        lede="Everyone on the team works on all of your forms — no inviting them form by form. Add as many people as you like."
        aside={team.locked ? chip("team") : null}
      >
        <div className="fk-domainadd">
          <Field label="Email addresses" help="Separate several with commas.">
            <Input
              value={emails}
              placeholder="ravi@studionine.co, priya@studionine.co"
              onChange={(e) => setEmails(e.target.value)}
              icon={<Mail size={17} strokeWidth={1.8} aria-hidden />}
            />
          </Field>
          <Field label="Role">
            <Select
              ariaLabel="Role"
              value={role}
              onChange={setNewRole}
              options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
            />
          </Field>
          <Button
            iconLeft={<UserPlus size={16} strokeWidth={1.8} aria-hidden />}
            disabled={!emails.trim() || busy}
            onClick={team.guard(async () => {
              setBusy(true);
              try {
                const n = await invite({
                  emails: emails.split(/[,;\s]+/).filter(Boolean),
                  role: role as "admin" | "editor" | "viewer",
                });
                setEmails("");
                toast(n ? `Invited ${n} ${n === 1 ? "person" : "people"}` : "Everyone there is already on the team");
              } catch (e) {
                if (!upgradeOnPlanError(e)) toast(errorText(e, "Those invitations did not go out."));
              } finally {
                setBusy(false);
              }
            })}
          >
            {busy ? "Inviting…" : "Invite"}
          </Button>
        </div>
        <p className="fk-proprow-hint" style={{ margin: "10px 0 0" }}>
          {ROLES.map((r) => `${r.label}: ${r.hint.toLowerCase()}.`).join(" ")}
        </p>

        {(data?.members ?? []).length > 0 && (
          <div className="fk-rows" style={{ marginTop: 16 }}>
            {data!.members.map((m) => (
              <div key={m._id} className="fk-row" data-static="true">
                <span className="fk-row-main">
                  <span className="fk-row-title">{m.name ?? m.email}</span>
                  <span className="fk-row-meta">
                    {m.name ? `${m.email} · ` : ""}
                    {m.status === "pending" ? `invited ${relativeTime(m.invitedAt)}` : `joined`}
                  </span>
                </span>
                <span className="fk-row-side" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {m.status === "pending" && <Badge tone="warning">Invited</Badge>}
                  <div style={{ width: 130 }}>
                    <Select
                      ariaLabel={`Role for ${m.email}`}
                      size="sm"
                      value={m.role}
                      onChange={(r) =>
                        void setRole({ memberId: m._id, role: r as "admin" | "editor" | "viewer" }).then(() =>
                          toast("Role changed"),
                        )
                      }
                      options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={<Trash2 size={15} strokeWidth={1.8} aria-hidden />}
                    onClick={async () => {
                      await remove({ memberId: m._id });
                      toast(`${m.email} removed from the team`);
                    }}
                  >
                    Remove
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Approvals before publishing"
        lede="Anyone who is not you or a team Admin asks before a form goes live. You and your Admins hear about it, and approving publishes it."
        aside={approvals.locked ? chip("approvals") : null}
      >
        <Row label="Require approval" hint={data?.approvals ? "On — editors see “Ask for approval” instead of Publish." : "Off"}>
          <Switch
            checked={!!data?.approvals}
            label="Require approval"
            onChange={approvals.guard(async (enabled: boolean) => {
              try {
                await setApprovals({ enabled });
                toast(enabled ? "Approvals on" : "Approvals off");
              } catch (e) {
                if (!upgradeOnPlanError(e)) toast(errorText(e, "That did not save."));
              }
            })}
          />
        </Row>
        {(waiting ?? []).length > 0 && (
          <div className="fk-rows" style={{ marginTop: 12 }}>
            {waiting!.map((w) => (
              <Link key={w.formId} href={`/app/forms/${w.formId}`} className="fk-row">
                <span className="fk-row-main">
                  <span className="fk-row-title">{w.title}</span>
                  <span className="fk-row-meta">
                    {w.by} asked {relativeTime(w.at)}
                    {w.note ? ` — “${w.note}”` : ""}
                  </span>
                </span>
                <span className="fk-row-side">
                  <Badge tone="warning">
                    <BadgeCheck size={13} strokeWidth={1.8} aria-hidden style={{ marginRight: 4 }} />
                    Waiting for you
                  </Badge>
                </span>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      {(data?.teams ?? []).length > 0 && (
        <Panel title="Teams you are on" lede="Their forms are in your list under Shared.">
          <div className="fk-rows">
            {data!.teams.map((t) => (
              <div key={t._id} className="fk-row" data-static="true">
                <span className="fk-row-main">
                  <span className="fk-row-title">{t.owner}&rsquo;s team</span>
                  <span className="fk-row-meta">
                    {ROLES.find((r) => r.value === t.role)?.label} · {t.email}
                  </span>
                </span>
                <span className="fk-row-side">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await remove({ memberId: t._id as Id<"teamMembers"> });
                      toast(`You left ${t.owner}’s team`);
                    }}
                  >
                    Leave
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
