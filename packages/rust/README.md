# PostShiba

Rust client for the PostShiba API.

## Installation

```toml
[dependencies]
postshiba = { git = "https://github.com/postshiba/postshiba-rust" }
```

Not on crates.io yet. Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks).

## How It Works

Create a client with a platform application token. Calls use bearer auth against `https://app.postshiba.com`. Team-scoped methods need `team_id`. Request and response bodies are JSON.

## Send an email

```rust
use postshiba::Client;
use serde_json::json;

let client = Client::new("ps_live_...")
    .team_id(1);

let email = client.emails().send(&json!({
    "from": "hello@mail.example.com",
    "to": ["you@example.com"],
    "subject": "PostShiba test",
    "text": "hello from PostShiba",
    "html": "<p>hello from PostShiba</p>"
}))?;
```

Send through a cluster with an idempotency key and sandbox mode:

```rust
client.emails().send_on_cluster(
    4,
    &body,
    Some("idem-123"),
    true,
)?;
```

## API

```rust
let me = client.users().me()?;
```

```rust
let clusters = client.clusters().list()?;
let cluster = client.clusters().get(4)?;
client.clusters().create(&json!({"cluster": {"name": "edge", "size": "small", "region": "manual", "plan": "nano"}}))?;
client.clusters().update(4, &json!({"cluster": {"plan": "small"}}))?;
client.clusters().suspend(4)?;
client.clusters().resume(4)?;
client.clusters().delete(4)?;
```

```rust
let domains = client.sending_domains().list()?;
let domain = client.sending_domains().get(8)?;
client.sending_domains().create(&json!({"sending_domain": {"name": "mail.example.com", "tenant_id": 12}}))?;
client.sending_domains().verify(8)?;
client.sending_domains().suspend(8)?;
client.sending_domains().resume(8)?;
client.sending_domains().make_primary(8)?;
client.sending_domains().delete(8)?;
```

```rust
let tenants = client.tenants().list()?;
let tenant = client.tenants().get(12)?;
client.tenants().create(&json!({"tenant": {"name": "Acme Florist"}}))?;
client.tenants().delete(12)?;
```

```rust
let inboxes = client.inboxes().list()?;
let inbox = client.inboxes().get(3)?;
client.inboxes().create(&json!({"inbox": {"name": "agent", "webhook_url": "https://hooks.example.com/mail"}}))?;
client.inboxes().verify(3)?;
client.inboxes().delete(3)?;
```

```rust
let messages = client.messages().list(3)?;
let message = client.messages().get(3, 21)?;
let bytes = client.messages().download_attachment(3, 21, 1)?;
```

```rust
let events = client.events().list(4)?;
let event = client.events().get(44)?;
```

```rust
let cred = client.smtp_credentials().create(4, &json!({"smtp_credential": {"tenant_id": 12}}))?;
client.smtp_credentials().delete(4, 9)?;
```

```rust
let hooks = client.webhooks().list()?;
let hook = client.webhooks().get(2)?;
client.webhooks().create(&json!({"webhook_endpoint": {"url": "https://hooks.example.com/capsule"}}))?;
```

```rust
let suppressions = client.suppressions().list()?;
client.suppressions().create(&json!({"suppression": {"email": "blocked@example.com", "tenant_id": 12}}))?;
client.suppressions().delete(7)?;
```

```rust
let firewall = client.firewall().get()?;
client.firewall().update(&json!({"firewall": {"enabled_checks": ["temp_providers", "plus_addressing"]}}))?;
client.firewall().add_entry(&json!({"firewall_entry": {"list": "deny", "value": "mailinator.com"}}))?;
client.firewall().delete_entry(3)?;
```

## Verify webhooks

```rust
let ok = postshiba::webhooks::verify(
    secret,
    timestamp,
    raw_body,
    signature,
);
```

`verify` checks HMAC-SHA256 of `{timestamp}.{rawBody}` against `X-Capsule-Signature` after stripping a `sha256=` prefix.

## Errors

Non-2xx responses return `Error` with `error`, `field`, and `message` from the API body.

```rust
match client.clusters().create(&body) {
    Ok(cluster) => println!("{}", cluster["id"]),
    Err(err) => eprintln!("{} {} {}", err.error.unwrap_or_default(), err.field.unwrap_or_default(), err.message),
}
```

Team-scoped methods return an error if `team_id` is missing.

## Contributing

```sh
cargo test
```
