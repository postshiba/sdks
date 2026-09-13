# PostShiba

> [!NOTE]
> [PostShiba skills](https://github.com/postshiba/postshiba-skills) connect agents to MCP for first send, domains, inboxes, and sandbox mail.

PostShiba API client for Node.js.

## Installation

```sh
npm install github:postshiba/postshiba-node
```

Node 18 or later. The client uses `fetch`. Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks).

## How It Works

`PostShiba` is a thin HTTPS client. Pass a platform application token. Team-scoped routes need `teamId` on the constructor. `GET /users/me` does not return one, so the client does not guess.

Send mail with `emails.send`. Nest services inject the same client and call that method.

## Send an email

```ts
import { PostShiba } from "postshiba"

const postshiba = new PostShiba(process.env.POSTSHIBA_API_KEY, { teamId: "KjkAJW" })

await postshiba.emails.send({
	from: "hello@mail.example.com",
	to: ["you@example.com"],
	subject: "PostShiba test",
	text: "hello from PostShiba",
	html: "<p>hello from PostShiba</p>",
})
```

Pass `clusterId` to send `X-Capsule-Cluster-Id`. The path stays `POST /api/v1/emails`.

```ts
await postshiba.emails.send(body, { clusterId: "NmQpXr" })
```

Cluster send can set `sandbox` and send `Idempotency-Key`:

```ts
await postshiba.emails.sendOnCluster("NmQpXr", body, {
	sandbox: true,
	idempotencyKey: "ikey-1",
})
```

## NestJS

The Nest entry is a module and an injectable token, not a mailer. Import `postshiba` without Nest. Import `postshiba/nest` only in Nest apps.

```ts
import { Inject, Injectable, Module } from "@nestjs/common"
import { POSTSHIBA, PostShibaModule, sendMail } from "postshiba/nest"
import type { PostShiba } from "postshiba"

@Module({
	imports: [
		PostShibaModule.register({
			apiKey: process.env.POSTSHIBA_API_KEY!,
			teamId: "KjkAJW",
		}),
	],
})
export class AppModule {}

@Injectable()
export class MailService {
	constructor(@Inject(POSTSHIBA) private readonly postshiba: PostShiba) {}

	sendWelcome() {
		return sendMail(this.postshiba, {
			from: "hello@mail.example.com",
			to: "you@example.com",
			subject: "Welcome",
			text: "hello",
			html: "<p>hello</p>",
		})
	}
}
```

`sendMail` maps `to`, `from`, `subject`, `html`, `text`, and `attachments` onto `emails.send`. It does not pass a cluster id. Call `this.postshiba.emails.send(body, { clusterId: "NmQpXr" })` to pin a cluster.

## API

Override `baseUrl` when you are not on production.

```ts
new PostShiba(process.env.POSTSHIBA_API_KEY, {
	teamId: "KjkAJW",
	baseUrl: "https://app.postshiba.com",
})
```

### Users

```ts
await postshiba.users.me()
```

### Emails

```ts
await postshiba.emails.send(body)
await postshiba.emails.send(body, { clusterId: "NmQpXr" })
await postshiba.emails.sendOnCluster("NmQpXr", body, { sandbox: true })
await postshiba.emails.send({
	to: ["you@example.com"],
	template: { id: "welcome", variables: { name: "Ada" } },
})
```

### Clusters

```ts
await postshiba.clusters.list()
await postshiba.clusters.get("NmQpXr")
await postshiba.clusters.create({ cluster: { name: "edge", size: "small", region: "manual", plan: "nano" } })
await postshiba.clusters.update("NmQpXr", { cluster: { plan: "small" } })
await postshiba.clusters.suspend("NmQpXr")
await postshiba.clusters.resume("NmQpXr")
await postshiba.clusters.delete("NmQpXr")
await postshiba.clusters.boost("NmQpXr", { sku: "small_to_large" })
await postshiba.clusters.extendBoost("NmQpXr", { idempotency_key: "extend-1" })
await postshiba.clusters.cancelBoost("NmQpXr")
```

### Network

```ts
await postshiba.network.list()
await postshiba.network.create({ ip_address_id: "IpQwEr", cluster_id: "NmQpXr" })
await postshiba.network.assign({ ip_address_id: "IpQwEr", cluster_id: "NmQpXr" })
await postshiba.network.unassign({ ip_address_id: "IpQwEr", cluster_id: "NmQpXr" })
await postshiba.network.switch({ ip_address_id: "IpQwEr", cluster_id: "NmQpXr" })
await postshiba.network.release({ ip_address_id: "IpQwEr" })
```

### Sending domains

```ts
await postshiba.sendingDomains.list()
await postshiba.sendingDomains.get("HsVtYk")
await postshiba.sendingDomains.create({ sending_domain: { name: "mail.example.com", tenant_id: "WbLcFd" } })
await postshiba.sendingDomains.update("HsVtYk", { sending_domain: { dkim_selector: "s1", dkim_manual: true } })
await postshiba.sendingDomains.refresh("HsVtYk")
await postshiba.sendingDomains.verify("HsVtYk")
await postshiba.sendingDomains.suspend("HsVtYk")
await postshiba.sendingDomains.resume("HsVtYk")
await postshiba.sendingDomains.makePrimary("HsVtYk")
await postshiba.sendingDomains.delete("HsVtYk")
```

### Tenants

```ts
await postshiba.tenants.list()
await postshiba.tenants.get("WbLcFd")
await postshiba.tenants.create({ tenant: { name: "Acme Florist" } })
await postshiba.tenants.delete("WbLcFd")
```

### Inboxes

```ts
await postshiba.inboxes.list()
await postshiba.inboxes.get("PqRzMn")
await postshiba.inboxes.create({
	inbox: {
		name: "agent",
		webhook_url: "https://hooks.example.com/mail",
		host: "inbound.example.com",
		forward_to: "you@example.com",
	},
})
await postshiba.inboxes.verify("PqRzMn")
await postshiba.inboxes.delete("PqRzMn")
```

### Messages

```ts
await postshiba.messages.list("PqRzMn")
await postshiba.messages.get("PqRzMn", "GxTyVu")
await postshiba.messages.downloadAttachment("PqRzMn", "GxTyVu", 1)
```

### Events

```ts
await postshiba.events.listTeam()
await postshiba.events.list("NmQpXr")
await postshiba.events.get("JkLmNp")
```

### SMTP credentials

```ts
await postshiba.smtpCredentials.create("NmQpXr", { smtp_credential: { tenant_id: "WbLcFd" } })
await postshiba.smtpCredentials.delete("NmQpXr", "RvWsXq")
```

Create returns `password`. Delete does not.

### Webhooks

```ts
await postshiba.webhooks.list()
await postshiba.webhooks.get("CdFgHj")
await postshiba.webhooks.create({
	webhook_endpoint: {
		url: "https://hooks.example.com/capsule",
		event_types: ["delivered", "bounce"],
		cluster_id: "NmQpXr",
	},
})
await postshiba.webhooks.update("CdFgHj", {
	webhook_endpoint: { enabled: false, event_types: ["delivered", "bounce"] },
})
await postshiba.webhooks.delete("CdFgHj")
```

List and update omit `secret`. Get and create return it.

### Templates

```ts
await postshiba.templates.list()
await postshiba.templates.get("welcome")
await postshiba.templates.create({
	email_template: {
		name: "Welcome",
		alias: "welcome",
		subject: "Hi {{ name }}",
		html: "<p>Hi {{ name }}</p>",
	},
})
await postshiba.templates.update("TpLmQr", { email_template: { subject: "Welcome, {{ name }}" } })
await postshiba.templates.publish("TpLmQr")
await postshiba.templates.duplicate("TpLmQr")
await postshiba.templates.delete("TpLmQr")
```

Send uses the published snapshot. `get` and member routes accept the public id or the alias.

### Suppressions

```ts
await postshiba.suppressions.list()
await postshiba.suppressions.create({ suppression: { email: "blocked@example.com", tenant_id: "WbLcFd" } })
await postshiba.suppressions.import({ emails: ["blocked@example.com", "old@example.com"], tenant_id: "WbLcFd" })
await postshiba.suppressions.delete("YtReWq")
```

### Firewall

```ts
await postshiba.firewall.get()
await postshiba.firewall.update({ firewall: { enabled_checks: ["temp_providers", "plus_addressing"] } })
await postshiba.firewall.addEntry({ firewall_entry: { list: "deny", value: "mailinator.com" } })
await postshiba.firewall.deleteEntry("BnMkLo")
```

## Verify webhooks

HMAC-SHA256 of `{timestamp}.{rawBody}` against `X-Capsule-Signature`. A `sha256=` prefix is stripped.

```ts
const ok = postshiba.webhooks.verify(rawBody, timestamp, signature, secret)
```

## Errors and throttling

Non-2xx responses throw `PostShibaError` with `error`, `field`, and `message` from the JSON body.

```ts
import { PostShibaError } from "postshiba"

try {
	await postshiba.emails.send(body)
} catch (err) {
	if (err instanceof PostShibaError) {
		console.error(err.error, err.field, err.message)
	}
}
```

A `429` response with `error` `throttled` means the cluster hit its hourly send limit. Do not retry that send immediately. Immediate retries hit the same cap. Wait until the next hour. The client does not delay for you. In a queued job, catch `PostShibaError` and check `err.error === "throttled"` before sending again.

Missing `teamId` on a team-scoped call throws before any request.

## Contributing

```sh
npm install
npm test
```

Tests mock HTTP and load fixtures from `../../fixtures/catalog`. They do not call production.
