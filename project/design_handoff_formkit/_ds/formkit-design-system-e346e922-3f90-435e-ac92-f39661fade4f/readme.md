# Formkit Design System

Formkit is a form creation and data collection platform: the familiarity of Google Forms, the craft of Typeform, and a visual identity of its own. People build forms by drag and drop, brand them with their own colours, type and logos, share them as links or embeds, and manage responses and analytics from a dashboard. Its audience is freelancers, creators, consultants, agencies and small businesses — professional enough for a client proposal, friendly enough that nobody dreads filling one in.

**Design principle: make the data feel calm.** A screen is a sheet of cool tinted-white paper with white cards floating on it under one sky-blue band. Figures are set large and light, colour appears only as a small disc beside a number, and nothing is outlined that a shadow can hold.

## Sources

- `uploads/Screenshot 2026-09-12 at 6.30.30 PM.png` through `6.36.32 PM.png` — nine screens of the user's own dashboard design, supplied as the reference this system is rebuilt on. Extracted directly and deliberately: the sky gradient hero, the floating circular tab rail, the translucent record tabs docked under the hero, the white 28px cards with a corner arrow button, the large-light metric numerals, the hairline tick charts and tick meters, the small state discs, the account capsule, the pill composer, the Outfit-style geometric type and the soft green / yellow / coral data palette.
- `uploads/www.mews.com-en.png`, `uploads/mews2.png` — the earlier reference for the previous (pink / black / cream) direction. Superseded; kept only for history.
- `uploads/Logo-Dark.svg`, `uploads/Logo-White.svg`, `uploads/Favicon.png` — the real Formkit logo artwork and favicon, supplied by the user. Now the system's mark; see **Iconography**.
- No codebase, Figma file or font binaries were provided. See **Substitutions & gaps**.

---

## Content fundamentals

**Voice: plain, short, a little dry.** Formkit talks like a competent studio colleague, not a SaaS platform. It states what happened and what to do next.

- **Second person, addressed to the user.** "Your form is live." "Where should we send the proposal?" First person plural ("we") only inside form copy the *creator* writes to their respondents.
- **Sentence case everywhere** — buttons, headings, menu items, labels, table headers. This system has **no uppercase tracked labels at all**; a label that needs presence gets space, not weight.
- **Verb-first buttons, two words maximum.** Create form. Publish. Export CSV. Mark reviewed.
- **Full stops in sentences, none in labels.** "Your form is live." keeps its stop; `Publish` does not.
- **Numbers are concrete, and kept as authored.** "248 responses", "72,52%", "4m 12s", "1–25 of 248". Decimal commas are not normalised.
- **Empty states have a joke's worth of warmth, no more.** "No forms yet. Let's make something people actually want to fill out."
- **Errors name the fix.** "That address is missing a domain — try alex@northwind.co", not "Invalid input".
- **No emoji. No exclamation marks** except in genuine celebration, once per flow.
- **Avoid:** "seamless", "powerful", "leverage", "workflow", "solution", "simply", "just".

---

## Visual foundations

### The core contrast
Tinted-white paper (`#f7fbff`), white cards, soft charcoal ink (`#2c3034`), and one sky-blue band across the top of every screen. Nothing is pure black. There is exactly one gradient in the system and it only ever appears as that band.

### Colour
- **The page is `--paper #f7fbff`** — a tinted white cooled by the sky accent, deliberately not a step on the neutral ramp, and only ever the page background.
- **Neutrals are cool.** `--neutral-0` is the cards, `--neutral-100 #f4f4f4` chip fills, sunken recesses and chart tracks, `--neutral-200 #e0e2e4` every hairline and unfilled chart tick, `--neutral-900 #2c3034` all ink and the primary pill. `--neutral-950` exists for pressed states only.
- **Nothing small is ever set in white on the sky band.** The band is light; `.fk-on-hero` carries charcoal ink for everything but the display title.
- **The hero band is a supplied image.** `--gradient-hero` is `var(--blue-400) url(<data URI>) center/cover no-repeat` — a 1440×600 JPEG (37 KB, 49 KB base64) inlined into the token, with the colour painting behind it as the fallback. It is inlined deliberately: a relative `url()` inside a custom property resolves against the *consuming document*, not the declaring stylesheet, so a path breaks across the kits, the cards and any project that copies these files out. `assets/hero-bg.jpg` is kept as the source file. This is the only raster image in the system.
- **Signature accent: sky.** `--blue-400 #86b2dc` is the accent fill; `--blue-400 #86b2dc` is the accent fill (with charcoal text on it, 5.9:1), `--blue-300` the tinted plate, `--blue-500` selection, `--blue-700 #1a5b95` the only blue that may carry small text (7:1 on white).
- **Data accents are soft and never neon:** green `--green-300/400`, yellow `--yellow-300`, coral `--red-400`. They exist to colour ticks and state discs. They are never a background for text and never decoration.
- **Colour never lands on a numeral.** A figure stays ink at weight 300; the state rides in a 20px disc beside it and the meaning sits in the grey label underneath.
- **Form themes are a separate palette space.** `--form-*` tokens are what a creator's brand overrides; app tokens never leak into a published form, and `--form-error` recalculates per theme so dark themes stay legible.

### Type
One typeface: **Outfit** (200–700), plus **JetBrains Mono** for slugs, field indices and token names. Outfit is a geometric sans with a tall x-height: it holds a 64px headline at 700 and, crucially, gives the large-light numerals the reference is built on.

- Display 64 / H1 44 at **700**; H2 32 at 600; H3–H5 at **500**. Weight 800 never appears.
- **Metrics are the signature:** 46px (or 30px) at **weight 300**. Never bold, never coloured, never below 24px.
- Body 15/1.6 in the app, 17/1.65 in a published form. Labels 13.5–14 at 400 in `--color-text-tertiary`.

### Space and layout
4px grid, 4 → 120. Card padding 26, card gap 18, page gutter 40, section gap 44. Desktop is 12 columns with 20px gutters; the dashboard runs three metric columns plus a 1.1fr assistant rail. Content **overlaps the sky band by 44px** so the two planes interlock. The published form reads in a 660px column.

### Surfaces, borders, shadows
Cards are white, 28px radius, **no border**, and carry `--shadow-card` at rest: elevation is how a surface is separated, not a stroke. `--shadow-inset-hairline` is the exception for a surface flush on white. Radius: 8 / 12 / 16 / 20 / 28 cards / 36 panels / pill. **Every control — button, input, chip, tab, filter, table pill — is a pill.** Icon buttons are circles.

### Backgrounds and imagery
The sky band, the mint `--gradient-glass` editorial block, and flat colour. No noise, no patterns, no drawn illustration. Translucency is real but rationed: the record tabs, the tab rail and the hero field pills use `--color-surface-glass` over the gradient; modal scrims blur 4px. Photography is not part of the system — `Avatar` renders initials until a real `src` is supplied.

### Motion
140ms controls, 220ms surfaces, 340ms data, on `cubic-bezier(.22,.8,.24,1)`. Charts animate height and width only. The spring is reserved for the switch knob, the insert-field pill and the toast entrance. `prefers-reduced-motion` zeroes every duration.

### States
- **Hover:** solid pills darken a step; white pills gain `--shadow-md`; cards lift 3px to `--shadow-lg`; table rows tint to `--neutral-50`.
- **Press:** `scale(.97)`.
- **Focus:** `--focus-ring` — a 3px white gap then a 2px sky ring. Inputs take an inset sky border plus a 4px `--blue-100` halo. Never removed.
- **Selected (builder):** inset 1.5px `--blue-500` ring on a `--blue-50` fill.
- **Disabled:** `--neutral-150` fill, `--neutral-400` text, `not-allowed`.

### Accessibility
WCAG AA is a floor, with one documented exception. Ink `#2c3034` on paper is 11.6:1; `--color-text-tertiary` (`--neutral-600`) on white is 4.7:1.

**The sky band is a LIGHT ground, so ink on it is charcoal, not white.** White text on the band measures 1.9–3.5:1. Measured against the band's actual `cover` crop, `--neutral-700` falls to 2.3:1 and `--neutral-900` to 3.8:1 at the image's darkest point, so the `.fk-on-hero` scope maps every text role to `--neutral-950` (4.7–8.8:1) and the band's icon buttons use charcoal glyphs in charcoal-alpha rings. On the record tabs the translucent plate lightens the ground, so name (`--neutral-900`, 5.9:1) and meta (`--neutral-800`, 4.7:1) keep their hierarchy.

**The one exception:** the display-scale `h1` on the band is set in white for brand fidelity with the source reference, where it measures 2.50:1 over the image — below the 3:1 that headline-scale type requires. It is a deliberate, isolated choice and the only element in the system that fails AA. Setting it in `--neutral-950` (6.56:1) would resolve it. The soft green, yellow and coral are **graphic colours only** — they never carry text, and `StatDot` takes a `label` whenever it is not adjacent to text saying the same thing. Every icon-only control takes a required `label`; the tab rail and account capsule expose theirs through `title` and `aria-label`. Touch targets stay at 44px (`--tap-target-min`).

### Responsive
- **Dashboard:** 3 metric columns + assistant rail → 2 columns with the assistant beneath → 1 column; the record dock scrolls horizontally; `StatGrid` stays 2×2.
- **Builder:** three panes → canvas full width, library as a bottom sheet, settings as a pushed panel.
- **Published form:** 20px margins, 17px question type, 54px controls, sticky submit in conversational mode.

---

## Iconography

**Lucide**, stroke **1.8** (2.6 only inside a state disc), sizes 14–22. `Icon` fetches source SVG from the pinned `lucide-static@0.544.0` CDN build and inlines it, so glyphs inherit colour and stroke; swapping in a local sprite means changing one constant in `components/core/Icon.jsx`. Icons sit in circles, never squares, and always beside a word except in the tab rail and account capsule. Field-type glyphs are centralised in `FIELD_TYPES` so the library tile, canvas block, settings panel and responses table always agree.

---

## Index

### Root
| File | What it is |
| --- | --- |
| `styles.css` | The single entry point consumers link — `@import`s only |
| `readme.md` | This guide |
| `SKILL.md` | Agent-skill wrapper |
| `thumbnail.html` | Homepage tile |
| `tokens/` | `fonts · colors · typography · spacing · radius · shadows · motion · layout · base` |
| `guidelines/` | 21 specimen cards: Brand, Colors, Type, Spacing, Motion |
| `components/` | 7 groups, 57 components |
| `ui_kits/` | `formkit-app`, `published-form` |

### Components

**core/** — Button, Spinner, IconButton, Icon, Badge, StatusBadge, StatDot, FieldPill, Card, Tag, Divider, Logo

**forms/** — FormField, Input, Textarea, Select, Checkbox, Radio, Switch, SegmentedControl, SearchInput, RatingInput, FileDropzone

**navigation/** — PillTabs, ClientTab, AvatarPill, Avatar, Tabs, TopBar, SidebarNav, Breadcrumb, Pagination, DropdownMenu, Stepper, WorkspaceSwitcher, UserMenu

`ClientTab` is a **locked design** — a connected tab with curved bottom shoulders, signed off and specified in `CLAUDE.md`. Its geometry (20px inverted corner flares, square bottoms, equal widths, 7px dock gap with 20px gutters) should not be altered without an explicit instruction to change the tabs.

**data/** — MetricCard, TickChart, TickBars, StatGrid, StatCard, Table, FormCard, BarChart, FunnelChart, FilterBar

**assistant/** — ChatMessage, PromptInput

**feedback/** — Alert, Toast, Tooltip, Modal, Drawer, EmptyState, Skeleton, ProgressBar

**builder/** — FieldTypeIcon (`FIELD_TYPES`, `fieldType`), FieldTypeTile, QuestionBlock, InsertPoint, PropertyRow, LogicRule

**form-experience/** — LogoLockup, FieldPreview, FormProgress, ThemePreset (`THEME_PRESETS`), ShareLink

The five components that define this system: **MetricCard** (the card every dashboard is built from), **TickChart** and **TickBars** (all measurement), **StatDot** (all state) and **PillTabs** (all navigation). Reach for those before inventing a layout.

Each component directory has `<Name>.jsx`, `<Name>.d.ts`, `<Name>.prompt.md` and one `@dsCard` specimen HTML.

### UI kits
- **`ui_kits/formkit-app/`** — sky-hero dashboard with the tick-chart metric grid and AI assistant rail, empty dashboard, create-form modal, form builder, theme editor, responses + response detail, analytics, share, form settings. Click-through from one `index.html`.
- **`ui_kits/published-form/`** — classic mode, conversational mode, success state, validation state, re-themed live across all ten presets.

---

## Substitutions & gaps

1. **Logo: real artwork, supplied.** The stacked mark + "formkit" wordmark comes from `uploads/Logo-Dark.svg` / `Logo-White.svg`. Paths are inlined in `components/core/Logo.jsx` and painted in `currentColor`, so one component serves both tones with no network fetch; `assets/logo.svg`, `assets/logo-mark.svg`, `assets/logo-dark.svg`, `assets/logo-white.svg` and `assets/favicon.png` hold the files. The wordmark is artwork, not live type — it is not set in Outfit and must never be re-spaced or recoloured.
2. **No 3D artwork.** The reference hero carries a rendered glass object behind the title. Nothing equivalent was supplied and none can be generated here, so the hero is the gradient alone. Drop a transparent PNG behind the title in `AppShell.jsx` when the render exists.
3. **No photography.** `Avatar` and `AvatarPill` render initials until a real `src` is passed.
4. **Fonts are Google Fonts.** Outfit and JetBrains Mono load from the Google Fonts CSS endpoint in `tokens/fonts.css` — no `@font-face` rules, no self-hosted files. If Formkit has licensed type, send the files and this becomes a one-file change.
5. **Icons are Lucide** via CDN, flagged above.
6. **All product content is invented** — Studio Nine, Northwind, Velto, the response data. It is written to the voice rules above and is safe to keep as demo content.
7. **Not built:** collaboration/presence UI, billing, notification centre, drawn mobile breakpoints (rules documented, screens not drawn), and real drag physics in the builder.
