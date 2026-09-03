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

`PostShiba` is a thin HTTPS client. Pass a platform application token. Calls go to `https://app.postshiba.com/api/v1` unless you set `baseUrl`. Team-scoped paths need `teamId`. `GET /users/me` does not return one.

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

Pass a cluster id to pin `X-Capsule-Cluster-Id`. Omit it and the header is not sent.

```java
client.emails.send(body, new PostShiba.SendOptions().clusterId("NmQpXr"));
```

Cluster send can add `Idempotency-Key` and `"sandbox": true`.

```java
PostShiba client = new PostShiba("ps_...", new PostShiba.Options().teamId("KjkAJW"));

client.emails.sendOnCluster(
	4,
	body,
	new PostShiba.SendOnClusterOptions().idempotencyKey("idem-1").sandbox(true)
);
```

## API

```java
PostShiba client = new PostShiba("ps_...", new PostShiba.Options().teamId("KjkAJW"));

client.users.me();

client.clusters.list();
client.clusters.get("NmQpXr");
client.clusters.create(Map.of("cluster", Map.of("name", "edge", "size", "small", "region", "manual", "plan", "nano")));
client.clusters.update("NmQpXr", Map.of("cluster", Map.of("plan", "small")));
client.clusters.suspend("NmQpXr");
client.clusters.resume("NmQpXr");
client.clusters.delete("NmQpXr");

client.sendingDomains.list();
client.sendingDomains.get("HsVtYk");
client.sendingDomains.create(Map.of("sending_domain", Map.of("name", "mail.example.com", "tenant_id", "WbLcFd")));
client.sendingDomains.verify("HsVtYk");
client.sendingDomains.suspend("HsVtYk");
client.sendingDomains.resume("HsVtYk");
client.sendingDomains.makePrimary("HsVtYk");
client.sendingDomains.delete("HsVtYk");

client.tenants.list();
client.tenants.get("WbLcFd");
client.tenants.create(Map.of("tenant", Map.of("name", "Acme Florist")));
client.tenants.delete("WbLcFd");

client.inboxes.list();
client.inboxes.get("PqRzMn");
client.inboxes.create(Map.of("inbox", Map.of("name", "agent", "webhook_url", "https://hooks.example.com/mail")));
client.inboxes.verify("PqRzMn");
client.inboxes.delete("PqRzMn");

client.messages.list("PqRzMn");
client.messages.get("PqRzMn", "GxTyVu");
client.messages.downloadAttachment("PqRzMn", "GxTyVu", 1);

client.events.list("NmQpXr");
client.events.get("JkLmNp");

client.smtpCredentials.create("NmQpXr", Map.of("smtp_credential", Map.of("tenant_id", "WbLcFd")));
client.smtpCredentials.delete("NmQpXr", "RvWsXq");

client.webhooks.list();
client.webhooks.get("CdFgHj");
client.webhooks.create(Map.of(
	"webhook_endpoint",
	Map.of("url", "https://hooks.example.com/capsule", "event_types", List.of("delivered", "bounce"), "cluster_id", "NmQpXr")
));
client.webhooks.update("CdFgHj", Map.of(
	"webhook_endpoint",
	Map.of("enabled", false, "event_types", List.of("delivered", "bounce"))
));
client.webhooks.delete("CdFgHj");

client.suppressions.list();
client.suppressions.create(Map.of("suppression", Map.of("email", "blocked@example.com", "tenant_id", "WbLcFd")));
client.suppressions.delete("YtReWq");

client.firewall.get();
client.firewall.update(Map.of("firewall", Map.of("enabled_checks", List.of("temp_providers", "plus_addressing"))));
client.firewall.addEntry(Map.of("firewall_entry", Map.of("list", "deny", "value", "mailinator.com")));
client.firewall.deleteEntry("BnMkLo");
```

Responses are Jackson `JsonNode` trees. Request bodies are maps or other JSON-serializable objects.

## Verify webhooks

HMAC-SHA256 of `{timestamp}.{rawBody}` against `X-Capsule-Signature`. A `sha256=` prefix is stripped.

```java
boolean ok = client.webhooks.verify(secret, timestamp, rawBody, signature);
```

## Errors and throttling

Non-2xx responses throw `ApiError` with `error`, `field`, and `message` from the JSON body.

```java
try {
	client.emails.send(body);
} catch (ApiError e) {
	System.err.println(e.error + " " + e.field + " " + e.message);
}
```

A `429` response with `error` `throttled` means the cluster hit its hourly send limit. Do not retry that send immediately. Immediate retries hit the same cap. Wait until the next hour. The client does not delay for you. In a queued worker, catch `ApiError` and check `e.error.equals("throttled")` before sending again.

A team-scoped call without `teamId` throws `IllegalStateException`.

## Contributing

```sh
./mvnw -q test
```
