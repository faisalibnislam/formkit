"use client";

import { saveBytes } from "./exporting";

/**
 * One response on paper: printed through the browser's own dialog, or saved
 * as a PDF file drawn here, so nothing about a respondent leaves the browser.
 */

export type ResponseDoc = {
  formTitle: string;
  name: string;
  email: string | null;
  submitted: string;
  meta: string[];
  tags: string[];
  partialNote: string | null;
  groups: { title: string; rows: { q: string; a: string }[] }[];
  note: string | null;
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function html(doc: ResponseDoc) {
  const groups = doc.groups
    .map(
      (g) =>
        `<section><h2>${esc(g.title)}</h2>${g.rows
          .map((r) => `<div class="qa"><div class="q">${esc(r.q)}</div><div class="a">${esc(r.a)}</div></div>`)
          .join("")}</section>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.name)} · ${esc(doc.formTitle)}</title>
<style>
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.5 -apple-system, "Segoe UI", Inter, Helvetica, Arial, sans-serif; color: #21282e; margin: 0; }
  .form { font-size: 9.5pt; color: #6b7680; margin: 0 0 4pt; }
  h1 { font-size: 18pt; font-weight: 600; letter-spacing: -.01em; margin: 0; }
  .email { color: #4b5560; margin: 2pt 0 10pt; }
  .meta { font-size: 9.5pt; color: #4b5560; margin: 0 0 6pt; }
  .tags { font-size: 9.5pt; margin: 0 0 12pt; }
  .tags span { display: inline-block; padding: 1pt 7pt; border-radius: 99pt; background: #eef1f4; margin-right: 4pt; }
  .partial { padding: 8pt 10pt; border-radius: 6pt; background: #fdf6dc; font-size: 10pt; margin: 0 0 14pt; }
  h2 { font-size: 10pt; font-weight: 500; color: #6b7680; margin: 16pt 0 6pt; }
  .qa { padding: 6pt 0 8pt; border-bottom: 0.5pt solid #d9dee3; break-inside: avoid; }
  .q { font-size: 9.5pt; color: #6b7680; margin-bottom: 2pt; }
  .a { white-space: pre-wrap; }
  .note { margin-top: 16pt; font-size: 10pt; }
</style></head><body>
<p class="form">${esc(doc.formTitle)}</p>
<h1>${esc(doc.name)}</h1>
${doc.email ? `<p class="email">${esc(doc.email)}</p>` : ""}
<p class="meta">${esc([doc.submitted, ...doc.meta].join("  ·  "))}</p>
${doc.tags.length ? `<p class="tags">${doc.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p>` : ""}
${doc.partialNote ? `<p class="partial"><strong>Started, never sent.</strong> ${esc(doc.partialNote)}</p>` : ""}
${groups}
${doc.note ? `<p class="note"><strong>Note:</strong> ${esc(doc.note)}</p>` : ""}
</body></html>`;
}

/** Print through a hidden frame, so the app itself never reflows for paper. */
export function printResponse(doc: ResponseDoc) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    return;
  }
  win.document.open();
  win.document.write(html(doc));
  win.document.close();
  const done = () => window.setTimeout(() => frame.remove(), 500);
  win.addEventListener("afterprint", done);
  window.setTimeout(() => {
    win.focus();
    win.print();
    // Some browsers never fire afterprint; clear up after a minute regardless.
    window.setTimeout(() => frame.remove(), 60_000);
  }, 60);
}

/* The PDF's standard fonts only know Windows-1252; anything else is folded to
   its plain letter where one exists. */
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function pdfText(s: string) {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    const c = ch.codePointAt(0)!;
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || CP1252_EXTRA.includes(ch) || ch === "\n") {
      out += ch;
      continue;
    }
    const plain = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    out += /^[\x20-\x7e]+$/.test(plain) ? plain : "?";
  }
  return out;
}

export function safeName(s: string) {
  return (
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "response"
  );
}

export async function downloadResponsePdf(doc: ResponseDoc, basename: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 48;
  const width = W - M * 2;
  let y = M;

  const ink = () => pdf.setTextColor(33, 40, 46);
  const quiet = () => pdf.setTextColor(107, 118, 128);
  const room = (h: number) => {
    if (y + h > H - M) {
      pdf.addPage();
      y = M;
    }
  };
  const write = (text: string, size: number, bold = false, gap = 4) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(pdfText(text), width) as string[];
    const lh = size * 1.4;
    for (const line of lines) {
      room(lh);
      pdf.text(line, M, y + size);
      y += lh;
    }
    y += gap;
  };

  quiet();
  write(doc.formTitle, 9.5);
  ink();
  write(doc.name, 18, true, 2);
  if (doc.email) {
    quiet();
    write(doc.email, 11);
  }
  quiet();
  write([doc.submitted, ...doc.meta].join("  ·  "), 9.5, false, 6);
  if (doc.tags.length) write(`Tags: ${doc.tags.join(", ")}`, 9.5, false, 8);
  if (doc.partialNote) {
    ink();
    write(`Started, never sent. ${doc.partialNote}`, 10, false, 8);
  }

  for (const g of doc.groups) {
    y += 8;
    quiet();
    write(g.title, 10, true, 4);
    for (const r of g.rows) {
      room(40);
      quiet();
      write(r.q, 9.5, false, 1);
      ink();
      write(r.a, 11, false, 6);
      pdf.setDrawColor(217, 222, 227);
      pdf.setLineWidth(0.5);
      pdf.line(M, y, W - M, y);
      y += 8;
    }
  }
  if (doc.note) {
    y += 6;
    ink();
    write(`Note: ${doc.note}`, 10);
  }

  const filename = `${safeName(basename)}.pdf`;
  saveBytes(pdf.output("arraybuffer"), filename, "application/pdf");
  return filename;
}
