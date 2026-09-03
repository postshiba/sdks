# PostShiba Java

Java client for the PostShiba API.

## Installation

```xml
<dependency>
	<groupId>com.postshiba</groupId>
	<artifactId>postshiba</artifactId>
	<version>0.1.0</version>
</dependency>
```

Not on Maven Central yet. Clone [postshiba/postshiba-java](https://github.com/postshiba/postshiba-java) and `./mvnw install`. Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks). Requires Java 17.

## How It Works

`PostShiba` is a thin HTTPS client. Pass a platform application token. Calls go to `https://postshiba.com/api/v1` unless you set `baseUrl`. Team-scoped paths need `teamId`. `GET /users/me` does not return one.

## Send an email

```java
PostShiba client = new PostShiba("ps_...");

client.emails.send(Map.of(
	"from", "hello@mail.example.com",
	"to", List.of("you@example.com"),
	"subject", "PostShiba test",
	"text", "hello from PostShiba",
	"html", "<p>hello from PostShiba</p>"
));
```

Cluster send can add `Idempotency-Key` and `"sandbox": true`.

```java
PostShiba client = new PostShiba("ps_...", new PostShiba.Options().teamId(1));

client.emails.sendOnCluster(
	4,
	body,
	new PostShiba.SendOnClusterOptions().idempotencyKey("idem-1").sandbox(true)
);
```

## API

```java
PostShiba client = new PostShiba("ps_...", new PostShiba.Options().teamId(1));

client.users.me();

client.clusters.list();
client.clusters.get(4);
client.clusters.create(Map.of("cluster", Map.of("name", "edge", "size", "small", "region", "manual", "plan", "nano")));
client.clusters.update(4, Map.of("cluster", Map.of("plan", "small")));
client.clusters.suspend(4);
client.clusters.resume(4);
client.clusters.delete(4);

client.sendingDomains.list();
client.sendingDomains.get(8);
client.sendingDomains.create(Map.of("sending_domain", Map.of("name", "mail.example.com", "tenant_id", 12)));
client.sendingDomains.verify(8);
client.sendingDomains.suspend(8);
client.sendingDomains.resume(8);
client.sendingDomains.makePrimary(8);
client.sendingDomains.delete(8);

client.tenants.list();
client.tenants.get(12);
client.tenants.create(Map.of("tenant", Map.of("name", "Acme Florist")));
client.tenants.delete(12);

client.inboxes.list();
client.inboxes.get(3);
client.inboxes.create(Map.of("inbox", Map.of("name", "agent", "webhook_url", "https://hooks.example.com/mail")));
client.inboxes.verify(3);
client.inboxes.delete(3);

client.messages.list(3);
client.messages.get(3, 21);
client.messages.downloadAttachment(3, 21, 1);

client.events.list(4);
client.events.get(44);

client.smtpCredentials.create(4, Map.of("smtp_credential", Map.of("tenant_id", 12)));
client.smtpCredentials.delete(4, 9);

client.webhooks.list();
client.webhooks.get(2);
client.webhooks.create(Map.of(
	"webhook_endpoint",
	Map.of("url", "https://hooks.example.com/capsule", "event_types", List.of("delivered", "bounce"), "cluster_id", 4)
));

client.suppressions.list();
client.suppressions.create(Map.of("suppression", Map.of("email", "blocked@example.com", "tenant_id", 12)));
client.suppressions.delete(7);

client.firewall.get();
client.firewall.update(Map.of("firewall", Map.of("enabled_checks", List.of("temp_providers", "plus_addressing"))));
client.firewall.addEntry(Map.of("firewall_entry", Map.of("list", "deny", "value", "mailinator.com")));
client.firewall.deleteEntry(3);
```

Responses are Jackson `JsonNode` trees. Request bodies are maps or other JSON-serializable objects.

## Verify webhooks

HMAC-SHA256 of `{timestamp}.{rawBody}` against `X-Capsule-Signature`. A `sha256=` prefix is stripped.

```java
boolean ok = client.webhooks.verify(secret, timestamp, rawBody, signature);
```

## Errors

Non-2xx responses throw `ApiError` with `error`, `field`, and `message` from the JSON body.

```java
try {
	client.emails.send(body);
} catch (ApiError e) {
	System.err.println(e.error + " " + e.field + " " + e.message);
}
```

A team-scoped call without `teamId` throws `IllegalStateException`.

## Contributing

```sh
./mvnw -q test
```
