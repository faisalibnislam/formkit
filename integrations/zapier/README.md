# Formkit for Zapier

The official Zapier app: **New Response** (a trigger, sent the moment a response arrives) and **Find Response** (a search).

It talks to API v2 (`formkit.app/api/v2`) with an account's API key, made in Settings → Developers with *Read your forms* and *Read responses* ticked. The trigger subscribes with `POST /api/v2/hooks` and unsubscribes with `DELETE /api/v2/hooks/{id}`; sending responses on is part of Pro, like every webhook.

## Publishing (Formkit's team)

1. `npm install -g zapier-platform-cli` and `zapier login` with the Formkit Zapier account.
2. In this folder: `npm install`, then `zapier register "Formkit"` the first time.
3. `zapier push` uploads a private version to test in a Zap.
4. When it works end to end, submit it for review from the Zapier developer platform.

`npm test` checks how responses are flattened.
