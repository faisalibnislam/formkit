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

/* ------------------------------------------------------------------ */
/* PDF files                                                           */
/*                                                                     */
/* A response in Western European text is drawn with the PDF's own     */
/* fonts: small, sharp, its words selectable. Anything else - Arabic,  */
/* Hindi, Bengali, Japanese, Chinese, Greek, Cyrillic - the PDF fonts  */
/* can't write, and the PDF library can't shape the scripts that join  */
/* or reorder their letters, so the browser lays the pages out (with   */
/* the fonts on this device, in the right direction) and they go into  */
/* the file as pictures.                                               */
/* ------------------------------------------------------------------ */

const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Whether a character the PDF's standard fonts can write (Windows-1252). */
const writable = (ch: string) => {
  const c = ch.codePointAt(0)!;
  return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || CP1252_EXTRA.includes(ch) || ch === "\n";
};

/** Text for the standard fonts: accents folded where that is all it takes. */
function pdfText(s: string) {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    if (writable(ch)) {
      out += ch;
      continue;
    }
    const plain = ch.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    out += /^[\x20-\x7e]+$/.test(plain) ? plain : "?";
  }
  return out;
}

const textOf = (doc: ResponseDoc) =>
  [doc.formTitle, doc.name, doc.email ?? "", doc.submitted, ...doc.meta, ...doc.tags, doc.partialNote ?? "", doc.note ?? "",
    ...doc.groups.flatMap((g) => [g.title, ...g.rows.flatMap((r) => [r.q, r.a])])].join("\n");

/** Whether the browser has to lay this response out: some of it the standard fonts can't write. */
export function needsBrowserText(doc: ResponseDoc) {
  for (const ch of textOf(doc).normalize("NFC")) {
    if (writable(ch)) continue;
    const plain = ch.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    if (!/^[\x20-\x7e]+$/.test(plain)) return true;
  }
  return false;
}

export function safeName(s: string) {
  return (
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "response"
  );
}

type Pdf = InstanceType<(typeof import("jspdf"))["jsPDF"]>;
const MARGIN = 48;

/** One response in the PDF's own fonts, from the top of a fresh page. */
function drawVector(pdf: Pdf, doc: ResponseDoc) {
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = MARGIN;
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
}

/* The browser's layout: A4 at 96 dots an inch, drawn at twice that. */
const PAGE_W = 794;
const PAGE_H = 1123;
const PAD = 64;
const SCALE = 2;
const FONTS =
  '-apple-system, "Segoe UI", Inter, "Noto Sans", "Noto Sans Arabic", "Noto Sans Devanagari", "Noto Sans Bengali", "Hiragino Sans", "Noto Sans CJK JP", "Noto Sans SC", "Microsoft YaHei", "Nirmala UI", Tahoma, sans-serif';
const PAGE_CSS = `
.p{box-sizing:border-box;width:${PAGE_W}px;height:${PAGE_H}px;padding:${PAD}px;background:#fff;color:#21282e;font:14.5px/1.5 ${FONTS};overflow:hidden}
.p *{box-sizing:border-box}
.f{font-size:12.5px;color:#6b7680;margin:0 0 5px}
.h{font-size:24px;font-weight:600;margin:0}
.e{color:#4b5560;margin:3px 0 12px}
.m{font-size:12.5px;color:#4b5560;margin:0 0 8px}
.t span{display:inline-block;padding:1px 9px;border-radius:99px;background:#eef1f4;margin:0 5px 4px 0;font-size:12.5px}
.w{padding:10px 13px;border-radius:8px;background:#fdf6dc;font-size:13px;margin:0 0 16px}
.g{font-size:13px;font-weight:500;color:#6b7680;margin:20px 0 8px}
.qa{padding:8px 0 10px;border-bottom:1px solid #d9dee3}
.q{font-size:12.5px;color:#6b7680;margin-bottom:3px}
.a{white-space:pre-wrap;overflow-wrap:anywhere}
.n{margin-top:18px;font-size:13px}`;

/** The response as blocks, each kept whole on one page where it fits. */
function blocksOf(doc: ResponseDoc) {
  const el = (cls: string, text: string, tag = "div") => {
    const n = document.createElement(tag);
    n.className = cls;
    n.dir = "auto";
    n.textContent = text;
    return n;
  };
  const out: HTMLElement[] = [];
  const head = document.createElement("div");
  head.append(el("f", doc.formTitle), el("h", doc.name));
  if (doc.email) head.append(el("e", doc.email));
  head.append(el("m", [doc.submitted, ...doc.meta].join("  ·  ")));
  if (doc.tags.length) {
    const t = document.createElement("div");
    t.className = "t";
    for (const tag of doc.tags) t.append(el("", tag, "span"));
    head.append(t);
  }
  if (doc.partialNote) head.append(el("w", `Started, never sent. ${doc.partialNote}`));
  out.push(head);
  for (const g of doc.groups) {
    out.push(el("g", g.title));
    for (const r of g.rows) {
      const qa = document.createElement("div");
      qa.className = "qa";
      qa.append(el("q", r.q), el("a", r.a));
      out.push(qa);
    }
  }
  if (doc.note) out.push(el("n", `Note: ${doc.note}`));
  return out;
}

/** Splits the blocks into pages by their measured heights. */
function paginate(blocks: HTMLElement[]) {
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:fixed;left:-20000px;top:0;visibility:hidden";
  const style = document.createElement("style");
  style.textContent = PAGE_CSS;
  const page = document.createElement("div");
  page.className = "p";
  page.style.height = "auto";
  probe.append(style, page);
  document.body.appendChild(probe);
  const room = PAGE_H - PAD * 2;
  const pages: HTMLElement[][] = [[]];
  let used = 0;
  try {
    for (const b of blocks) {
      page.appendChild(b);
      const cs = getComputedStyle(b);
      const h = b.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
      if (used + h > room && pages[pages.length - 1]!.length) {
        pages.push([]);
        used = 0;
      }
      pages[pages.length - 1]!.push(b);
      used += h;
    }
  } finally {
    probe.remove();
  }
  return pages;
}

/** One page, as the browser draws it, as a JPEG. */
async function pictureOf(blocks: HTMLElement[]) {
  const page = document.createElement("div");
  page.className = "p";
  const style = document.createElement("style");
  style.textContent = PAGE_CSS;
  page.append(style, ...blocks);
  const xhtml = new XMLSerializer().serializeToString(page);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}"><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  const img = new Image();
  img.decoding = "async";
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W * SCALE;
  canvas.height = PAGE_H * SCALE;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#fff";
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

/** One response laid out by the browser, a picture per page. */
async function drawBrowser(pdf: Pdf, doc: ResponseDoc, first: boolean) {
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const pages = paginate(blocksOf(doc));
  for (const [i, blocks] of pages.entries()) {
    if (!(first && i === 0)) pdf.addPage();
    pdf.addImage(await pictureOf(blocks), "JPEG", 0, 0, W, H);
  }
}

/** One PDF holding every response given, each from a fresh page. */
export async function responsesPdf(docs: ResponseDoc[]) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  for (const [i, doc] of docs.entries()) {
    if (needsBrowserText(doc)) await drawBrowser(pdf, doc, i === 0);
    else {
      if (i > 0) pdf.addPage();
      drawVector(pdf, doc);
    }
  }
  return pdf.output("arraybuffer");
}

export async function downloadResponsePdf(doc: ResponseDoc, basename: string) {
  const filename = `${safeName(basename)}.pdf`;
  saveBytes(await responsesPdf([doc]), filename, "application/pdf");
  return filename;
}

/** Many responses: one combined PDF, or a zip with a PDF each. */
export async function downloadResponsePdfs(
  docs: { doc: ResponseDoc; name: string }[],
  basename: string,
  shape: "zip" | "one",
  onProgress?: (done: number) => void,
) {
  if (shape === "one") {
    const filename = `${safeName(basename)}.pdf`;
    saveBytes(await responsesPdf(docs.map((d) => d.doc)), filename, "application/pdf");
    return filename;
  }
  const { zipSync } = await import("fflate");
  // Names inside the zip keep every script's letters: zip files carry UTF-8 names.
  const entry = (x: string) => x.normalize("NFC").replace(/[^\p{L}\p{M}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 80) || "response";
  const files: Record<string, Uint8Array> = {};
  for (const [i, d] of docs.entries()) {
    let name = `${entry(d.name)}.pdf`;
    for (let n = 2; files[name]; n++) name = `${entry(d.name)}-${n}.pdf`;
    files[name] = new Uint8Array(await responsesPdf([d.doc]));
    onProgress?.(i + 1);
  }
  const filename = `${safeName(basename)}-pdfs.zip`;
  saveBytes(zipSync(files, { level: 0 }) as BlobPart, filename, "application/zip");
  return filename;
}
