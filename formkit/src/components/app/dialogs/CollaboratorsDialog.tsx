"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, Field, IconButton, Input, Modal, Select } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "../ds";

/**
 * Collaborators owns people, and only people. What each role can do is spelled
 * out next to it rather than left to the word alone.
 */
const ROLES = [
  { value: "editor", label: "Editor", note: "Edits the form and reads its responses" },
  { value: "commenter", label: "Commenter", note: "Leaves comments, changes nothing" },
  { value: "viewer", label: "Viewer", note: "Reads the form and its responses" },
];

export function CollaboratorsDialog({
  formId,
  onClose,
}: {
  formId: Id<"forms">;
  onClose: () => void;
}) {
  const data = useQuery(api.collaborators.list, { formId });
  const invite = useMutation(api.collaborators.invite);
  const setRole = useMutation(api.collaborators.setRole);
  const remove = useMutation(api.collaborators.remove);
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [role, setRoleValue] = useState("editor");

  async function send() {
    try {
      await invite({ formId, email, role: role as "editor" | "commenter" | "viewer" });
      toast(`Invited ${email.trim()}`, {
        detail: "They see the form the next time they sign in.",
      });
      setEmail("");
    } catch (e) {
      toast("That invitation did not go out", {
        detail: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  }

  return (
    <Modal
      title="People on this form"
      description="Sharing the link is a separate thing — this is who can work on the form itself."
      onClose={onClose}
      width={560}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Field label="Invite by email">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              type="email"
              style={{ flex: 1, minWidth: 180 }}
            />
            <div style={{ width: 170 }}>
              <Select value={role} onChange={setRoleValue} options={ROLES} ariaLabel="Their role" />
            </div>
            <Button onClick={send} disabled={!email.includes("@")}>
              Invite
            </Button>
          </div>
        </Field>

        <div className="fk-rows">
          {data && (
            <div className="fk-row" data-static="true">
              <Avatar name={data.owner.name} image={data.owner.image} size="sm" />
              <span className="fk-row-main">
                <span className="fk-row-title">{data.owner.name}</span>
                <span className="fk-row-meta">{data.owner.email}</span>
              </span>
              <span className="fk-row-side">
                <Badge>Owner</Badge>
              </span>
            </div>
          )}

          {(data?.people ?? []).map((p) => (
            <div key={p._id} className="fk-row" data-static="true">
              <Avatar name={p.name ?? p.email} image={p.image} size="sm" />
              <span className="fk-row-main">
                <span className="fk-row-title">{p.name ?? p.email}</span>
                <span className="fk-row-meta">
                  {p.name ? `${p.email} · ` : ""}
                  {p.status === "pending" ? "Waiting for them to sign up" : "Has access"}
                </span>
              </span>
              <span className="fk-row-side">
                <div style={{ width: 160 }}>
                  <Select
                    value={p.role}
                    onChange={(next) =>
                      setRole({
                        collaboratorId: p._id,
                        role: next as "editor" | "commenter" | "viewer",
                      })
                    }
                    options={ROLES}
                    ariaLabel={`Role for ${p.email}`}
                  />
                </div>
                <IconButton
                  label={`Remove ${p.email}`}
                  tone="danger"
                  onClick={() => remove({ collaboratorId: p._id })}
                >
                  <Trash2 size={16} strokeWidth={1.8} aria-hidden />
                </IconButton>
              </span>
            </div>
          ))}
        </div>

        {data && data.people.length === 0 && (
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-tertiary)" }}>
            Nobody else yet. An Editor can change the form and read its answers from their own
            account.
          </p>
        )}
      </div>
    </Modal>
  );
}
