"use client";

import { useViewer } from "@/lib/seed";
import { useState, useSyncExternalStore } from "react";
import { useMutation, useQuery } from "convex/react";
import { Mail } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { Panel, Row } from "./bits";
import { browserAlertsOn, browserAlertsSupported, setBrowserAlerts } from "../useInboxAlerts";
import { PageSkeleton } from "../Skeleton";
import { EmailDomainPanel } from "./Domains";

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
  const viewer = useViewer();
  const forms = useQuery(api.forms.list, { filter: "all" });
  const [scope, setScope] = useState("all");

  if (!viewer) return <PageSkeleton kind="panel" />;

  return (
    <>
      <InApp prefs={viewer.inAppPrefs} emailComments={viewer.emailPrefs.comments} />
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
    <EmailDomainPanel />
    </>
  );
}

type InAppPrefs = {
  responses: boolean;
  sharedResponses: boolean;
  comments: boolean;
  sharing: boolean;
  forms: boolean;
  security: boolean;
};

const IN_APP: { key: keyof InAppPrefs; label: string; hint: string }[] = [
  { key: "sharing", label: "Sharing", hint: "Someone adds you to a form, changes your role or removes you, or joins a form you shared" },
  { key: "comments", label: "Comments", hint: "New comments on your forms, replies to you, and when someone @mentions you" },
  { key: "responses", label: "Responses to my forms", hint: "New answers, gathered into one notice per form until you look" },
  { key: "sharedResponses", label: "Responses to forms shared with me", hint: "The same, for forms other people own and let you read" },
  { key: "forms", label: "Form changes", hint: "A form is published, unpublished, closed or closes itself" },
  { key: "security", label: "Security", hint: "New sign-ins, and changes to your password, email or two-factor" },
];

/** Whether this browser's alerts are on, kept in step with the switch. */
function useBrowserAlerts() {
  return useSyncExternalStore(
    (on) => {
      window.addEventListener("storage", on);
      window.addEventListener("fk:browser-alerts", on);
      return () => {
        window.removeEventListener("storage", on);
        window.removeEventListener("fk:browser-alerts", on);
      };
    },
    () => browserAlertsOn(),
    () => false,
  );
}

function InApp({ prefs, emailComments }: { prefs: InAppPrefs; emailComments: boolean }) {
  const toast = useToast();
  const save = useMutation(api.users.setPreferences);
  const browser = useBrowserAlerts();
  // Read after mount, so the server and the first client render agree.
  const supported = useSyncExternalStore(
    () => () => {},
    () => browserAlertsSupported(),
    () => true,
  );
  return (
    <Panel
      title="In the app"
      lede="What reaches the bell. Formkit announcements and anything about your account's standing always do."
    >
      {IN_APP.map((row) => (
        <Row key={row.key} label={row.label} hint={row.hint}>
          <Switch
            checked={prefs[row.key]}
            label={row.label}
            onChange={async (on) => {
              await save({ inAppPrefs: { [row.key]: on } });
              toast(on ? "Turned on" : "Turned off", { detail: `${row.label} · in the app` });
            }}
          />
        </Row>
      ))}
      <Row
        label="Email replies and mentions I have not seen"
        hint="If a reply or @mention is still unread ten minutes later, it comes by email once"
      >
        <Switch
          checked={emailComments}
          label="Email replies and mentions I have not seen"
          onChange={async (on) => {
            await save({ emailPrefs: { comments: on } });
            toast(on ? "Turned on" : "Turned off", { detail: "Emails for unseen replies and mentions" });
          }}
        />
      </Row>
      <Row
        label="Browser alerts on this device"
        hint={
          supported
            ? "A system notification when something arrives while Formkit is open in the background"
            : "This browser does not offer notifications"
        }
      >
        <Switch
          checked={browser}
          label="Browser alerts on this device"
          onChange={async (on) => {
            const result = await setBrowserAlerts(on);
            window.dispatchEvent(new Event("fk:browser-alerts"));
            if (result === "denied") {
              toast("The browser said no", {
                detail: "Allow notifications for this site in the browser's settings, then try again.",
                tone: "error",
              });
            } else if (result === "unsupported") {
              toast("This browser does not offer notifications", { tone: "error" });
            } else {
              toast(result === "on" ? "Browser alerts on" : "Browser alerts off", { detail: "On this device" });
            }
          }}
        />
      </Row>
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
