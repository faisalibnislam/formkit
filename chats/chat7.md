# Conditional logic dropdown

_Started 2026-09-20 04:58 UTC_

---

## User

Continuing from "Rounded corners for small screens".

## Assistant

We've been building Formkit, a form-creation and response-collection platform with a conversational AI agent that lets users build forms by talking to them. The app is now feature-complete with multiple systems working end-to-end.

**What was done:**

The core app includes a dashboard, form builder with real-time tabs, responses table (card view on phone), analytics, templates, settings, and a hamburger nav below 900px. An AI assistant launched as a bottom-right floating chat launcher and panel, with animated glow and attraction treatment until first use. It routes intents (form creation spends credits, chat/logic/theme/insight are free) and lives in both the main workspace and the builder sidebar. An admin console lets Formkit staff override per-account AI limits (default 5 forms/month), grant credits, suspend accounts, lock forms, manage plans, and view audit trails. Both environments persist to shared storage so the admin controls actually affect what customers see.

**Key decisions made:**

The AI intent classifier distinguishes `chat` (greetings, credit questions — free) from `create` (form briefs — 1 credit each). Live mode calls Claude with a system prompt, Tested Patterns mode uses eleven recipes. Either way it falls back gracefully if the model response doesn't parse. Responsiveness was audited at 13 viewport widths; 15 card grids use `minmax(min(Npx, 100%), 1fr)` to collapse on phones without breaking. The Responses table becomes touch cards below 620px. The design-system bundle was patched locally when `FieldPreview` needed `auto-fit`. Admin data lives in shared storage so changes to limits immediately affect the customer app's credit display. The AI reply goes through a deterministic voice pass (capitalise sentence starts, fix lone "I", convert -ize to -ise, strip sales language) so the model's output can't drift.

**Current state:**

Both the main app and admin console pass verification. The AI launcher shows the pulsing glow and attraction animation until a form is created, then collapses to a quiet pill. Live chat replies conversationally with accurate credit counts; "Hi" no longer wastes a credit. Form creation, rewriting, logic, theming, and insight all work from the panel. Responsive layouts hold from 320px to 1728px. All enums match their component signatures and no unknown props leak into the DOM.

**Open:**

The chat has no conversation memory — each message is answered in isolation. If back-and-forth ("make it shorter" → "which one?") is wanted, that's a thread-history thread to wire up.

**Files:**

`Formkit Main App.dc.html` (core app with AI panel, 3500+ lines), `Formkit Admin.dc.html` (staff console), `Formkit Responsive Check.dc.html` (device harness), `Formkit Sky.dc.html` (hero wallpaper component), `_ds_bundle.js` (patched local design-system copy), `CLAUDE.md` (implementation notes for the Claude Code build, covering the AI system prompt, JSON schema, voice rules, enum gotchas, and the fallback logic).

## User

can logic be dropdown instead of type when appropriate? Like here I want to put if the user is 18 or older. then want to show the follow up question but I don't know if my input is gonna work. Please suggest/resolve.

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now the template: numeric input type + the note line.

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Your instinct was right — the typed value was the weak spot, and "18 or older" genuinely didn't work before: the only numeric operator was **is greater than**, which would have excluded anyone who is exactly 18.

What's changed on the Logic tab:

- **Operators are now type-aware.** Pick a number-ish question and you get *is at least, is at most, is greater than, is less than*. So your rule is: If Age **is at least** 18 → Then **Show** → your follow-up question. Choice questions get only *is / is not / is empty*; text questions get *contains*.
- **Dropdown wherever the answer set is finite** — choices, yes/no, rating and scale, NPS 0–10 all give you a value dropdown instead of typing. Numbers stay an input because the threshold is yours, but it's now a number input.
- **It tells you if your input won't work.** Type letters into a numeric value and a red line appears under the row saying it will never match. A short-text question whose wording implies a number ("How old are you?", "How many…") is read as a number too, with a note saying so.

One thing I left alone: the AI assistant still refuses to write logic unless the form has a choice question. It could now branch on numbers too — say the word and I'll extend it.

## User

Found issues — fixing…

## Assistant

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Both fixed. The value field stays a text input with a numeric keypad hint, so your stored "18 or older" is still visible and editable — and it now outlines red with the note telling you to replace it with `18` and pick **is at least**. The note colour uses the system's `--color-text-error` instead of a hardcoded hex.

## User

Address these comments from my teammates:

**Faisal Islam** (on `Formkit Admin.dc.html` at `a`):
<commented-element>react:    Formkit Admin › SidebarNav
dom:      body › div#dc-root › div.sc-host › div › div › div.sc-host-x › nav › div › div › a[2/2]
text:     "Open the customer app"
children: text
selector: a</commented-element>
<teammate-comment>remove this. Admin panel will be accesable by Admins, owner and support staff from formkit.app/admin. also add Admin, Owner and Support Staff management system with their own custom permission inside admin panel.</teammate-comment>

**Faisal Islam** (on `Formkit Admin.dc.html` at `[data-comment-anchor="16e84bab42-div"]`):
<commented-element>react:    Formkit Admin
dom:      body › div#dc-root › div.sc-host › div › div[2/3]
text:     "Customers Plans What each plan includes and whether it is o…"
children: div, div
selector: [data-om-id="8185087e:21"]</commented-element>
<teammate-comment>this app is 100% free, no plan feature required. completely remove from the system.</teammate-comment>

**Faisal Islam** (on `Formkit Main App.dc.html` at `[role="listbox"] >div`):
<commented-element>react:    Formkit Main App › FkSelect
dom:      body › div#dc-root › div.sc-host › div › main › div[screen="Builder — Logic"] › div › div › div.sc-host › div › div › div
text:     "is is not is at least is at most is greater than is less th…"
children: button, button, button, button, button, button,…</commented-element>
<teammate-comment>dropdown is doing out of the viewport, please fix.</teammate-comment>

## Assistant

_[tool: update_todos]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the admin file.

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: str_replace_edit]_

Now the Plans screen becomes Team access.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now the helpers, nav, and view sections.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: read_file]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: save_screenshot]_

_[tool: get_webview_logs]_

_[tool: save_screenshot]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: update_todos]_

_[tool: ready_for_verification]_

All three addressed.

**Sidebar link removed.** The footer is now just the signed-in operator (Sam Okafor, Owner) — no route back into the customer app.

**Plans gone entirely.** The Plans page, the nav item, the per-account plan field and filter, the plan column, the drawer's plan selector, the plan mix chart, and the `billing.annual` flag are all removed, along with plan-flavoured copy in the seeded announcements, tickets and audit entries. The overview's second chart now breaks accounts down by standing (active / trial / suspended).

**Team access** replaces it, under Platform. Six staff members with role, last-seen and invite state; Owner is locked (all eight permissions, can't be demoted or removed). A role matrix sets what Admin and Support can do — Admins get everything except managing team access, Support gets accounts plus support replies. Any individual can be given their own permissions from the chips under their row; once customised they stop following the role, and "Follow the role again" puts them back. Every change writes to the audit log.

**Dropdown fix** is in `FkSelect` itself, so it applies everywhere the component is used, not just the Logic tab: it measures on open and flips above (or right-aligns) when the menu would leave the viewport, re-measuring on scroll and resize.

## User

Check didn’t complete

## Assistant

_[tool: grep]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

_[tool: multi_screenshot]_

_[tool: eval_js]_

Verifier dropped out mid-run, so I checked by hand: no `plan` references remain anywhere in the file, no console errors, all screens render, the role selects show their values (`Admin`, `Admin`, `Support`…) and permission counts are right (Owner 8/8, Admin 7/8, Support 2/8). The blank boxes in one capture were an artefact of that screenshot method, not the page.

