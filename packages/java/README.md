# PostShiba Java

> [!NOTE]
> [PostShiba skills](https://github.com/postshiba/postshiba-skills) connect agents to MCP for first send, domains, inboxes, and sandbox mail.

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
	"NmQpXr",
	body,
	new PostShiba.SendOnClusterOptions().idempotencyKey("idem-1").sandbox(true)
);
```

## API

```java
PostShiba client = new PostShiba("ps_...", new PostShiba.Options().teamId("KjkAJW"));
```

Override `baseUrl` when you are not on production.

```java
new PostShiba("ps_...", new PostShiba.Options().teamId("KjkAJW").baseUrl("https://app.postshiba.com"));
```

### Users

```java
client.users.me();
```

### Emails

```java
client.emails.send(body);
client.emails.send(body, new PostShiba.SendOptions().clusterId("NmQpXr"));
client.emails.sendOnCluster("NmQpXr", body, new PostShiba.SendOnClusterOptions().sandbox(true));
client.emails.send(Map.of(
	"to", List.of("you@example.com"),
	"template", Map.of("id", "welcome", "variables", Map.of("name", "Ada"))
));
```

### Clusters

```java
client.clusters.list();
client.clusters.get("NmQpXr");
client.clusters.create(Map.of("cluster", Map.of("name", "edge", "size", "small", "region", "manual", "plan", "nano")));
client.clusters.update("NmQpXr", Map.of("cluster", Map.of("plan", "small")));
client.clusters.suspend("NmQpXr");
client.clusters.resume("NmQpXr");
client.clusters.delete("NmQpXr");
client.clusters.boost("NmQpXr", Map.of("sku", "small_to_large"));
client.clusters.extendBoost("NmQpXr", Map.of("idempotency_key", "extend-1"));
client.clusters.cancelBoost("NmQpXr");
```

### Network

```java
client.network.list();
client.network.create(Map.of("ip_address_id", "IpQwEr", "cluster_id", "NmQpXr"));
client.network.assign(Map.of("ip_address_id", "IpQwEr", "cluster_id", "NmQpXr"));
client.network.unassign(Map.of("ip_address_id", "IpQwEr", "cluster_id", "NmQpXr"));
client.network.switch_(Map.of("ip_address_id", "IpQwEr", "cluster_id", "NmQpXr"));
client.network.release(Map.of("ip_address_id", "IpQwEr"));
```

`switch` and `import` are Java keywords, so those methods are `switch_` and `import_`.

### Sending domains

```java
client.sendingDomains.list();
client.sendingDomains.get("HsVtYk");
client.sendingDomains.create(Map.of("sending_domain", Map.of("name", "mail.example.com", "tenant_id", "WbLcFd")));
client.sendingDomains.update("HsVtYk", Map.of("sending_domain", Map.of("dkim_selector", "s1", "dkim_manual", true)));
client.sendingDomains.refresh("HsVtYk");
client.sendingDomains.verify("HsVtYk");
client.sendingDomains.suspend("HsVtYk");
client.sendingDomains.resume("HsVtYk");
client.sendingDomains.makePrimary("HsVtYk");
client.sendingDomains.delete("HsVtYk");
```

### Tenants

```java
client.tenants.list();
client.tenants.get("WbLcFd");
client.tenants.create(Map.of("tenant", Map.of("name", "Acme Florist")));
client.tenants.delete("WbLcFd");
```

### Inboxes

```java
client.inboxes.list();
client.inboxes.get("PqRzMn");
client.inboxes.create(Map.of(
	"inbox",
	Map.of(
		"name", "agent",
		"webhook_url", "https://hooks.example.com/mail",
		"host", "inbound.example.com",
		"forward_to", "you@example.com"
	)
));
client.inboxes.verify("PqRzMn");
client.inboxes.delete("PqRzMn");
```

### Messages

```java
client.messages.list("PqRzMn");
client.messages.get("PqRzMn", "GxTyVu");
client.messages.downloadAttachment("PqRzMn", "GxTyVu", 1);
```

### Events

```java
client.events.listTeam();
client.events.list("NmQpXr");
client.events.get("JkLmNp");
```

### SMTP credentials

```java
client.smtpCredentials.create("NmQpXr", Map.of("smtp_credential", Map.of("tenant_id", "WbLcFd")));
client.smtpCredentials.delete("NmQpXr", "RvWsXq");
```

Create returns `password`. Delete does not.

### Webhooks

```java
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
```

List and update omit `secret`. Get and create return it.

### Templates

```java
client.templates.list();
client.templates.get("welcome");
client.templates.create(Map.of(
	"email_template",
	Map.of("name", "Welcome", "alias", "welcome", "subject", "Hi {{ name }}", "html", "<p>Hi {{ name }}</p>")
));
client.templates.update("TpLmQr", Map.of("email_template", Map.of("subject", "Welcome, {{ name }}")));
client.templates.publish("TpLmQr");
client.templates.duplicate("TpLmQr");
client.templates.delete("TpLmQr");
```

Send uses the published snapshot. `get` and member routes accept the public id or the alias.

### Suppressions

```java
client.suppressions.list();
client.suppressions.create(Map.of("suppression", Map.of("email", "blocked@example.com", "tenant_id", "WbLcFd")));
client.suppressions.import_(Map.of("emails", List.of("blocked@example.com", "old@example.com"), "tenant_id", "WbLcFd"));
client.suppressions.delete("YtReWq");
```

### Firewall

```java
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
