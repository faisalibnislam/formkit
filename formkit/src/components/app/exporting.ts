"use client";

import { useCallback } from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { csv, xlsx, XLSX_TYPE, type Sheet } from "../../../convex/model/sheet";
import { useToast } from "@/components/ui/Toast";

/**
 * Downloads. Excel means a real .xlsx - Excel opens it without asking whether
 * to trust it - and CSV carries a byte-order mark so accented names survive
 * being double-clicked open.
 */

export type Format = "csv" | "xlsx";

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

/** One file from one or more sheets. A CSV holds the first sheet only. */
export function downloadSheets(sheets: Sheet[], basename: string, format: Format) {
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
        const sheet: { filename: string; title: string; columns: string[]; rows: string[][] } =
          req.what === "contacts"
            ? {
                title: "Contacts",
                ...(await convex.query(api.responses.contactsForExport, { formId: req.formId })),
              }
            : await convex.query(api.responses.forExport, {
                formId: req.formId,
                ids: req.ids,
                from: req.from,
                to: req.to,
                includePartial: req.includePartial,
              });
        const title = sheet.title;
        const filename = downloadSheets(
          [{ name: title, columns: sheet.columns, rows: sheet.rows }],
          sheet.filename,
          req.format,
        );
        void record({
          formId: req.formId,
          what: req.what,
          format: req.format,
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
    [convex, record, toast],
  );
}
