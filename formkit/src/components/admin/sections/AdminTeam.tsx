"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, Checkbox, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/**
 * Team access.
 *
 * Two layers, and the screen says so. A role sets what everybody on it can do;
 * giving one person their own permission snapshots the role grant at that
 * moment, and from then on changes to the role no longer reach them. That is
 * stated next to their name rather than left to be discovered.
 */
export function AdminTeam({ meId }: { meId: Id<"users"> }) {
  const toast = useToast();
  const data = useQuery(api.admin.team, {});
  const setRole = useMutation(api.admin.setStaffRole);
  const setStaffPermission = useMutation(api.admin.setStaffPermission);
  const clearOverride = useMutation(api.admin.clearStaffOverride);
  const setRolePermission = useMutation(api.admin.setRolePermission);
  const invite = useMutation(api.admin.inviteStaff);
  const [email, setEmail] = useState("");
  const [role, setInviteRole] = useState<"admin" | "support">("support");

  if (!data) return null;

  return (
    <>
      <section className="fk-panel">
        <h3>Add somebody</h3>
        <p className="fk-panel-lede">
          They need a Formkit account first. Owners are only ever made from the list below, never invited.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@formkit.app"
              style={{ width: 280 }}
            />
          </Field>
          <div style={{ width: 170 }}>
            <Field label="Role">
              <Select
                value={role}
                ariaLabel="Role"
                onChange={(v) => setInviteRole(v as "admin" | "support")}
                options={[
                  { value: "support", label: "Support" },
                  { value: "admin", label: "Admin" },
                ]}
              />
            </Field>
          </div>
          <Button
            disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())}
            onClick={async () => {
              try {
                await invite({ email, role });
                toast(`${email.trim()} is on the team`, { detail: `As ${role}. They are told in their bell.` });
                setEmail("");
              } catch (e) {
                toast("Could not add them", { detail: e instanceof Error ? e.message.split("\n")[0] : undefined, tone: "error" });
              }
            }}
          >
            Add to the team
          </Button>
        </div>
      </section>

      <section className="fk-panel">
        <h3>People</h3>
        <p className="fk-panel-lede">
          Everyone who can reach this console. Owners hold every permission, always.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {data.members.map((m) => (
            <div key={m._id} className="fk-subrow" style={{ display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: 13.5, color: "var(--color-text-tertiary)" }}>
                    {m.email} · {m.permissions.length} of {data.perms.length} permissions
                  </div>
                </div>
                {m.custom && <Badge tone="info">Own permissions</Badge>}
                {m.role === "owner" || m._id === meId ? (
                  <Badge tone="neutral">{m.role[0]!.toUpperCase() + m.role.slice(1)}</Badge>
                ) : (
                <div style={{ width: 170 }}>
                  <Select
                    value={m.role}
                    ariaLabel={`Role for ${m.name}`}
                    onChange={async (v) => {
                      await setRole({
                        userId: m._id,
                        role: v as "owner" | "admin" | "support" | "none",
                      });
                      toast(`${m.name} is now ${v === "none" ? "not staff" : `an ${v}`}`, {
                        detail: m.custom
                          ? "Their own permissions still apply."
                          : `They follow the ${v} permissions.`,
                      });
                    }}
                    options={[
                      { value: "owner", label: "Owner", note: "Everything, always" },
                      { value: "admin", label: "Admin" },
                      { value: "support", label: "Support" },
                      { value: "none", label: "Remove access", note: "No longer staff" },
                    ]}
                    placeholder="Role"
                  />
                </div>
                )}
              </div>

              {m.role === "owner" ? (
                <p style={{ margin: "12px 0 0", fontSize: 13.5, color: "var(--color-text-tertiary)" }}>
                  Owners hold every permission, and an owner’s role is locked here. Another owner can move them to Admin.
                </p>
              ) : (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 8,
                      marginTop: 14,
                    }}
                  >
                    {data.perms.map((p) => (
                      <Checkbox
                        key={p.key}
                        label={p.label}
                        description={p.detail}
                        checked={m.permissions.includes(p.key)}
                        onChange={(on) =>
                          setStaffPermission({ userId: m._id, permission: p.key, on })
                        }
                      />
                    ))}
                  </div>
                  {m.custom && (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ margin: "0 0 8px", fontSize: 13.5, color: "var(--color-text-tertiary)" }}>
                        {m.name.split(" ")[0]} has their own permissions, so changes to the {m.role}{" "}
                        role no longer reach them.
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await clearOverride({ userId: m._id });
                          toast(`Put ${m.name} back on the ${m.role} permissions`);
                        }}
                      >
                        Follow the role again
                      </Button>
                    </div>
                  )}
                  {m._id === meId && (
                    <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--color-text-tertiary)" }}>
                      This is you. You cannot change your own role.
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="fk-panel">
        <h3>What each role can do</h3>
        <p className="fk-panel-lede">
          This applies to everyone on the role. Anyone given their own permissions above keeps
          those instead.
        </p>
        <div className="fk-scroll-x">
          <table className="fk-matrix">
            <thead>
              <tr>
                <th>Permission</th>
                {data.roles.map((r) => (
                  <th key={r.role} data-center="true">
                    {r.role[0]!.toUpperCase() + r.role.slice(1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.perms.map((p) => (
                <tr key={p.key}>
                  <th scope="row" style={{ fontWeight: 400 }}>
                    {p.label}
                    <span className="fk-matrix-detail">{p.detail}</span>
                  </th>
                  {data.roles.map((r) => (
                    <td key={r.role} data-center="true">
                      {r.role === "owner" ? (
                        <span style={{ color: "var(--color-text-tertiary)" }} title="Owners hold everything">
                          Always
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          aria-label={`${p.label} for ${r.role}s`}
                          checked={r.permissions.includes(p.key)}
                          onChange={(e) =>
                            setRolePermission({
                              role: r.role as "admin" | "support",
                              permission: p.key,
                              on: e.target.checked,
                            })
                          }
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
