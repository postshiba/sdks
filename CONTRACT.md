# PostShiba SDK contract

Language packages implement this file. Do not edit `CONTRACT.md`, `fixtures/`, the root `README.md`, `LICENSE`, or `script/test`.

Default base URL: `https://app.postshiba.com`.
Auth: `Authorization: Bearer <apiKey>`.
API prefix: `/api/v1`.
JSON only. No `provision!`.

Constructor: `PostShiba(apiKey, { baseUrl?, teamId? })`.
`teamId` is required for every team-scoped path. `GET /users/me` does not return a team id. Raise if it is missing. Do not guess.

Public Capsule resource ids are strings (letters-only Hashids). Interpolate them into paths as-is. URL-encode only when a character needs it. Do not coerce an id to an integer. `emails.send` / `send_email` sets `X-Capsule-Cluster-Id` to the obfuscated cluster id string. Keep the existing option names (`clusterId`, `cluster_id`). Typed packages take `string` for team, cluster, tenant, domain, inbox, credential, webhook, message, suppression, template, and sending IP ids. Do not advertise sending raw integers.

Ids used in fixtures and tests:

- user `UsErKj`
- team `KjkAJW`
- cluster `NmQpXr`
- sending domain `HsVtYk`
- tenant `WbLcFd`
- inbox `PqRzMn`
- inbound message `GxTyVu`
- event `JkLmNp`
- SMTP credential `RvWsXq`
- suppression `YtReWq`
- firewall entry `BnMkLo`
- webhook `CdFgHj`
- email template `TpLmQr`
- sending IP `IpQwEr`

## Errors

Non-2xx responses raise a typed error with `error`, `field`, and `message` from `{error, field, message}`.
Do not swallow HTTP failures.
A `429` body with `error` `throttled` is the cluster hourly send limit. Immediate retries hit the same cap.
Never expose `dkim_private_key` or `provider_resources`.
`webhook_secret` and SMTP `password` only when the API returns them (create/show).

## Webhook verify

HMAC-SHA256 of `{timestamp}.{rawBody}` compared to `X-Capsule-Signature` after stripping a `sha256=` prefix.
Use a constant-time compare.
Fixture: `fixtures/catalog/webhook_verify.json`.

## Operations

Load request and response bodies from `fixtures/catalog/<file>.json`. Do not invent payloads.

| Method | Name | HTTP | Path | Request fixture | Response fixture |
| --- | --- | --- | --- | --- | --- |
| `users.me` | | GET | `/api/v1/users/me` | | `whoami` |
| `emails.send` | | POST | `/api/v1/emails` | `email_send_request` | `email_send_response` |
| `emails.sendOnCluster` | | POST | `/api/v1/teams/:teamId/clusters/:clusterId/sends` | `email_send_request` plus `sandbox` | `email_sandbox_response` |
| `clusters.list` | | GET | `/api/v1/teams/:teamId/clusters` | | `[cluster]` |
| `clusters.get` | | GET | `/api/v1/clusters/:id` | | `cluster` |
| `clusters.create` | | POST | `/api/v1/teams/:teamId/clusters` | `cluster_create_request` | `cluster` |
| `clusters.update` | | PATCH | `/api/v1/clusters/:id` | `cluster_update_request` | `cluster_updated` |
| `clusters.suspend` | | POST | `/api/v1/clusters/:id/suspend` | | `cluster_suspended` |
| `clusters.resume` | | POST | `/api/v1/clusters/:id/resume` | | `cluster` |
| `clusters.delete` | | DELETE | `/api/v1/clusters/:id` | | `cluster_deprovisioned` |
| `clusters.boost` | | POST | `/api/v1/clusters/:id/boost` | `cluster_boost_request` | `cluster_boosted` |
| `clusters.extendBoost` | | POST | `/api/v1/clusters/:id/extend_boost` | `cluster_extend_boost_request` | `cluster_boosted` |
| `clusters.cancelBoost` | | POST | `/api/v1/clusters/:id/cancel_boost` | | `cluster` |
| `network.list` | | GET | `/api/v1/teams/:teamId/network` | | `[network]` |
| `network.create` | | POST | `/api/v1/teams/:teamId/network` | `network_create_request` | `network_assigned` |
| `network.assign` | | POST | `/api/v1/teams/:teamId/network/assign` | `network_create_request` | `network_dedicated` |
| `network.unassign` | | POST | `/api/v1/teams/:teamId/network/unassign` | `network_create_request` | `network` |
| `network.switch` | | POST | `/api/v1/teams/:teamId/network/switch` | `network_create_request` | `network_assigned` |
| `network.release` | | POST | `/api/v1/teams/:teamId/network/release` | `network_release_request` | `network_released` |
| `sendingDomains.list` | | GET | `/api/v1/teams/:teamId/sending_domains` | | `[sending_domain]` |
| `sendingDomains.get` | | GET | `/api/v1/sending_domains/:id` | | `sending_domain` |
| `sendingDomains.create` | | POST | `/api/v1/teams/:teamId/sending_domains` | `sending_domain_create_request` | `sending_domain` |
| `sendingDomains.update` | | PATCH | `/api/v1/sending_domains/:id` | `sending_domain_update_request` | `sending_domain_updated` |
| `sendingDomains.refresh` | | POST | `/api/v1/sending_domains/:id/refresh` | | `sending_domain` |
| `sendingDomains.verify` | | POST | `/api/v1/sending_domains/:id/verify` | | `sending_domain` |
| `sendingDomains.suspend` | | POST | `/api/v1/sending_domains/:id/suspend` | | `sending_domain_suspended` |
| `sendingDomains.resume` | | POST | `/api/v1/sending_domains/:id/resume` | | `sending_domain` |
| `sendingDomains.makePrimary` | | POST | `/api/v1/sending_domains/:id/make_primary` | | `sending_domain_primary` |
| `sendingDomains.delete` | | DELETE | `/api/v1/sending_domains/:id` | | empty object |
| `tenants.list` | | GET | `/api/v1/teams/:teamId/tenants` | | `[tenant]` |
| `tenants.get` | | GET | `/api/v1/tenants/:id` | | `tenant` |
| `tenants.create` | | POST | `/api/v1/teams/:teamId/tenants` | `tenant_create_request` | `tenant` |
| `tenants.delete` | | DELETE | `/api/v1/tenants/:id` | | empty object |
| `inboxes.list` | | GET | `/api/v1/teams/:teamId/inboxes` | | `[inbox_index]` |
| `inboxes.get` | | GET | `/api/v1/inboxes/:id` | | `inbox` |
| `inboxes.create` | | POST | `/api/v1/teams/:teamId/inboxes` | `inbox_create_request` | `inbox` |
| `inboxes.verify` | | POST | `/api/v1/inboxes/:id/verify` | | `inbox_index` |
| `inboxes.delete` | | DELETE | `/api/v1/inboxes/:id` | | `inbox_index` |
| `messages.list` | | GET | `/api/v1/inboxes/:inboxId/inbound_messages` | | `[message]` |
| `messages.get` | | GET | `/api/v1/inboxes/:inboxId/inbound_messages/:id` | | `message_show` |
| `messages.downloadAttachment` | | GET | `/api/v1/inboxes/:inboxId/inbound_messages/:id/attachments/:index` | | binary. Index is 1-based. Example index is `1`. Tests may assert the path only |
| `events.listTeam` | | GET | `/api/v1/teams/:teamId/message_events` | | `[event]` |
| `events.list` | | GET | `/api/v1/teams/:teamId/clusters/:clusterId/message_events` | | `[event]` |
| `events.get` | | GET | `/api/v1/message_events/:id` | | `event` |
| `smtpCredentials.create` | | POST | `/api/v1/teams/:teamId/clusters/:clusterId/smtp_credentials` | `smtp_credential_create_request` | `smtp_credential_create` |
| `smtpCredentials.delete` | | DELETE | `/api/v1/teams/:teamId/clusters/:clusterId/smtp_credentials/:id` | | `smtp_credential_deleted` |
| `webhooks.list` | | GET | `/api/v1/teams/:teamId/webhook_endpoints` | | `[webhook]` |
| `webhooks.get` | | GET | `/api/v1/webhook_endpoints/:id` | | `webhook_show` |
| `webhooks.create` | | POST | `/api/v1/teams/:teamId/webhook_endpoints` | `webhook_create_request` | `webhook_show` |
| `webhooks.update` | | PATCH | `/api/v1/webhook_endpoints/:id` | `webhook_update_request` | `webhook` |
| `webhooks.delete` | | DELETE | `/api/v1/webhook_endpoints/:id` | | empty object |
| `templates.list` | | GET | `/api/v1/teams/:teamId/templates` | | `[template]` |
| `templates.get` | | GET | `/api/v1/templates/:id` | | `template` |
| `templates.create` | | POST | `/api/v1/teams/:teamId/templates` | `template_create_request` | `template` |
| `templates.update` | | PATCH | `/api/v1/templates/:id` | `template_update_request` | `template_updated` |
| `templates.publish` | | POST | `/api/v1/templates/:id/publish` | | `template` |
| `templates.duplicate` | | POST | `/api/v1/templates/:id/duplicate` | | `template_duplicated` |
| `templates.delete` | | DELETE | `/api/v1/templates/:id` | | empty object |
| `suppressions.list` | | GET | `/api/v1/teams/:teamId/suppressions` | | `[suppression]` |
| `suppressions.create` | | POST | `/api/v1/teams/:teamId/suppressions` | `suppression_create_request` | `suppression` |
| `suppressions.import` | | POST | `/api/v1/teams/:teamId/suppressions/import` | `suppression_import_request` | `suppression_import` |
| `suppressions.delete` | | DELETE | `/api/v1/suppressions/:id` | | empty object |
| `firewall.get` | | GET | `/api/v1/teams/:teamId/firewall` | | `firewall` |
| `firewall.update` | | PATCH | `/api/v1/teams/:teamId/firewall` | `firewall_update_request` | `firewall` |
| `firewall.addEntry` | | POST | `/api/v1/teams/:teamId/firewall_entries` | `firewall_entry_create_request` | `firewall_entry` |
| `firewall.deleteEntry` | | DELETE | `/api/v1/firewall_entries/:id` | | empty object |

`emails.sendOnCluster` also sends header `Idempotency-Key` when the caller passes one.
`emails.send` sends request header `X-Capsule-Cluster-Id` when the caller passes a cluster id. The path stays `POST /api/v1/emails`. Omit the option and the server picks a cluster. This is not `sendOnCluster` (that stays `POST /teams/:teamId/clusters/:clusterId/sends`).
Sandbox send adds `"sandbox": true` on the JSON body. Response is `email_sandbox_response` (`queued` false).

`emails.send` and `emails.sendOnCluster` also accept `template: {id, variables}` instead of `html` and `text`. Fixture: `email_send_template_request`. Response: `email_send_template_response`. `id` is the template alias or public id. Do not send `html` or `text` with `template`. Tests must cover this body on `emails.send`. Member template routes accept the public id or the alias. Example get uses `TpLmQr`.

Inbox create sends `host` and `forward_to` from `inbox_create_request`. Show omits `forward_to` when it is null.

`can_i_send_this` and tenant suspend/resume exist on the server. Leave them out. Stay on the table above.

## Tests

Mock HTTP. No live PostShiba calls.
Load fixtures from `../../fixtures/catalog` relative to the package (repo root `fixtures/catalog`).

Cover:

- Bearer header and `baseUrl` override
- `emails.send` happy path
- `emails.send` with a cluster id sets `X-Capsule-Cluster-Id` and does not change the path
- `emails.send` with `email_send_template_request` posts that body and returns `email_send_template_response`
- cluster send with `Idempotency-Key` and `sandbox`
- every method in the table
- `403` from `error_403.json` and `422` from `error_422.json` raise
- `webhooks.verify` accept and reject
- SMTP password present on create, absent on delete
- webhook `secret` omitted on list and update, present on get/create
- missing `teamId` raises on a team-scoped call
- mail adapter maps from, to, cc, bcc, reply_to, subject, html, text, attachments, headers, and unique_args when this package has one
- from and reply_to keep a display name as `Name <email>`
- Message-ID, In-Reply-To, and References go in `headers`
- unique_args comes from an `X-Capsule-Unique-Args` JSON header when the framework exposes headers

Test command for this package must be what `script/test` runs. See that file.

## Mail adapters

Optional. The HTTP client must import without the framework installed.

- Node: NestJS module that injects the client. Optional peer `@nestjs/common`.
- Python: Django backend `postshiba.django.EmailBackend`.
- PHP: Laravel mailer transport `postshiba` and a Symfony Mailer transport.
- Ruby: ActionMailer delivery method `:postshiba`.
- Elixir: `PostShiba.Swoosh.Adapter`.

Adapters call `emails.send`.

## README

Ankane style. Short title. One-line purpose. Installation. How It Works. Tiny snippets. No marketing.

Sections, in order:

1. Title and one line
2. Installation
3. How It Works
4. Send an email
5. Mail adapter (only if this package has one)
6. API (one snippet per resource group)
7. Verify webhooks
8. Errors and throttling
9. Contributing with the test command

The Errors and throttling section has a typed error snippet, then a throttling paragraph. A `429` with `error` `throttled` is the hourly send cap. Do not retry that send immediately. Wait until the next hour. Mail adapters do not delay. Catch `throttled` in queued jobs before sending again. Use this package's real exception name. Do not invent `RateLimitExceeded` or a retry-delay env var.

Not published yet. Do not add badges that imply a registry version.

## Package layout

```
packages/<lang>/
  README.md
  src/ or language-native layout
  tests/
```

Idiomatic names:

- npm `postshiba`
- PyPI `postshiba`
- Composer `postshiba/postshiba`
- gem `postshiba`
- Go module `github.com/postshiba/sdks/packages/go`
- Maven `com.postshiba:postshiba`
- crate `postshiba`
- NuGet `PostShiba`
- Hex `postshiba`
- pub `postshiba`

Version `0.1.0`. Do not publish.
