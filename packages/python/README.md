# PostShiba

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

client = PostShiba("ps_...", team_id=1)
client.emails.send({
	"from": "hello@mail.example.com",
	"to": ["you@example.com"],
	"subject": "Hello",
	"text": "Hi",
	"html": "<p>Hi</p>",
})
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

The backend calls `emails.send`. `import postshiba` does not load Django.

## API

### Users

```python
client.users.me()
```

### Emails

```python
client.emails.send(body)
client.emails.send_on_cluster(4, body, idempotency_key="idem-1", sandbox=True)
```

### Clusters

```python
client.clusters.list()
client.clusters.get(4)
client.clusters.create({"cluster": {"name": "edge", "size": "small", "region": "manual", "plan": "nano"}})
client.clusters.update(4, {"cluster": {"plan": "small"}})
client.clusters.suspend(4)
client.clusters.resume(4)
client.clusters.delete(4)
```

### Sending domains

```python
client.sending_domains.list()
client.sending_domains.get(8)
client.sending_domains.create({"sending_domain": {"name": "mail.example.com", "tenant_id": 12}})
client.sending_domains.verify(8)
client.sending_domains.suspend(8)
client.sending_domains.resume(8)
client.sending_domains.make_primary(8)
client.sending_domains.delete(8)
```

### Tenants

```python
client.tenants.list()
client.tenants.get(12)
client.tenants.create({"tenant": {"name": "Acme Florist"}})
client.tenants.delete(12)
```

### Inboxes

```python
client.inboxes.list()
client.inboxes.get(3)
client.inboxes.create({"inbox": {"name": "agent", "webhook_url": "https://hooks.example.com/mail"}})
client.inboxes.verify(3)
client.inboxes.delete(3)
```

### Messages

```python
client.messages.list(3)
client.messages.get(3, 21)
client.messages.download_attachment(3, 21, 1)
```

### Events

```python
client.events.list(4)
client.events.get(44)
```

### SMTP credentials

```python
client.smtp_credentials.create(4, {"smtp_credential": {"tenant_id": 12}})
client.smtp_credentials.delete(4, 9)
```

### Webhooks

```python
client.webhooks.list()
client.webhooks.get(2)
client.webhooks.create({"webhook_endpoint": {"url": "https://hooks.example.com/capsule", "event_types": ["delivered"]}})
client.webhooks.update(2, {"webhook_endpoint": {"enabled": False, "event_types": ["delivered", "bounce"]}})
client.webhooks.delete(2)
```

### Suppressions

```python
client.suppressions.list()
client.suppressions.create({"suppression": {"email": "blocked@example.com", "tenant_id": 12}})
client.suppressions.delete(7)
```

### Firewall

```python
client.firewall.get()
client.firewall.update({"firewall": {"enabled_checks": ["temp_providers"]}})
client.firewall.add_entry({"firewall_entry": {"list": "deny", "value": "mailinator.com"}})
client.firewall.delete_entry(3)
```

## Verify webhooks

```python
ok = client.webhooks.verify(raw_body, request.headers["X-Capsule-Signature"], timestamp, secret)
```

The check is HMAC-SHA256 of `{timestamp}.{raw_body}` compared to `X-Capsule-Signature` after a `sha256=` prefix.

## Errors

Non-2xx responses raise `Error` with `error`, `field`, and `message`.

```python
from postshiba import Error

try:
	client.clusters.create({"cluster": {"name": "edge"}})
except Error as e:
	print(e.error, e.field, e.message)
```

Team-scoped calls raise if `team_id` is missing.

## Contributing

```sh
pip install -e ".[dev]"
python3 -m pytest
```
