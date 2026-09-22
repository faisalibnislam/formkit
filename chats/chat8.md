# AI Form Builder Admin Control

_Started 2026-09-21 00:39 UTC_

---

## User

Continuing from "Conditional logic dropdown".

## Assistant

We've been building Formkit, a form-creation platform with a conversational AI agent. The app is feature-complete with dashboard, builder, responses, analytics, templates, settings, and an admin console for staff to manage accounts, credits, and team access.

**What we just finished:**

You asked about logic operators for numeric inputs — specifically to handle "18 or older" safely. We rebuilt the Logic tab so operators are now type-aware: number questions get *is at least, is at most, is greater than, is less than*; choice/yes-no/rating questions get *is / is not / is empty*; text gets *contains*. The value field shows a red error line if your input won't parse (e.g. "18 or older" when a number is needed). We also fixed a dropdown viewport overflow in `FkSelect` — it now measures on open and flips or right-aligns to stay visible.

**Then addressed three team comments:**

Faisal asked us to remove the "Open the customer app" link from the admin sidebar, kill the Plans section entirely (app is 100% free), and add a Team access system. We removed all plan references (page, nav item, filters, charts, per-account plan field, seeded data). Plans tab became Team access under Platform, showing six staff with role, last-seen, and invite state. Roles (Owner/Admin/Support) have permission matrices; individual staff can override their role's permissions, or "Follow the role again" to revert. Every change audits. The dropdown flip fix went into `FkSelect` itself so it works everywhere.

**Current state:**

Main app and admin console both pass checks. Logic operators are type-aware with real-time validation. Dropdown menus stay in viewport. Admin team management is live with role matrices and granular permission overrides. No plan references remain.

**Files changed:**

`Formkit Main App.dc.html`, `Formkit Admin.dc.html`, `FkSelect.dc.html`, `CLAUDE.md`.

## User

Feature: Build a form with AI will be turned of for all usr and only admin will enable it for individual users if needed from admin dashboard. Create a complete system, UI, UX for it.

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

Now writing the admin changes.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now the admin template for the AI access page.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: read_file]_

Now the gate values in the customer app.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

Now the customer-side template: locked page, create-modal row, settings card, request modal.

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: multi_screenshot]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: read_file]_

_[tool: str_replace_edit]_

Now updating the project notes.

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

AI form building is now an allow-list, off for everyone until an admin grants it.

**Admin console** — the "AI credits" section is now **AI access**:
- A status card: how many accounts have it (211), how many don't, how many are waiting — plus a platform pause switch (a kill switch that suspends everyone without forgetting who was allowed).
- **Asked for access**: pending requests with the account's reason, Turn AI on / Decline.
- **Who has it**: search + On/Off/All filter, one switch per account.
- The limit, override and heaviest-use cards now only count accounts with AI on; accounts list has an AI column ("Off" or "3 of 5") and an AI filter; the account drawer leads with an access switch and hides the limit controls when it's off. Every change audits and toasts.

**Customer app** — with AI off, the floating launcher, the assistant drawer and the Ask workspace are simply gone. The way back in is three doors onto one request modal: a locked row in Create a form, a card in Settings → Preferences, and the locked Ask page. Sending writes the request into the admin store; the console picks it up within seconds, and approving flips the app live with a toast.

Studio Nine is seeded off with no request, so you can run the whole loop: ask from the app, approve in the console, watch the launcher appear.

## User

Check didn’t complete

## Assistant

_[tool: get_webview_logs]_

_[tool: eval_js]_

_[tool: multi_screenshot]_

_[tool: eval_js]_

_[tool: eval_js]_

Checked it myself: no console errors, the console renders, approving a request turns that account on (211 → 214), the accounts table shows "Off" or "22 / 25", and the customer app picks up a grant live. I also reset the demo data my test run had approved, so it opens at the seeded state — three accounts on, three requests waiting, Studio Nine off.

## User

Address these comments from my teammates:

**Faisal Islam** (on `Formkit Admin.dc.html` at `[data-comment-anchor="0cfe029dee-span"]`):
<commented-element>react:    Formkit Admin
dom:      body › div#dc-root › div.sc-host › div › div › div[screen="AI access"] › div › div › span[1/2]
text:     "Asked for access"
children: text
selector: [data-om-id="1dfbdd68:156"]</commented-element>
<teammate-comment>user can't ask for access. Admin will enable it. If admin doesn't enable it, user won't see any AI feature.</teammate-comment>

**Faisal Islam** (on `Formkit Responsive Check.dc.html` at `[data-comment-anchor="89bbdff4e9-iframe"]`):
<commented-element>react:    Formkit Responsive Check
dom:      body › div#dc-root › div.sc-host › div › div › div › div › iframe
selector: [data-comment-anchor="89bbdff4e9-iframe"]</commented-element>
<teammate-comment>remove this button</teammate-comment>

## Assistant

_[tool: grep]_

_[tool: read_file]_

Removing the request path from the customer app.

_[tool: str_replace_edit]_

Now removing the locked UI from the customer template.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now the admin side: removing the request queue.

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

Now the admin view models and template.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: multi_screenshot]_

_[tool: ready_for_verification]_

Both done.

**Faisal's first comment** — the request path is gone entirely. Admin: no "Asked for access" card, no request queue, no polling; the third figure in the status card is now "3 of 20 on in this sample", and the overview tile counts accounts with AI on. Customer app: with AI off there is now *no trace* of the feature — no launcher, no drawer, no Ask workspace, no locked screen, no row in Create a form, no Settings card; the `agent` route redirects home. The only thing left is a toast when an admin turns it on, so the user notices it appeared.

**Second comment** — the anchor landed on the responsive-check iframe, so I read it as the "Ask for access" button visible in that preview; it's removed by the same change. If you meant a different button in that frame, tell me which and I'll pull it.

Noted in CLAUDE.md so the request flow doesn't get reintroduced.

## User

Check didn’t complete

## Assistant

_[tool: get_webview_logs]_

_[tool: eval_js]_

_[tool: multi_screenshot]_

_[tool: eval_js]_

Verified by hand since the background check kept dropping out: no console errors, and the gate works both ways — off gives a dashboard with zero AI anywhere, turning it on in the console makes the launcher and assistant appear within seconds (5 of 5 credits, Live engine intact), turning it off makes them vanish again. Left the demo in the off state with the stale request data cleared.

## User

Address these comments from my teammates:

**Faisal Islam** (on `Formkit Main App.dc.html` at `#dc-root > div:nth-child(1) > div:nth-child(1) > header:nth-child(1) > div:nth-child(5) > div:nth-child(2) > div:nth-child(1)`):
<commented-element>react:    Formkit Main App › ClientTab
dom:      body › div#dc-root › div.sc-host › div › header › div › div.sc-host-x › div
text:     "Company Logo, details and brand Company: Studio Nine"
children: span, span, div, div
selector: #dc-root &gt; div:nth-child(1) &gt; div:nth-child(1) &gt; header:nth-child(1) …</commented-element>
<teammate-comment>Company can claim a link, so when they share a public form link, it will be formkit.app/&lt;company name&gt;/form-name</teammate-comment>

**Faisal Islam** (on `Formkit Main App.dc.html` at `[role="dialog"] >div:nth-child(2)`):
<commented-element>react:    Formkit Main App › Modal
dom:      body › div#dc-root › div.sc-host › div › div › div.sc-host-x › div › div › div[2/2]
text:     "Link QR code Embed formkit.app/f/vaping-habits-survey Copy …"
children: div, div
selector: [role="dialog"] &gt;div:nth-child(2)</commented-element>
<teammate-comment>add an option to enable/disable link sharing. When disabled, people with the link can't access the form</teammate-comment>

**Faisal Islam** (on `Formkit Main App.dc.html` at `[role="dialog"] .sc-host-x >[role="tablist"] >button:nth-child(2)`):
<commented-element>react:    Formkit Main App › Modal › Tabs
dom:      body › div#dc-root › div.sc-host › div › div › div.sc-host-x › div › div › div › div › div.sc-host-x › div › button[2/3]
text:     "Invite"
children: span, text
selector: [role="dialog"] .sc-host-x &gt;[role="tablist"] &gt;button:nth-child(2)</commented-element>
<teammate-comment>rename it to collaborator and add all collaboration features here too.</teammate-comment>

**Faisal Islam** (on `Formkit Main App.dc.html` at `[role="dialog"] .sc-host-x >[role="tablist"] >button:nth-child(1)`):
<commented-element>react:    Formkit Main App › Modal › Tabs
dom:      body › div#dc-root › div.sc-host › div › div › div.sc-host-x › div › div › div › div › div.sc-host-x › div › button[1/3]
text:     "People"
children: span, text
selector: [role="dialog"] .sc-host-x &gt;[role="tablist"] &gt;button:nth-child(1)</commented-element>
<teammate-comment>we don't need it here, already hase 'Share' option to share form via link</teammate-comment>

**Faisal Islam** (on `Formkit Main App.dc.html` at `[role="listbox"] button:nth-child(1)`):
<commented-element>react:    Formkit Main App › Modal › FkSelect
dom:      body › div#dc-root › div.sc-host › div › div › div.sc-host-x › div › div › div › div › div › div › div.sc-host › div › div › div › button.scp0[1/3]
text:     "Editor"
children: span, div
selector: [role="listbox"] button:nth-child(1)</commented-element>
<teammate-comment>editor can access responds to this form from their own account</teammate-comment>

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

Making the logic changes.

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

Now the share-link switch and the company handle card.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now the two template blocks: Share link tab and the Company link card.

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: get_webview_logs]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: eval_js]_

_[tool: multi_screenshot]_

_[tool: read_file]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

All five addressed:

**Claimed company link** — Settings → Company has a "Your Formkit link" card: type a handle next to a `formkit.app/` prefix, see the live preview, claim it (validated for length, dashes and reserved names), change it, or release it. Once claimed every public link becomes `formkit.app/<handle>/<form-name>`; unclaimed falls back to `/f/`. Seeded unclaimed so the claim is there to do.

**Link sharing on/off** — a switch at the top of Share → Link. Off strikes the URL through, and the QR and Embed tabs say the code and the embed lead to a closed page too. It's per form and logs to the form's activity.

**Collaborators** — the modal is now Collaborators / Activity. The invite block leads, then who's on the form, pending invitations, and the role guide.

**People tab removed** — its "General access" dropdown was the duplicate of Share, so link access now lives only in Share; a line at the bottom of Collaborators points there.

**Editor role** — the dropdown now reads "Editor · Edits, reads responses" and the guide spells it out: edits questions and reads this form's responses from their own account, but can't manage access. (I widened FkSelect's menu when options carry notes — it was clipping the labels.)

## User

Check didn’t complete

## Assistant

_[tool: snip]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

Checked directly since the background verifier keeps dropping: the app loads clean with no console errors, and I'd already confirmed each change in the live preview — Collaborators modal with its two tabs, the role dropdown reading "Editor · Edits, reads responses", and Share's link-sharing switch with the claimed-handle note.

