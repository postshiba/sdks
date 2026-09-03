# PostShiba SDKs

HTTP clients and mail adapters for the PostShiba API.

This repo is the write target. Language repos under [postshiba](https://github.com/orgs/postshiba/repositories) are one-way mirrors. Install from those GitHub URLs. Nothing is on npm, PyPI, or RubyGems yet.

```sh
script/split-push
```

Creates missing repos when `CREATE_REPOS=1` and `gh` can write to the `postshiba` org. Force-pushes each `packages/<lang>` to `postshiba/postshiba-<lang>`.

## Libraries

- [Node.js](https://github.com/postshiba/postshiba-node) ([source](packages/node/README.md), NestJS included)
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

Mail adapters live in the language package. They call `emails.send`. The core client loads without Rails, Laravel, Django, Nest, or Swoosh. The WordPress plugin replaces wp_mail and lives in its own package.

## Testing

```sh
script/test
```

Each package also has its own test command in its README. Tests mock HTTP. They do not call production.

Java tests need a JDK 17 or later. Dart tests need the Dart SDK. `script/test` fails if those are missing from `PATH`.

## Contributing

See [CONTRACT.md](CONTRACT.md) for the shared resource map and fixture rules.
