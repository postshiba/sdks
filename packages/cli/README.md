# PostShiba CLI

> [!NOTE]
> [PostShiba skills](https://github.com/postshiba/postshiba-skills) connect agents to MCP for first send, domains, inboxes, and sandbox mail.

Command line. Send mail and manage resources from a terminal.

## Installation

```sh
npm install -g github:postshiba/postshiba-cli
```

Node 18 or later. One-off: `npx github:postshiba/postshiba-cli whoami`. Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks).

## How It Works

`postshiba` is a thin HTTPS client. Authenticate with a platform application token. Credentials resolve flag, then env, then `$XDG_CONFIG_HOME/postshiba/config.json` (else `~/.config/postshiba/config.json`).

`send` posts to `POST /api/v1/emails`. `--cluster` sets `X-Capsule-Cluster-Id`. `--sandbox` posts to `POST /api/v1/teams/:teamId/clusters/:clusterId/sends` and needs `--cluster`. Resource commands come from one operations table. Pass `--data` for writes.

```sh
postshiba login --api-key "$POSTSHIBA_API_KEY" --team KjkAJW
postshiba send --from hello@mail.example.com --to you@example.com --subject "Hi" --text "hello"
postshiba clusters list
```

Template send. Pass `--template` and `--var`. Skip `--html` and `--text`.

```sh
postshiba send --from hello@mail.example.com --to you@example.com --template welcome --var name=Ada
```

## Commands

```
postshiba login
postshiba logout
postshiba whoami
postshiba send
postshiba <resource> <action> [ids...] [--data JSON]
postshiba help [resource]
```

Resources: clusters, network, sending-domains, tenants, inboxes, messages, events, smtp-credentials, webhooks, templates, suppressions, firewall.

## Errors and throttling

Non-2xx responses print `Error: <message>` and, when present, `(field: <field>)`. The process exits 1.

A `429` with `error` `throttled` is the cluster hourly send limit. The CLI prints that line and exits. Do not retry that send immediately. Wait until the next hour.

See [Errors](https://www.postshiba.com/docs/api-reference/errors).

## Contributing

```sh
npm test
```

Tests mock HTTP. They do not call production.
