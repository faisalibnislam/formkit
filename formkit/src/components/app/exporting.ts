"use client";

import { useCallback } from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Sheet } from "../../../convex/model/sheet";
import { contactsSheet, readPages, responsesSheet } from "../../../convex/model/exportSheet";
import { useToast } from "@/components/ui/Toast";
import type { FunctionReturnType } from "convex/server";
import type { ResponseDoc } from "./responseDoc";

/**
 * Downloads. Excel means a real .xlsx - Excel opens it without asking whether
 * to trust it - and CSV carries a byte-order mark so accented names survive
 * being double-clicked open.
 */

export type Format = "csv" | "xlsx" | "json" | "pdf-zip" | "pdf-one";
/** What a spreadsheet download can be. */
export type SheetFormat = "csv" | "xlsx";

/** The most responses one PDF download takes. */
export const PDF_CAP = 500;

const FORMAT_NAME: Record<Format, string> = {
  csv: "CSV file",
  xlsx: "Excel file",
  json: "JSON file",
  "pdf-zip": "PDFs",
  "pdf-one": "PDF",
};

export function saveBytes(bytes: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * One file from one or more sheets. A CSV holds the first sheet only. The
 * writer (and the zip library an .xlsx needs) loads with the first export.
 */
export async function downloadSheets(sheets: Sheet[], basename: string, format: SheetFormat) {
  const { csv, xlsx, XLSX_TYPE } = await import("../../../convex/model/sheet");
  const filename = `${basename}.${format}`;
  if (format === "xlsx") saveBytes(xlsx(sheets) as BlobPart, filename, XLSX_TYPE);
  else saveBytes("﻿" + csv(sheets[0]!), filename, "text/csv;charset=utf-8");
  return filename;
}

export type ExportRequest = {
  what: "responses" | "contacts";
  format: Format;
  formId?: Id<"forms">;
  ids?: Id<"responses">[];
  from?: number;
  to?: number;
  includePartial?: boolean;
};

/**
 * Fetch the rows, save the file, remember the export for Settings → Exports,
 * and say how many rows went out.
 */
export function useExporter() {
  const convex = useConvex();
  const record = useMutation(api.exports.record);
  const toast = useToast();

  return useCallback(
    async (req: ExportRequest) => {
      try {
        if (req.what === "responses" && (req.format === "json" || req.format === "pdf-zip" || req.format === "pdf-one")) {
          return await exportRecords(req);
        }
        // Read a page at a time, so an export is never one huge read.
        const sheet =
          req.what === "contacts"
            ? contactsSheet(
                await readPages((cursor) => convex.query(api.responses.contactsExportPage, { formId: req.formId, cursor })),
              )
            : responsesSheet(
                await readPages((cursor) =>
                  convex.query(api.responses.exportPage, {
                    formId: req.formId,
                    ids: req.ids,
                    from: req.from,
                    to: req.to,
                    includePartial: req.includePartial,
                    cursor,
                  }),
                ),
              );
        const title = sheet.title;
        const filename = await downloadSheets(
          [{ name: title, columns: sheet.columns, rows: sheet.rows }],
          sheet.filename,
          req.format === "xlsx" ? "xlsx" : "csv",
        );
        void record({
          formId: req.formId,
          what: req.what,
          format: req.format === "xlsx" ? "xlsx" : "csv",
          filename,
          rows: sheet.rows.length,
          from: req.from,
          to: req.to,
          ids: req.ids,
        });
        const noun = req.what === "contacts" ? "contact" : "response";
        toast(`${req.format === "xlsx" ? "Excel" : "CSV"} file downloaded`, {
          detail: `${sheet.rows.length.toLocaleString("en-US")} ${noun}${sheet.rows.length === 1 ? "" : "s"} · ${filename}`,
        });
        return sheet.rows.length;
      } catch (e) {
        toast("That export did not work", {
          detail: e instanceof Error ? e.message : undefined,
          tone: "error",
        });
        return 0;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- exportRecords is rebuilt from the same three
    [convex, record, toast],
  );

  /** JSON, or PDFs: each response as API v2 returns it, a page at a time. */
  async function exportRecords(req: ExportRequest) {
    const pdf = req.format === "pdf-zip" || req.format === "pdf-one";
    const pages = [];
    let cursor: string | null = null;
    let rows = 0;
    for (;;) {
      const page: FunctionReturnType<typeof api.responses.jsonPage> = await convex.query(api.responses.jsonPage, {
        formId: req.formId,
        ids: req.ids,
        from: req.from,
        to: req.to,
        includePartial: req.includePartial,
        cursor,
      });
      pages.push(page);
      rows += page.rows.length;
      if (page.done || (pdf && rows >= PDF_CAP)) break;
      cursor = page.cursor;
    }
    const first = pages[0]!;
    const all = pages.flatMap((p) => p.rows).slice(0, pdf ? PDF_CAP : undefined);
    let filename: string;
    if (req.format === "json") {
      filename = `${first.filename}.json`;
      const body = { form: first.title, exportedAt: new Date().toISOString(), count: all.length, responses: all };
      saveBytes(JSON.stringify(body, null, 2), filename, "application/json");
    } else {
      if (!all.length) throw new Error("There are no responses to put in a PDF.");
      const { downloadResponsePdfs } = await import("./responseDoc");
      const docs = all.map((r) => ({ doc: docOf(r, first.title), name: `${r.submittedAt.slice(0, 10)} ${r.respondent.name ?? r.respondent.email ?? "response"}` }));
      filename = await downloadResponsePdfs(docs, first.filename, req.format === "pdf-zip" ? "zip" : "one");
    }
    void record({ formId: req.formId, what: "responses", format: req.format, filename, rows: all.length, from: req.from, to: req.to, ids: req.ids });
    const more = pdf && rows > PDF_CAP;
    toast(`${FORMAT_NAME[req.format]} downloaded`, {
      detail: more
        ? `The first ${PDF_CAP} responses · ${filename}. Narrow the dates or filters for the rest.`
        : `${all.length.toLocaleString("en-US")} response${all.length === 1 ? "" : "s"} · ${filename}`,
    });
    return all.length;
  }
}

type JsonRow = FunctionReturnType<typeof api.responses.jsonPage>["rows"][number];

/** A response from the JSON export, as a page of paper. */
function docOf(r: JsonRow, formTitle: string): ResponseDoc {
  const when = new Date(r.submittedAt).toLocaleString(undefined, { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });
  const money = (minor: number, cur: string) => {
    const major = ["jpy", "krw", "vnd", "clp"].includes(cur) ? minor : minor / 100;
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: cur.toUpperCase() }).format(major);
    } catch {
      return `${major.toFixed(2)} ${cur.toUpperCase()}`;
    }
  };
  const groups: ResponseDoc["groups"] = [
    {
      title: "Answers",
      rows: r.answers.map((a) => ({
        q: a.question,
        a: a.value === null ? "Not answered" : Array.isArray(a.value) ? a.value.join(", ") : a.fileUrl ? `Attached: ${a.value}` : String(a.value),
      })),
    },
  ];
  if (r.payment && r.payment.status !== "none") {
    groups.push({
      title: "Payment",
      rows: [
        { q: "Amount", a: money(r.payment.amount, r.payment.currency) },
        { q: "Status", a: r.payment.status === "paid" ? "Paid" : r.payment.status === "pending" ? "Awaiting payment" : "Not paid" },
      ],
    });
  }
  return {
    formTitle: "formTitle" in r && typeof r.formTitle === "string" ? r.formTitle : formTitle,
    name: r.respondent.name ?? r.respondent.email ?? "Anonymous",
    email: r.respondent.name ? r.respondent.email : null,
    submitted: when,
    meta: [r.respondent.phone, r.respondent.company, r.source].filter((x): x is string => !!x),
    tags: r.tags,
    partialNote: r.complete ? null : "They stopped before the end.",
    groups,
    note: null,
  };
}
