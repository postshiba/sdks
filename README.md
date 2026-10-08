# PostShiba SDKs

> [!NOTE]
> [PostShiba skills](https://github.com/postshiba/postshiba-skills) connect agents to MCP for first send, domains, inboxes, and sandbox mail.

HTTP clients and mail adapters for the PostShiba API.

This repo is the write target. Language repos under [postshiba](https://github.com/orgs/postshiba/repositories) are one-way mirrors. Install from those GitHub URLs. Nothing is on npm, PyPI, or RubyGems yet.

```sh
script/split-push
```

Creates missing repos when `CREATE_REPOS=1` and `gh` can write to the `postshiba` org. Force-pushes each `packages/<lang>` to `postshiba/postshiba-<lang>`.

## Libraries

- [Skills](https://github.com/postshiba/postshiba-skills) ([source](packages/skills/README.md)) Cursor plugin. MCP plus agent skills.
- [CLI](https://github.com/postshiba/postshiba-cli) ([source](packages/cli/README.md)) Terminal app. Interactive prompts for humans, JSON for scripts.
- [Node.js](https://github.com/postshiba/postshiba-node) ([source](packages/node/README.md), NestJS included)
- [Convex](https://github.com/postshiba/postshiba-convex) ([source](packages/convex/README.md)) component. Durable send plus webhooks.
- [Inngest](https://github.com/postshiba/postshiba-inngest) ([source](packages/inngest/README.md)) adapter. Send inside `step.run`.
- [Trigger.dev](https://github.com/postshiba/postshiba-trigger) ([source](packages/trigger/README.md)) adapter. Send inside a task.
- [Python](https://github.com/postshiba/postshiba-python) ([source](packages/python/README.md), Django included)
- [PHP](https://github.com/postshiba/postshiba-php) ([source](packages/php/README.md), Laravel and Symfony included)
- [Ruby](https://github.com/postshiba/postshiba-ruby) ([source](packages/ruby/README.md), ActionMailer included)
- [Go](https://github.com/postshiba/postshiba-go) ([source](packages/go/README.md))
- [Java](https://github.com/postshiba/postshiba-java) ([source](packages/java/README.md))
- [Rust](https://github.com/postshiba/postshiba-rust) ([source](packages/rust/README.md))
- [.NET](https://github.com/postshiba/postshiba-dotnet) ([source](packages/dotnet/README.md))
- [Elixir](https://github.com/postshiba/postshiba-elixir) ([source](packages/elixir/README.md), Swoosh included)
- [Dart](https://github.com/postshiba/postshiba-dart) ([source](packages/dart/README.md))
- [WordPress](https://github.com/postshiba/postshiba-wordpress) ([source](packages/wordpress/README.md)) plugin. Not a language client.

## How It Works

Each package is a thin HTTPS client. Authenticate with a platform application token. Send through `POST /api/v1/emails`. Manage clusters, domains, inboxes, and the rest of the catalog from the same client.

The Convex package is a component. It enqueues mail from a mutation and delivers through `POST /api/v1/teams/:teamId/clusters/:clusterId/sends`.

The Inngest and Trigger.dev packages wrap that same cluster send. Inngest uses `step.run`. Trigger.dev uses a task. A `429` with `error` `throttled` waits until the next hour. Permanent errors do not retry.

Failed REST calls raise a typed error with `error`, `field`, and `message`. A `429` with `error` `throttled` is the cluster hourly send limit. Do not retry that send immediately. Wait until the next hour. Each language README has the catch shape.

Mail adapters live in the language package. They call `emails.send`. The core client loads without Rails, Laravel, Django, Nest, or Swoosh. The WordPress plugin replaces wp_mail and lives in its own package.

## Testing

```sh
script/test
```

Each package also has its own test command in its README. Tests mock HTTP. They do not call production.

Java tests need a JDK 17 or later. Dart tests need the Dart SDK. `script/test` fails if those are missing from `PATH`.

## Contributing

See [CONTRACT.md](CONTRACT.md) for the shared resource map and fixture rules.
