"use client";

import { useSeededQuery, useViewer } from "@/lib/seed";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { Eye, KeyRound, Lock, Mail, Plus, Reply, Send, Trash2, TriangleAlert, Unlock, Clock } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, Field, IconButton, Input, Modal, PillTabs, Select, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { fullTime } from "../bits";
import { CloseFormDialog } from "../dialogs/CloseFormDialog";
import { localZone, zoneOptions } from "../time";
import { ClosingRules, closeWhenLabel } from "./ClosingRules";
import { ConnectionsSection, PaymentsSection } from "./ConnectionsSection";
import { AiReplySection } from "./AiReplySection";
import { QuizSection } from "./QuizSection";
import { DraftArea, DraftPill } from "./Draft";
import { openPreview } from "./previewBus";
import { tracked } from "./saveStatus";
import { useSettingsDraft } from "./useSettingsDraft";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { openUpgrade, useGate } from "@/components/plan/usePlan";

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

type Security = {
  multiple: boolean;
  editAfter: boolean;
  password: boolean;
  passwordSet: boolean;
  spam: boolean;
  rateLimit: boolean;
  requireEmail: boolean;
};

type Section = "general" | "responses" | "notifications" | "ai" | "quiz" | "security" | "submission" | "connections" | "payments" | "emails";

const VARIABLES = ["{{name}}", "{{email}}", "{{form_name}}", "{{submitted_at}}"];
const DEFAULT_NOTE = "This form is closed. Thank you to everyone who answered.";

function notifyDefaults(stored: unknown, email: string): Notify {
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
      n.confirmBody ?? "Thank you {{name}}. We have your answers and will come back to you shortly.",
    confirmAttach: n.confirmAttach !== false,
  };
}

function Card({ title, lede, children }: { title?: string; lede?: string; children: React.ReactNode }) {
  return (
    <section className="fk-panel">
      {title && <h3 style={{ margin: lede ? "0 0 6px" : "0 0 14px" }}>{title}</h3>}
      {lede && <p className="fk-panel-lede">{lede}</p>}
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="fk-proprow">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14 }}>{label}</div>
        {hint && <div className="fk-proprow-hint">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export function FormSettingsTab({ formId }: { formId: Id<"forms"> }) {
  const toast = useToast();
  const router = useRouter();
  const form = useSeededQuery(api.forms.get, { formId });
  const redirectGate = useGate("forms.redirect", form?.ownerPlan?.features);
  const pipeGate = useGate("logic.piping", form?.ownerPlan?.features);
  const viewer = useViewer();
  const log = useQuery(api.notifications.log, { formId });
  const update = useMutation(api.forms.update);
  const setClosing = useMutation(api.forms.setClosing);
  const setPassword = useMutation(api.forms.setPassword);
  const softDelete = useMutation(api.forms.softDelete);
  const sendTest = useAction(api.notifications.sendTest);

  const [section, setSection] = useState<Section>("general");
  const [closing, setClosingOpen] = useState<null | "close" | "reopen">(null);
  const [trash, setTrash] = useState(false);
  const [pw, setPw] = useState<string | null>(null);

  const [notify, patchNotify] = useSettingsDraft<Notify>(
    formId,
    "notify",
    notifyDefaults(form?.notify, viewer?.email ?? ""),
  );
  const [security, patchSecurity] = useSettingsDraft<Security>(
    formId,
    "security",
    (form?.security ?? {
      multiple: true,
      editAfter: false,
      password: false,
      passwordSet: false,
      spam: true,
      rateLimit: true,
      requireEmail: false,
    }) as Security,
  );

  if (!form) return null;

  const zone = form.closing?.timezone ?? viewer?.timezone ?? localZone();
  const fields = form.blocks.filter((b) => b.kind === "field");
  const hasEmailQuestion = fields.some((b) => b.type === "email");
  const scheduled = !!(form.closing?.closeAt || form.closing?.closeAfter);
  const patchThanks = (p: Record<string, string>) =>
    tracked(
      update({
        formId,
        patch: { thanks: { title: "Thank you", message: "", ...(form.thanks ?? {}), ...p } },
      }),
    );

  async function test(which: "notification" | "confirmation") {
    const r = await sendTest({ formId, which });
    if (r.state === "sent") toast(`Test sent to ${r.to}`);
    else toast("That test did not go out", { detail: r.detail, tone: "error" });
  }

  return (
    <div className="fk-formsettings">
      <div style={{ display: "flex", overflowX: "auto" }} className="fk-no-scrollbar">
        <PillTabs
          ariaLabel="Settings section"
          value={section}
          onChange={setSection}
          tabs={[
            { value: "general", label: "General" },
            { value: "responses", label: "Responses" },
            { value: "notifications", label: "Notifications" },
            { value: "ai", label: "AI reply" },
            { value: "quiz", label: "Quiz" },
            { value: "security", label: "Security" },
            { value: "submission", label: "Submission" },
            { value: "connections", label: "Connections" },
            { value: "payments", label: "Payments" },
            { value: "emails", label: "Email log" },
          ]}
        />
      </div>

      {section === "general" && (
        <Card title="General">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Form name">
              <DraftPill
                size="md"
                value={form.title}
                wrapStyle={{ maxWidth: 420 }}
                onCommit={(title) => title.trim() && tracked(update({ formId, patch: { title: title.trim() } }))}
              />
            </Field>
            <Field label="Description" help="Only you see it. It helps when a list of forms gets long.">
              <DraftArea
                rows={2}
                value={form.description ?? ""}
                placeholder="What this form is for, in a line."
                onCommit={(description) => tracked(update({ formId, patch: { description } }))}
              />
            </Field>
            <Field label="Public link">
              <Input readOnly value={`https://${form.url}`} onFocus={(e) => e.currentTarget.select()} />
            </Field>
            <Row label="Language" hint="English (US) for now">
              <span className="fk-static-pill">English (US)</span>
            </Row>
            <Row label="Time zone" hint="Used for closing dates and timestamps">
              <div style={{ width: 250 }}>
                <Select
                  size="sm"
                  ariaLabel="Time zone"
                  searchable
                  searchPlaceholder="Search time zones"
                  value={zone}
                  options={zoneOptions()}
                  onChange={(timezone) => tracked(setClosing({ formId, closing: { timezone } }))}
                />
              </div>
            </Row>
          </div>
        </Card>
      )}

      {section === "responses" && (
        <>
          <Card title="Responses">
            <Row label="Allow multiple submissions" hint="One person can answer more than once">
              <Switch
                checked={security.multiple}
                label="Allow multiple submissions"
                onChange={(multiple) => patchSecurity({ multiple })}
              />
            </Row>
            <Row label="Allow editing after submit" hint="Respondents get an edit link">
              <Switch
                checked={security.editAfter}
                label="Allow editing after submit"
                onChange={(editAfter) => patchSecurity({ editAfter })}
              />
            </Row>
          </Card>

          <Card
            title="Closing"
            lede="A closed form keeps every response and stops accepting new ones. The link and embed still work — visitors see your message instead of the questions."
          >
            <div className="fk-closestate" data-state={form.status === "closed" ? "closed" : scheduled ? "scheduled" : "open"}>
              <span className="fk-closestate-mark">
                {form.status === "closed" ? (
                  <Lock size={16} strokeWidth={1.8} aria-hidden />
                ) : scheduled ? (
                  <Clock size={16} strokeWidth={1.8} aria-hidden />
                ) : (
                  <Unlock size={16} strokeWidth={1.8} aria-hidden />
                )}
              </span>
              <span style={{ flex: 1, minWidth: 200 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 500 }}>
                  {form.status === "closed"
                    ? "Closed"
                    : scheduled
                      ? "Open — closing is scheduled"
                      : form.status === "draft"
                        ? "A draft — not collecting yet"
                        : "Open and collecting"}
                </span>
                <span className="fk-proprow-hint" style={{ display: "block", fontSize: 13.5 }}>
                  {form.status === "closed"
                    ? `Closed ${form.closing?.closedBy === "automatically" ? "automatically" : "by you"}${
                        form.closing?.closedAt ? ` ${fullTime(form.closing.closedAt)}` : ""
                      }. ${form.responses.toLocaleString("en-US")} responses are safe in your inbox.`
                    : scheduled
                      ? closeWhenLabel(form.closing, form.responses, zone)
                      : "New answers are accepted. Schedule a closing time below, or close it by hand."}
                </span>
              </span>
              {form.status === "closed" ? (
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<Unlock size={15} strokeWidth={1.8} aria-hidden />}
                  onClick={() => setClosingOpen("reopen")}
                >
                  Reopen now
                </Button>
              ) : (
                form.status === "published" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<Lock size={15} strokeWidth={1.8} aria-hidden />}
                    onClick={() => setClosingOpen("close")}
                  >
                    Close now
                  </Button>
                )
              )}
            </div>

            <ClosingRules formId={formId} closing={form.closing} responses={form.responses} zone={zone} />

            <div style={{ paddingTop: 6 }}>
              <Field label="Message visitors see when it is closed">
                <DraftArea
                  rows={2}
                  value={form.closing?.message ?? DEFAULT_NOTE}
                  placeholder={DEFAULT_NOTE}
                  onCommit={(message) => tracked(setClosing({ formId, closing: { message } }))}
                />
              </Field>
              <Button
                variant="ghost"
                size="sm"
                style={{ marginTop: 10, paddingLeft: 6 }}
                iconLeft={<Eye size={15} strokeWidth={1.8} aria-hidden />}
                onClick={() => openPreview({ closed: true })}
              >
                Preview closed screen
              </Button>
            </div>
          </Card>
        </>
      )}

      {section === "notifications" && (
        <>
          <Card
            title="Tell me about a response"
            lede="Sent every time someone answers this form. Variables are replaced with the response."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Send to" help="Separate several addresses with a comma.">
                <DraftPill
                  size="md"
                  icon={<Mail size={17} strokeWidth={1.8} aria-hidden />}
                  value={notify.to}
                  placeholder="you@example.com"
                  wrapStyle={{ maxWidth: 420 }}
                  onCommit={(to) => patchNotify({ to })}
                />
              </Field>
              <Field label="Subject">
                <DraftPill
                  size="md"
                  value={notify.subject}
                  wrapStyle={{ maxWidth: 520 }}
                  onCommit={(subject) => patchNotify({ subject })}
                />
              </Field>
              <Field label="Message">
                <DraftArea rows={3} value={notify.body} onCommit={(body) => patchNotify({ body })} />
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
                  iconLeft={<Send size={15} strokeWidth={1.8} aria-hidden />}
                  onClick={() => test("notification")}
                >
                  Send me a test
                </Button>
              </div>
            </div>
          </Card>

          <Card
            title="Send some responses elsewhere"
            lede="A rule sends the notification to someone else when an answer matches. The first rule that matches wins; anything that matches nothing goes to the address above."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {notify.routes.map((r, i) => {
                const setRoute = (p: Partial<Notify["routes"][number]>) =>
                  patchNotify({ routes: notify.routes.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                return (
                  <div key={i} className="fk-route">
                    <div style={{ flex: 1, minWidth: 170 }}>
                      <div className="fk-sublabel">When</div>
                      <Select
                        size="sm"
                        value={r.when || null}
                        ariaLabel="Which question"
                        placeholder="Pick a question"
                        options={fields.map((b) => ({ value: b._id as string, label: b.title || "Untitled question" }))}
                        onChange={(when) => setRoute({ when })}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div className="fk-sublabel">is</div>
                      <DraftPill
                        value={r.value ?? ""}
                        placeholder="An answer"
                        aria-label="Which answer"
                        onCommit={(value) => setRoute({ value })}
                      />
                    </div>
                    <div style={{ flex: 1.4, minWidth: 190 }}>
                      <div className="fk-sublabel">send to</div>
                      <DraftPill
                        icon={<Mail size={15} strokeWidth={1.8} aria-hidden />}
                        value={r.to ?? ""}
                        placeholder="name@example.com"
                        aria-label="Send to"
                        onCommit={(to) => setRoute({ to })}
                      />
                    </div>
                    <IconButton
                      label={`Remove rule ${i + 1}`}
                      onClick={() => patchNotify({ routes: notify.routes.filter((_, j) => j !== i) })}
                    >
                      <Trash2 size={15} strokeWidth={1.8} aria-hidden />
                    </IconButton>
                  </div>
                );
              })}

              {notify.routes.length === 0 && (
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--color-text-tertiary)" }}>
                  No rules yet. Every response goes to {notify.to || "you"}.
                </p>
              )}

              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<Plus size={15} strokeWidth={1.8} aria-hidden />}
                  onClick={() => patchNotify({ routes: [...notify.routes, { when: "", value: "", to: "" }] })}
                >
                  Add a rule
                </Button>
              </div>
            </div>
          </Card>

          <section className="fk-panel">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <h3 style={{ margin: "0 0 6px" }}>Reply to the person who answered</h3>
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
                    detail: on ? "Everyone who answers gets a short reply" : "Nobody gets a reply from Formkit",
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
              <div className="fk-confirm">
                <Field label="Replies go to">
                  <DraftPill
                    size="md"
                    icon={<Reply size={17} strokeWidth={1.8} aria-hidden />}
                    value={notify.replyTo}
                    placeholder="you@example.com"
                    wrapStyle={{ maxWidth: 420 }}
                    onCommit={(replyTo) => patchNotify({ replyTo })}
                  />
                </Field>
                <Field label="Subject">
                  <DraftPill
                    size="md"
                    value={notify.confirmSubject}
                    wrapStyle={{ maxWidth: 520 }}
                    onCommit={(confirmSubject) => patchNotify({ confirmSubject })}
                  />
                </Field>
                <Field label="Message">
                  <DraftArea
                    rows={3}
                    value={notify.confirmBody}
                    onCommit={(confirmBody) => patchNotify({ confirmBody })}
                  />
                </Field>
                <Row label="Include their answers" hint="A plain summary of what they sent">
                  <Switch
                    checked={notify.confirmAttach}
                    label="Include their answers"
                    onChange={(confirmAttach) => patchNotify({ confirmAttach })}
                  />
                </Row>
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<Send size={15} strokeWidth={1.8} aria-hidden />}
                    disabled={!hasEmailQuestion}
                    title={hasEmailQuestion ? undefined : "Add an email question first"}
                    onClick={() => test("confirmation")}
                  >
                    Send me a test
                  </Button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {section === "security" && (
        <Card title="Security">
          <Row label="Password protection" hint="Respondents need a password to open the form">
            <Switch
              checked={security.password || pw !== null}
              label="Password protection"
              onChange={async (on) => {
                if (on) {
                  setPw("");
                  return;
                }
                setPw(null);
                if (security.passwordSet) {
                  await tracked(setPassword({ formId }));
                  toast("Password removed", { detail: "Anyone with the link can open the form" });
                }
              }}
            />
          </Row>
          {(pw !== null || security.password) && (
            <div className="fk-password">
              {security.passwordSet && pw === null ? (
                <>
                  <KeyRound size={16} strokeWidth={1.8} aria-hidden />
                  <span style={{ flex: 1, fontSize: 14 }}>A password is set. Share it with the people who should answer.</span>
                  <Button variant="secondary" size="sm" onClick={() => setPw("")}>
                    Change it
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    inputSize="sm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="A password for this form"
                    aria-label="Form password"
                    value={pw ?? ""}
                    onChange={(e) => setPw(e.target.value)}
                    wrapStyle={{ flex: 1, minWidth: 200 }}
                  />
                  <Button
                    size="sm"
                    disabled={(pw ?? "").trim().length < 4}
                    onClick={async () => {
                      try {
                        await tracked(setPassword({ formId, password: pw ?? "" }));
                        setPw(null);
                        toast("Password set", { detail: "People are asked for it before the first question" });
                      } catch (e) {
                        toast("That password was not set", {
                          detail: e instanceof Error ? e.message : undefined,
                          tone: "error",
                        });
                      }
                    }}
                  >
                    Set password
                  </Button>
                </>
              )}
            </div>
          )}
          <Row label="Spam check" hint="A quiet check on every submit. Only suspicious ones are asked to prove it.">
            <Switch checked={security.spam} label="Spam check" onChange={(spam) => patchSecurity({ spam })} />
          </Row>
          <Row label="One submission a minute per device" hint="Stops a script hammering the form">
            <Switch
              checked={security.rateLimit}
              label="One submission a minute per device"
              onChange={(rateLimit) => patchSecurity({ rateLimit })}
            />
          </Row>
          <Row label="Require email" hint="No anonymous responses">
            <Switch
              checked={security.requireEmail}
              label="Require email"
              onChange={(requireEmail) => patchSecurity({ requireEmail })}
            />
          </Row>
          {security.requireEmail && !hasEmailQuestion && (
            <div className="fk-note" style={{ marginTop: 12 }}>
              <TriangleAlert size={16} strokeWidth={1.8} aria-hidden />
              <span>This form has no email question yet, so nobody could submit it. Add one under Build.</span>
            </div>
          )}
        </Card>
      )}

      {section === "submission" && (
        <Card title="After submitting">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Thank-you headline">
              <DraftPill
                size="md"
                value={form.thanks?.title ?? "Thank you"}
                wrapStyle={{ maxWidth: 420 }}
                onCommit={(title) => patchThanks({ title })}
              />
            </Field>
            <Field
              label="Message"
              help={
                pipeGate.locked
                  ? "Quoting an answer with {{key}} — “Thanks {{name}}” — is part of Pro."
                  : "Quote an answer or a calculation by its key: “Thanks {{name}}, your total is {{total}}.”"
              }
            >
              <DraftArea
                rows={2}
                value={form.thanks?.message ?? ""}
                placeholder="Your answers are in. We will be in touch."
                onCommit={(message) => patchThanks({ message })}
              />
            </Field>
            <Field label="Button label" help="Leave it blank for no button.">
              <DraftPill
                size="md"
                value={form.thanks?.buttonLabel ?? ""}
                placeholder="Visit our website"
                wrapStyle={{ maxWidth: 320 }}
                onCommit={(buttonLabel) => patchThanks({ buttonLabel })}
              />
            </Field>
            <Field label="Button link">
              <DraftPill
                size="md"
                value={form.thanks?.buttonUrl ?? ""}
                placeholder="https://studionine.co"
                wrapStyle={{ maxWidth: 420 }}
                onCommit={(buttonUrl) => patchThanks({ buttonUrl })}
              />
            </Field>
            <Field
              label="Redirect URL"
              help="Sends people straight here after they submit, instead of the thank-you screen. Keys fill in: https://acme.com/thanks?name={{name}}"
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <DraftPill
                  size="md"
                  value={form.thanks?.redirect ?? ""}
                  placeholder="https://studionine.co/thanks"
                  wrapStyle={{ maxWidth: 420, flex: 1 }}
                  onCommit={(redirect) =>
                    redirect && redirectGate.locked ? openUpgrade({ feature: "forms.redirect" }) : patchThanks({ redirect })
                  }
                />
                {redirectGate.locked && <ProChip onClick={() => openUpgrade({ feature: "forms.redirect" })} />}
              </span>
            </Field>
          </div>
        </Card>
      )}

      {section === "ai" && <AiReplySection formId={formId} form={form} />}

      {section === "quiz" && <QuizSection formId={formId} form={form} />}

      {section === "connections" && <ConnectionsSection formId={formId} features={form.ownerPlan?.features} />}

      {section === "payments" && <PaymentsSection formId={formId} features={form.ownerPlan?.features} />}

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
                      style={{ background: e.state === "sent" ? "var(--green-100)" : "var(--red-100)" }}
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

      <section className="fk-panel fk-danger">
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 15.5, fontWeight: 500 }}>Delete this form</div>
          <div className="fk-proprow-hint" style={{ fontSize: 14, marginTop: 4 }}>
            It moves to the Deleted tab with its responses for 60 days, then goes for good.
          </div>
        </div>
        <Button
          variant="destructive"
          iconLeft={<Trash2 size={16} strokeWidth={1.8} aria-hidden />}
          onClick={() => setTrash(true)}
        >
          Delete form
        </Button>
      </section>

      {closing && (
        <CloseFormDialog
          formId={formId}
          status={closing === "reopen" ? "closed" : "published"}
          onClose={() => setClosingOpen(null)}
        />
      )}

      {trash && (
        <Modal
          title={`Delete ${form.title}?`}
          description="It moves to Deleted with its responses, and is removed for good after 60 days. You can restore it any time before then."
          onClose={() => setTrash(false)}
          width={460}
          footer={
            <>
              <Button variant="secondary" onClick={() => setTrash(false)}>
                Cancel
              </Button>
              <Button
                iconLeft={<Trash2 size={16} strokeWidth={1.8} aria-hidden />}
                onClick={async () => {
                  await tracked(softDelete({ formId }));
                  toast("Moved to Deleted", { detail: "Restore it from the Deleted tab within 60 days" });
                  router.push("/app/forms");
                }}
              >
                Move to Deleted
              </Button>
            </>
          }
        >
          {null}
        </Modal>
      )}
    </div>
  );
}
