"use client";

import { useViewer } from "@/lib/seed";
import { useState } from "react";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { useFlag } from "../useFlags";
import { Download, FileSpreadsheet, FileText, Mail, Send } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, Field, Input, Select, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { relativeTime } from "../bits";
import { useExporter } from "../exporting";
import { downloadAnalytics } from "../analyticsExport";
import { Panel, Row, errorText } from "./bits";
import { PageSkeleton } from "../Skeleton";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { upgradeOnPlanError, useGate } from "@/components/plan/usePlan";

/**
 * Settings → Exports: take everything out, have a copy of each response
 * emailed as it arrives, see what Formkit has sent, and fetch any recent
 * export again.
 */

const DAY = 24 * 60 * 60 * 1000;
const RANGES = [
  { value: "all", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

function fromOf(range: string, now: number) {
  if (range === "all") return undefined;
  if (range === "year") return new Date(new Date(now).getFullYear(), 0, 1).getTime();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime() - (Number(range) - 1) * DAY;
}

export function ExportsSection() {
  return (
    <>
      <ExportPanel />
      <EmailLog />
      <EmailCopy />
      <Recent />
    </>
  );
}

function ExportPanel() {
  const toast = useToast();
  const exportRows = useExporter();
  const forms = useQuery(api.forms.list, { filter: "all" });
  const emailIt = useAction(api.notifications.exportByEmail);
  const excel = useFlag("exports.xlsx");
  const excelGate = useGate("exports.xlsx");
  const [form, setForm] = useState("all");
  const [range, setRange] = useState("all");
  const [partials, setPartials] = useState(false);
  const [to, setTo] = useState("");
  const [now] = useState(() => Date.now());
  const formId = form === "all" ? undefined : (form as Id<"forms">);
  const from = fromOf(range, now);
  const ready = useQuery(api.responses.count, { formId, from, includePartial: partials });

  return (
    <Panel
      title="Export responses"
      lede="Download everything people have sent you. Exports include every answer, the submission time and the source."
    >
      <div className="fk-fieldgrid">
        <Field label="Which form">
          <Select
            searchable
            ariaLabel="Which form"
            value={form}
            onChange={setForm}
            options={[
              { value: "all", label: "Every form" },
              ...(forms?.forms ?? []).map((f) => ({ value: f._id, label: f.title })),
            ]}
          />
        </Field>
        <Field label="Date range">
          <Select ariaLabel="Date range" value={range} onChange={setRange} options={RANGES} />
        </Field>
      </div>
      <Row label="Include incomplete responses" hint="Partial submissions people never finished">
        <Switch checked={partials} label="Include incomplete responses" onChange={setPartials} />
      </Row>
      <div className="fk-setpanel-actions">
        {excel && (
          <Button
            iconLeft={<FileSpreadsheet size={16} strokeWidth={1.8} aria-hidden />}
            disabled={!ready?.n}
            onClick={excelGate.guard(() => void exportRows({ what: "responses", format: "xlsx", formId, from, includePartial: partials }))}
          >
            Download Excel
            {excelGate.locked && <ProChip />}
          </Button>
        )}
        <Button
          variant="secondary"
          iconLeft={<FileText size={16} strokeWidth={1.8} aria-hidden />}
          disabled={!ready?.n}
          onClick={() => void exportRows({ what: "responses", format: "csv", formId, from, includePartial: partials })}
        >
          Download CSV
        </Button>
        <span className="fk-range-note">
          {ready === undefined
            ? "Counting…"
            : ready.n === 1 && !ready.more
              ? "1 response ready"
              : `${ready.n.toLocaleString("en-US")}${ready.more ? "+" : ""} responses ready`}
        </span>
      </div>
      <div className="fk-emailexport">
        <Input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Where to email the export"
          placeholder="Or email it. Leave blank to send it to yourself"
          icon={<Mail size={17} strokeWidth={1.8} aria-hidden />}
          wrapStyle={{ flex: 1, minWidth: 220 }}
        />
        <Button
          variant="secondary"
          disabled={!ready?.n}
          iconLeft={<Send size={16} strokeWidth={1.8} aria-hidden />}
          onClick={async () => {
            try {
              const r = await emailIt({
                formId,
                to: to.trim() || undefined,
                from,
                includePartial: partials,
                format: excel && !excelGate.locked ? "xlsx" : "csv",
              });
              if (r.state === "sent")
                toast(`Sent to ${r.to}`, { detail: `${excel && !excelGate.locked ? "An Excel" : "A CSV"} file is attached` });
              else toast("That export did not go out", { detail: r.detail, tone: "error" });
            } catch (e) {
              toast("That export did not go out", { detail: errorText(e, ""), tone: "error" });
            }
          }}
        >
          Email it
        </Button>
      </div>
    </Panel>
  );
}

function EmailLog() {
  const log = useQuery(api.notifications.log, {});
  return (
    <Panel title="What Formkit has sent" lede="Every notification and confirmation that went out on your behalf, newest first.">
      {log && log.length === 0 ? (
        <p className="fk-setpanel-empty">Nothing yet. This fills up as people answer your forms.</p>
      ) : (
        <div className="fk-maillog">
          {(log ?? []).map((m) => (
            <div key={m._id} className="fk-maillog-row">
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="fk-maillog-subject">{m.subject}</span>
                <span className="fk-maillog-meta">
                  {m.kind[0]!.toUpperCase() + m.kind.slice(1)}
                  {m.form ? ` · ${m.form}` : ""} · to {m.to}
                  {m.state === "failed" && m.detail ? ` · ${m.detail}` : ""}
                </span>
              </span>
              {m.state === "failed" && <Badge tone="error">Failed</Badge>}
              <span className="fk-maillog-at">{relativeTime(m.at)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function EmailCopy() {
  const toast = useToast();
  const viewer = useViewer();
  const save = useMutation(api.users.setPreferences);
  const gate = useGate("exports.copy");
  const [draft, setDraft] = useState<string | null>(null);
  if (!viewer) return <PageSkeleton kind="panel" />;
  const to = draft ?? viewer.emailCopy.to;
  return (
    <Panel
      title="Email a copy"
      lede="Send every new response straight to an inbox as it arrives, with every answer and not just a notice."
      aside={gate.locked ? <ProChip /> : null}
    >
      <Row label="Email each response">
        <Switch
          checked={viewer.emailCopy.on && !gate.locked}
          label="Email each response"
          onChange={async (on) => {
            if (on && gate.locked) return gate.guard(() => undefined)();
            try {
              await save({ emailCopy: { on, to } });
              toast(on ? "Copies on" : "Copies off", { detail: on ? `Each new response goes to ${to}` : undefined });
            } catch (e) {
              if (!upgradeOnPlanError(e)) toast(errorText(e, "That did not save."));
            }
          }}
        />
      </Row>
      <div style={{ marginTop: 14 }}>
        <Field label="Send to">
          <Input
            icon={<Mail size={17} strokeWidth={1.8} aria-hidden />}
            value={to}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={async () => {
              if (draft !== null && draft.trim() !== viewer.emailCopy.to) {
                await save({ emailCopy: { to: draft.trim() } });
                toast("Saved", { detail: `Copies go to ${draft.trim()}` });
              }
              setDraft(null);
            }}
          />
        </Field>
      </div>
    </Panel>
  );
}

function Recent() {
  const toast = useToast();
  const convex = useConvex();
  const exportRows = useExporter();
  const recent = useQuery(api.exports.recent, {});
  if (!recent || recent.length === 0) {
    return (
      <Panel title="Recent exports">
        <p className="fk-setpanel-empty">Files you download or email from Responses, Analytics or here appear in this list.</p>
      </Panel>
    );
  }
  return (
    <Panel title="Recent exports">
      <div className="fk-maillog">
        {recent.map((x) => (
          <div key={x._id} className="fk-maillog-row">
            <span className="fk-export-mark" aria-hidden>
              {x.format === "xlsx" ? <FileSpreadsheet size={17} strokeWidth={1.8} /> : <FileText size={17} strokeWidth={1.8} />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="fk-maillog-subject">{x.filename}</span>
              <span className="fk-maillog-meta">
                {x.format === "xlsx" ? "Excel" : "CSV"} · {x.what} · {x.formTitle ?? "a deleted form"} ·{" "}
                {x.rows.toLocaleString("en-US")} {x.what === "analytics" ? "days" : "rows"}
                {x.emailedTo ? ` · emailed to ${x.emailedTo}` : ""} · {relativeTime(x.at)}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={x.formTitle === null}
              iconLeft={<Download size={15} strokeWidth={1.8} aria-hidden />}
              onClick={async () => {
                const formId = (x.formId ?? undefined) as Id<"forms"> | undefined;
                if (x.what === "analytics") {
                  const data = await convex.query(api.analytics.overview, {
                    formId,
                    from: x.from ?? undefined,
                    to: x.to ?? undefined,
                  });
                  await downloadAnalytics(data, x.formTitle ?? "All forms", x.format);
                  toast(`Downloading ${x.filename}`);
                  return;
                }
                await exportRows({
                  what: x.what,
                  format: x.format,
                  formId,
                  ids: (x.ids ?? undefined) as Id<"responses">[] | undefined,
                  from: x.from ?? undefined,
                  to: x.to ?? undefined,
                });
              }}
            >
              Download
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
