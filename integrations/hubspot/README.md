# Formkit's HubSpot app

The OAuth app customers connect from a form's Settings → Connections → HubSpot
(convex/integrations.ts). Each response creates or updates a contact and adds
a note with the answers.

## Upload a change

```bash
npx -p @hubspot/cli@8.15.0 hs account auth    # once: signs the CLI in to the Formkit HubSpot account
cd integrations/hubspot
npx -p @hubspot/cli@8.15.0 hs project upload
```

Then `npx -p @hubspot/cli@8.15.0 hs project open` → the app → **Auth** → Client credentials.
The client ID and secret go in Convex (production) as `HUBSPOT_CLIENT_ID` and
`HUBSPOT_CLIENT_SECRET`. Never commit them.
