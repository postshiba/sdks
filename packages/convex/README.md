# PostShiba Convex

PostShiba email delivery as a Convex component.

## Installation

```sh
npm install github:postshiba/postshiba-convex
```

Node 18 or later. Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks).

## How It Works

`PostShiba` is a Convex component. Enqueue mail from a mutation and it commits with your transaction. The component owns delivery after that: workpools, retries with backoff, two rate limited pools, and webhook status updates.

Register the component in `convex/convex.config.ts`:

```ts
import { defineApp } from "convex/server";
import postshiba from "@postshiba/convex/convex.config";

const app = defineApp();
app.use(postshiba);

export default app;
```

Construct a client. Options fall back to environment variables:

```ts
import { PostShiba } from "@postshiba/convex";
import { components } from "./_generated/api";

export const postshiba = new PostShiba(components.postshiba);
```

| Option | Environment variable | Default |
| --- | --- | --- |
| `apiKey` | `POSTSHIBA_API_KEY` | required |
| `teamId` | `POSTSHIBA_TEAM_ID` | required |
| `clusterId` | `POSTSHIBA_CLUSTER_ID` | required |
| `webhookSecret` | `POSTSHIBA_WEBHOOK_SECRET` | required for webhooks |
| `baseUrl` | `POSTSHIBA_API_BASE` | `https://app.postshiba.com` |
| `hourlyLimit` | | `25` |
| `testMode` | | `true` |

## Send an email

```ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { postshiba } from "./email";

export const sendWelcome = mutation({
  args: { to: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    return await postshiba.sendEmail(ctx, {
      from: "hello@mail.example.com",
      to: args.to,
      subject: "Welcome",
      html: "<p>Glad you are here.</p>",
      text: "Glad you are here.",
    });
  },
});
```

Pass `attachments` as base64 content:

```ts
await postshiba.sendEmail(ctx, {
  from: "hello@mail.example.com",
  to: "you@example.com",
  subject: "Photo",
  text: "See attached.",
  attachments: [
    { filename: "photo.png", contentType: "image/png", content: "<base64>" },
  ],
});
```

Use `priority: "bulk"` for newsletters. Default is `transactional`.

## Webhooks

Route PostShiba webhooks to the component:

```ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { postshiba } from "./email";

const http = httpRouter();

http.route({
  path: "/postshiba/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => postshiba.handleEventWebhook(ctx, req)),
});

export default http;
```

HMAC-SHA256 of `{timestamp}.{rawBody}` against `X-Capsule-Signature` with a `sha256=` prefix. `X-Capsule-Timestamp` must be within 300 seconds.

Optional `onEmailEvent` runs a mutation for each event:

```ts
import { PostShiba, vOnEmailEventArgs } from "@postshiba/convex";
import { internalMutation } from "./_generated/server";
import { components, internal } from "./_generated/api";

export const postshiba = new PostShiba(components.postshiba, {
  onEmailEvent: internal.email.handleEmailEvent,
});

export const handleEmailEvent = internalMutation({
  args: vOnEmailEventArgs,
  returns: null,
  handler: async (ctx, { id, event }) => {
    if (event.event === "bounce") {
      // handle bounce
    }
  },
});
```

## Test mode

`testMode` defaults to true. Every recipient must sit inside `testDomains` (default `inbound.postshiba.com`). Set `testMode: false` to send to real addresses.

## `/http`

`@postshiba/convex/http` is a zero dependency client on `fetch` and Web Crypto. It runs in the Convex V8 runtime and edge runtimes:

```ts
import {
  sendEmail,
  verifyWebhookSignature,
  parseWebhookEvents,
  PostShibaHttpError,
} from "@postshiba/convex/http";
```

Cluster sends post a flat JSON body to `/api/v1/teams/:teamId/clusters/:clusterId/sends`. The component sets `Idempotency-Key` to the Convex email id.

## Errors and throttling

Non-2xx responses throw `PostShibaHttpError` with `status`, `code`, and `retryable`.

```ts
try {
  await sendEmail(config, body);
} catch (err) {
  if (err instanceof PostShibaHttpError && err.code === "throttled") {
    // hourly cap; wait until the next hour
  }
}
```

A `429` with `error` `throttled` is the cluster hourly send limit. This component retries with backoff because it owns the queue. Set `hourlyLimit` under your cluster cap. Callers in other systems should still catch `throttled` before sending again.

## Contributing

```sh
npm install
npm test
```

Tests mock HTTP. They do not call production.

Derived from [wollemiahq/convex-postshiba](https://github.com/wollemiahq/convex-postshiba) (MIT).
