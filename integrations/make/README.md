# Formkit for Make

A Make app: **Watch responses** (instant, sent the moment a response arrives) and **Search responses**.

It uses API v2 (`formkit.app/api/v2`) with an account's API key from Settings → Developers (*Read your forms* and *Read responses*). The trigger subscribes with `POST /api/v2/hooks` and unsubscribes with `DELETE /api/v2/hooks/{id}`; sending responses on is part of Pro, like every webhook.

## The files

Make apps are written in Make's IML (JSON):

- `base.imljson`: the API address, the key header, how errors read.
- `connections/apikey.imljson`: the API key, checked against `GET /me`.
- `webhooks/responses.imljson`: subscribing and unsubscribing a scenario's webhook.
- `modules/watchResponses.imljson`: the instant trigger.
- `modules/searchResponses.imljson`: the search.
- `modules/listForms.rpc.imljson`: the form picker (an RPC named `listForms`).

## Publishing (Formkit's team)

1. In Make, open the developer platform (My apps → Create a new app), named Formkit.
2. Paste each file into the matching section (Base, Connections, Webhooks, Modules, RPCs), or sync them with Make's VS Code extension.
3. Test in a scenario: connect with a key, pick a form, send a response.
4. Request review to make it public.
