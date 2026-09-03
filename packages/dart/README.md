# PostShiba

Dart client for the PostShiba API.

## Installation

```yaml
dependencies:
  postshiba:
    git:
      url: https://github.com/postshiba/postshiba-dart.git
```

Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks).

## How It Works

`PostShiba` is a thin HTTPS client. It sends `Authorization: Bearer <apiKey>` to `https://app.postshiba.com/api/v1`. Pass `teamId` for team-scoped routes. `GET /users/me` does not return a team id.

## Send an email

```dart
final client = PostShiba("ps_xxx", teamId: 1);

await client.emails.send({
  "from": "hello@mail.example.com",
  "to": ["you@example.com"],
  "subject": "Hello",
  "html": "<p>Hi</p>",
  "text": "Hi",
});
```

Cluster send accepts `Idempotency-Key` and `sandbox`:

```dart
await client.emails.sendOnCluster(
  4,
  {
    "from": "hello@mail.example.com",
    "to": ["you@example.com"],
    "subject": "Hello",
    "text": "Hi",
  },
  idempotencyKey: "idem-1",
  sandbox: true,
);
```

## API

```dart
final client = PostShiba(
  "ps_xxx",
  baseUrl: "https://app.postshiba.com",
  teamId: 1,
);
```

Inject `http.Client` in tests:

```dart
PostShiba("ps_xxx", teamId: 1, httpClient: mock);
```

### Users

```dart
await client.users.me();
```

### Emails

```dart
await client.emails.send({...});
await client.emails.sendOnCluster(4, {...}, sandbox: true);
```

### Clusters

```dart
await client.clusters.list();
await client.clusters.get(4);
await client.clusters.create({
  "cluster": {"name": "edge", "size": "small", "region": "manual", "plan": "nano"},
});
await client.clusters.update(4, {
  "cluster": {"plan": "small"},
});
await client.clusters.suspend(4);
await client.clusters.resume(4);
await client.clusters.delete(4);
```

### Sending domains

```dart
await client.sendingDomains.list();
await client.sendingDomains.get(8);
await client.sendingDomains.create({
  "sending_domain": {"name": "mail.example.com", "tenant_id": 12},
});
await client.sendingDomains.verify(8);
await client.sendingDomains.suspend(8);
await client.sendingDomains.resume(8);
await client.sendingDomains.makePrimary(8);
await client.sendingDomains.delete(8);
```

### Tenants

```dart
await client.tenants.list();
await client.tenants.get(12);
await client.tenants.create({
  "tenant": {"name": "Acme Florist"},
});
await client.tenants.delete(12);
```

### Inboxes

```dart
await client.inboxes.list();
await client.inboxes.get(3);
await client.inboxes.create({
  "inbox": {"name": "agent", "webhook_url": "https://hooks.example.com/mail"},
});
await client.inboxes.verify(3);
await client.inboxes.delete(3);
```

### Messages

```dart
await client.messages.list(3);
await client.messages.get(3, 21);
await client.messages.downloadAttachment(3, 21, 1);
```

### Events

```dart
await client.events.list(4);
await client.events.get(44);
```

### SMTP credentials

```dart
await client.smtpCredentials.create(4, {
  "smtp_credential": {"tenant_id": 12},
});
await client.smtpCredentials.delete(4, 9);
```

### Webhooks

```dart
await client.webhooks.list();
await client.webhooks.get(2);
await client.webhooks.create({
  "webhook_endpoint": {
    "url": "https://hooks.example.com/capsule",
    "event_types": ["delivered", "bounce"],
    "cluster_id": 4,
  },
});
await client.webhooks.update(2, {
  "webhook_endpoint": {"enabled": false, "event_types": ["delivered", "bounce"]},
});
await client.webhooks.delete(2);
```

### Suppressions

```dart
await client.suppressions.list();
await client.suppressions.create({
  "suppression": {"email": "blocked@example.com", "tenant_id": 12},
});
await client.suppressions.delete(7);
```

### Firewall

```dart
await client.firewall.get();
await client.firewall.update({
  "firewall": {
    "enabled_checks": ["temp_providers", "plus_addressing"],
  },
});
await client.firewall.addEntry({
  "firewall_entry": {"list": "deny", "value": "mailinator.com"},
});
await client.firewall.deleteEntry(3);
```

## Verify webhooks

HMAC-SHA256 of `{timestamp}.{rawBody}` against `X-Capsule-Signature`.

```dart
final ok = Webhooks.verify(secret, body, signature, timestamp);
```

## Errors and throttling

Non-2xx responses throw `ApiException` with `error`, `field`, and `message`.

```dart
try {
  await client.emails.send({...});
} on ApiException catch (e) {
  print(e.error);
  print(e.field);
  print(e.message);
}
```

A `429` response with `error` `throttled` means the cluster hit its hourly send limit. Do not retry that send immediately. Immediate retries hit the same cap. Wait until the next hour. The client does not delay for you. In a queued job, catch `ApiException` and check `e.error == "throttled"` before sending again. `e.statusCode` is the HTTP status.

Team-scoped calls throw `StateError` when `teamId` is missing.

## Contributing

```sh
dart test
```
