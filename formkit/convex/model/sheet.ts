import { strToU8, zipSync } from "fflate";

/**
 * Spreadsheets, written by hand so an export is a real file Excel opens
 * without a warning, and so the same bytes can be downloaded in the browser or
 * attached to an email from the server.
 *
 * An .xlsx is a zip of a few XML parts. Every cell is written as an inline
 * string, except values that are plainly numbers, so Excel neither drops the
 * leading zero from a phone number nor turns an answer into a date.
 */

export type Sheet = { name: string; columns: string[]; rows: string[][] };

/** Characters XML 1.0 refuses, which would make Excel call the file corrupt. */
const INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

function esc(value: string) {
  return value
    .replace(INVALID, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function column(i: number) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const NUMBER = /^-?(0|[1-9]\d{0,14})(\.\d+)?$/;

function cell(ref: string, value: string, header: boolean) {
  if (!header && NUMBER.test(value)) return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${header ? ' s="1"' : ""}><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function worksheet(sheet: Sheet) {
  const all = [sheet.columns, ...sheet.rows];
  const widths = sheet.columns.map((_, c) =>
    Math.min(60, Math.max(10, ...all.slice(0, 200).map((r) => (r[c] ?? "").length + 2))),
  );
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const body = all
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">${r.map((v, ci) => cell(`${column(ci)}${ri + 1}`, v ?? "", ri === 0)).join("")}</row>`,
    )
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`
  );
}

/** Sheet names are at most 31 characters and cannot hold a few symbols. */
function sheetName(name: string, taken: Set<string>) {
  const base = (name.replace(/[\\/?*[\]:]/g, " ").trim() || "Sheet").slice(0, 31);
  let out = base;
  for (let n = 2; taken.has(out.toLowerCase()); n++) out = `${base.slice(0, 27)} (${n})`;
  taken.add(out.toLowerCase());
  return out;
}

export function xlsx(sheets: Sheet[]): Uint8Array {
  const taken = new Set<string>();
  const names = sheets.map((s) => sheetName(s.name, taken));
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join("") +
        "</Types>",
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
    ),
    "xl/workbook.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        "</sheets></workbook>",
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join("") +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        "</Relationships>",
    ),
    "xl/styles.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        "</styleSheet>",
    ),
  };
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(worksheet(s));
  });
  return zipSync(files, { level: 6 });
}

/**
 * A cell is quoted whenever a comma, a quote or a newline would break it. An
 * answer that a spreadsheet would read as a formula is prefixed with an
 * apostrophe - respondents write these cells, not the owner. A phone number
 * like +44 7700 900100 is left alone.
 */
function csvCell(raw: string) {
  const value = /^[=@\t\r]/.test(raw) || /^[+-](?![\d\s().]*$)/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function csv(sheet: Pick<Sheet, "columns" | "rows">): string {
  return [sheet.columns, ...sheet.rows].map((r) => r.map((v) => csvCell(v ?? "")).join(",")).join("\r\n");
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
