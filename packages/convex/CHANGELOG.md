# Changelog

## 0.1.0

Official PostShiba release. Derived from [wollemiahq/convex-postshiba](https://github.com/wollemiahq/convex-postshiba) (MIT).

- Durable email delivery through PostShiba with workpools, retries, and exponential backoff.
- Two sending pools (transactional and bulk), each with its own hourly token bucket.
- `sendEmail` from a mutation so email commits with your transaction.
- Webhook handler with HMAC-SHA256 verification, replay window, and optional `onEmailEvent`.
- Test mode on by default.
- Flat send body aligned with the PostShiba SDK contract (no `{ send: ... }` envelope).
- Attachments on send (`filename`, `contentType`, base64 `content`).
- Slim `/http` export: send, webhook verify, and types only.
