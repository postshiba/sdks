# PostShiba

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

const postshiba = new PostShiba(process.env.POSTSHIBA_API_KEY, { teamId: 1 })

await postshiba.emails.send({
	from: "hello@mail.example.com",
	to: ["you@example.com"],
	subject: "PostShiba test",
	text: "hello from PostShiba",
	html: "<p>hello from PostShiba</p>",
})
```

Cluster send can set `sandbox` and send `Idempotency-Key`:

```ts
await postshiba.emails.sendOnCluster(4, body, {
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
			teamId: 1,
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

`sendMail` maps `to`, `from`, `subject`, `html`, `text`, and `attachments` onto `emails.send`. You can also call `this.postshiba.emails.send` directly.

## API

Override `baseUrl` when you are not on production.

```ts
new PostShiba(process.env.POSTSHIBA_API_KEY, {
	teamId: 1,
	baseUrl: "https://postshiba.com",
})
```

### Users

```ts
await postshiba.users.me()
```

### Emails

```ts
await postshiba.emails.send(body)
await postshiba.emails.sendOnCluster(4, body, { sandbox: true })
```

### Clusters

```ts
await postshiba.clusters.list()
await postshiba.clusters.get(4)
await postshiba.clusters.create({ cluster: { name: "edge", size: "small", region: "manual", plan: "nano" } })
await postshiba.clusters.update(4, { cluster: { plan: "small" } })
await postshiba.clusters.suspend(4)
await postshiba.clusters.resume(4)
await postshiba.clusters.delete(4)
```

### Sending domains

```ts
await postshiba.sendingDomains.list()
await postshiba.sendingDomains.get(8)
await postshiba.sendingDomains.create({ sending_domain: { name: "mail.example.com", tenant_id: 12 } })
await postshiba.sendingDomains.verify(8)
await postshiba.sendingDomains.suspend(8)
await postshiba.sendingDomains.resume(8)
await postshiba.sendingDomains.makePrimary(8)
await postshiba.sendingDomains.delete(8)
```

### Tenants

```ts
await postshiba.tenants.list()
await postshiba.tenants.get(12)
await postshiba.tenants.create({ tenant: { name: "Acme Florist" } })
await postshiba.tenants.delete(12)
```

### Inboxes

```ts
await postshiba.inboxes.list()
await postshiba.inboxes.get(3)
await postshiba.inboxes.create({ inbox: { name: "agent", webhook_url: "https://hooks.example.com/mail" } })
await postshiba.inboxes.verify(3)
await postshiba.inboxes.delete(3)
```

### Messages

```ts
await postshiba.messages.list(3)
await postshiba.messages.get(3, 21)
await postshiba.messages.downloadAttachment(3, 21, 1)
```

### Events

```ts
await postshiba.events.list(4)
await postshiba.events.get(44)
```

### SMTP credentials

```ts
await postshiba.smtpCredentials.create(4, { smtp_credential: { tenant_id: 12 } })
await postshiba.smtpCredentials.delete(4, 9)
```

Create returns `password`. Delete does not.

### Webhooks

```ts
await postshiba.webhooks.list()
await postshiba.webhooks.get(2)
await postshiba.webhooks.create({
	webhook_endpoint: {
		url: "https://hooks.example.com/capsule",
		event_types: ["delivered", "bounce"],
		cluster_id: 4,
	},
})
```

List omits `secret`. Get and create return it. There is no update or delete.

### Suppressions

```ts
await postshiba.suppressions.list()
await postshiba.suppressions.create({ suppression: { email: "blocked@example.com", tenant_id: 12 } })
await postshiba.suppressions.delete(7)
```

### Firewall

```ts
await postshiba.firewall.get()
await postshiba.firewall.update({ firewall: { enabled_checks: ["temp_providers", "plus_addressing"] } })
await postshiba.firewall.addEntry({ firewall_entry: { list: "deny", value: "mailinator.com" } })
await postshiba.firewall.deleteEntry(3)
```

## Verify webhooks

HMAC-SHA256 of `{timestamp}.{rawBody}` against `X-Capsule-Signature`. A `sha256=` prefix is stripped.

```ts
const ok = postshiba.webhooks.verify(rawBody, timestamp, signature, secret)
```

## Errors

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

Missing `teamId` on a team-scoped call throws before any request.

## Contributing

```sh
npm install
npm test
```

Tests mock HTTP and load fixtures from `../../fixtures/catalog`. They do not call production.
