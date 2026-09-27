"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Search } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, EmptyState, Field, Input, PillTabs, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { fullTime } from "@/components/app/bits";

/**
 * Users. Opening somebody shows what they have and what may be changed about
 * them; deleting an account asks for its email typed out, because it destroys
 * every form and response it owns.
 */
export function AdminUsers({ permissions }: { permissions: string[] }) {
  const toast = useToast();
  const [term, setTerm] = useState("");
  const [only, setOnly] = useState<"all" | "ai" | "suspended">("all");
  const [open, setOpen] = useState<Id<"users"> | null>(null);
  const [confirm, setConfirm] = useState("");

  const users = useQuery(api.admin.users, {
    search: term || undefined,
    only: only === "all" ? undefined : only,
  });
  const setStanding = useMutation(api.admin.setStanding);
  const deleteUser = useMutation(api.admin.deleteUser);
  const setAiAccess = useMutation(api.admin.setAiAccess);

  const current = users?.find((u) => u._id === open) ?? null;

  return (
    <>
      <div className="fk-panel" data-pad="tight">
        <div className="fk-toolbar">
          <PillTabs
            ariaLabel="Which users"
            value={only}
            onChange={setOnly}
            tabs={[
              { value: "all", label: "Everyone" },
              { value: "ai", label: "On the AI allow-list" },
              { value: "suspended", label: "Suspended" },
            ]}
          />
          <span className="fk-toolbar-spacer" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search by name, email or link"
            icon={<Search size={17} strokeWidth={1.8} aria-hidden />}
            style={{ width: 280 }}
          />
        </div>
      </div>

      <div className="fk-resp-layout">
        <section className="fk-panel" data-pad="none">
          {users && users.length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState title="Nobody matches" description="Try a shorter search." />
            </div>
          ) : (
            <div className="fk-rows">
              {(users ?? []).map((u) => (
                <div
                  key={u._id}
                  className="fk-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setOpen(u._id);
                    setConfirm("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setOpen(u._id);
                  }}
                  style={open === u._id ? { background: "var(--blue-50)" } : undefined}
                >
                  <span className="fk-row-main">
                    <span className="fk-row-title">{u.name || u.email}</span>
                    <span className="fk-row-meta">
                      {u.email} · {u.forms} forms · {u.responses} responses
                      {u.handle ? ` · formkit.app/${u.handle}` : ""}
                    </span>
                  </span>
                  <span className="fk-row-side">
                    {u.staffRole && <Badge tone="info">{u.staffRole}</Badge>}
                    {u.ai.allowed && <Badge tone="success">AI</Badge>}
                    {u.deactivatedAt && <Badge tone="error">Suspended</Badge>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="fk-panel" style={{ position: "sticky", top: 24 }}>
          {!current ? (
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-tertiary)" }}>
              Pick somebody and their account opens here.
            </p>
          ) : (
            <>
              <h3 style={{ marginBottom: 2 }}>{current.name || current.email}</h3>
              <p className="fk-panel-lede">
                {current.email} · joined {fullTime(current.joinedAt)}
              </p>
              {permissions.includes("users.view") && (
                <div style={{ margin: "-4px 0 18px" }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      window.open(
                        `/app?viewAs=${current._id}&who=${encodeURIComponent(current.name || current.email || "")}`,
                        "_blank",
                        "noopener",
                      )
                    }
                  >
                    Open support view
                  </Button>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {permissions.includes("ai.access") && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ flex: 1, fontSize: 14.5 }}>Ask Formkit</span>
                      <Switch
                        checked={current.ai.allowed}
                        label="Ask Formkit for this account"
                        onChange={async (on) => {
                          await setAiAccess({ userId: current._id, enabled: on });
                          toast(on ? "Ask Formkit turned on" : "Ask Formkit turned off", {
                            detail: on
                              ? "It appears in their app on the next load."
                              : "Every AI surface disappears from their app.",
                          });
                        }}
                      />
                    </div>

                    {current.ai.allowed && (
                      <>
                        <Field
                          label="Monthly limit"
                          help={`${current.ai.used} used this month. Leave blank to follow the platform default.`}
                        >
                          <Input
                            type="number"
                            min={0}
                            defaultValue={current.ai.limit}
                            onBlur={(e) =>
                              setAiAccess({
                                userId: current._id,
                                limitOverride: Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                              await setAiAccess({ userId: current._id, grant: 5 });
                              toast("Five extra credits granted");
                            }}
                          >
                            Grant 5 credits
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              await setAiAccess({ userId: current._id, resetUsage: true });
                              toast("This month's usage reset");
                            }}
                          >
                            Reset usage
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}

                {permissions.includes("users.suspend") && !current.staffRole && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ flex: 1, fontSize: 14.5 }}>Account is active</span>
                    <Switch
                      checked={!current.deactivatedAt}
                      label="Account is active"
                      onChange={async (on) => {
                        await setStanding({ userId: current._id, deactivated: !on });
                        toast(on ? "Account reactivated" : "Account suspended", {
                          detail: on
                            ? "They can sign in again."
                            : "Their forms keep collecting; they cannot sign in.",
                        });
                      }}
                    />
                  </div>
                )}

                {permissions.includes("users.delete") && !current.staffRole && (
                  <div className="fk-note" data-tone="danger" style={{ display: "block" }}>
                    <p style={{ margin: "0 0 10px" }}>
                      Deleting destroys {current.forms} forms and {current.responses} responses.
                      There is no bin and no undo. Type <strong>{current.email}</strong> to confirm.
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Input
                        inputSize="sm"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder={current.email}
                        style={{ flex: 1, minWidth: 180 }}
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={confirm !== current.email}
                        onClick={async () => {
                          await deleteUser({ userId: current._id, confirm });
                          toast("Account deleted");
                          setOpen(null);
                          setConfirm("");
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
