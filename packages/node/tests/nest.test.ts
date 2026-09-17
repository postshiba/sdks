import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostShiba } from "../src/index.js";
import { POSTSHIBA, PostShibaModule, sendMail } from "../src/nest.js";

describe("PostShibaModule", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("provides a PostShiba client", () => {
    const mod = PostShibaModule.register({ apiKey: "sk_test", teamId: "KjkAJW", baseUrl: "https://api.example.test" });
    expect(mod.exports).toContain(POSTSHIBA);
    const provider = (mod.providers ?? []).find((item) => typeof item === "object" && "provide" in item && item.provide === POSTSHIBA) as {
      useValue: PostShiba;
    };
    expect(provider.useValue).toBeInstanceOf(PostShiba);
    expect(provider.useValue.apiKey).toBe("sk_test");
    expect(provider.useValue.teamId).toBe("KjkAJW");
    expect(provider.useValue.baseUrl).toBe("https://api.example.test");
  });

  it("maps mail fields through emails.send", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ queued: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new PostShiba("sk_test", { teamId: "KjkAJW" });
    await sendMail(client, {
      from: "hello@mail.example.com",
      to: "you@example.com",
      subject: "PostShiba test",
      html: "<p>hello from PostShiba</p>",
      text: "hello from PostShiba",
      attachments: [{ filename: "photo.png", content_type: "image/png", content: "abc" }],
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      from: "hello@mail.example.com",
      to: ["you@example.com"],
      subject: "PostShiba test",
      html: "<p>hello from PostShiba</p>",
      text: "hello from PostShiba",
      attachments: [{ filename: "photo.png", content_type: "image/png", content: "abc" }],
    });
  });

  it("maps display names, replyTo, headers, and unique args", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ queued: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new PostShiba("sk_test", { teamId: "KjkAJW" });
    await sendMail(client, {
      from: "PostShiba <hello@mail.example.com>",
      to: "you@example.com",
      cc: "cc@example.com",
      bcc: ["bcc@example.com"],
      replyTo: "Support <hello@mail.example.com>",
      subject: "PostShiba test",
      headers: {
        "Message-ID": "<msg-1@mail.example.com>",
        "In-Reply-To": "<orig@mail.example.com>",
        References: "<orig@mail.example.com>",
        "X-Campaign": "cmp_123",
        "X-Capsule-Unique-Args": '{"campaign_id":"cmp_123","site":"docs"}',
      },
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      from: "PostShiba <hello@mail.example.com>",
      to: ["you@example.com"],
      cc: ["cc@example.com"],
      bcc: ["bcc@example.com"],
      reply_to: "Support <hello@mail.example.com>",
      subject: "PostShiba test",
      headers: {
        "Message-ID": "<msg-1@mail.example.com>",
        "In-Reply-To": "<orig@mail.example.com>",
        References: "<orig@mail.example.com>",
        "X-Campaign": "cmp_123",
      },
      unique_args: { campaign_id: "cmp_123", site: "docs" },
    });
  });
});
