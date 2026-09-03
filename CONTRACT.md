# PostShiba SDK contract

Language packages implement this file. Do not edit `CONTRACT.md`, `fixtures/`, the root `README.md`, `LICENSE`, or `script/test`.

Default base URL: `https://postshiba.com`.
Auth: `Authorization: Bearer <apiKey>`.
API prefix: `/api/v1`.
JSON only. No `provision!`.

Constructor: `PostShiba(apiKey, { baseUrl?, teamId? })`.
`teamId` is required for every team-scoped path. `GET /users/me` does not return a team id. Raise if it is missing. Do not guess.

Ids used in fixtures and tests:

- team `1`
- cluster `4`
- sending domain `8`
- tenant `12`
- inbox `3`
- inbound message `21`
- event `44`
- SMTP credential `9`
- suppression `7`
- firewall entry `3`
- webhook `2`

## Errors

Non-2xx responses raise a typed error with `error`, `field`, and `message` from `{error, field, message}`.
Do not swallow HTTP failures.
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
| `sendingDomains.list` | | GET | `/api/v1/teams/:teamId/sending_domains` | | `[sending_domain]` |
| `sendingDomains.get` | | GET | `/api/v1/sending_domains/:id` | | `sending_domain` |
| `sendingDomains.create` | | POST | `/api/v1/teams/:teamId/sending_domains` | `sending_domain_create_request` | `sending_domain` |
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
| `events.list` | | GET | `/api/v1/teams/:teamId/clusters/:clusterId/message_events` | | `[event]` |
| `events.get` | | GET | `/api/v1/message_events/:id` | | `event` |
| `smtpCredentials.create` | | POST | `/api/v1/teams/:teamId/clusters/:clusterId/smtp_credentials` | `smtp_credential_create_request` | `smtp_credential_create` |
| `smtpCredentials.delete` | | DELETE | `/api/v1/teams/:teamId/clusters/:clusterId/smtp_credentials/:id` | | `smtp_credential_deleted` |
| `webhooks.list` | | GET | `/api/v1/teams/:teamId/webhook_endpoints` | | `[webhook]` |
| `webhooks.get` | | GET | `/api/v1/webhook_endpoints/:id` | | `webhook_show` |
| `webhooks.create` | | POST | `/api/v1/teams/:teamId/webhook_endpoints` | `webhook_create_request` | `webhook_show` |
| `suppressions.list` | | GET | `/api/v1/teams/:teamId/suppressions` | | `[suppression]` |
| `suppressions.create` | | POST | `/api/v1/teams/:teamId/suppressions` | `suppression_create_request` | `suppression` |
| `suppressions.delete` | | DELETE | `/api/v1/suppressions/:id` | | empty object |
| `firewall.get` | | GET | `/api/v1/teams/:teamId/firewall` | | `firewall` |
| `firewall.update` | | PATCH | `/api/v1/teams/:teamId/firewall` | `firewall_update_request` | `firewall` |
| `firewall.addEntry` | | POST | `/api/v1/teams/:teamId/firewall_entries` | `firewall_entry_create_request` | `firewall_entry` |
| `firewall.deleteEntry` | | DELETE | `/api/v1/firewall_entries/:id` | | empty object |

`emails.sendOnCluster` also sends header `Idempotency-Key` when the caller passes one.
Sandbox send adds `"sandbox": true` on the JSON body. Response is `email_sandbox_response` (`queued` false).

The API has no webhook update or delete. Do not invent those methods.

`can_i_send_this` and tenant suspend/resume exist on the server. Leave them out. Stay on the table above.

## Tests

Mock HTTP. No live PostShiba calls.
Load fixtures from `../../fixtures/catalog` relative to the package (repo root `fixtures/catalog`).

Cover:

- Bearer header and `baseUrl` override
- `emails.send` happy path
- cluster send with `Idempotency-Key` and `sandbox`
- every method in the table
- `403` from `error_403.json` and `422` from `error_422.json` raise
- `webhooks.verify` accept and reject
- SMTP password present on create, absent on delete
- webhook `secret` omitted on list, present on get/create
- missing `teamId` raises on a team-scoped call
- mail adapter maps to/from/subject/html/text/attachments when this package has one

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
8. Errors
9. Contributing with the test command

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
