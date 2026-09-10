# PostShiba

> [!NOTE]
> [PostShiba skills](https://github.com/postshiba/postshiba-skills) connect agents to MCP for first send, domains, inboxes, and sandbox mail.

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
    .team_id("KjkAJW");

let email = client.emails().send(&json!({
    "from": "hello@mail.example.com",
    "to": ["you@example.com"],
    "subject": "PostShiba test",
    "text": "hello from PostShiba",
    "html": "<p>hello from PostShiba</p>"
}))?;
```

Pass a cluster id to pin `X-Capsule-Cluster-Id`. Omit it and the header is not sent.

```rust
client.emails().send_with(&body, "NmQpXr")?;
```

Send through a cluster with an idempotency key and sandbox mode:

```rust
client.emails().send_on_cluster(
    "NmQpXr",
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
let cluster = client.clusters().get("NmQpXr")?;
client.clusters().create(&json!({"cluster": {"name": "edge", "size": "small", "region": "manual", "plan": "nano"}}))?;
client.clusters().update("NmQpXr", &json!({"cluster": {"plan": "small"}}))?;
client.clusters().suspend("NmQpXr")?;
client.clusters().resume("NmQpXr")?;
client.clusters().delete("NmQpXr")?;
```

```rust
let domains = client.sending_domains().list()?;
let domain = client.sending_domains().get("HsVtYk")?;
client.sending_domains().create(&json!({"sending_domain": {"name": "mail.example.com", "tenant_id": "WbLcFd"}}))?;
client.sending_domains().verify("HsVtYk")?;
client.sending_domains().suspend("HsVtYk")?;
client.sending_domains().resume("HsVtYk")?;
client.sending_domains().make_primary("HsVtYk")?;
client.sending_domains().delete("HsVtYk")?;
```

```rust
let tenants = client.tenants().list()?;
let tenant = client.tenants().get("WbLcFd")?;
client.tenants().create(&json!({"tenant": {"name": "Acme Florist"}}))?;
client.tenants().delete("WbLcFd")?;
```

```rust
let inboxes = client.inboxes().list()?;
let inbox = client.inboxes().get("PqRzMn")?;
client.inboxes().create(&json!({"inbox": {"name": "agent", "webhook_url": "https://hooks.example.com/mail"}}))?;
client.inboxes().verify("PqRzMn")?;
client.inboxes().delete("PqRzMn")?;
```

```rust
let messages = client.messages().list("PqRzMn")?;
let message = client.messages().get("PqRzMn", "GxTyVu")?;
let bytes = client.messages().download_attachment("PqRzMn", "GxTyVu", 1)?;
```

```rust
let events = client.events().list("NmQpXr")?;
let event = client.events().get("JkLmNp")?;
```

```rust
let cred = client.smtp_credentials().create("NmQpXr", &json!({"smtp_credential": {"tenant_id": "WbLcFd"}}))?;
client.smtp_credentials().delete("NmQpXr", "RvWsXq")?;
```

```rust
let hooks = client.webhooks().list()?;
let hook = client.webhooks().get("CdFgHj")?;
client.webhooks().create(&json!({"webhook_endpoint": {"url": "https://hooks.example.com/capsule"}}))?;
client.webhooks().update("CdFgHj", &json!({"webhook_endpoint": {"enabled": false, "event_types": ["delivered", "bounce"]}}))?;
client.webhooks().delete("CdFgHj")?;
```

```rust
let suppressions = client.suppressions().list()?;
client.suppressions().create(&json!({"suppression": {"email": "blocked@example.com", "tenant_id": "WbLcFd"}}))?;
client.suppressions().delete("YtReWq")?;
```

```rust
let firewall = client.firewall().get()?;
client.firewall().update(&json!({"firewall": {"enabled_checks": ["temp_providers", "plus_addressing"]}}))?;
client.firewall().add_entry(&json!({"firewall_entry": {"list": "deny", "value": "mailinator.com"}}))?;
client.firewall().delete_entry("BnMkLo")?;
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

## Errors and throttling

Non-2xx responses return `Error` with `error`, `field`, and `message` from the API body.

```rust
match client.clusters().create(&body) {
    Ok(cluster) => println!("{}", cluster["id"]),
    Err(err) => eprintln!("{} {} {}", err.error.unwrap_or_default(), err.field.unwrap_or_default(), err.message),
}
```

A `429` response with `error` `throttled` means the cluster hit its hourly send limit. Do not retry that send immediately. Immediate retries hit the same cap. Wait until the next hour. The client does not delay for you. In a queued worker, check `err.error.as_deref() == Some("throttled")` before sending again.

Team-scoped methods return an error if `team_id` is missing.

## Contributing

```sh
cargo test
```
