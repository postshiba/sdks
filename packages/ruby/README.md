# PostShiba Ruby

Ruby library for the PostShiba API.

## Installation

Add this line to your application's Gemfile:

```ruby
gem "postshiba", git: "https://github.com/postshiba/postshiba-ruby.git"
```

Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks).

## How It Works

`PostShiba.new` returns a client that sends JSON to `/api/v1`. Every request uses `Authorization: Bearer`. The default host is `https://app.postshiba.com`. Team-scoped calls need `team_id` on the client. `GET /users/me` does not return one.

## Send an email

```ruby
postshiba = PostShiba.new(api_key: "ps_...", team_id: "KjkAJW")

postshiba.send_email(
  from: "hello@mail.example.com",
  to: ["you@example.com"],
  subject: "Hello",
  html: "<p>Hello</p>",
  text: "Hello"
)
```

Pass `cluster_id` to send `X-Capsule-Cluster-Id`. The path stays `POST /api/v1/emails`.

```ruby
postshiba.send_email(body, cluster_id: "NmQpXr")
```

Cluster send takes an idempotency key and a sandbox flag:

```ruby
postshiba.send_on_cluster(
  4,
  {from: "hello@mail.example.com", to: ["you@example.com"], subject: "Hello", text: "Hello"},
  idempotency_key: "send-1",
  sandbox: true
)
```

## ActionMailer

```ruby
# config/environments/production.rb
config.action_mailer.delivery_method = :postshiba
config.action_mailer.postshiba_settings = {
  api_key: ENV["POSTSHIBA_API_KEY"]
}
```

Then `deliver_now` on any mailer. `to`, `from`, `subject`, `html`, `text`, and attachments map to `send_email`.

Set `cluster_id` in `postshiba_settings` to send `X-Capsule-Cluster-Id`. A mail header of that name wins and is not copied into the JSON body.

```ruby
config.action_mailer.postshiba_settings = {
  api_key: ENV["POSTSHIBA_API_KEY"],
  cluster_id: "NmQpXr"
}

mail.header["X-Capsule-Cluster-Id"] = "NmQpXr"
```

Without Rails, require the adapter yourself:

```ruby
require "postshiba/action_mailer"
```

## API

```ruby
postshiba = PostShiba.new(api_key: "ps_...", team_id: "KjkAJW", base_url: "https://app.postshiba.com")
```

Users

```ruby
postshiba.users_me
```

Emails

```ruby
postshiba.send_email(from: "hello@mail.example.com", to: ["you@example.com"], subject: "Hello", text: "Hello")
postshiba.send_email({from: "hello@mail.example.com", to: ["you@example.com"], subject: "Hello", text: "Hello"}, cluster_id: "NmQpXr")
postshiba.send_on_cluster("NmQpXr", {from: "hello@mail.example.com", to: ["you@example.com"], subject: "Hello", text: "Hello"}, sandbox: true)
```

Clusters

```ruby
postshiba.list_clusters
postshiba.get_cluster(4)
postshiba.create_cluster(cluster: {name: "edge", size: "small", region: "manual", plan: "nano"})
postshiba.update_cluster(4, cluster: {plan: "small"})
postshiba.suspend_cluster(4)
postshiba.resume_cluster(4)
postshiba.delete_cluster(4)
```

Sending domains

```ruby
postshiba.list_sending_domains
postshiba.get_sending_domain(8)
postshiba.create_sending_domain(sending_domain: {name: "mail.example.com", tenant_id: "WbLcFd"})
postshiba.verify_sending_domain(8)
postshiba.suspend_sending_domain(8)
postshiba.resume_sending_domain(8)
postshiba.make_sending_domain_primary(8)
postshiba.delete_sending_domain(8)
```

Tenants

```ruby
postshiba.list_tenants
postshiba.get_tenant(12)
postshiba.create_tenant(tenant: {name: "Acme Florist"})
postshiba.delete_tenant(12)
```

Inboxes

```ruby
postshiba.list_inboxes
postshiba.get_inbox(3)
postshiba.create_inbox(inbox: {name: "agent", webhook_url: "https://hooks.example.com/mail"})
postshiba.verify_inbox(3)
postshiba.delete_inbox(3)
```

Messages

```ruby
postshiba.list_messages(3)
postshiba.get_message("PqRzMn", "GxTyVu")
postshiba.download_attachment("PqRzMn", "GxTyVu", 1)
```

Events

```ruby
postshiba.list_events(4)
postshiba.get_event(44)
```

SMTP credentials

```ruby
postshiba.create_smtp_credential("NmQpXr", smtp_credential: {tenant_id: "WbLcFd"})
postshiba.delete_smtp_credential("NmQpXr", "RvWsXq")
```

Webhooks

```ruby
postshiba.list_webhooks
postshiba.get_webhook(2)
postshiba.create_webhook(webhook_endpoint: {url: "https://hooks.example.com/capsule", event_types: ["delivered"], cluster_id: "NmQpXr"})
postshiba.update_webhook(2, webhook_endpoint: {enabled: false, event_types: ["delivered", "bounce"]})
postshiba.delete_webhook(2)
```

Suppressions

```ruby
postshiba.list_suppressions
postshiba.create_suppression(suppression: {email: "blocked@example.com", tenant_id: "WbLcFd"})
postshiba.delete_suppression(7)
```

Firewall

```ruby
postshiba.get_firewall
postshiba.update_firewall(firewall: {enabled_checks: ["temp_providers"]})
postshiba.add_firewall_entry(firewall_entry: {list: "deny", value: "mailinator.com"})
postshiba.delete_firewall_entry(3)
```

## Verify webhooks

```ruby
PostShiba::Webhooks.verify(
  payload: request.raw_post,
  signature: request.headers["X-Capsule-Signature"],
  secret: ENV["POSTSHIBA_WEBHOOK_SECRET"],
  timestamp: params[:timestamp]
)
```

HMAC-SHA256 of `{timestamp}.{raw body}`, compared to `X-Capsule-Signature` after a `sha256=` prefix is stripped.

## Errors and throttling

Non-2xx responses raise `PostShiba::Error` with `error`, `field`, and `message` from the JSON body.

```ruby
begin
  postshiba.send_email(from: "bad@example.com", to: ["you@example.com"], subject: "Hello")
rescue PostShiba::Error => e
  e.error
  e.field
  e.message
end
```

A `429` response with `error` `throttled` means the cluster hit its hourly send limit. Do not retry that send immediately. Immediate retries hit the same cap. Wait until the next hour. ActionMailer does not delay for you. In a queued job, rescue `PostShiba::Error` and check `e.error == "throttled"` before delivering again.

A team-scoped call without `team_id` raises `ArgumentError`.

## Contributing

```sh
bundle exec rake test
```
