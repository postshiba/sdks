# PostShiba

Elixir client for the PostShiba API.

## Installation

Add to `mix.exs`:

```elixir
{:postshiba, git: "https://github.com/postshiba/postshiba-elixir.git"}
```

Not on Hex yet. Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks).

## How It Works

`PostShiba.new/3` sends JSON to `https://app.postshiba.com/api/v1` with a Bearer token. Team-scoped paths use the `team_id` argument. `GET /users/me` does not return a team id, so the client will not guess one.

## Send an email

```elixir
client = PostShiba.new(System.get_env("POSTSHIBA_API_KEY"), nil, 1)

PostShiba.Emails.send(client, %{
  "from" => "hello@mail.example.com",
  "to" => ["you@example.com"],
  "subject" => "PostShiba test",
  "text" => "hello from PostShiba",
  "html" => "<p>hello from PostShiba</p>"
})
```

Cluster send can set `Idempotency-Key` and `"sandbox": true`.

```elixir
PostShiba.Emails.send_on_cluster(client, 4, body, idempotency_key: "idem-1", sandbox: true)
```

## Phoenix and Swoosh

`PostShiba.Swoosh.Adapter` maps a `Swoosh.Email` to `emails.send`. Add `:swoosh` in your app. The core client compiles without it.

```elixir
# config/config.exs
config :my_app, MyApp.Mailer,
  adapter: PostShiba.Swoosh.Adapter,
  api_key: System.get_env("POSTSHIBA_API_KEY"),
  team_id: 1
```

Or pass a client:

```elixir
config :my_app, MyApp.Mailer,
  adapter: PostShiba.Swoosh.Adapter,
  client: PostShiba.new(System.get_env("POSTSHIBA_API_KEY"), nil, 1)
```

The mapper copies `from`, `to`, `subject`, `html`, `text`, and attachments.

## API

### Users

```elixir
PostShiba.Users.me(client)
```

### Clusters

```elixir
PostShiba.Clusters.list(client)
PostShiba.Clusters.get(client, 4)
PostShiba.Clusters.create(client, %{"cluster" => %{"name" => "edge", "size" => "small", "region" => "manual", "plan" => "nano"}})
PostShiba.Clusters.update(client, 4, %{"cluster" => %{"plan" => "small"}})
PostShiba.Clusters.suspend(client, 4)
PostShiba.Clusters.resume(client, 4)
PostShiba.Clusters.delete(client, 4)
```

### Sending domains

```elixir
PostShiba.SendingDomains.list(client)
PostShiba.SendingDomains.get(client, 8)
PostShiba.SendingDomains.create(client, %{"sending_domain" => %{"name" => "mail.example.com", "tenant_id" => 12}})
PostShiba.SendingDomains.verify(client, 8)
PostShiba.SendingDomains.suspend(client, 8)
PostShiba.SendingDomains.resume(client, 8)
PostShiba.SendingDomains.make_primary(client, 8)
PostShiba.SendingDomains.delete(client, 8)
```

### Tenants

```elixir
PostShiba.Tenants.list(client)
PostShiba.Tenants.get(client, 12)
PostShiba.Tenants.create(client, %{"tenant" => %{"name" => "Acme Florist"}})
PostShiba.Tenants.delete(client, 12)
```

### Inboxes

```elixir
PostShiba.Inboxes.list(client)
PostShiba.Inboxes.get(client, 3)
PostShiba.Inboxes.create(client, %{"inbox" => %{"name" => "agent", "webhook_url" => "https://hooks.example.com/mail"}})
PostShiba.Inboxes.verify(client, 3)
PostShiba.Inboxes.delete(client, 3)
```

### Messages

```elixir
PostShiba.Messages.list(client, 3)
PostShiba.Messages.get(client, 3, 21)
PostShiba.Messages.download_attachment(client, 3, 21, 1)
```

### Events

```elixir
PostShiba.Events.list(client, 4)
PostShiba.Events.get(client, 44)
```

### SMTP credentials

```elixir
PostShiba.SmtpCredentials.create(client, 4, %{"smtp_credential" => %{"tenant_id" => 12}})
PostShiba.SmtpCredentials.delete(client, 4, 9)
```

The password is present on create only.

### Webhooks

```elixir
PostShiba.Webhooks.list(client)
PostShiba.Webhooks.get(client, 2)
PostShiba.Webhooks.create(client, %{
  "webhook_endpoint" => %{
    "url" => "https://hooks.example.com/capsule",
    "event_types" => ["delivered", "bounce"],
    "cluster_id" => 4
  }
})
PostShiba.Webhooks.update(client, 2, %{
  "webhook_endpoint" => %{"enabled" => false, "event_types" => ["delivered", "bounce"]}
})
PostShiba.Webhooks.delete(client, 2)
```

The secret is present on get and create. It is omitted on list and update.

### Suppressions

```elixir
PostShiba.Suppressions.list(client)
PostShiba.Suppressions.create(client, %{"suppression" => %{"email" => "blocked@example.com", "tenant_id" => 12}})
PostShiba.Suppressions.delete(client, 7)
```

### Firewall

```elixir
PostShiba.Firewall.get(client)
PostShiba.Firewall.update(client, %{"firewall" => %{"enabled_checks" => ["temp_providers", "plus_addressing"]}})
PostShiba.Firewall.add_entry(client, %{"firewall_entry" => %{"list" => "deny", "value" => "mailinator.com"}})
PostShiba.Firewall.delete_entry(client, 3)
```

## Verify webhooks

HMAC-SHA256 of `{timestamp}.{rawBody}` compared to `X-Capsule-Signature`. A `sha256=` prefix is stripped.

```elixir
PostShiba.Webhooks.verify(raw_body, timestamp, signature, secret)
```

## Errors and throttling

Non-2xx responses raise `%PostShiba.Error{}` with `error`, `field`, and `message`.

```elixir
try do
  PostShiba.Emails.send(client, body)
rescue
  error in [PostShiba.Error] ->
    IO.inspect({error.field, error.message})
end
```

A `429` response with `error` `throttled` means the cluster hit its hourly send limit. Do not retry that send immediately. Immediate retries hit the same cap. Wait until the next hour. The Swoosh adapter does not delay for you. In a queued job, catch `%PostShiba.Error{}` and check `error.error == "throttled"` before sending again.

A team-scoped call without `team_id` raises. The client does not read a team id from `Users.me`.

## Contributing

```sh
mix test
```
