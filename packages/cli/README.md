# PostShiba CLI

Terminal app for the PostShiba API. Interactive prompts for humans. JSON for scripts.

## Installation

```sh
npm install -g github:postshiba/postshiba-cli
```

Node 20 or later. One-off: `npx github:postshiba/postshiba-cli`. Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks).

## Sign in

```sh
postshiba login
```

The key can also come from `--api-key` or `POSTSHIBA_API_KEY`. Team id comes from `--team`, `POSTSHIBA_TEAM_ID`, or a prompt. Config is `$XDG_CONFIG_HOME/postshiba/config.json`, else `~/.config/postshiba/config.json`, mode `0600`.

```sh
postshiba whoami
postshiba logout
```

## Send

```sh
postshiba send --from hello@mail.example.com --to you@example.com --subject "Hi" --text "hello"
```

`--cluster` sets `X-Capsule-Cluster-Id` on `POST /api/v1/emails`. `--sandbox` and `--idempotency-key` post to the cluster send path and need `--cluster`.

```sh
postshiba send --cluster NmQpXr --sandbox --from hello@mail.example.com --to you@example.com --subject "Test" --text "sandbox"
```

Template send. Pass `--template` and `--var`. Skip `--html` and `--text`.

```sh
postshiba send --from hello@mail.example.com --to you@example.com --template welcome --var name=Ada
```

## Resources

```
postshiba <resource> <action> [ids...] [--data JSON | --data @file.json | --data -]
```

```sh
postshiba clusters list
postshiba clusters get NmQpXr
postshiba sending-domains create --data '{"name":"mail.example.com"}'
postshiba messages download-attachment PqRzMn GxTyVu 1 --output photo.png
```

`delete`, `suspend`, `release`, and `unassign` ask before they run. `--yes` skips the confirm. Plain mode needs `--yes`.

## Plain mode

Scripts and agents should pass `--json`. `--no-input`, a non-TTY, or `CI` also force plain mode. Plain mode never prompts. Success prints 2-space API JSON. Missing input exits 2.

```sh
postshiba doctor --json
postshiba clusters list --json
```

## Agent skill

```sh
postshiba skills install
npx skills add postshiba/postshiba-cli
```

`--global` writes under the home directory. `--target cursor|claude|agents` picks the skill folder.

## Errors

Non-2xx responses print `Error: <message>` and, when present, `(field: <field>)`. Exit 1.

A `429` with `error` `throttled` is the cluster hourly send limit. The CLI prints that line and exits. Do not retry that send immediately. Wait until the next hour.

## Contributing

```sh
npm install
npm test
```

Tests mock HTTP. They do not call production.
