# PostShiba Inngest

> [!NOTE]
> [PostShiba skills](https://github.com/postshiba/postshiba-skills) connect agents to MCP for first send, domains, inboxes, and sandbox mail.

PostShiba email delivery inside an Inngest function.

## Installation

```sh
npm install github:postshiba/postshiba-inngest inngest
```

Node 18 or later. Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks).

## How It Works

`sendEmail` wraps cluster send in `step.run`. Inngest retries the step. A `429` with `error` `throttled` becomes `RetryAfterError` and waits one hour. Permanent errors become `NonRetriableError`.

This client posts to `POST /api/v1/teams/:teamId/clusters/:clusterId/sends`. `clusterId` is required. Pass `idempotencyKey` from `event.id` so a replayed step does not double-send.

```ts
import { Inngest } from "inngest"
import { sendEmail } from "@postshiba/inngest"

const inngest = new Inngest({ id: "app" })

export const sendWelcome = inngest.createFunction(
  { id: "send-welcome" },
  { event: "app/user.created" },
  async ({ event, step }) => {
    return await sendEmail(
      step,
      {
        apiKey: process.env.POSTSHIBA_API_KEY!,
        teamId: "KjkAJW",
        clusterId: "NmQpXr",
      },
      {
        from: "hello@mail.example.com",
        to: [event.data.email],
        subject: "Welcome",
        text: "Glad you are here.",
        idempotencyKey: event.id,
      },
    )
  },
)
```

Template send. Pass `template` and skip `html` and `text`. `from` and `subject` override the template when you set them.

```ts
await sendEmail(step, config, {
  from: "hello@mail.example.com",
  to: [event.data.email],
  template: { id: "welcome", variables: { name: event.data.name } },
  idempotencyKey: event.id,
})
```

## Webhooks

```ts
import { handleWebhook } from "@postshiba/inngest"
import { inngest } from "./inngest"

export async function POST(req: Request) {
  return handleWebhook(req, {
    secret: process.env.POSTSHIBA_WEBHOOK_SECRET!,
    inngest,
  })
}
```

HMAC-SHA256 of `{timestamp}.{rawBody}` against `X-Capsule-Signature` with a `sha256=` prefix. `X-Capsule-Timestamp` must be within 300 seconds. Each event is sent as `postshiba/email.event`.

## Errors and throttling

Non-2xx responses throw `PostShibaHttpError` with `status`, `code`, and `retryable`. `sendEmail` maps those onto Inngest errors before they leave the step.

A `429` with `error` `throttled` is the cluster hourly send limit. This adapter waits one hour. Do not send the same message from another system during that window.

See [Errors](https://www.postshiba.com/docs/api-reference/errors).

## Contributing

```sh
npm install
npm test
```

Tests mock HTTP. They do not call production.
