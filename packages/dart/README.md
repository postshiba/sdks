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
final client = PostShiba("ps_xxx", teamId: "KjkAJW");

await client.emails.send({
  "from": "hello@mail.example.com",
  "to": ["you@example.com"],
  "subject": "Hello",
  "html": "<p>Hi</p>",
  "text": "Hi",
});
```

Pass a cluster id to pin `X-Capsule-Cluster-Id`. Omit it and the header is not sent.

```dart
await client.emails.send({...}, clusterId: "NmQpXr");
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
  teamId: "KjkAJW",
);
```

Inject `http.Client` in tests:

```dart
PostShiba("ps_xxx", teamId: "KjkAJW", httpClient: mock);
```

### Users

```dart
await client.users.me();
```

### Emails

```dart
await client.emails.send({...}, clusterId: "NmQpXr");
await client.emails.sendOnCluster("NmQpXr", {...}, sandbox: true);
```

### Clusters

```dart
await client.clusters.list();
await client.clusters.get("NmQpXr");
await client.clusters.create({
  "cluster": {"name": "edge", "size": "small", "region": "manual", "plan": "nano"},
});
await client.clusters.update("NmQpXr", {
  "cluster": {"plan": "small"},
});
await client.clusters.suspend("NmQpXr");
await client.clusters.resume("NmQpXr");
await client.clusters.delete("NmQpXr");
```

### Sending domains

```dart
await client.sendingDomains.list();
await client.sendingDomains.get("HsVtYk");
await client.sendingDomains.create({
  "sending_domain": {"name": "mail.example.com", "tenant_id": "WbLcFd"},
});
await client.sendingDomains.verify("HsVtYk");
await client.sendingDomains.suspend("HsVtYk");
await client.sendingDomains.resume("HsVtYk");
await client.sendingDomains.makePrimary("HsVtYk");
await client.sendingDomains.delete("HsVtYk");
```

### Tenants

```dart
await client.tenants.list();
await client.tenants.get("WbLcFd");
await client.tenants.create({
  "tenant": {"name": "Acme Florist"},
});
await client.tenants.delete("WbLcFd");
```

### Inboxes

```dart
await client.inboxes.list();
await client.inboxes.get("PqRzMn");
await client.inboxes.create({
  "inbox": {"name": "agent", "webhook_url": "https://hooks.example.com/mail"},
});
await client.inboxes.verify("PqRzMn");
await client.inboxes.delete("PqRzMn");
```

### Messages

```dart
await client.messages.list("PqRzMn");
await client.messages.get("PqRzMn", "GxTyVu");
await client.messages.downloadAttachment("PqRzMn", "GxTyVu", 1);
```

### Events

```dart
await client.events.list("NmQpXr");
await client.events.get("JkLmNp");
```

### SMTP credentials

```dart
await client.smtpCredentials.create("NmQpXr", {
  "smtp_credential": {"tenant_id": "WbLcFd"},
});
await client.smtpCredentials.delete("NmQpXr", "RvWsXq");
```

### Webhooks

```dart
await client.webhooks.list();
await client.webhooks.get("CdFgHj");
await client.webhooks.create({
  "webhook_endpoint": {
    "url": "https://hooks.example.com/capsule",
    "event_types": ["delivered", "bounce"],
    "cluster_id": "NmQpXr",
  },
});
await client.webhooks.update("CdFgHj", {
  "webhook_endpoint": {"enabled": false, "event_types": ["delivered", "bounce"]},
});
await client.webhooks.delete("CdFgHj");
```

### Suppressions

```dart
await client.suppressions.list();
await client.suppressions.create({
  "suppression": {"email": "blocked@example.com", "tenant_id": "WbLcFd"},
});
await client.suppressions.delete("YtReWq");
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
await client.firewall.deleteEntry("BnMkLo");
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
