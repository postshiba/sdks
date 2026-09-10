import { NonRetriableError, RetryAfterError } from 'inngest';

import {
  PostShibaHttpError,
  sendEmail as postSend,
  parseWebhookEvents,
  verifyWebhookSignature,
} from './http.js';
import type { PostShibaHttpConfig, SendRequest, SendResult } from './http.js';

export {
  DEFAULT_BASE_URL,
  DEFAULT_TENANT_SLUG,
  DEFAULT_SIGNATURE_TOLERANCE_SECONDS,
  PostShibaHttpError,
  sendEmail as postSend,
  verifyWebhookSignature,
  parseWebhookEvents,
} from './http.js';
export type {
  UniqueArgValue,
  SendAttachment,
  PostShibaHttpConfig,
  SendRequest,
  SendResult,
} from './http.js';

export type StepRunner = {
  run<T>(id: string, fn: () => Promise<T>): Promise<T>;
};

export async function sendEmail(
  step: StepRunner,
  config: PostShibaHttpConfig,
  req: SendRequest,
  options?: { stepId?: string },
): Promise<SendResult> {
  return step.run(options?.stepId ?? 'postshiba-send', async () => {
    try {
      return await postSend(config, req);
    } catch (err) {
      mapInngestError(err);
    }
  });
}

export function mapInngestError(err: unknown): never {
  if (err instanceof PostShibaHttpError) {
    if (err.code === 'throttled' || err.status === 429) {
      throw new RetryAfterError('PostShiba hourly send limit', '1h');
    }
    if (err.retryable === false) {
      throw new NonRetriableError(err.message);
    }
  }
  throw err;
}

export type InngestSender = {
  send: (events: Array<{ name: string; data: unknown }>) => Promise<unknown>;
};

export async function handleWebhook(
  req: Request,
  options: { secret: string; inngest: InngestSender; event?: string },
): Promise<Response> {
  const rawBody = await req.text();
  const timestamp = req.headers.get('X-Capsule-Timestamp') ?? '';
  const signature = req.headers.get('X-Capsule-Signature') ?? '';
  const ok = await verifyWebhookSignature({
    secret: options.secret,
    timestamp,
    signature,
    rawBody,
  });
  if (!ok) {
    return new Response('invalid signature', { status: 401 });
  }

  const parsed = parseWebhookEvents(rawBody);
  const name = options.event ?? 'postshiba/email.event';
  await options.inngest.send(parsed.map((data) => ({ name, data })));
  return new Response('ok', { status: 200 });
}
