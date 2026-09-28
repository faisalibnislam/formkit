# Preview harness (development only)

The signed-in application is drawn almost entirely from Convex queries, so it
cannot be looked at without a backend - which is how it came to be written
without ever being rendered.

This harness swaps the Convex client hooks for fixtures, so

    npm run preview

serves the whole app at the real routes (`/app`, `/app/forms`, …) with a
representative account in it. Nothing here is imported by a normal build:
`next.config.ts` only installs the aliases when `FK_PREVIEW=1`.

`npm run shots` drives a browser over those routes and writes
`preview-shots/` - the pass that catches a layout that does not match the
reference renders in `project/shots/`.
