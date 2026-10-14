# Formkit

Forms people actually finish. Next.js 16 on the front, Convex for data and auth,
Resend for email, Vercel for hosting.

Formkit has three plans: Free, Pro and Business, billed per seat through Polar
(see `convex/model/plans.ts`, the single source of truth for what each
includes). AI is Google Gemini (`convex/model/gemini.ts`), on for every account
with a monthly allowance from its plan. Read `PRODUCT_DECISIONS.md` in the
handoff for the standing design decisions, but note the decisions it records
as superseded at its top: the handoff was written when Formkit was going to be
free, with AI off by default and the Claude API.

## Running it

```bash
npm install
npx convex dev      # keeps the backend in sync and writes .env.local
npm run dev
```

`npx convex dev` needs to reach `api.convex.dev`. Where it cannot, run
`node scripts/convex-codegen.mjs` instead - it writes `convex/_generated/` from
the modules on disk so the app typechecks and builds offline. Run it after
adding a Convex module.

## What goes where

Two different places hold secrets, and it matters which.

**Vercel** (already set on the `formkit` project, all three targets):

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | The Convex deployment the browser connects to |
| `NEXT_PUBLIC_SITE_URL` | `https://formkit.app` - canonicals, Open Graph, sitemap |

**The Convex deployment** - these are server-side and never reach the browser,
so they are set with `npx convex env set`, not in `.env.local`:

Two of them are Convex Auth's own signing keys, and nothing works without
them: accounts are created and then token generation throws
`Missing environment variable JWT_PRIVATE_KEY`, which reads on screen as a
failed sign-up. They are generated, and set, by

```bash
npx @convex-dev/auth --prod      # writes JWT_PRIVATE_KEY and JWKS
```

The rest:

```bash
npx convex env set --prod AUTH_RESEND_KEY re_...                 # Resend; full access, so customers' sending domains can be added
npx convex env set --prod AUTH_EMAIL_FROM "Formkit <hello@formkit.app>"
npx convex env set --prod SITE_URL        https://formkit.app    # links inside notification emails
npx convex env set --prod STAFF_EMAILS    you@formkit.app        # who gets the admin console
npx convex env set --prod GEMINI_API_KEY  ...                    # Gemini API key; every AI feature needs it
npx convex env set --prod GEMINI_MODEL    gemini-3.8-flash       # optional: tried first, before the built-in list
npx convex env set --prod GEMINI_LITE_MODEL ...                  # optional: first choice for small, frequent AI jobs
npx convex env set --prod POLAR_ACCESS_TOKEN polar_oat_...       # billing (convex/billing.ts)
npx convex env set --prod POLAR_WEBHOOK_SECRET ...               # verifies Polar's webhook at /polar/webhook
npx convex env set --prod POLAR_SERVER    sandbox                # only while testing; omit for production
npx convex env set --prod VERCEL_API_TOKEN ...                   # custom domains: adds customers' domains to the project
npx convex env set --prod VERCEL_PROJECT_ID prj_...              # the Vercel project that serves formkit.app
npx convex env set --prod VERCEL_TEAM_ID  team_...               # when that project belongs to a team
npx convex env set --prod SECRETS_KEY "$(openssl rand -base64 32)" # seals Stripe keys at rest; then: npx convex run --prod payments:sealStoredKeys
npx convex env set --prod TURNSTILE_SECRET_KEY 0x...             # Cloudflare Turnstile, the spam check on forms
```

On Vercel (all environments): `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_GA_ID` to switch on Google Analytics on the public pages, behind
its consent banner, and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (with
`TURNSTILE_SECRET_KEY` on Convex) to switch on Turnstile, and
`NEXT_PUBLIC_SENTRY_DSN` to send errors to Sentry (browser and server; nothing
is sent while it is unset). Errors inside Convex functions are reported by
Convex's own Sentry integration, set up in the Convex dashboard.

**Apps a form sends responses into** (Pro: a live Google Sheet, Notion,
Airtable, HubSpot) each appear once their OAuth app is set on the Convex
deployment, and stay hidden until then. Register each app with the redirect
URL `https://formkit.app/integrations/callback/<google|notion|airtable|hubspot>`,
then set `GOOGLE_INTEGRATION_CLIENT_ID` / `GOOGLE_INTEGRATION_CLIENT_SECRET`
(scope `drive.file` only), `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` (a public
integration), `AIRTABLE_CLIENT_ID` / `AIRTABLE_CLIENT_SECRET` (scopes
`data.records:write schema.bases:read schema.bases:write`) and
`HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET` (scopes
`crm.objects.contacts.read crm.objects.contacts.write`). Their tokens are
sealed with `SECRETS_KEY`, so set that first.

**Google and Microsoft sign-in** (Business single sign-on) are switched on by
setting their OAuth apps on the Convex deployment: `AUTH_GOOGLE_ID` /
`AUTH_GOOGLE_SECRET`, and `AUTH_MICROSOFT_ENTRA_ID_ID` /
`AUTH_MICROSOFT_ENTRA_ID_SECRET` (optionally `AUTH_MICROSOFT_ENTRA_ID_ISSUER`).
Formkit only accepts an address the provider has verified, so the Microsoft
app registration must include the **`xms_edov`** optional claim on the ID token
(Entra admin centre → App registrations → Token configuration → Add optional
claim → ID → `xms_edov`). Without it, Microsoft sign-in is refused rather than
trusting an email any tenant could claim. After enabling either provider on a
deployment that already has users, run `npx convex run security:oauthLinkAudit`
once and check that the list is empty.

`STAFF_EMAILS` is how the first staff account comes to exist. The console at
`/admin` is gated on a staff role, and nothing in the product can grant one, so
a fresh deployment would otherwise have a console nobody can reach. Addresses
listed here get the owner role once, when a new account first verifies one of
them (the emailed code, or a provider-verified sign-in); after that every
role is changed from inside the console, where the change is audited.

Without `AUTH_RESEND_KEY` nothing is sent and every attempt is written to the
customer's email log as failed, with the reason. Without `GEMINI_API_KEY`
Ask Formkit answers that it is not connected, and the admin console's AI page
shows "No key". Neither fails silently. A busy or retired model hands the
request to the next one in `convex/model/gemini.ts`, and a failed request never
spends a credit.

## Deploying

`main` is the production branch, and Vercel builds every push to it. The
repository root is not the app root: the Next.js project lives in `formkit/`,
which is the project's configured root directory.

Convex ships with the same build. The project's build command is

```
npx convex deploy --cmd 'npm run build'
```

so every Vercel build pushes the schema and functions first, and `convex
deploy` hands the resulting deployment URL to the inner `npm run build` as
`NEXT_PUBLIC_CONVEX_URL`. Which deployment that is comes from
`CONVEX_DEPLOY_KEY`, set on the Vercel project.

Production and preview point at different Convex deployments on purpose, so a
preview build never writes to production data. Both `CONVEX_DEPLOY_KEY` and
`NEXT_PUBLIC_CONVEX_URL` are set per target and the two must name the same
deployment - change one and change the other.

Environment variables do not travel between Convex deployments. A new
deployment starts with none - including `JWT_PRIVATE_KEY` and `JWKS` - so the
whole list above has to be set again on it before anyone can sign up.

To push Convex by hand instead:

```bash
npx convex deploy
```

## The shape of the code

```
convex/            schema, queries, mutations, actions
  model/           shared helpers - identity, handles, forms, built-in templates
  emails/          the one HTML shell every email is rendered into
src/app/           routes: marketing, /app (signed in), /admin, the published form
src/components/
  site/            public chrome - nav, footer, legal, help
  landing/         the scroll story; one rAF loop, no React state
  app/             the signed-in application
  admin/           the staff console
  live/            the form as a respondent sees it
  ui/              the control primitives
src/styles/        tokens copied from the design system, then one file per area
```

## Looking at the signed-in app

The application is drawn almost entirely from Convex queries, so it cannot be
looked at without a backend - which is how it came to be written without ever
being rendered. `scripts/preview/` swaps the Convex hooks for fixtures:

```bash
npm run preview     # the whole app on fixture data, at the real routes
npm run shots       # drives a browser over every screen into preview-shots/
npm run shots -- --width 430    # the narrow layout
```

```bash
npm run drag-check    # the builder's drag and drop, in a real browser
npm run menu-check    # every menu and dropdown paints on top
npm run hero-check    # the landing hero bobs and leans toward the pointer
```

`shots` reports console errors and horizontal overflow beside each screen,
because neither shows up in a screenshot and both are fatal in the product.
The other three check what a screenshot cannot. `drag-check` drives real drags
and asserts the order that comes out, because "the handlers are wired" is not
the same as "it drags". `menu-check` opens each menu and asks the browser what
is actually at that point, because a menu with the highest z-index in the
stylesheet is still buried if an ancestor made a stacking context around it.
`hero-check` moves the pointer and watches the transforms change, because the
floating parts look perfectly correct while standing completely still. Each of
those three shipped broken once.
`next.config.ts` installs the aliases only when `FK_PREVIEW=1`, so a normal
build resolves the real modules. The renders the screens are measured against
are in `../project/shots/`.

## Things worth knowing before changing them

- **The record dock is the app's navigation.** The tabs along the bottom of the
  sky band are it - there is deliberately no second row of tabs in the bar
  above. `ClientTab` in `src/components/app/ds.tsx` is a locked design: the
  active tab's concave bottom shoulders are a radial-gradient square parked
  outside each corner, because `border-radius` cannot express a concave corner.
  The dock is the last thing in the band and the band carries no padding below
  it, so the tabs meet its edge however tall the active one grows.
- **A builder card is always `draggable`.** `onCardPointerDown` decides whether
  the press may start a drag - it arms `gripArm` unless the pointer landed on a
  control, and `onDragStart` cancels the drag when the flag is unset. Setting
  `draggable` from state on mousedown does not work: the browser reads the
  attribute before that state lands. What is being dragged is held in a ref as
  well, because the drop runs from a browser event and cannot wait for a render.
- **Every drag writes to `dataTransfer`.** Firefox refuses to begin a drag that
  carries no data at all, so `setData` is not optional.
- **A drop lands on the gap between two blocks, never on a block.** The insert
  point that opens under the pointer is the thing being aimed at, so where a
  block will end up is shown rather than inferred. While a drag is in flight the
  gap's *catcher* grows, not the gap: growing the gap reflows the canvas out
  from under the pointer and every drop misses.
- **Pictures never pass through a mutation.** `users.generateUploadUrl` hands
  out a one-use URL, the browser posts the file straight to it, and only the
  storage id is written down. `setAvatar` and `companies.setLogo` delete what
  they replace rather than orphaning it.
- **The nav hide guard reads resting geometry, not the live rect.** Computing it
  from `getBoundingClientRect()` makes the bar flicker as it hides itself.
- **The landing hero leans toward the pointer.** The floating form parts, and
  the pill in the headline, bob on a clock of their own and tilt in 3D toward
  the cursor - `floaties()` in `scrollEngine.ts`, on its own rAF loop because
  the scroll loop parks itself once everything has settled. The stage needs its
  `perspective`, and everything stops under `prefers-reduced-motion`.
- **Nothing between a menu and `.fk-app-head` may carry a `z-index`.** Any that
  does becomes a stacking context and traps the menu inside it, under the record
  dock, however high the menu's own z-index goes.
- **The landing page does not use React state.** One rAF loop writes to refs
  through a write guard; adding state to the scroll path drops frames.
- **Blocks are one ordered list.** Questions and page breaks share `order`,
  because that is what the builder canvas shows. Reordering sends the whole new
  order in one mutation.
- **A hidden question is never required.** Otherwise a logic rule can make a
  form impossible to submit.
- **Sharing is three separate things.** The Share panel owns the public link and
  has no on/off switch, Collaborators owns people, and a claimed handle owns the
  shape of the URL. Do not fold them together.
- **AI is on for every account, metered by plan.** Each company gets a monthly
  allowance of builds, edits, responses and reports (`model/aiMeter.ts`),
  then credits. Staff can turn AI off for one account or pause it for
  everyone, and every AI path checks that switch (`aiAllowed`), including the
  ones that run by themselves on responses.
