# Formkit — product decisions

_A copy of the project's running CLAUDE.md. Several entries record mistakes that cost a debugging pass; read the relevant section before changing that area._

---

# Formkit — project notes

## AI form generation
The **Ask Formkit** assistant in `Formkit Main App.dc.html` is a working prototype of the real
feature, not a mock. It has two engines behind the Live / Tested patterns chip:

- **Live** (default) calls Claude from the page and builds the form from the user's own words.
- **Tested patterns** matches the prompt against a local recipe library — instant and
  deterministic, useful for demos.

**In the real build the user will call the Claude API server-side.** When porting to production,
the pieces worth lifting from the prototype are:

- The system prompt and JSON schema in `aiLiveDraft()` — it constrains `type` to the app's own
  field types, caps question count, and enforces Formkit's voice rules (sentence case, question
  marks, no emoji, `req` only where genuinely needed).
- `aiContext()` — how a pasted brief, an uploaded filename, or an existing form's question list
  is appended to the prompt.
- The validation and fallback path — unknown field types coerce to `short-text`, a parse failure
  or 45s timeout falls back to a pattern and says so in the conversation rather than failing
  silently.
- **`aiIntent()` must classify talk as talk.** It originally ended `return 'create'`, so "Hi"
  was read as a form brief: it spent a credit and invented a form. There is now a `chat` intent
  (greetings, thanks, "what can you do", credit questions, short non-imperative input, bare
  questions) routed to `aiChat()` — a plain written reply, **no credit spent**, live via
  `aiChatLive()` with a separate short-reply system prompt and a local fallback. Any production
  port needs the same guard, or every stray message bills the user.
- **Never instruct the model in "sentence case" and trust it.** It reads that as licence for
  all-lowercase, intermittently (3 of 5 replies). `aiChatLive()` now spells the rule out
  ("begin every sentence with a capital letter", "do not write in all lowercase", British
  spelling, and an explicit no-sales-register list) **and** pipes the reply through
  `aiVoice()`, which capitalises sentence starts and the pronoun I and converts -ize/color
  spellings. Same defensive posture as `aiLiveDraft()`'s JSON validation: correct the output,
  do not rely on compliance.

Credits: the monthly limit is **set by admins, not by this app**. `Formkit Main App.dc.html`'s
`aiLimit()` reads `localStorage['formkit.admin.v1']` on every call — `overrides['studio-nine']`
first, then `aiDefault`, plus `grants['studio-nine']`. Change it in `Formkit Admin.dc.html`
(AI access, or an account's drawer) and the customer app follows on the next render. Only
*creating* a form spends a credit; rewriting copy, writing logic, picking themes and summarising
responses are free. `aiUsed` persists; `aiLiveSet` records whether the user has deliberately
chosen an engine so the default can change without overriding them.

## AI access is an allow-list, off by default
Form building with AI is **off for every account** until a Formkit admin turns it on for a named
one. Customers cannot ask for it and never see it advertised — admins decide. Two files, one
store (`formkit.admin.v1`):

- Admin (`aiAccess: {accountId: true}`) is the allow-list; `aiPaused` is a platform kill switch
  that suspends everyone at once without forgetting who was allowed. Turn access on from the AI
  access page's "Who has it" list or from an account's drawer.
- Customer app: `aiAccess()` reads that store, `aiAllowed()` is `on && !paused`. When it is false
  there is **no AI surface at all** — no launcher, no drawer, no Ask workspace, no locked state,
  no mention in Settings; `isAgent` is gated and the `agent` route redirects home. Do not add a
  request, upsell or "locked" affordance back: Faisal removed that deliberately.
- The customer app polls the access signature every 2.5s and toasts when access is granted,
  withdrawn or paused, so a change made in the console lands without a reload.
- Anything counted per account (`aiTotals`, at-limit, heaviest use, overrides) counts only
  accounts with access; `AI_ON_OTHERS` is the allowed population outside the 20-row sample.

Do not reintroduce a global "AI for everyone" default. The platform switch on the AI access page
is a pause, not an enable-all.

## Identity: one person, a personal link, any number of companies
Formkit is **person first**. A user is a human being; companies are optional, plural and most
people never add one.

- **Identities.** `'me'` is the person; every other identity is a company in `state.companies`
  (`[{id, name, handle, brandColor, logoUrl, apply, badge, …}]`). A form carries `brand` — `'me'`
  or a company id — and `brandOf/brandCo/brandName/handleFor` resolve it. `formUrl(fm)` is
  `formkit.app/<that identity's handle>/<slug>`, falling back to `/f/`. Never read a single
  `state.company` again; it is gone.
- **Links.** The person claims their own handle (`state.handle`); each company claims its own.
  One claim path for all of them: `hDraftOf/setHDraft/saveHandle/releaseHandle`, keyed by `'me'`
  or a company id, refusing duplicates across the account.
- **Settings → Companies** is a personal-link card, a company list (add / open / per-company form
  count), and the logo, link, details and brand cards bound to `coSel`. **Remove company** sends
  its forms back to `'me'`.
- **Design → Branding** shows "Published under" whenever at least one company exists; the logo
  row, lockup and theme defaults all follow the form's identity, not a global company.
- Customer app chrome leads with the person (`acName`); `orgLine()` adds a second line — the
  company name when there is one, "N companies" when there are several, nothing when solo.
- Admin console: a row **is a person**. `who(a)` is the person (`a.owner`), `org(a)` the optional
  workspace (`a.name`, often empty), `orgLine(a)` the em-dash fallback. Single **User** column,
  staff copy says "users", seven of the 20 sample rows are deliberately solo.
- `SAVE_KEY` is `formkit.state.v5` — bump it whenever the state shape changes, or saved demo
  state resurrects the old one.

## Sharing model
Three separate things, deliberately kept apart:

- **Share** (the modal) owns the public link: the URL, the QR code, the embed snippet and the
  claimed-handle note. There is deliberately **no link on/off switch** — Faisal removed it;
  stopping answers is what closing or unpublishing a form is for.
- **Collaborators** (the old People modal) owns people working on the form: one Collaborators tab
  (invite, the list, pending invitations, the role guide) and Activity. The old People tab and
  its "General access" dropdown were removed — link access belongs to Share, not here.
- **A claimed company handle** (`company.handle`, unclaimed by default) moves every public link
  from `formkit.app/f/<slug>` to `formkit.app/<handle>/<slug>`. Claim, change and release it in
  Settings → Company. Build public URLs with `formUrl(fm)` — never concatenate `formkit.app/f/`.

Roles are `Editor` / `Commenter` / `Viewer` from `roleOptions()`, which returns
`{value,label,note}` objects. An **Editor** edits the form *and* reads its responses from their
own account; the role guide says so in full.

## Publishing
`publish()` sets `status: 'published'`; `unpublish()` takes it back to `draft`, closes the
modals and keeps every response. The publish modal retitles itself when the form is already
live ("This form is published") and swaps its footer to Done / Unpublish. Closing
(`status: 'closed'`) is a separate thing: it stops new answers but keeps the form live.

## What a form carries
Beyond questions and theme, a form owns three things added in the launch-gaps pass:

- **`notify`** (`notifyOf(fm)` fills the defaults, `patchNotify` / `patchRoute` write): `to`,
  `subject`, `body` for the owner's alert; `routes: [{when, value, to}]` — first match wins — so a
  support form and an event form reach different people; and the respondent reply (`confirm`,
  `replyTo`, `confirmSubject`, `confirmBody`, `confirmAttach`). Notifications are **per form**, not
  per account — do not move them back into `fset`, which is global.
- **`versions`** — newest first. `publish()` calls `snapshot()`, `restoreVersion(v)` puts old
  questions back (and snapshots that too), `unpublishedChanges(fm)` counts edits since the live
  version and drives the amber note in the publish modal and the Version history drawer.
- **Partial responses** — `r.partial` with `answeredCount`. They are excluded from the Completed
  stat, filtered by the All / Complete / Partial control, badged by `respBadge(r)`, and the drawer
  offers a resume link. Bulk work runs off `respSel` (`toggleResp`) with the dark action bar.

File uploads are capped at **10 MB** (stated, not configurable); a field may list accepted
extensions. Forms are **English (US) only** — the language picker was removed until translations
exist. `logEmail()` appends to `emailLog`, the customer-side record of what Formkit sent.

## Support view and admin access
`Formkit Main App.dc.html?viewAs=<id>&who=<name>` shows the dark support banner and sets
`state.support`. `readOnly()` refuses every mutation while it is set — `patchForm`, `publish` and
`unpublish` call it, so new mutators should too. The admin console opens it from a user's drawer
(Support → View as), and **Their emails** jumps to the Email log filtered to that person.

formkit.app/admin is unlinked and gated by who you are: staff get the console, a signed-in
customer is offered their dashboard, a stranger is sent to the marketing site. The three states
are the `visitor` prop on `Formkit Admin.dc.html` (Tweaks → Access) so they can be demonstrated;
`gateOpen` also covers the signed-out screen.

## Admin console
`Formkit Admin.dc.html` is the Formkit-staff console: overview, accounts (a 20-row sample
presented as 10,020 with search, filters and pagination), AI access, moderation, support,
announcements, **team access**, feature flags and an audit log. State persists under
`formkit.admin.v1`. It is reached at formkit.app/admin — there is deliberately no link from the
console back to the customer app.

**Formkit is free. There are no plans.** Plans, prices, per-account plan assignment, plan
filters and billing-flavoured copy were removed wholesale; do not reintroduce them. The overview
breaks accounts down by standing (active / trial / suspended) instead.

**Team access** (`vStaff`) is the staff-permission system. Three roles: Owner (holds every
permission, always, and cannot be demoted or removed from the UI), Admin and Support. Two layers:
`rolePerms` sets what a role can do, and `staffPerms[memberId]` is a per-person override that
snapshots the role grant at the moment of the first change — once a person is customised, later
role changes no longer reach them, and “Follow the role again” deletes the override. The
permission list lives in `Component.PERMS` and role defaults in `Component.ROLE_DEFAULTS`; add a
permission in one place and both the matrix and the per-person chips pick it up.

Sidebar sections are Customers / Operations / **Administrative** (renamed from Platform; the page
eyebrows for Overview, Team access, Feature flags and Audit log echo it). Every staff role —
Owner, Admin, Support — signs out from the sidebar footer button or the icon button beside the
narrow-layout capsule; `signOut()` logs to the audit trail and shows the signed-out screen, and
`signedOut` is deliberately not in `SAVE`.

**Persist from `setState`, not `componentDidUpdate`** — the DC runtime does not forward
`componentDidUpdate` to the logic class, so a lifecycle-based save silently never runs.

Component props that do not work the way the name suggests — each cost a debugging pass, so read
the signature in `_ds_bundle.js` before calling any of these:
- `ProgressBar` takes `color` (a CSS value), not `tone`.
- `Toast` takes `message`/`detail`/`onDismiss`, not `title` + children.
- `EmptyState` takes `description`, not children.
- `TickChart` takes `data` as `[{value, tone}]` with **value as a 0–1 fraction** of the plot
  height, not `values` of raw numbers, and has no `labelLeft`/`labelRight` — draw captions yourself.
- `AvatarPill` takes a `user` object, not `name`/`meta`, and has no second-line slot. For a
  name-plus-role capsule, compose `Avatar` (which does take `name`) with your own markup.

Unknown props do not error — they leak into the DOM as literal attributes and the component
renders empty. A blank chart or an empty avatar circle is the signature of this mistake.

## Night Sky is the background
Faisal's standing instruction: the photographic sky band is retired. Landing, Help, Privacy,
Terms, Auth and Onboarding heroes use the **Night Sky**: `<dc-import name="Formkit Sky">` inside a
`position:relative;overflow:hidden;background:#0a3d6f` wrapper, with the content in a
`position:relative;z-index:1` child and white ink (`Logo` takes `tone="inverse"`). Landing,
Help, Privacy, Terms, Auth and Onboarding all follow it. `--gradient-hero` is overridden at the
end of `_ds/.../tokens/colors.css` to the Night Sky gradient so any component still referencing
the token renders dark; never reintroduce the old band.

**The landing page follows the app.** The September 2026 rebuild is a continuous scroll story,
but its surface is the application's: Night Sky hero, `--paper` page, white cards at
`--radius-card`, charcoal `--neutral-900` pill CTAs, and **sky blue as the primary accent**
(`--blue-500` / `--blue-700`; green stays for status badges, tick charts and positive deltas,
exactly as in the app). The earlier bone-and-ink editorial palette was rejected as
disconnected — do not reintroduce it.

## Landing page: "watch a question become useful"
`Formkit Landing.dc.html` is one continuous scroll story — ASK → SHAPE → ANSWER → UNDERSTAND →
ACT — built around a single field that transforms from an architectural hero input into a real
builder question. Notes for anyone editing it:
- **Never put `overflow-x:hidden` on the page wrapper.** It makes the wrapper a scroll container
  and every `position:sticky` scene silently stops pinning. It is `overflow-x:clip`.
- All motion is DOM-written from one rAF scroll loop in the logic class (`applyHero`,
  `applyAsk`, `applyShape`, `applyJourney`, `applyArchive`); there is deliberately **no React
  state** on this page, so interactivity is wired in `componentDidMount` and nothing re-renders
  over the scroll-driven inline styles.
- The hero field's start box comes from a measured in-flow `[data-anchor]` spacer, so it lands
  correctly at any viewport; the dock target is computed from the builder's sidebar widths.
- `prefers-reduced-motion` resolves every scene to its end state via `staticStates()`.
- The header ink flips from white to charcoal as the hero hands off from the sky to the white
  workspace (`headerInk()`); the Logo is mounted `tone="current"` so it follows.
- Earlier versions are kept as `Formkit Landing v1.dc.html` and `Formkit Landing v2.dc.html`.
- Google Forms and Typeform are named only in the comparison section, with no logos, colours or
  claims about what they cannot do. Fictional marks (Northstar, Merrow, Velto, Fieldnote) appear
  only as selectable answers inside a form question — never as customer proof.

## No underlined links, anywhere
Faisal's standing instruction: links never carry an underline or a line-looking border.
`tokens/base.css` in the design system used to draw a 1px `currentColor` `border-bottom` under
every anchor (and drop it on hover, which read backwards); that rule is now
`border-bottom:none;padding-bottom:0` with a colour-only hover, and the page helmets repeat it.
A link signals itself with colour, weight or a pill — never a line.

## No monospace, anywhere
Faisal's standing instruction: Formkit never renders a monospace face. `--font-mono` in
`_ds/.../tokens/typography.css` is deliberately aliased to the Outfit sans stack, so the many
existing `var(--font-mono)` references (field indices, slugs, IDs, embed snippets, shortcuts)
all render in Outfit. Do not restore a mono stack to that token, do not hardcode
`ui-monospace`/`monospace` in a style, and keep the Mono category out of the form theme font
picker (`Component.FONTS`).

## Builder drag-to-reorder
A question/page card is always `draggable`; `onCardPointerDown` decides whether the press may
start a drag — it arms `this.gripArm` unless the pointer landed on an input, textarea, select,
button, link or other control, and `onDragStart` cancels the drag when the flag is unset. The
grip also arms on hover. Do not go back to setting `draggable` from state on mousedown: the
browser reads the attribute before that state lands and the drag never starts.

## Design system
Bound to **Formkit Design System** (`_ds/formkit-design-system-e346e922-…/`). Before passing any
`tone` / `status` / `variant` value, read that component's map in `_ds_bundle.js` — invalid keys
fall back silently rather than erroring (this has bitten us three times: `StatDot tone="green"`,
`StatusBadge status="archived"`, `Badge tone="positive"`).

`FkSelect.dc.html` measures its trigger on open and flips the menu above / right-aligns it when
it would leave the viewport, re-measuring on scroll and resize. Anything reusing it inherits that;
do not hardcode `top:100%` back into the menu.

`ClientTab` is a locked design — do not alter its geometry without an explicit instruction.
