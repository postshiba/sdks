# PostShiba

> [!NOTE]
> [PostShiba skills](https://github.com/postshiba/postshiba-skills) connect agents to MCP for first send, domains, inboxes, and sandbox mail.

Python client for the PostShiba API

## Installation

```sh
pip install git+https://github.com/postshiba/postshiba-python.git
```

Not on PyPI yet. Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks).

Django extra:

```sh
pip install "git+https://github.com/postshiba/postshiba-python.git#egg=postshiba[django]"
```

## How It Works

`PostShiba` sends JSON to `https://app.postshiba.com/api/v1` with a Bearer token. Pass `team_id` for team-scoped calls. `users.me` does not return a team id, so the client will not guess one.

## Send an email

```python
from postshiba import PostShiba

client = PostShiba("ps_...", team_id="KjkAJW")
client.emails.send({
	"from": "hello@mail.example.com",
	"to": ["you@example.com"],
	"subject": "Hello",
	"text": "Hi",
	"html": "<p>Hi</p>",
})
```

Pass `cluster_id` to send `X-Capsule-Cluster-Id`. The path stays `POST /api/v1/emails`.

```python
client.emails.send(body, cluster_id="NmQpXr")
```

## Django

```python
EMAIL_BACKEND = "postshiba.django.EmailBackend"
POSTSHIBA_API_KEY = "ps_..."
```

Django 6.1 and later can use `MAILERS` instead:

```python
MAILERS = {
	"default": {
		"BACKEND": "postshiba.django.EmailBackend",
	}
}
POSTSHIBA_API_KEY = "ps_..."
```

```python
from django.core.mail import EmailMultiAlternatives

message = EmailMultiAlternatives(
	subject="Hello",
	body="Hi",
	from_email="hello@mail.example.com",
	to=["you@example.com"],
)
message.attach_alternative("<p>Hi</p>", "text/html")
message.send()
```

The backend calls `emails.send` without a cluster id. Call the client yourself to pin a cluster. `import postshiba` does not load Django.

## API

### Users

```python
client.users.me()
```

### Emails

```python
client.emails.send(body)
client.emails.send(body, cluster_id="NmQpXr")
client.emails.send_on_cluster("NmQpXr", body, idempotency_key="idem-1", sandbox=True)
client.emails.send({
	"to": ["you@example.com"],
	"template": {"id": "welcome", "variables": {"name": "Ada"}},
})
```

### Clusters

```python
client.clusters.list()
client.clusters.get("NmQpXr")
client.clusters.create({"cluster": {"name": "edge", "size": "small", "region": "manual", "plan": "nano"}})
client.clusters.update("NmQpXr", {"cluster": {"plan": "small"}})
client.clusters.suspend("NmQpXr")
client.clusters.resume("NmQpXr")
client.clusters.delete("NmQpXr")
client.clusters.boost("NmQpXr", {"sku": "small_to_large"})
client.clusters.extend_boost("NmQpXr", {"idempotency_key": "extend-1"})
client.clusters.cancel_boost("NmQpXr")
```

### Network

```python
client.network.list()
client.network.create({"ip_address_id": "IpQwEr", "cluster_id": "NmQpXr"})
client.network.assign({"ip_address_id": "IpQwEr", "cluster_id": "NmQpXr"})
client.network.unassign({"ip_address_id": "IpQwEr", "cluster_id": "NmQpXr"})
client.network.switch({"ip_address_id": "IpQwEr", "cluster_id": "NmQpXr"})
client.network.release({"ip_address_id": "IpQwEr"})
```

### Sending domains

```python
client.sending_domains.list()
client.sending_domains.get("HsVtYk")
client.sending_domains.create({"sending_domain": {"name": "mail.example.com", "tenant_id": "WbLcFd"}})
client.sending_domains.update("HsVtYk", {"sending_domain": {"dkim_selector": "s1", "dkim_manual": True}})
client.sending_domains.refresh("HsVtYk")
client.sending_domains.verify("HsVtYk")
client.sending_domains.suspend("HsVtYk")
client.sending_domains.resume("HsVtYk")
client.sending_domains.make_primary("HsVtYk")
client.sending_domains.delete("HsVtYk")
```

### Tenants

```python
client.tenants.list()
client.tenants.get("WbLcFd")
client.tenants.create({"tenant": {"name": "Acme Florist"}})
client.tenants.delete("WbLcFd")
```

### Inboxes

```python
client.inboxes.list()
client.inboxes.get("PqRzMn")
client.inboxes.create({
	"inbox": {
		"name": "agent",
		"webhook_url": "https://hooks.example.com/mail",
		"host": "inbound.example.com",
		"forward_to": "you@example.com",
	},
})
client.inboxes.verify("PqRzMn")
client.inboxes.delete("PqRzMn")
```

### Messages

```python
client.messages.list("PqRzMn")
client.messages.get("PqRzMn", "GxTyVu")
client.messages.download_attachment("PqRzMn", "GxTyVu", 1)
```

### Events

```python
client.events.list_team()
client.events.list("NmQpXr")
client.events.get("JkLmNp")
```

### SMTP credentials

```python
client.smtp_credentials.create("NmQpXr", {"smtp_credential": {"tenant_id": "WbLcFd"}})
client.smtp_credentials.delete("NmQpXr", "RvWsXq")
```

### Webhooks

```python
client.webhooks.list()
client.webhooks.get("CdFgHj")
client.webhooks.create({"webhook_endpoint": {"url": "https://hooks.example.com/capsule", "event_types": ["delivered"]}})
client.webhooks.update("CdFgHj", {"webhook_endpoint": {"enabled": False, "event_types": ["delivered", "bounce"]}})
client.webhooks.delete("CdFgHj")
```

### Templates

```python
client.templates.list()
client.templates.get("welcome")
client.templates.create({
	"email_template": {
		"name": "Welcome",
		"alias": "welcome",
		"subject": "Hi {{ name }}",
		"html": "<p>Hi {{ name }}</p>",
	},
})
client.templates.update("TpLmQr", {"email_template": {"subject": "Welcome, {{ name }}"}})
client.templates.publish("TpLmQr")
client.templates.duplicate("TpLmQr")
client.templates.delete("TpLmQr")
```

Send uses the published snapshot. `get` and member routes accept the public id or the alias.

### Suppressions

```python
client.suppressions.list()
client.suppressions.create({"suppression": {"email": "blocked@example.com", "tenant_id": "WbLcFd"}})
client.suppressions.import_({"emails": ["blocked@example.com", "old@example.com"], "tenant_id": "WbLcFd"})
client.suppressions.delete("YtReWq")
```

### Firewall

```python
client.firewall.get()
client.firewall.update({"firewall": {"enabled_checks": ["temp_providers"]}})
client.firewall.add_entry({"firewall_entry": {"list": "deny", "value": "mailinator.com"}})
client.firewall.delete_entry("BnMkLo")
```

## Verify webhooks

```python
ok = client.webhooks.verify(raw_body, request.headers["X-Capsule-Signature"], timestamp, secret)
```

The check is HMAC-SHA256 of `{timestamp}.{raw_body}` compared to `X-Capsule-Signature` after a `sha256=` prefix.

## Errors and throttling

Non-2xx responses raise `Error` with `error`, `field`, and `message`.

```python
from postshiba import Error

try:
	client.clusters.create({"cluster": {"name": "edge"}})
except Error as e:
	print(e.error, e.field, e.message)
```

A `429` response with `error` `throttled` means the cluster hit its hourly send limit. Do not retry that send immediately. Immediate retries hit the same cap. Wait until the next hour. The Django backend does not delay for you. In a queued task, catch `Error` and check `e.error == "throttled"` before sending again.

Team-scoped calls raise if `team_id` is missing.

## Contributing

```sh
pip install -e ".[dev]"
python3 -m pytest
```
