---
name: postshiba-cli
description: Uses the PostShiba CLI to manage infrastructure and send mail from a terminal, script, or CI. Use when the user wants to manage PostShiba or send mail from a terminal, script, or CI, or when the `postshiba` command is installed or should be.
---

# PostShiba CLI

Drive PostShiba from a terminal, script, or CI with the `postshiba` command. Always pass `--json` so the CLI never prompts. A non-TTY or set `CI` also forces plain mode.

For Cursor MCP workflows (first send, DNS walkthroughs, hosted inboxes), use the sibling skills in this plugin: `postshiba`, `postshiba-first-send`, `postshiba-create-cluster`, `postshiba-create-credentials`, `postshiba-send-test-email`, `postshiba-create-mailbox`, `postshiba-send-from-domain`, `postshiba-import-dkim`.

## Install

```bash
npm install -g github:postshiba/postshiba-cli
postshiba --version
```

One-off: `npx github:postshiba/postshiba-cli`. If `--version` fails, install, then check again.

## Credentials

Read credentials from the environment. Never echo the API key.

| Setting | Env |
| --- | --- |
| API key | `POSTSHIBA_API_KEY` |
| Team id | `POSTSHIBA_TEAM_ID` |
| Default cluster | `POSTSHIBA_CLUSTER_ID` |

Team-scoped commands need a team id. Never guess it. Prefer env over `postshiba login`. Login prompts.

## Start

1. Confirm the binary with `postshiba --version`.
2. Run `postshiba doctor --json`.
3. Fix what `doctor` reports before sending.

`doctor` checks the key, team id, a cluster with `sending_ready`, and a verified sending domain.

## Resource commands

```
postshiba <resource> <action> [ids...] --json [--data JSON | --data @file.json | --data -]
```

Ids are public letter-only Hashids. Pass them in path order. Pass `--data` when the action has a request body (`create`, `update`, `boost`, `extend-boost`, `assign`, `unassign`, `switch`, `release`, `import`, `add-entry`).

| Resource | Actions |
| --- | --- |
| `clusters` | `list` `get` `create` `update` `suspend` `resume` `delete` `boost` `extend-boost` `cancel-boost` |
| `network` | `list` `create` `assign` `unassign` `switch` `release` |
| `sending-domains` | `list` `get` `create` `update` `refresh` `verify` `suspend` `resume` `make-primary` `delete` |
| `tenants` | `list` `get` `create` `delete` |
| `inboxes` | `list` `get` `create` `verify` `delete` |
| `messages` | `list` `get` `download-attachment` |
| `events` | `list-team` `list` `get` |
| `smtp-credentials` | `create` `delete` |
| `webhooks` | `list` `get` `create` `update` `delete` |
| `templates` | `list` `get` `create` `update` `publish` `duplicate` `delete` |
| `suppressions` | `list` `create` `import` `delete` |
| `firewall` | `get` `update` `add-entry` `delete-entry` |

Also: `whoami`, `send`, `doctor`, `help`, `skills install`. `messages download-attachment` writes bytes to `--output PATH`, else stdout.

```bash
postshiba clusters list --json
postshiba clusters get NmQpXr --json
postshiba sending-domains create --json --data '{"name":"mail.example.com"}'
postshiba messages get PqRzMn GxTyVu --json
```

## Send

Required: `--from` and at least one `--to`.

Plain:

```bash
postshiba send --json --from hello@mail.example.com --to you@example.com --subject "Hi" --text "Hello"
```

Template. Pass `--var KEY=VALUE` for each Liquid variable. Do not also pass `--html` or `--text`.

```bash
postshiba send --json --from hello@mail.example.com --to you@example.com --template welcome --var name=Ada
```

Sandbox test. Requires `--cluster`. Success returns `queued: false`. The message is not delivered.

```bash
postshiba send --json --cluster NmQpXr --sandbox --from hello@mail.example.com --to you@example.com --subject "Test" --text "Sandbox"
```

Idempotent cluster send. Requires `--cluster`.

```bash
postshiba send --json --cluster NmQpXr --idempotency-key run-1 --from hello@mail.example.com --to you@example.com --subject "Hi" --text "Hello"
```

`--sandbox` and `--idempotency-key` post to the cluster send path. `--cluster` alone on a plain send sets the cluster header and keeps `POST /api/v1/emails`.

## Exit codes

- `0` success. stdout is 2-space API JSON.
- `1` API error. stderr is `Error: <message>` and, when present, `(field: <field>)`. A `429` with `error` `throttled` is the hourly send cap. Wait until the next hour. Do not retry immediately.
- `2` usage error. Missing input, bad JSON, or a destructive action without `--yes`.

## Destructive actions

`delete`, `suspend`, `release`, and `unassign` need `--yes` in plain mode. Pass `--yes` only when the user explicitly asked for that destructive action.

## Secrets

Never echo the API key. Keep SMTP passwords and webhook secrets out of logs. An SMTP password appears once on create.
