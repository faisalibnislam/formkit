"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Mail } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { Panel, Row } from "./bits";

/**
 * Settings → Notifications. "Every form" sets the account's defaults — what
 * it is emailed about, and the recipient and wording every form starts from.
 * Picking one form changes just that form, the same settings its own
 * Settings tab shows.
 */

const VARS = ["{{name}}", "{{email}}", "{{form_name}}", "{{submitted_at}}"];

type Values = {
  newResponse: boolean;
  daily: boolean;
  weekly: boolean;
  to: string;
  subject: string;
  body: string;
};

export function NotificationsSection() {
  const viewer = useQuery(api.users.viewer, {});
  const forms = useQuery(api.forms.list, { filter: "all" });
  const [scope, setScope] = useState("all");

  if (!viewer) return null;

  return (
    <Panel
      title="Email me about"
      lede="For every form, or for one of them. A form's own choices win over these."
      aside={
        <Select
          size="sm"
          searchable
          ariaLabel="Which form"
          value={scope}
          onChange={setScope}
          options={[
            { value: "all", label: "Every form" },
            ...(forms?.forms ?? []).map((f) => ({ value: f._id, label: f.title })),
          ]}
        />
      }
    >
      {scope === "all" ? (
        <AccountDefaults key="all" values={viewer.emailPrefs} />
      ) : (
        <FormNotify key={scope} formId={scope as Id<"forms">} account={viewer.emailPrefs} ownerEmail={viewer.email} />
      )}
    </Panel>
  );
}

function AccountDefaults({ values }: { values: Values }) {
  const toast = useToast();
  const save = useMutation(api.users.setPreferences);
  return (
    <Editor
      values={values}
      onToggle={async (key, on) => {
        await save({ emailPrefs: { [key]: on } });
        toast(on ? "Turned on" : "Turned off", { detail: `${LABEL[key]} · every form` });
      }}
      onText={async (key, text) => {
        await save({ emailPrefs: { [key]: text } });
        toast("Saved", { detail: `${key === "to" ? "Recipient" : key === "subject" ? "Subject" : "Message"} · every form` });
      }}
    />
  );
}

function FormNotify({ formId, account, ownerEmail }: { formId: Id<"forms">; account: Values; ownerEmail: string }) {
  const toast = useToast();
  const form = useQuery(api.forms.get, { formId });
  const patch = useMutation(api.forms.patchSettings);
  if (!form) return null;
  const n = (form.notify ?? {}) as Partial<Values>;
  const values: Values = {
    newResponse: n.newResponse ?? account.newResponse,
    daily: n.daily ?? account.daily,
    weekly: n.weekly ?? account.weekly,
    to: n.to || account.to || ownerEmail,
    subject: n.subject || account.subject,
    body: n.body || account.body,
  };
  return (
    <Editor
      values={values}
      onToggle={async (key, on) => {
        await patch({ formId, key: "notify", patch: { [key]: on } });
        toast(on ? "Turned on" : "Turned off", { detail: `${LABEL[key]} · ${form.title}` });
      }}
      onText={async (key, text) => {
        await patch({ formId, key: "notify", patch: { [key]: text } });
        toast("Saved", { detail: form.title });
      }}
    />
  );
}

const LABEL = { newResponse: "New response", daily: "Daily summary", weekly: "Weekly report" } as const;

function Editor({
  values,
  onToggle,
  onText,
}: {
  values: Values;
  onToggle: (key: "newResponse" | "daily" | "weekly", on: boolean) => void;
  onText: (key: "to" | "subject" | "body", text: string) => void;
}) {
  const [draft, setDraft] = useState<Partial<Record<"to" | "subject" | "body", string>>>({});
  const text = (k: "to" | "subject" | "body") => draft[k] ?? values[k];
  const commit = (k: "to" | "subject" | "body") => {
    if (draft[k] !== undefined && draft[k] !== values[k]) onText(k, draft[k]!.trim());
    setDraft((d) => {
      const next = { ...d };
      delete next[k];
      return next;
    });
  };

  return (
    <>
      <Row label="New response" hint="Email me whenever someone submits">
        <Switch checked={values.newResponse} label="New response" onChange={(on) => onToggle("newResponse", on)} />
      </Row>
      <Row label="Daily summary" hint="One email at 8am with yesterday’s responses">
        <Switch checked={values.daily} label="Daily summary" onChange={(on) => onToggle("daily", on)} />
      </Row>
      <Row label="Weekly report" hint="Completion rate and drop-off, every Monday">
        <Switch checked={values.weekly} label="Weekly report" onChange={(on) => onToggle("weekly", on)} />
      </Row>
      <div className="fk-setpanel-form" style={{ marginTop: 18 }}>
        <Field label="Recipient" help="Several addresses? Separate them with commas.">
          <Input
            icon={<Mail size={17} strokeWidth={1.8} aria-hidden />}
            value={text("to")}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            onBlur={() => commit("to")}
          />
        </Field>
        <Field label="Subject">
          <Input
            value={text("subject")}
            onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            onBlur={() => commit("subject")}
          />
        </Field>
        <Field label="Message">
          <Textarea
            rows={3}
            value={text("body")}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            onBlur={() => commit("body")}
          />
        </Field>
        <div className="fk-varchips">
          <span>Variables</span>
          {VARS.map((v) => (
            <span key={v} className="fk-varchip">
              {v}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
