# Handoff: Formkit

## Overview

Formkit is a form-creation and data-collection platform for freelancers, studios, consultants and small businesses. People build forms by drag and drop, brand them with their own colours, type and logo, publish them at their own link, and manage responses and analytics from a dashboard.

This bundle covers the whole product as designed: a public marketing site, a help centre, legal pages, the customer application, and an internal staff console.

**Formkit is free.** There are no plans, no prices and no billing. Plans were deliberately removed from the design; do not reintroduce them.

## About the design files

The `.dc.html` files in this bundle are **design references written in HTML** — prototypes that show intended look and behaviour. They are not production code to copy.

The task is to **recreate these designs in the target codebase's environment** — React, Vue, Svelte, whatever is established — using its existing patterns, routing and component libraries. If no environment exists yet, choose one appropriate to the project and implement the designs there.

Each file is a self-contained document with an HTML template and a JavaScript class that supplies its data and behaviour. The class is a reasonable guide to component state, but the file format itself is specific to the prototyping tool and should not be reproduced.

## Fidelity

**High fidelity.** Colours, typography, spacing, radii, shadows, motion and interaction states are final and come from a real design system (see *Design tokens*). Recreate the UI to match, using the codebase's own primitives where they exist.

---

## Architecture

### Public site (indexable)

| File | Route | Purpose |
| --- | --- | --- |
| `Formkit Landing.dc.html` | `/` | Marketing home — one continuous scroll story |
| `Formkit Templates.dc.html` | `/templates`, `/templates/:slug` | Template index + six template detail pages |
| `Formkit Pricing.dc.html` | `/pricing` | Free-tier explanation and honest limits |
| `Formkit Compare.dc.html` | `/compare`, `/compare/:slug` | Comparison hub + two competitor pages |
| `Formkit Help.dc.html` | `/help`, `/help/:slug` | Help centre — 12 categories, 39 articles |
| `Formkit Privacy.dc.html` | `/privacy` | Privacy policy |
| `Formkit Terms.dc.html` | `/terms` | Terms of service |
| `Formkit 404.dc.html` | 404 | Not found |

### Application (must be `noindex`)

| File | Route | Purpose |
| --- | --- | --- |
| `Formkit Main App.dc.html` | `/app/*` | Dashboard, builder, responses, analytics, settings |
| `Formkit Auth.dc.html` | `/signin`, `/signup` | Sign in and sign up |
| `Formkit Onboarding.dc.html` | first run | Four-step account setup |
| `Formkit Admin.dc.html` | `/admin` | Formkit-staff console, unlinked and gated |

### Shared components

| File | Used by | Notes |
| --- | --- | --- |
| `Formkit Nav.dc.html` | every public page | Fixed dark pill; two states |
| `Formkit Footer.dc.html` | every public page | Dark inset card, giant wordmark |
| `Formkit Sky.dc.html` | every public hero | Animated "Night Sky" background |

`FkColor.dc.html` and `FkSelect.dc.html` are two small in-app controls. `Formkit Landing v1/v2.dc.html` are superseded drafts — ignore them.

---

## Global chrome

### Navigation bar

Fixed, horizontally centred, above all content at `z-index: 80`.

- **Shape** — pill, `border-radius: 999px`, height `60px` (54px below 560px viewport), padding `0 8px`.
- **Colour** — solid `#21282E`, shadow `0 18px 40px -26px rgba(33,40,46,.9)`, `backdrop-filter: blur(14px)`.
- **Geometry** — at rest `top: 29px` and `width: calc(100% - (clamp(10px,1.5vw,20px) + 12px) * 2)`, i.e. 12px inside the page container. Past 60px of scroll it animates to `top: 14px` and `width: min(1200px, calc(100% - clamp(24px,5vw,56px)))`. Transition `.45s cubic-bezier(.22,.8,.24,1)` on width, top and transform.
- **Contents** — logo (links to `/`), then an absolutely centred link group (Product, Templates, Pricing, Compare, Help center) at `left: 50%; transform: translateX(-50%)`, then the account area. Links are 40px pills, `13.5px`, `rgba(255,255,255,.86)`, hovering to `rgba(255,255,255,.14)` background and white text. The current page's link is permanently in the hover state.
- **Hiding** — the bar lifts away (`translateY(calc(-100% - 40px))`) whenever an element marked `data-nav-hide` intersects its resting footprint, and returns otherwise. On the landing page the hero, the two pinned scenes and the footer are marked. Below 60px of scroll the bar always shows.
  - **Implementation warning.** Compute the guard from the bar's *resting* geometry (`restingTop + height + 12`), never from its live rect. Reading the live rect while hidden collapses the test, the bar animates back in, and — with the handler only firing on scroll — it comes to rest on top of the section it was avoiding.
- **Responsive** — the centre link group is hidden below 980px.

#### Two account states

- **Signed out** — a "Sign in" text pill then a white "Sign up" pill (`#ffffff` on `#21282E`, 42px, weight 500).
- **Signed in** — an avatar capsule: 34px white disc with the user's initials in `#21282E` at 13px/600, the account name (max 14ch, ellipsised), and a chevron that rotates 180° when open. Clicking opens a dropdown below it: white, `border-radius: 18px`, `min-width: 230px`, `shadow-float`, containing the name and email, a divider, Dashboard, Help center, a divider, and **Log out** in `--red-600` on a `--red-100` hover. Closes on outside pointerdown or Escape.

Signed-in state is derived from the presence of the app's saved session. Logging out clears the session and navigates to `/`.

### Footer

A dark inset card, matching the page's other containers.

- `background: #21282E`, `margin: 0 clamp(10px,1.5vw,20px)`, `border-radius: clamp(20px,2.4vw,34px)`, `box-shadow: 0 0 0 1px rgba(134,178,220,.25)`, padding `clamp(56px,8vw,110px) clamp(24px,7vw,110px) 34px`. Everything centred.
- **Headline** "What will you ask first?" — `clamp(28px,4.4vw,58px)`, weight 700, `letter-spacing: -.04em`, `max-width: 16ch`.
- **Ask field** — 620px max, pill, `1px solid rgba(255,255,255,.24)` on `rgba(255,255,255,.05)`; a transparent text input plus a white "Build a form" pill whose arrow shifts `translateX(4px)` when the field has content. Stacks vertically below 560px.
- **Link rows** — three full-width rows (PRODUCT, LEARN, ACCOUNT), each a centred flex row of a `11px` `.12em`-tracked heading (min 7ch, right-aligned) followed by its links at `15px`. Rows 1 and 2 carry `border-bottom: 1px solid rgba(255,255,255,.14)`; the last does not. Below 560px each row becomes a centred column.
- **Wordmark** — the Formkit logo at `clamp(56px,10vw,150px)`, drawn twice in the same flex-centred box: a ghost at `rgba(255,255,255,.18)` and a white copy absolutely on top, revealed left to right with `clip-path: inset(0 <100-fill>% 0 0)` as the footer scrolls into view. Typing in the ask field pushes the fill further (`min(100, length * 3)`).
  - **Implementation warning.** The logo renders as a `display:block` SVG behind a `display:contents` wrapper, so `text-align: center` cannot centre it — both layers need `display:flex; justify-content:center` or they desynchronise.
- **Bottom bar** — © 2026 Formkit · formkit.app · Privacy · Terms, centred, `12.5px`, `rgba(255,255,255,.45)`.

### Page frame

Every public page is a stack of inset cards on the paper background:

```
--fk-gutter: clamp(10px, 1.5vw, 20px);
--fk-gap:    clamp(10px, 1.5vw, 20px);
--fk-round:  clamp(20px, 2.4vw, 34px);

section, main, footer {
  margin: 0 var(--fk-gutter) var(--fk-gap);
  border-radius: var(--fk-round);
  box-shadow: 0 0 0 1px rgba(134,178,220,.25);   /* 25% sky-blue ring */
  overflow: hidden;
}
```

Pinned (scroll-driven) sections are the exception: the section itself stays full-bleed and transparent, and the rounding, tint and ring live on the sticky shell inside it, which is `top: var(--fk-gap); height: calc(100vh - var(--fk-gap) * 2)`.

**Implementation warning.** Do not set `height: auto` on a sticky shell whose children are all absolutely positioned — it collapses to 0 and `overflow: hidden` then erases the section.

---

## Screens

### Landing page

One continuous scroll narrative: **ASK → SHAPE → ANSWER → UNDERSTAND → ACT**. Total height roughly 900vh.

**Hero (`#ask`, 280vh, pinned).** Night Sky background, content centred. Eyebrow row: a "Form builder" pill on `rgba(255,255,255,.16)` plus "Build forms, add logic, read the responses — free." Headline "What will your next **form** do?" at `clamp(42px,8.6vw,132px)`/700/`-.045em`, where *form* sits in a pill — `rgba(255,255,255,.12)`, `inset 0 0 0 2px rgba(255,255,255,.55)`, a green check disc in front — and reacts to the pointer. Sub-line "Design the questions. Branch the journey. Read what comes back." One line on desktop, wrapping below 860px. Two CTAs: white "Build a form", glass "Explore Formkit" (scrolls to the next section). A centred "Scroll down" cue with a chevron nudging on a 1.6s loop sits at the card's foot.

Six abstract form parts (checkbox, toggle, radio, star rating, input line, upload chip) float at depths 14–40, bobbing continuously and leaning toward the pointer with a slight 3D tilt under `perspective: 900px`. Hidden below 1100px, where the centred headline reaches them.

As you scroll, the headline scales away, the sky hands off to a `#E9F3FB` workspace, and a **1660×760 Formkit builder** scales in to fill the card: a 64px header with the form name, status pill and Publish; six rounded-rectangle editor tabs (Build, Design, Logic, Responses, Analytics, Settings — active `#E7F1F9` with a sky ring, inactive white); a 300px field library with a search field and grouped field-type tiles; the canvas with a welcome card, a page-break row and three question cards; and a 340px right column with Pages and Field settings. Phases resolve by 62% of the pin so the assembled builder holds. A dark `#21282E` caption plate rises at the foot carrying the ASK eyebrow, "Start with what you need to know." and its supporting line.

**SHAPE (`#shape`, 280vh, pinned).** Two columns: the logic rule on the left, what the respondent sees on the right. Five scroll steps add the condition, divide the path, drop a question, cut 11 to 8, and merge. Beneath the rule, two tick-chart rows show 73% existing clients / 27% new clients. Dark caption plate at the foot.

**ANSWER (`#answer`).** A live, interactive form on `--blue-50`: pick one of four invented brands (Northstar, Merrow, Velto, Fieldnote), attach a file, submit, start again — with a mobile screen tracking every state. It auto-advances every 3s until the visitor clicks, then hands over permanently.

**UNDERSTAND (`#understand`).** A full-bleed two-column inbox: response list on the left (rows go New → Read on click, avatars are drop targets for real photography), response detail on the right with answers, the attachment, Mark reviewed / Add a note / Export, and below it the completion rate with a tick chart and "where people stop". Dark caption plate at the foot.

**Analytics (`#analytics`).** On `--blue-50`: a 7/30/90/Custom pill segment, export buttons, five stat cards (Views, Started, Completed on `--blue-300`, Completion rate on `#21282E`, Average time), a "Responses over time" bar chart at `clamp(300px,36vw,430px)` running to the card's bottom edge, and a completion funnel in tick rows.

**Features (`#features`, 300vh, pinned).** Twelve feature cards on a horizontal track driven by vertical scroll, with a counter, prev/next arrows and a progress bar. Below 820px the track wraps into an ordinary grid.

**Comparison.** A 10-row × 3-column matrix with tick / dash / cross discs, each labelled in words so it never relies on colour alone.

**FAQ.** Six questions plus a "Visit the help center" pill.

### Templates

Index: six cards, each with a tinted icon tile, name, blurb, question count and time. Below, "How Formkit templates work" in three columns.

Detail (six of them): breadcrumb, `<name> form template` headline, "Use this template" CTA, then the full numbered question list with answer types, "Who this template is for", three FAQs, a sticky at-a-glance panel and links to the other five.

The six templates are Client onboarding (11q), Website questionnaire (14q), Customer feedback (6q), Lead qualification (8q), Event registration (9q) and Product research (10q). Full question text lives in `Component.TPL`.

### Pricing

Hero "Formkit is free." Then twelve included features in a hairline grid, three honest limits (10 MB uploads, English US only, admin-enabled AI), and six FAQs.

### Compare

Index with the full three-way table plus two cards. Detail pages (Google Forms, Typeform) drop to two columns, add a "pick it when" framing for both products, and carry their own FAQs. **No competitor logos, colours, screenshots or attack language** — the comparison is sourced to each product's published free tier, and a dash means "narrower", never "missing".

### Help centre

Hub: Night Sky hero with search and popular chips, then 12 category cards each listing its articles. Search filters titles, summaries and body text, showing a match snippet. Article view: sticky sibling sidebar, links to other categories, prev/next through all 39, and a "Was this helpful?" footer.

### Main application

Dashboard, form builder (field library / canvas / settings), design and theme editor, logic rules, responses inbox with detail drawer, analytics, share modal, form settings, and account settings. It has its own chrome — the public nav does not appear here.

### Admin console

Formkit-staff only: overview, accounts (a 20-row sample presented as 10,020), AI access, moderation, support, announcements, team access, feature flags and an audit log. Reached at `/admin`, gated by who you are, with no link back to the customer app.

---

## Interactions and behaviour

### Scroll choreography (landing page)

One `requestAnimationFrame` loop reads scroll position, eases each scene's progress toward its target (damping 0.16) and writes styles directly to the DOM. It parks itself when everything has settled. There is **no React state on this page** — interactivity is wired on mount and nothing re-renders over the scroll-driven inline styles.

A write guard skips any style assignment whose value has not changed. Tracks are moved with `translate3d` only.

**Reimplementation note.** In a component framework, keep this as an imperative effect writing to refs. Driving 900vh of choreography through render state will drop frames.

### Reduced motion

`prefers-reduced-motion: reduce` resolves every scene to its end state, disables the floaters, the auto-advancing form and the bobbing, and zeroes all durations.

### Responsive

| Breakpoint | Behaviour |
| --- | --- |
| ≤1100px | Hero floaters hidden |
| ≤1024px | Two-column scenes (SHAPE, inbox) collapse to one |
| ≤980px | Nav centre links hidden |
| ≤900px | Help category links hidden |
| ≤820px | **Pinned scenes unpin entirely** — sections become `height:auto`, shells `position:static`, the hero builder is hidden, caption plates go static, the features track wraps to a grid. The scroll engine detects this and skips all transform driving. |
| ≤640px | Help hub and article grids single-column, article sidebar unsticks, footer rows stack |
| ≤560px | Nav 54px, CTAs full width, footer ask field stacks |

The application and admin console carry their own breakpoint systems on resize listeners: the app uses `narrow <1080`, `panes ≥1180`, `compact <900`, `phone <620`, `tight <400`; admin collapses its sidebar at 1024 and swaps tables for card lists at 760/900.

---

## Design tokens

From the **Formkit Design System**. The full token files ship in `_ds/` alongside this README — link those rather than re-typing values.

### Colour

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f7fbff` | Page background only |
| `--neutral-0` | `#ffffff` | Cards |
| `--neutral-100` | `#f4f4f4` | Chip fills, chart tracks |
| `--neutral-200` | `#e0e2e4` | Every hairline, unfilled ticks |
| `--neutral-900` / `--neutral-950` | `#21282E` | **All ink and every dark surface** |
| `--blue-400` | `#86b2dc` | Signature sky accent |
| `--blue-700` | `#1a5b95` | The only blue that may carry small text |
| `--blue-50` | — | Tinted section containers |
| `--green-300/400`, `--yellow-300`, `--red-400` | — | Data colours only, never behind text |

Additional literals used on the marketing site: `#0a3d6f` (Night Sky base), `#083357` (hero card), `#E9F3FB` (builder workspace), `#E7F1F9` (active tab, rails), `#ECF3F9` (hero ink), `rgba(134,178,220,.25)` (container ring).

**Rules.** Nothing is pure black — `#21282E` is the one dark. Colour never lands on a numeral: figures stay ink at weight 300 with a coloured disc beside them.

### Type

**Outfit** (200–700) throughout. There is **no monospace anywhere** — `--font-mono` is deliberately aliased to the Outfit stack, and the Mono category is excluded from the form theme picker.

Display 64 / H1 44 at 700; H2 32 at 600; H3–H5 at 500. Metrics are 46px or 30px at **weight 300** — never bold, never coloured. Body 15/1.6 in the app, 17/1.65 in a published form. Labels 13.5–14 in `--color-text-tertiary`. Sentence case everywhere; no uppercase tracked labels in the product (the marketing site uses `11px` `.12em` eyebrows).

### Space, radius, elevation

4px grid, 4 → 120. Card padding 26, card gap 18, page gutter 40, section gap 44.

Radius 8 / 12 / 16 / 20 / 28 (cards) / 36 (panels) / pill. **Every control is a pill; icon buttons are circles.**

Cards are white with **no border** and carry `--shadow-card`; elevation separates surfaces, not strokes.

### Motion

140ms controls, 220ms surfaces, 340ms data, all on `cubic-bezier(.22,.8,.24,1)`. Charts animate height and width only.

### States

- Hover: solid pills darken; white pills gain `--shadow-md`; cards lift 3px to `--shadow-lg`; table rows tint to `--neutral-50`.
- Press: `scale(.97)`.
- Focus: `--focus-ring` — 3px white gap then a 2px sky ring. Never removed.
- Selected (builder): `inset 0 0 0 1.5px var(--blue-500)` on `--blue-50`.
- Disabled: `--neutral-150` fill, `--neutral-400` text, `not-allowed`.

---

## Standing design rules

These were decided explicitly and should carry into the build.

1. **No underlined links, anywhere.** A link signals itself with colour, weight or a pill — never a line. The design system's base stylesheet was changed to remove the default `border-bottom`.
2. **No monospace, anywhere.**
3. **`#21282E` is the one dark colour** for text and dark surfaces.
4. **Night Sky on every public hero.** The older photographic sky band is retired; `--gradient-hero` is overridden to the Night Sky gradient. The landing page is the one exception — it uses the Night Sky component directly rather than the token.
5. **Formkit is free.** No plans, no prices, no billing UI.
6. **Identity is person-first.** A user is a person; companies are optional and plural. Forms publish under a person or a company, each with its own claimed handle.
7. **AI form building is an allow-list, off by default.** When an account does not have it, there is no AI surface at all — no launcher, no locked state, no mention in settings. Do not add an upsell.
8. **Sharing is three separate things**: the Share modal owns the public link (with no on/off switch — closing or unpublishing is how you stop answers), Collaborators owns people, and a claimed handle owns the URL shape.
9. **No fake proof.** No customer logos, no testimonials, no invented statistics. Fictional marks appear only as selectable answers inside a form question.
10. **Competitors are named only in the comparison**, with no logos, colours or claims about what they cannot do.

---

## SEO

Implemented in the prototypes and worth preserving:

- `<html lang="en-US">` on every document.
- Per-page `<title>`, meta description, canonical, Open Graph and Twitter tags. Templates and Compare rewrite theirs per route.
- JSON-LD: `SoftwareApplication` + `FAQPage` (landing), `Product` with a zero-price offer + `FAQPage` (pricing), `BreadcrumbList` + `HowTo` + `FAQPage` (each template), `BreadcrumbList` + `FAQPage` (each comparison), `WebSite` + `SearchAction` (help).
- `noindex, nofollow` on the app, admin, auth and onboarding; `noindex, follow` on 404.
- One `h1` per page, ordered headings, a skip link on each public page.

### Outstanding for development

1. **Real routes.** Templates, Compare and Help currently use hash routing because each prototype is one file. Per-template and per-article pages must become real paths to be indexed separately — this is the highest-value SEO task in the build.
2. **`robots.txt` and `sitemap.xml`**, mirroring the `noindex` intent above.
3. **Open Graph images** — the tags exist but point at nothing. One 1200×630 card per public page.
4. **`Organization` schema** with a logo, sitewide.
5. **Article schema** per help article once they have real URLs.

---

## Assets

- **Logo** — real Formkit artwork, paths inlined in the design system's `Logo` component and painted in `currentColor`. Files in `_ds/.../assets/`. The wordmark is artwork, not type; never re-space or recolour it.
- **Icons** — Lucide at stroke 1.8, sizes 14–22. The prototypes inline 146 icons in `fk-icons.js` so the pages need no network at runtime; in production use the Lucide package directly.
- **Fonts** — Outfit from Google Fonts.
- **Competitor marks** — `uploads/Google Form.svg` and `uploads/tyeform.svg`, supplied by the client, used only in the comparison table headers.
- **Photography** — none. Avatars render initials; the inbox avatars on the landing page are drop targets awaiting licensed portraits.
- **No illustration, no 3D, no patterns.** The Night Sky is drawn in CSS.

---

## Files in this bundle

Every `.dc.html` listed under *Architecture*, plus:

- `_ds/` — the Formkit Design System: token stylesheets, `styles.css` and the component bundle. **Link these directly** rather than re-deriving values.
- `fk-icons.js` — the inlined Lucide set.
- `image-slot.js` — the drag-and-drop image placeholder used for avatars.
- `uploads/` — the two competitor marks.
- `PRODUCT_DECISIONS.md` — the running record of product decisions, including several that cost a debugging pass and are worth reading before touching the relevant area.
