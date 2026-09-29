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
  { value: "admin", label: "Admin", hint: "Every form, plus members, plan, billing and settings" },
  { value: "editor", label: "Editor", hint: "Edits every form and reads its responses" },
  { value: "viewer", label: "Viewer", hint: "Reads every form and its responses" },
];

const PLAN_WORD = { free: "Free", pro: "Pro", business: "Business" } as const;

/** Settings → Members: everyone in the company being worked in. */
export function TeamSection() {
  const toast = useToast();
  const data = useQuery(api.team.overview, {});
  const waiting = useQuery(api.approvals.waiting, {});
  const invite = useMutation(api.team.invite);
  const setRole = useMutation(api.team.setRole);
  const remove = useMutation(api.team.remove);
  const setApprovals = useMutation(api.approvals.setEnabled);
  const approvals = useGate("approvals");
  const [emails, setEmails] = useState("");
  const [role, setNewRole] = useState("editor");
  const [busy, setBusy] = useState(false);

  const chip = (feature: "approvals") => <ProChip plan="business" onClick={() => openUpgrade({ feature })} />;
  const paid = data && data.plan !== "free";
  const seatPrice = data ? data.pricePerSeat.month : 0;

  return (
    <>
      <Panel
        title={data ? `Members of ${data.company}` : "Members"}
        lede="Members work on every form in this company. People you invite to a single form are guests instead, and are free."
      >
        {data && (
          <p className="fk-seatnote" data-paid={paid ? "true" : undefined}>
            {paid
              ? `${data.seats} ${data.seats === 1 ? "seat" : "seats"} on ${PLAN_WORD[data.plan]}, at $${seatPrice} a seat a month. Each member is a seat: the bill follows as people join and leave, prorated.`
              : `Free has no limit on members. On Pro or Business, each member is a seat.`}
          </p>
        )}
        {data?.canManage && (
          <>
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
                onClick={async () => {
                  setBusy(true);
                  try {
                    const n = await invite({
                      emails: emails.split(/[,;\s]+/).filter(Boolean),
                      role: role as "admin" | "editor" | "viewer",
                    });
                    setEmails("");
                    toast(
                      n ? `Invited ${n} ${n === 1 ? "person" : "people"}` : "Everyone there is already a member",
                      paid && n ? { detail: `That adds ${n} ${n === 1 ? "seat" : "seats"} once they join.` } : undefined,
                    );
                  } catch (e) {
                    if (!upgradeOnPlanError(e)) toast(errorText(e, "Those invitations did not go out."));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Inviting…" : "Invite"}
              </Button>
            </div>
            <p className="fk-proprow-hint" style={{ margin: "10px 0 0" }}>
              {ROLES.map((r) => `${r.label}: ${r.hint.toLowerCase()}.`).join(" ")}
            </p>
          </>
        )}

        {data && (
          <div className="fk-rows" style={{ marginTop: 16 }}>
            <div className="fk-row" data-static="true">
              <span className="fk-row-main">
                <span className="fk-row-title">
                  {data.owner.name ?? data.owner.email}
                  {data.owner.me ? " (you)" : ""}
                </span>
                <span className="fk-row-meta">{data.owner.name && data.owner.email ? `${data.owner.email} · ` : ""}Owner</span>
              </span>
              <span className="fk-row-side">
                <Badge tone="neutral">Owner</Badge>
              </span>
            </div>
            {data.members.map((m) => (
              <div key={m._id} className="fk-row" data-static="true">
                <span className="fk-row-main">
                  <span className="fk-row-title">
                    {m.name ?? m.email}
                    {m.me ? " (you)" : ""}
                  </span>
                  <span className="fk-row-meta">
                    {m.name ? `${m.email} · ` : ""}
                    {m.status === "pending" ? `invited ${relativeTime(m.invitedAt)}` : `joined`}
                  </span>
                </span>
                <span className="fk-row-side" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {m.status === "pending" && <Badge tone="warning">Invited</Badge>}
                  {data.canManage ? (
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
                  ) : (
                    <Badge tone="neutral">{ROLES.find((r) => r.value === m.role)?.label}</Badge>
                  )}
                  {(data.canManage || m.me) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={<Trash2 size={15} strokeWidth={1.8} aria-hidden />}
                      onClick={async () => {
                        await remove({ memberId: m._id as Id<"teamMembers"> });
                        toast(m.me ? `You left ${data.company}` : `${m.email} removed`);
                      }}
                    >
                      {m.me ? "Leave" : "Remove"}
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Approvals before publishing"
        lede="Anyone who is not the owner or an Admin asks before a form goes live. The owner and Admins hear about it, and approving publishes it."
        aside={approvals.locked ? chip("approvals") : null}
      >
        <Row label="Require approval" hint={data?.approvals ? "On. Editors see “Ask for approval” instead of Publish." : "Off"}>
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
                    {w.note ? `: “${w.note}”` : ""}
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

    </>
  );
}
