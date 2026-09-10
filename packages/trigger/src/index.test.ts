import { AbortTaskRunError } from "@trigger.dev/sdk"
import { describe, expect, it } from "vitest"

import {
  catchPostShibaError,
  handleWebhook,
  nextHour,
  sendEmail,
} from "./index.js"
import { PostShibaHttpError } from "./http.js"

const config = {
  apiKey: "psk_test_123",
  teamId: "KjkAJW",
  clusterId: "NmQpXr",
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

async function withFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = impl
  try {
    return await fn()
  } finally {
    globalThis.fetch = original
  }
}

describe("sendEmail", () => {
  it("returns messageId", async () => {
    const impl = (async () =>
      jsonResponse(201, {
        queued: true,
        message_id: "abc123@mail.example.com",
      })) as unknown as typeof fetch
    const result = await withFetch(impl, () =>
      sendEmail(config, {
        from: "a@example.com",
        to: ["b@example.com"],
        subject: "Hi",
      }),
    )
    expect(result).toEqual({
      queued: true,
      messageId: "abc123@mail.example.com",
    })
  })

  it("rethrows throttled as PostShibaHttpError", async () => {
    const impl = (async () =>
      jsonResponse(429, { error: "throttled" })) as unknown as typeof fetch
    const error = await withFetch(impl, () =>
      sendEmail(config, {
        from: "a@example.com",
        to: ["b@example.com"],
        subject: "Hi",
      }).catch((err: unknown) => err),
    )
    expect(error).toBeInstanceOf(PostShibaHttpError)
    expect((error as PostShibaHttpError).retryable).toBe(true)
  })

  it("maps suppressed to AbortTaskRunError", async () => {
    const impl = (async () =>
      jsonResponse(403, { error: "suppressed" })) as unknown as typeof fetch
    const error = await withFetch(impl, () =>
      sendEmail(config, {
        from: "a@example.com",
        to: ["b@example.com"],
        subject: "Hi",
      }).catch((err: unknown) => err),
    )
    expect(error).toBeInstanceOf(AbortTaskRunError)
  })
})

describe("catchPostShibaError", () => {
  it("waits until the next hour for throttled", () => {
    const error = new PostShibaHttpError({
      message: "throttled",
      status: 429,
      code: "throttled",
      retryable: true,
      body: '{"error":"throttled"}',
    })
    const now = new Date("2026-09-10T09:15:00.000Z")
    const result = catchPostShibaError(error, now)
    expect(result).toEqual({ retryAt: nextHour(now) })
  })

  it("skips retrying for permanent errors", () => {
    const error = new PostShibaHttpError({
      message: "suppressed",
      status: 403,
      code: "suppressed",
      retryable: false,
      body: '{"error":"suppressed"}',
    })
    expect(catchPostShibaError(error)).toEqual({ skipRetrying: true })
  })
})

describe("nextHour", () => {
  it("returns the next UTC hour boundary", () => {
    expect(nextHour(new Date("2026-09-10T09:15:30.500Z")).toISOString()).toBe(
      "2026-09-10T10:00:00.000Z",
    )
  })
})

async function sign(secret: string, timestamp: string, rawBody: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  )
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return `sha256=${hex}`
}

describe("handleWebhook", () => {
  const secret = "whsec_topsecret"
  const timestamp = String(Math.floor(Date.now() / 1000))
  const rawBody = '[{"event":"delivered"}]'

  it("returns 401 on a bad signature", async () => {
    const req = new Request("https://example.test/webhook", {
      method: "POST",
      headers: {
        "X-Capsule-Timestamp": timestamp,
        "X-Capsule-Signature": "sha256=deadbeef",
      },
      body: rawBody,
    })
    const received: unknown[] = []
    const res = await handleWebhook(req, {
      secret,
      trigger: async (event) => {
        received.push(event)
      },
    })
    expect(res.status).toBe(401)
    expect(received).toEqual([])
  })

  it("triggers once per event", async () => {
    const signature = await sign(secret, timestamp, rawBody)
    const req = new Request("https://example.test/webhook", {
      method: "POST",
      headers: {
        "X-Capsule-Timestamp": timestamp,
        "X-Capsule-Signature": signature,
      },
      body: rawBody,
    })
    const received: unknown[] = []
    const res = await handleWebhook(req, {
      secret,
      trigger: async (event) => {
        received.push(event)
      },
    })
    expect(res.status).toBe(200)
    expect(received).toEqual([{ event: "delivered" }])
  })
})
