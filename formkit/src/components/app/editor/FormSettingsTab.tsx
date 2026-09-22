"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Mail, Plus, Reply, Trash2, TriangleAlert } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Button,
  Field,
  IconButton,
  Input,
  PillTabs,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { fullTime } from "../bits";

/**
 * A form's own settings.
 *
 * Notifications belong to the form, not the account: a support form and a job
 * application go to different people. The account's address only supplies the
 * first draft.
 */

type Notify = {
  to: string;
  subject: string;
  body: string;
  routes: { when?: string; value?: string; to?: string }[];
  confirm: boolean;
  replyTo: string;
  confirmSubject: string;
  confirmBody: string;
  confirmAttach: boolean;
};

const VARIABLES = ["{{name}}", "{{email}}", "{{form_name}}", "{{submitted_at}}"];

function defaults(stored: unknown, email: string): Notify {
  const n = (stored ?? {}) as Partial<Notify>;
  return {
    to: n.to ?? email,
    subject: n.subject ?? "New response to {{form_name}}",
    body: n.body ?? "{{name}} ({{email}}) just submitted {{form_name}}.",
    routes: n.routes ?? [],
    confirm: !!n.confirm,
    replyTo: n.replyTo ?? email,
    confirmSubject: n.confirmSubject ?? "We have your answers — {{form_name}}",
    confirmBody:
      n.confirmBody ??
      "Thank you {{name}}. We have your answers and will come back to you shortly.",
    confirmAttach: n.confirmAttach !== false,
  };
}

export function FormSettingsTab({ formId }: { formId: Id<"forms"> }) {
  const toast = useToast();
  const form = useQuery(api.forms.get, { formId });
  const viewer = useQuery(api.users.viewer, {});
  const log = useQuery(api.notifications.log, { formId });
  const update = useMutation(api.forms.update);
  const setClosing = useMutation(api.forms.setClosing);
  const sendTest = useAction(api.notifications.sendTest);

  const [section, setSection] = useState<"general" | "closing" | "notifications" | "emails">(
    "general",
  );

  if (!form) return null;
  const notify = defaults(form.notify, viewer?.email ?? "");
  const hasEmailQuestion = form.blocks.some((b) => b.type === "email");

  const patchNotify = (patch: Partial<Notify>) =>
    update({ formId, patch: { notify: { ...notify, ...patch } } });

  return (
    <>
      <div className="fk-panel" data-pad="tight">
        <PillTabs
          ariaLabel="Settings section"
          value={section}
          onChange={setSection}
          tabs={[
            { value: "general", label: "General" },
            { value: "closing", label: "Closing" },
            { value: "notifications", label: "Notifications" },
            { value: "emails", label: "Email log" },
          ]}
        />
      </div>

      {section === "general" && (
        <section className="fk-panel">
          <h3>About this form</h3>
          <p className="fk-panel-lede">
            Only you see the description. It helps when a list of forms gets long.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Name">
              <Input
                value={form.title}
                onChange={(e) => update({ formId, patch: { title: e.target.value } })}
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={2}
                value={form.description ?? ""}
                placeholder="What this form is for, in a line."
                onChange={(e) => update({ formId, patch: { description: e.target.value } })}
              />
            </Field>
            <Field label="Public link" help="Claim a name under Share to shorten this.">
              <Input readOnly value={`https://${form.url}`} onFocus={(e) => e.currentTarget.select()} />
            </Field>
          </div>
        </section>
      )}

      {section === "closing" && (
        <section className="fk-panel">
          <h3>When this form stops</h3>
          <p className="fk-panel-lede">
            Either rule closes the form on its own. Reopening it switches off a rule that has
            already passed, so it does not close again straight away.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Close on a date">
              <Input
                type="datetime-local"
                value={
                  form.closing?.closeAt
                    ? new Date(form.closing.closeAt - new Date().getTimezoneOffset() * 60000)
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
                onChange={(e) =>
                  setClosing({
                    formId,
                    closing: {
                      closeAt: e.target.value ? new Date(e.target.value).getTime() : undefined,
                    },
                  })
                }
              />
            </Field>
            <Field
              label="Close after this many responses"
              help={`${form.responses} so far.`}
            >
              <Input
                type="number"
                min={1}
                value={form.closesAfter ?? ""}
                placeholder="No limit"
                onChange={(e) =>
                  setClosing({
                    formId,
                    closing: { closeAfter: e.target.value ? Number(e.target.value) : undefined },
                  })
                }
              />
            </Field>
            <Field label="What visitors see when it is closed">
              <Textarea
                rows={2}
                value={form.closing?.message ?? ""}
                placeholder="This form is closed. Thank you to everyone who answered."
                onChange={(e) => setClosing({ formId, closing: { message: e.target.value } })}
              />
            </Field>
          </div>
        </section>
      )}

      {section === "notifications" && (
        <>
          <section className="fk-panel">
            <h3>Tell me about a response</h3>
            <p className="fk-panel-lede">
              Sent every time someone answers this form. Variables are replaced with the response.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Send to" help="Separate several addresses with a comma.">
                <Input
                  icon={<Mail size={17} strokeWidth={1.8} aria-hidden />}
                  value={notify.to}
                  onChange={(e) => patchNotify({ to: e.target.value })}
                  placeholder="you@example.com"
                  style={{ maxWidth: 420 }}
                />
              </Field>
              <Field label="Subject">
                <Input
                  value={notify.subject}
                  onChange={(e) => patchNotify({ subject: e.target.value })}
                  style={{ maxWidth: 520 }}
                />
              </Field>
              <Field label="Message">
                <Textarea
                  rows={3}
                  value={notify.body}
                  onChange={(e) => patchNotify({ body: e.target.value })}
                />
              </Field>
              <div className="fk-chiprow">
                <span style={{ fontSize: 13.5, color: "var(--color-text-tertiary)" }}>Variables</span>
                {VARIABLES.map((v) => (
                  <span key={v} className="fk-chip">
                    {v}
                  </span>
                ))}
              </div>
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const r = await sendTest({ formId, which: "notification" });
                    if (r.state === "sent") toast(`Test sent to ${r.to}`);
                    else toast("That test did not go out", { detail: r.detail, tone: "error" });
                  }}
                >
                  Send me a test
                </Button>
              </div>
            </div>
          </section>

          <section className="fk-panel">
            <h3>Send some responses elsewhere</h3>
            <p className="fk-panel-lede">
              A rule sends the notification to someone else when an answer matches. The first rule
              that matches wins; anything that matches nothing goes to the address above.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {notify.routes.map((r, i) => (
                <div key={i} className="fk-subrow">
                  <div style={{ flex: 1, minWidth: 170 }}>
                    <div className="fk-sublabel">When</div>
                    <Select
                      value={r.when ?? null}
                      ariaLabel="Which question"
                      placeholder="Pick a question"
                      options={form.blocks
                        .filter((b) => b.kind === "field")
                        .map((b) => ({ value: b._id as string, label: b.title ?? "Question" }))}
                      onChange={(v) =>
                        patchNotify({
                          routes: notify.routes.map((x, j) => (j === i ? { ...x, when: v } : x)),
                        })
                      }
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div className="fk-sublabel">is</div>
                    <Input
                      inputSize="sm"
                      value={r.value ?? ""}
                      placeholder="An answer"
                      aria-label="Which answer"
                      onChange={(e) =>
                        patchNotify({
                          routes: notify.routes.map((x, j) =>
                            j === i ? { ...x, value: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </div>
                  <div style={{ flex: 1.4, minWidth: 190 }}>
                    <div className="fk-sublabel">send to</div>
                    <Input
                      inputSize="sm"
                      icon={<Mail size={15} strokeWidth={1.8} aria-hidden />}
                      value={r.to ?? ""}
                      placeholder="name@example.com"
                      aria-label="Send to"
                      onChange={(e) =>
                        patchNotify({
                          routes: notify.routes.map((x, j) =>
                            j === i ? { ...x, to: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </div>
                  <IconButton
                    label="Delete this rule"
                    tone="danger"
                    onClick={() =>
                      patchNotify({ routes: notify.routes.filter((_, j) => j !== i) })
                    }
                  >
                    <Trash2 size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                </div>
              ))}

              {notify.routes.length === 0 && (
                <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-tertiary)" }}>
                  No rules yet. Every response goes to {notify.to || "you"}.
                </p>
              )}

              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<Plus size={15} strokeWidth={1.8} aria-hidden />}
                  onClick={() =>
                    patchNotify({ routes: [...notify.routes, { when: "", value: "", to: "" }] })
                  }
                >
                  Add a rule
                </Button>
              </div>
            </div>
          </section>

          <section className="fk-panel">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <h3>Reply to the person who answered</h3>
                <p className="fk-panel-lede" style={{ marginBottom: 0 }}>
                  A short confirmation, sent to the email address they gave you. It needs an email
                  question on the form.
                </p>
              </div>
              <Switch
                checked={notify.confirm}
                label="Send a confirmation"
                onChange={(on) => {
                  patchNotify({ confirm: on });
                  toast(on ? "Confirmation on" : "Confirmation off", {
                    detail: on
                      ? "Everyone who answers gets a short reply"
                      : "Nobody gets a reply from Formkit",
                  });
                }}
              />
            </div>

            {!hasEmailQuestion && (
              <div className="fk-note" style={{ marginTop: 14 }}>
                <TriangleAlert size={16} strokeWidth={1.8} aria-hidden />
                <span>
                  This form has no email question, so there is nowhere to send it. Add one under
                  Build.
                </span>
              </div>
            )}

            {notify.confirm && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
                <Field label="Replies go to">
                  <Input
                    icon={<Reply size={17} strokeWidth={1.8} aria-hidden />}
                    value={notify.replyTo}
                    onChange={(e) => patchNotify({ replyTo: e.target.value })}
                    style={{ maxWidth: 420 }}
                  />
                </Field>
                <Field label="Subject">
                  <Input
                    value={notify.confirmSubject}
                    onChange={(e) => patchNotify({ confirmSubject: e.target.value })}
                    style={{ maxWidth: 520 }}
                  />
                </Field>
                <Field label="Message">
                  <Textarea
                    rows={3}
                    value={notify.confirmBody}
                    onChange={(e) => patchNotify({ confirmBody: e.target.value })}
                  />
                </Field>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ flex: 1, fontSize: 14.5 }}>Include a copy of their answers</span>
                  <Switch
                    checked={notify.confirmAttach}
                    label="Include a copy of their answers"
                    onChange={(on) => patchNotify({ confirmAttach: on })}
                  />
                </div>
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      const r = await sendTest({ formId, which: "confirmation" });
                      if (r.state === "sent") toast(`Test sent to ${r.to}`);
                      else toast("That test did not go out", { detail: r.detail, tone: "error" });
                    }}
                  >
                    Send me a test
                  </Button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {section === "emails" && (
        <section className="fk-panel" data-pad="none">
          <div style={{ padding: "22px 24px 8px" }}>
            <h3 style={{ margin: 0 }}>Email log</h3>
            <p className="fk-panel-lede" style={{ margin: "6px 0 0" }}>
              Everything Formkit sent on your behalf for this form, newest first.
            </p>
          </div>
          {(log ?? []).length === 0 ? (
            <p style={{ padding: "8px 24px 24px", fontSize: 14, color: "var(--color-text-tertiary)" }}>
              Nothing sent yet.
            </p>
          ) : (
            <div className="fk-rows" style={{ marginTop: 10 }}>
              {(log ?? []).map((e) => (
                <div key={e._id} className="fk-row" data-static="true">
                  <span className="fk-row-main">
                    <span className="fk-row-title">{e.subject}</span>
                    <span className="fk-row-meta">
                      {e.kind} · to {e.to} · {fullTime(e.at)}
                      {e.state === "failed" && e.detail ? ` · ${e.detail}` : ""}
                    </span>
                  </span>
                  <span className="fk-row-side">
                    <span
                      className="fk-chip"
                      style={{
                        background: e.state === "sent" ? "var(--green-100)" : "var(--red-100)",
                      }}
                    >
                      {e.state === "sent" ? "Sent" : "Failed"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
