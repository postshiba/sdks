# PostShiba Trigger.dev

> [!NOTE]
> [PostShiba skills](https://github.com/postshiba/postshiba-skills) connect agents to MCP for first send, domains, inboxes, and sandbox mail.

PostShiba email delivery inside a Trigger.dev task.

## Installation

```sh
npm install github:postshiba/postshiba-trigger @trigger.dev/sdk
```

Node 18 or later. Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks).

## How It Works

`sendEmail` posts to `POST /api/v1/teams/:teamId/clusters/:clusterId/sends`. `clusterId` is required. Put `catchPostShibaError` on the task. A `429` with `error` `throttled` waits until the next hour. Permanent errors skip retrying.

```ts
import { task } from "@trigger.dev/sdk"
import { catchPostShibaError, defaultRetry, sendEmail } from "@postshiba/trigger"

export const sendWelcome = task({
  id: "send-welcome",
  retry: defaultRetry,
  catchError: async ({ error }) => catchPostShibaError(error),
  run: async (payload: { to: string; id: string }) => {
    return await sendEmail(
      {
        apiKey: process.env.POSTSHIBA_API_KEY!,
        teamId: "KjkAJW",
        clusterId: "NmQpXr",
      },
      {
        from: "hello@mail.example.com",
        to: [payload.to],
        subject: "Welcome",
        text: "Glad you are here.",
        idempotencyKey: payload.id,
      },
    )
  },
})
```

Pass a stable `idempotencyKey` so a retried task does not double-send.

## Webhooks

```ts
import { handleWebhook } from "@postshiba/trigger"

export async function POST(req: Request) {
  return handleWebhook(req, {
    secret: process.env.POSTSHIBA_WEBHOOK_SECRET!,
    trigger: async (event) => {
      await processEmailEvent.trigger(event)
    },
  })
}
```

HMAC-SHA256 of `{timestamp}.{rawBody}` against `X-Capsule-Signature` with a `sha256=` prefix. `X-Capsule-Timestamp` must be within 300 seconds.

## Errors and throttling

Non-2xx responses throw `PostShibaHttpError` with `status`, `code`, and `retryable`. Permanent errors become `AbortTaskRunError`.

A `429` with `error` `throttled` is the cluster hourly send limit. `catchPostShibaError` waits until the next hour.

See [Errors](https://www.postshiba.com/docs/api-reference/errors).

## Contributing

```sh
npm install
npm test
```

Tests mock HTTP. They do not call production.
