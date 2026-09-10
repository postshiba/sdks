import { NonRetriableError, RetryAfterError } from "inngest"
import { describe, expect, it } from "vitest"

import { handleWebhook, sendEmail } from "./index.js"
import { PostShibaHttpError } from "./http.js"

const config = {
  apiKey: "psk_test_123",
  teamId: "KjkAJW",
  clusterId: "NmQpXr",
}

const step: { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> } = {
  run: async (_id, fn) => fn(),
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("sendEmail", () => {
  it("posts through the step and returns messageId", async () => {
    const impl = (async () =>
      jsonResponse(201, {
        queued: true,
        message_id: "abc123@mail.example.com",
      })) as unknown as typeof fetch

    const original = globalThis.fetch
    globalThis.fetch = impl
    try {
      const result = await sendEmail(step, config, {
        from: "a@example.com",
        to: ["b@example.com"],
        subject: "Hi",
      })
      expect(result).toEqual({
        queued: true,
        messageId: "abc123@mail.example.com",
      })
    } finally {
      globalThis.fetch = original
    }
  })

  it("uses the default step id", async () => {
    const ids: string[] = []
    const trackingStep = {
      run: async <T>(id: string, fn: () => Promise<T>) => {
        ids.push(id)
        return fn()
      },
    }
    const impl = (async () =>
      jsonResponse(201, {
        queued: true,
        message_id: "abc123@mail.example.com",
      })) as unknown as typeof fetch
    const original = globalThis.fetch
    globalThis.fetch = impl
    try {
      await sendEmail(trackingStep, config, {
        from: "a@example.com",
        to: ["b@example.com"],
        subject: "Hi",
      })
      expect(ids).toEqual(["postshiba-send"])
    } finally {
      globalThis.fetch = original
    }
  })

  it("maps throttled to RetryAfterError", async () => {
    const impl = (async () =>
      jsonResponse(429, { error: "throttled" })) as unknown as typeof fetch
    const original = globalThis.fetch
    globalThis.fetch = impl
    try {
      const error = await sendEmail(step, config, {
        from: "a@example.com",
        to: ["b@example.com"],
        subject: "Hi",
      }).catch((err: unknown) => err)
      expect(error).toBeInstanceOf(RetryAfterError)
      expect((error as Error).message).toBe("PostShiba hourly send limit")
    } finally {
      globalThis.fetch = original
    }
  })

  it("maps suppressed to NonRetriableError", async () => {
    const impl = (async () =>
      jsonResponse(403, { error: "suppressed" })) as unknown as typeof fetch
    const original = globalThis.fetch
    globalThis.fetch = impl
    try {
      const error = await sendEmail(step, config, {
        from: "a@example.com",
        to: ["b@example.com"],
        subject: "Hi",
      }).catch((err: unknown) => err)
      expect(error).toBeInstanceOf(NonRetriableError)
      expect(error).not.toBeInstanceOf(PostShibaHttpError)
    } finally {
      globalThis.fetch = original
    }
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
  const rawBody = '[{"event":"delivered"},{"event":"bounce"}]'

  it("returns 401 on a bad signature", async () => {
    const req = new Request("https://example.test/webhook", {
      method: "POST",
      headers: {
        "X-Capsule-Timestamp": timestamp,
        "X-Capsule-Signature": "sha256=deadbeef",
      },
      body: rawBody,
    })
    const sent: unknown[] = []
    const res = await handleWebhook(req, {
      secret,
      inngest: { send: async (events) => sent.push(events) },
    })
    expect(res.status).toBe(401)
    expect(await res.text()).toBe("invalid signature")
    expect(sent).toEqual([])
  })

  it("sends one Inngest event per PostShiba event", async () => {
    const signature = await sign(secret, timestamp, rawBody)
    const req = new Request("https://example.test/webhook", {
      method: "POST",
      headers: {
        "X-Capsule-Timestamp": timestamp,
        "X-Capsule-Signature": signature,
      },
      body: rawBody,
    })
    const sent: Array<{ name: string; data: unknown }> = []
    const res = await handleWebhook(req, {
      secret,
      inngest: { send: async (events) => sent.push(...events) },
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("ok")
    expect(sent).toEqual([
      { name: "postshiba/email.event", data: { event: "delivered" } },
      { name: "postshiba/email.event", data: { event: "bounce" } },
    ])
  })
})
