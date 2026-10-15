/**
 * Formkit's MCP apps: small views an AI assistant shows in the conversation
 * instead of a wall of JSON - a preview of a form (with get_form) and a table
 * of responses (with list_responses).
 *
 * Each is one self-contained HTML page (no outside scripts, styles or
 * requests) that the host runs in a sandbox and hands the tool's result.
 * Two dialects reach the same page: the MCP Apps extension (a postMessage
 * handshake, then ui/notifications/tool-result) and ChatGPT's window.openai.
 * Everything from the result is written with textContent, never as HTML,
 * because answers are other people's words.
 */

export const APP_MIME = "text/html;profile=mcp-app";
/** ChatGPT's own name for the same thing, kept for hosts that still ask for it. */
export const SKYBRIDGE_MIME = "text/html+skybridge";

const STYLE = `
:root{--bg:#fff;--card:#f6f7f8;--ink:#14181b;--soft:#545b61;--line:#e3e6e9;--accent:#2f5bd3;--pill:#eef2fb;--good:#1d7a4a;--warn:#9a5b00}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#15191c;--card:#20262b;--ink:#eef1f3;--soft:#a5adb4;--line:#323a41;--accent:#8fb0ff;--pill:#25304a;--good:#6fd39e;--warn:#f0b35a}}
:root[data-theme=dark]{--bg:#15191c;--card:#20262b;--ink:#eef1f3;--soft:#a5adb4;--line:#323a41;--accent:#8fb0ff;--pill:#25304a;--good:#6fd39e;--warn:#f0b35a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14.5px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{padding:16px}
h1{font-size:18px;margin:0 0 4px;font-weight:600}
.sub{color:var(--soft);font-size:13px;margin:0 0 14px}
.pill{display:inline-block;padding:1px 9px;border-radius:999px;background:var(--pill);color:var(--accent);font-size:12px;font-weight:500;margin-left:6px;vertical-align:2px}
.links{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
button.link{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:4px 12px;cursor:pointer}
button.link:hover{border-color:var(--accent)}
.empty{color:var(--soft);padding:20px 0}
`;

/** Shared by both pages: the handshake, the data, the theme, the height, links. */
const BRIDGE = `
(function(){
  var pending = {}, nextId = 1;
  function post(msg){ try { window.parent.postMessage(msg, "*"); } catch (e) {} }
  function request(method, params){
    var id = nextId++;
    post({ jsonrpc: "2.0", id: id, method: method, params: params || {} });
    return new Promise(function(resolve){ pending[id] = resolve; setTimeout(function(){ if (pending[id]) { delete pending[id]; resolve(null); } }, 4000); });
  }
  function theme(t){ if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t); }
  function fromResult(r){
    if (!r) return null;
    if (r.structuredContent) return r.structuredContent;
    var c = (r.content || []).find(function(x){ return x && x.type === "text"; });
    if (c) { try { return JSON.parse(c.text); } catch (e) {} }
    return null;
  }
  var shown = false;
  function show(data){
    if (!data) return;
    shown = true;
    try { window.render(data); } catch (e) { document.body.textContent = "This view could not be drawn."; }
    resize();
  }
  function resize(){
    // The content's own height: the frame's would never let it shrink.
    var h = Math.ceil(document.body.getBoundingClientRect().height);
    post({ jsonrpc: "2.0", method: "ui/notifications/size-changed", params: { height: h } });
    if (window.openai && window.openai.notifyIntrinsicHeight) { try { window.openai.notifyIntrinsicHeight(h); } catch (e) {} }
  }
  window.openLink = function(url){
    if (!/^https:\\/\\//.test(url)) return;
    if (window.openai && window.openai.openExternal) return window.openai.openExternal({ href: url });
    request("ui/open-link", { url: url });
  };
  window.addEventListener("message", function(ev){
    var m = ev.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (m.id != null && pending[m.id]) { var done = pending[m.id]; delete pending[m.id]; done(m.result || null); return; }
    if (m.method === "ui/notifications/tool-result") show(fromResult(m.params));
    if (m.method === "ui/notifications/host-context-changed" && m.params) theme(m.params.theme);
    if (m.method === "ui/resource-teardown" && m.id != null) post({ jsonrpc: "2.0", id: m.id, result: {} });
  });
  // ChatGPT hands the result over directly.
  function fromOpenAI(){ if (window.openai) { theme(window.openai.theme); if (window.openai.toolOutput) show(window.openai.toolOutput); } }
  window.addEventListener("openai:set_globals", fromOpenAI);
  fromOpenAI();
  request("ui/initialize", { appInfo: { name: "formkit", version: "1.0.0" }, appCapabilities: {}, protocolVersion: "2026-01-26" }).then(function(r){
    if (r && r.hostContext) theme(r.hostContext.theme);
    post({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} });
  });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(document.body);
  setTimeout(function(){ if (!shown) { var p = document.querySelector(".empty"); if (p) p.textContent = "Waiting for Formkit…"; } }, 1500);
})();
`;

/** el("p", {class: "x"}, "text", child): text is always text. */
const DOM = `
function el(tag, attrs){
  var n = document.createElement(tag);
  for (var k in (attrs || {})) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); }
  for (var i = 2; i < arguments.length; i++) {
    var c = arguments[i];
    if (c == null || c === false) continue;
    n.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  return n;
}
function linkButton(label, url){ var b = el("button", { class: "link", type: "button" }, label); b.onclick = function(){ window.openLink(url); }; return b; }
`;

const page = (title: string, style: string, script: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${STYLE}${style}</style></head>
<body><main id="root"><p class="empty">Loading…</p></main>
<script>${DOM}${script}</script><script>${BRIDGE}</script></body></html>`;

/* ---------- the form preview ---------- */

const FORM_STYLE = `
.page{margin:18px 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--soft)}
.q{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:0 0 10px}
.q h2{font-size:14.5px;font-weight:500;margin:0}
.q .req{color:var(--warn);margin-left:3px}
.q .help{color:var(--soft);font-size:13px;margin:2px 0 0}
.q .type{float:right;color:var(--soft);font-size:12px}
.ctl{margin-top:9px}
.ctl input[type=text],.ctl textarea,.ctl select{width:100%;font:inherit;padding:7px 10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--soft)}
.ctl textarea{min-height:56px}
.opt{display:flex;gap:8px;align-items:center;padding:3px 0;color:var(--ink)}
.stars{letter-spacing:4px;color:var(--soft);font-size:18px}
.scale{display:flex;gap:6px;flex-wrap:wrap}
.scale span{min-width:30px;text-align:center;padding:4px 0;border:1px solid var(--line);border-radius:8px;color:var(--soft);font-size:13px}
.rules{color:var(--soft);font-size:13px;margin-top:14px}
`;

const FORM_SCRIPT = `
var TYPE = { "short-text":"Short answer","long-text":"Long answer",email:"Email",phone:"Phone",url:"Link",name:"Name",company:"Company",address:"Address",number:"Number","single-choice":"One choice","multi-choice":"Several choices",dropdown:"Dropdown","yes-no":"Yes or no",date:"Date",time:"Time",rating:"Rating",scale:"Scale",file:"Upload",signature:"Signature",voice:"Voice",matrix:"Grid",ranking:"Ranking" };
function control(q){
  var t = q.type, box = el("div", { class: "ctl" });
  var opts = t === "yes-no" ? ["Yes", "No"] : (q.options || []);
  if (t === "single-choice" || t === "multi-choice" || t === "yes-no" || t === "ranking") {
    opts.forEach(function(o, i){ box.appendChild(el("label", { class: "opt" }, el("input", { type: t === "multi-choice" ? "checkbox" : "radio", disabled: "" }), t === "ranking" ? (i + 1) + ". " + o : o)); });
  } else if (t === "dropdown") {
    var s = el("select", { disabled: "", "aria-label": q.title || "Choice" }); s.appendChild(el("option", {}, "Choose…")); opts.forEach(function(o){ s.appendChild(el("option", {}, o)); }); box.appendChild(s);
  } else if (t === "rating") { box.appendChild(el("div", { class: "stars", "aria-hidden": "true" }, "★★★★★"));
  } else if (t === "scale") { var sc = el("div", { class: "scale" }); for (var n = 0; n <= 10; n++) sc.appendChild(el("span", {}, n)); box.appendChild(sc);
  } else if (t === "long-text" || t === "address") { box.appendChild(el("textarea", { disabled: "", "aria-label": q.title || "Answer" }));
  } else if (t === "file" || t === "signature" || t === "voice") { box.appendChild(el("p", { class: "help" }, TYPE[t] + " - answered on the form itself."));
  } else { box.appendChild(el("input", { type: "text", disabled: "", "aria-label": q.title || "Answer", placeholder: TYPE[t] || "" })); }
  return box;
}
window.render = function(f){
  var root = document.getElementById("root"); root.textContent = "";
  root.appendChild(el("h1", {}, f.title || "Untitled form", el("span", { class: "pill" }, f.status || "draft")));
  var n = (f.questions || []).length;
  root.appendChild(el("p", { class: "sub" }, n + (n === 1 ? " question" : " questions") + (f.responses != null ? " · " + f.responses + " responses" : "") + (f.unpublishedChanges ? " · changes not published yet" : "")));
  var links = el("div", { class: "links" });
  if (f.editUrl) links.appendChild(linkButton("Edit in Formkit", f.editUrl));
  if (f.url) links.appendChild(linkButton("Open the form", f.url));
  root.appendChild(links);
  if (f.welcome && (f.welcome.title || f.welcome.message)) {
    var w = el("div", { class: "q" }, el("h2", {}, f.welcome.title || ""), f.welcome.message ? el("p", { class: "help" }, f.welcome.message) : null);
    root.appendChild(w);
  }
  var lastPage;
  (f.questions || []).forEach(function(q, i){
    if (q.page !== lastPage && q.page) root.appendChild(el("div", { class: "page" }, q.page));
    lastPage = q.page;
    root.appendChild(el("section", { class: "q" },
      el("span", { class: "type" }, TYPE[q.type] || q.type || ""),
      el("h2", {}, (i + 1) + ". " + (q.title || "Untitled question"), q.required ? el("span", { class: "req", "aria-label": "required" }, "*") : null),
      q.help ? el("p", { class: "help" }, q.help) : null,
      control(q)));
  });
  if (!n) root.appendChild(el("p", { class: "empty" }, "No questions yet."));
  var live = (f.rules || []).filter(function(r){ return r.enabled; }).length;
  if (live) root.appendChild(el("p", { class: "rules" }, live + (live === 1 ? " logic rule" : " logic rules") + " decide what people see."));
};
`;

/* ---------- the responses table ---------- */

const TABLE_STYLE = `
.bar{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}
.bar input,.bar select{font:inherit;font-size:13px;padding:6px 10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink)}
.bar input{flex:1;min-width:140px}
.wrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;max-width:260px}
th{font-weight:500;color:var(--soft);background:var(--card);white-space:nowrap;cursor:pointer;user-select:none}
tr:last-child td{border-bottom:0}
td.when{white-space:nowrap;color:var(--soft)}
td .who{font-weight:500}
td .mail{color:var(--soft);font-size:12.5px}
.status{display:inline-block;padding:0 8px;border-radius:999px;background:var(--pill);color:var(--accent);font-size:12px;white-space:nowrap}
.partial{color:var(--warn);font-size:12px}
td button.link{padding:2px 10px;font-size:12px}
.more{color:var(--soft);font-size:13px;margin-top:10px}
`;

const TABLE_SCRIPT = `
var rows = [], cols = [], sortKey = "when", sortDir = -1;
function answerOf(r, qid){ var a = (r.answers || []).find(function(x){ return x.questionId === qid; }); if (!a || a.value == null) return ""; return Array.isArray(a.value) ? a.value.join(", ") : String(a.value); }
function draw(){
  var term = (document.getElementById("q").value || "").toLowerCase();
  var st = document.getElementById("st").value;
  var list = rows.filter(function(r){
    if (st && r.status !== st) return false;
    if (!term) return true;
    var hay = [r.respondent && r.respondent.name, r.respondent && r.respondent.email].concat((r.answers || []).map(function(a){ return Array.isArray(a.value) ? a.value.join(" ") : a.value; })).join(" ").toLowerCase();
    return hay.indexOf(term) >= 0;
  });
  list.sort(function(a, b){
    var x = sortKey === "when" ? a.submittedAt : sortKey === "who" ? ((a.respondent && (a.respondent.name || a.respondent.email)) || "") : sortKey === "status" ? a.status : answerOf(a, sortKey);
    var y = sortKey === "when" ? b.submittedAt : sortKey === "who" ? ((b.respondent && (b.respondent.name || b.respondent.email)) || "") : sortKey === "status" ? b.status : answerOf(b, sortKey);
    return (x > y ? 1 : x < y ? -1 : 0) * sortDir;
  });
  var body = document.getElementById("body"); body.textContent = "";
  list.forEach(function(r){
    var who = r.respondent || {};
    var tr = el("tr", {},
      el("td", { class: "when" }, new Date(r.submittedAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })),
      el("td", {}, el("div", { class: "who" }, who.name || who.email || "Anonymous"), who.name && who.email ? el("div", { class: "mail" }, who.email) : null, r.complete ? null : el("div", { class: "partial" }, "Not finished")),
      el("td", {}, el("span", { class: "status" }, r.status || "new")));
    cols.forEach(function(c){ var v = answerOf(r, c.id); tr.appendChild(el("td", {}, v.length > 140 ? v.slice(0, 139) + "…" : v)); });
    var open = el("td", {}); if (r.viewUrl) open.appendChild(linkButton("Open", r.viewUrl)); tr.appendChild(open);
    body.appendChild(tr);
  });
  document.getElementById("count").textContent = list.length === rows.length ? rows.length + (rows.length === 1 ? " response" : " responses") : list.length + " of " + rows.length + " responses";
}
function header(label, key){
  var th = el("th", { scope: "col", tabindex: "0", "aria-sort": sortKey === key ? (sortDir > 0 ? "ascending" : "descending") : "none" }, label);
  function go(){ if (sortKey === key) sortDir = -sortDir; else { sortKey = key; sortDir = key === "when" ? -1 : 1; } build(); }
  th.onclick = go; th.onkeydown = function(e){ if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
  return th;
}
function build(){
  var root = document.getElementById("root"); var keep = document.getElementById("q") ? document.getElementById("q").value : ""; var keepSt = document.getElementById("st") ? document.getElementById("st").value : "";
  root.textContent = "";
  root.appendChild(el("h1", {}, "Responses"));
  root.appendChild(el("p", { class: "sub", id: "count" }));
  var search = el("input", { id: "q", type: "search", placeholder: "Search names and answers", "aria-label": "Search responses" }); search.value = keep; search.oninput = draw;
  var statuses = []; rows.forEach(function(r){ if (statuses.indexOf(r.status) < 0) statuses.push(r.status); });
  var pick = el("select", { id: "st", "aria-label": "Status" }, el("option", { value: "" }, "Every status"));
  statuses.forEach(function(s){ pick.appendChild(el("option", { value: s }, s)); }); pick.value = keepSt; pick.onchange = draw;
  root.appendChild(el("div", { class: "bar" }, search, pick));
  var head = el("tr", {}, header("Sent", "when"), header("From", "who"), header("Status", "status"));
  cols.forEach(function(c){ head.appendChild(header(c.title.length > 32 ? c.title.slice(0, 31) + "…" : c.title, c.id)); });
  head.appendChild(el("th", { scope: "col" }, ""));
  root.appendChild(el("div", { class: "wrap" }, el("table", {}, el("thead", {}, head), el("tbody", { id: "body" }))));
  if (window.__more) root.appendChild(el("p", { class: "more" }, "More responses are in Formkit. Ask for the next page to see them."));
  draw();
}
window.render = function(d){
  rows = (d && d.data) || []; window.__more = !!(d && d.next);
  // The first few questions people answered become columns.
  var seen = {}; cols = [];
  rows.forEach(function(r){ (r.answers || []).forEach(function(a){ if (!seen[a.questionId] && cols.length < 3) { seen[a.questionId] = 1; cols.push({ id: a.questionId, title: a.question || "Question" }); } }); });
  if (!rows.length) { var root = document.getElementById("root"); root.textContent = ""; root.appendChild(el("h1", {}, "Responses")); root.appendChild(el("p", { class: "empty" }, "No responses yet.")); return; }
  build();
};
`;

export const APPS = [
  {
    uri: "ui://formkit/form-preview.html",
    name: "form-preview",
    title: "Form preview",
    description: "A preview of a form's questions, as people will see them.",
    html: page("Form preview", FORM_STYLE, FORM_SCRIPT),
  },
  {
    uri: "ui://formkit/responses.html",
    name: "responses-table",
    title: "Responses",
    description: "A form's responses in a table you can search, filter and sort.",
    html: page("Responses", TABLE_STYLE, TABLE_SCRIPT),
  },
] as const;

/** The same page under ChatGPT's mime type, at its own address. */
export const skybridgeUri = (uri: string) => uri.replace(/\.html$/, ".skybridge.html");
