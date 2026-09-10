import { describe, expect, it } from 'vitest';

import {
  PostShibaHttpError,
  parseWebhookEvents,
  sendEmail,
  verifyWebhookSignature,
} from './http.js';

const config = {
  apiKey: 'psk_test_123',
  teamId: 'team_abc',
  clusterId: 'cluster_xyz',
};

type Captured = { url: string; init: RequestInit };

function captureFetch(response: Response) {
  const calls: Captured[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return response;
  }) as unknown as typeof fetch;
  return { calls, impl };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function okResponse() {
  return jsonResponse(201, {
    queued: true,
    message_id: 'abc123@mail.example.com',
  });
}

describe('sendEmail', () => {
  it('posts to the cluster sends endpoint with a bearer token', async () => {
    const { calls, impl } = captureFetch(okResponse());

    await sendEmail(
      config,
      { from: 'a@example.com', to: ['b@example.com'], subject: 'Hi' },
      impl,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      'https://app.postshiba.com/api/v1/teams/team_abc/clusters/cluster_xyz/sends',
    );
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(calls[0]!.init.method).toBe('POST');
    expect(headers.Authorization).toBe('Bearer psk_test_123');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Idempotency-Key']).toBeUndefined();
  });

  it('honours a custom base url without doubling slashes', async () => {
    const { calls, impl } = captureFetch(okResponse());

    await sendEmail(
      { ...config, baseUrl: 'https://eu.postshiba.test/' },
      { from: 'a@example.com', to: ['b@example.com'], subject: 'Hi' },
      impl,
    );

    expect(calls[0]!.url).toBe(
      'https://eu.postshiba.test/api/v1/teams/team_abc/clusters/cluster_xyz/sends',
    );
  });

  it('sends an Idempotency-Key header when one is supplied', async () => {
    const { calls, impl } = captureFetch(okResponse());

    await sendEmail(
      config,
      {
        from: 'a@example.com',
        to: ['b@example.com'],
        subject: 'Hi',
        idempotencyKey: 'email_1234',
      },
      impl,
    );

    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('email_1234');
  });

  it('posts a flat body with snake_case fields', async () => {
    const { calls, impl } = captureFetch(okResponse());

    await sendEmail(
      config,
      {
        from: 'a@example.com',
        to: ['b@example.com'],
        cc: ['c@example.com'],
        bcc: ['d@example.com'],
        replyTo: ['reply@example.com'],
        subject: 'Hi',
        html: '<p>Hi</p>',
        text: 'Hi',
        headers: { 'X-Entity': '1' },
        uniqueArgs: { convex_email_id: 'email_1234', attempt: 1, live: true },
        tenant: 'tenant_a',
        sandbox: true,
      },
      impl,
    );

    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body).toEqual({
      from: 'a@example.com',
      to: ['b@example.com'],
      cc: ['c@example.com'],
      bcc: ['d@example.com'],
      reply_to: 'reply@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
      headers: { 'X-Entity': '1' },
      unique_args: { convex_email_id: 'email_1234', attempt: 1, live: true },
      tenant: 'tenant_a',
      sandbox: true,
    });
    expect('send' in body).toBe(false);
  });

  it('omits absent optional fields entirely', async () => {
    const { calls, impl } = captureFetch(okResponse());

    await sendEmail(
      config,
      { from: 'a@example.com', to: ['b@example.com'], subject: 'Hi' },
      impl,
    );

    const body = JSON.parse(calls[0]!.init.body as string);
    expect(Object.keys(body).sort()).toEqual(['from', 'subject', 'tenant', 'to']);
    expect('send' in body).toBe(false);
  });

  it('names the default tenant when the caller gives none', async () => {
    const { calls, impl } = captureFetch(okResponse());

    await sendEmail(
      config,
      { from: 'a@example.com', to: ['b@example.com'], subject: 'Hi' },
      impl,
    );

    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.tenant).toBe('default');
  });

  it('posts attachments with content_type', async () => {
    const { calls, impl } = captureFetch(okResponse());

    await sendEmail(
      config,
      {
        from: 'a@example.com',
        to: ['b@example.com'],
        subject: 'Hi',
        text: 'Hi',
        attachments: [
          {
            filename: 'photo.png',
            contentType: 'image/png',
            content: 'abc123',
          },
        ],
      },
      impl,
    );

    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.attachments).toEqual([
      { filename: 'photo.png', content_type: 'image/png', content: 'abc123' },
    ]);
    expect('send' in body).toBe(false);
  });

  it('maps a 201 queued response to a SendResult', async () => {
    const { impl } = captureFetch(okResponse());

    const result = await sendEmail(
      config,
      { from: 'a@example.com', to: ['b@example.com'], subject: 'Hi' },
      impl,
    );

    expect(result).toEqual({
      queued: true,
      messageId: 'abc123@mail.example.com',
    });
  });

  it('throws a permanent error for a 403 suppressed response', async () => {
    const { impl } = captureFetch(jsonResponse(403, { error: 'suppressed' }));

    const error = await sendEmail(
      config,
      { from: 'a@example.com', to: ['b@example.com'], subject: 'Hi' },
      impl,
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PostShibaHttpError);
    const httpError = error as PostShibaHttpError;
    expect(httpError.status).toBe(403);
    expect(httpError.code).toBe('suppressed');
    expect(httpError.retryable).toBe(false);
    expect(httpError.body).toContain('suppressed');
  });

  it('treats 409 and 422 as permanent', async () => {
    for (const status of [409, 422]) {
      const { impl } = captureFetch(
        jsonResponse(status, { error: 'idempotency_conflict' }),
      );
      const error = (await sendEmail(
        config,
        { from: 'a@example.com', to: ['b@example.com'], subject: 'Hi' },
        impl,
      ).catch((e: unknown) => e)) as PostShibaHttpError;
      expect(error.status).toBe(status);
      expect(error.retryable).toBe(false);
    }
  });

  it('treats 429 as retryable', async () => {
    const { impl } = captureFetch(jsonResponse(429, { error: 'throttled' }));

    const error = (await sendEmail(
      config,
      { from: 'a@example.com', to: ['b@example.com'], subject: 'Hi' },
      impl,
    ).catch((e: unknown) => e)) as PostShibaHttpError;

    expect(error.status).toBe(429);
    expect(error.code).toBe('throttled');
    expect(error.retryable).toBe(true);
  });

  it('treats 503 as retryable', async () => {
    const { impl } = captureFetch(
      new Response('upstream down', { status: 503 }),
    );

    const error = (await sendEmail(
      config,
      { from: 'a@example.com', to: ['b@example.com'], subject: 'Hi' },
      impl,
    ).catch((e: unknown) => e)) as PostShibaHttpError;

    expect(error.status).toBe(503);
    expect(error.retryable).toBe(true);
  });

  it('rethrows a network failure as a retryable error', async () => {
    const impl = (async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;

    const error = (await sendEmail(
      config,
      { from: 'a@example.com', to: ['b@example.com'], subject: 'Hi' },
      impl,
    ).catch((e: unknown) => e)) as PostShibaHttpError;

    expect(error).toBeInstanceOf(PostShibaHttpError);
    expect(error.retryable).toBe(true);
    expect(error.status).toBe(0);
    expect(error.message).toContain('network down');
  });

  it('throws a retryable error when a 2xx body is not the expected shape', async () => {
    const { impl } = captureFetch(jsonResponse(201, { queued: true }));

    const error = (await sendEmail(
      config,
      { from: 'a@example.com', to: ['b@example.com'], subject: 'Hi' },
      impl,
    ).catch((e: unknown) => e)) as PostShibaHttpError;

    expect(error).toBeInstanceOf(PostShibaHttpError);
    expect(error.retryable).toBe(true);
  });

  it('posts catalog email_send_request fields as a flat body', async () => {
    const { calls, impl } = captureFetch(okResponse());

    await sendEmail(
      config,
      {
        from: 'hello@mail.example.com',
        to: ['you@example.com'],
        replyTo: 'hello@mail.example.com',
        subject: 'PostShiba test',
        text: 'hello from PostShiba',
        html: '<p>hello from PostShiba</p>',
        headers: { 'X-Campaign': 'cmp_123' },
        uniqueArgs: { campaign_id: 'cmp_123', site: 'docs' },
        tenant: 'default',
        attachments: [
          {
            filename: 'photo.png',
            contentType: 'image/png',
            content:
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          },
        ],
      },
      impl,
    );

    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.from).toBe('hello@mail.example.com');
    expect(body.to).toEqual(['you@example.com']);
    expect(body.reply_to).toBe('hello@mail.example.com');
    expect(body.subject).toBe('PostShiba test');
    expect(body.text).toBe('hello from PostShiba');
    expect(body.html).toBe('<p>hello from PostShiba</p>');
    expect(body.headers).toEqual({ 'X-Campaign': 'cmp_123' });
    expect(body.unique_args).toEqual({ campaign_id: 'cmp_123', site: 'docs' });
    expect(body.tenant).toBe('default');
    expect(body.attachments).toEqual([
      {
        filename: 'photo.png',
        content_type: 'image/png',
        content:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      },
    ]);
    expect('send' in body).toBe(false);
  });
});

const SECRET = 'whsec_topsecret';

async function sign(secret: string, timestamp: string, rawBody: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hex}`;
}

describe('verifyWebhookSignature', () => {
  const now = 1_700_000_000_000;
  const timestamp = String(Math.floor(now / 1000));
  const rawBody = '[{"event":"delivered"}]';

  it('accepts a valid signature', async () => {
    const signature = await sign(SECRET, timestamp, rawBody);
    await expect(
      verifyWebhookSignature({
        secret: SECRET,
        timestamp,
        signature,
        rawBody,
        now,
      }),
    ).resolves.toBe(true);
  });

  it('accepts the catalog webhook_verify fixture', async () => {
    const catalogNow = 1_710_000_000_000;
    await expect(
      verifyWebhookSignature({
        secret: 'hex-secret',
        timestamp: '1710000000',
        signature:
          'sha256=3417573cd592bd88f560e3528d0a6a00f86d8076c170eac6361938099f8547fa',
        rawBody: '[{"event":"delivered"}]',
        now: catalogNow,
      }),
    ).resolves.toBe(true);
  });

  it('rejects a signature made with a different secret', async () => {
    const signature = await sign('whsec_other', timestamp, rawBody);
    await expect(
      verifyWebhookSignature({
        secret: SECRET,
        timestamp,
        signature,
        rawBody,
        now,
      }),
    ).resolves.toBe(false);
  });

  it('rejects a tampered body', async () => {
    const signature = await sign(SECRET, timestamp, rawBody);
    await expect(
      verifyWebhookSignature({
        secret: SECRET,
        timestamp,
        signature,
        rawBody: '[{"event":"bounce"}]',
        now,
      }),
    ).resolves.toBe(false);
  });

  it('rejects a stale timestamp outside the tolerance', async () => {
    const stale = String(Math.floor(now / 1000) - 400);
    const signature = await sign(SECRET, stale, rawBody);
    await expect(
      verifyWebhookSignature({
        secret: SECRET,
        timestamp: stale,
        signature,
        rawBody,
        now,
      }),
    ).resolves.toBe(false);
  });

  it('accepts a stale timestamp when the tolerance is widened', async () => {
    const stale = String(Math.floor(now / 1000) - 400);
    const signature = await sign(SECRET, stale, rawBody);
    await expect(
      verifyWebhookSignature({
        secret: SECRET,
        timestamp: stale,
        signature,
        rawBody,
        toleranceSeconds: 600,
        now,
      }),
    ).resolves.toBe(true);
  });

  it('rejects a future timestamp outside the tolerance', async () => {
    const future = String(Math.floor(now / 1000) + 400);
    const signature = await sign(SECRET, future, rawBody);
    await expect(
      verifyWebhookSignature({
        secret: SECRET,
        timestamp: future,
        signature,
        rawBody,
        now,
      }),
    ).resolves.toBe(false);
  });

  it('requires the sha256= prefix', async () => {
    const signature = await sign(SECRET, timestamp, rawBody);
    await expect(
      verifyWebhookSignature({
        secret: SECRET,
        timestamp,
        signature: signature.replace('sha256=', ''),
        rawBody,
        now,
      }),
    ).resolves.toBe(false);
  });

  it('rejects a non numeric timestamp', async () => {
    const signature = await sign(SECRET, 'not-a-number', rawBody);
    await expect(
      verifyWebhookSignature({
        secret: SECRET,
        timestamp: 'not-a-number',
        signature,
        rawBody,
        now,
      }),
    ).resolves.toBe(false);
  });

  it('rejects a signature of a different length without throwing', async () => {
    await expect(
      verifyWebhookSignature({
        secret: SECRET,
        timestamp,
        signature: 'sha256=abcd',
        rawBody,
        now,
      }),
    ).resolves.toBe(false);
  });

  it('rejects an empty secret', async () => {
    const signature = await sign(SECRET, timestamp, rawBody);
    await expect(
      verifyWebhookSignature({
        secret: '',
        timestamp,
        signature,
        rawBody,
        now,
      }),
    ).resolves.toBe(false);
  });
});

describe('parseWebhookEvents', () => {
  it('returns the array of events', () => {
    expect(
      parseWebhookEvents('[{"event":"delivered"},{"event":"bounce"}]'),
    ).toEqual([{ event: 'delivered' }, { event: 'bounce' }]);
  });

  it('throws when the body is a bare object', () => {
    expect(() => parseWebhookEvents('{"event":"delivered"}')).toThrow(/array/i);
  });

  it('throws when the body is not valid JSON', () => {
    expect(() => parseWebhookEvents('not json')).toThrow();
  });
});
