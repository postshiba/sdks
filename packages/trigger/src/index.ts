import { AbortTaskRunError } from "@trigger.dev/sdk";

import {
  PostShibaHttpError,
  sendEmail as postSend,
  parseWebhookEvents,
  verifyWebhookSignature,
} from "./http.js";
import type { PostShibaHttpConfig, SendRequest, SendResult } from "./http.js";

export {
  DEFAULT_BASE_URL,
  DEFAULT_SIGNATURE_TOLERANCE_SECONDS,
  DEFAULT_TENANT_SLUG,
  PostShibaHttpError,
  parseWebhookEvents,
  sendEmail as postSend,
  verifyWebhookSignature,
} from "./http.js";
export type {
  PostShibaHttpConfig,
  SendAttachment,
  SendRequest,
  SendResult,
  UniqueArgValue,
} from "./http.js";

export const defaultRetry = {
  maxAttempts: 10,
  factor: 2,
  minTimeoutInMs: 1000,
  maxTimeoutInMs: 3_600_000,
  randomize: false,
};

export function nextHour(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours() + 1,
      0,
      0,
      0,
    ),
  );
}

export function mapTriggerError(err: unknown): never {
  if (err instanceof PostShibaHttpError && !err.retryable) {
    throw new AbortTaskRunError(err.message);
  }
  throw err;
}

export async function sendEmail(
  config: PostShibaHttpConfig,
  req: SendRequest,
): Promise<SendResult> {
  try {
    return await postSend(config, req);
  } catch (err) {
    mapTriggerError(err);
  }
}

export function catchPostShibaError(
  error: unknown,
  now: Date = new Date(),
): { retryAt: Date } | { skipRetrying: true } | undefined {
  if (error instanceof PostShibaHttpError) {
    if (error.status === 429 || error.code === "throttled") {
      return { retryAt: nextHour(now) };
    }
    if (!error.retryable) {
      return { skipRetrying: true };
    }
  }
  if (error instanceof AbortTaskRunError) {
    return { skipRetrying: true };
  }
  return undefined;
}

export type TriggerEvent = (data: unknown) => Promise<unknown>;

export async function handleWebhook(
  req: Request,
  options: { secret: string; trigger: TriggerEvent },
): Promise<Response> {
  const rawBody = await req.text();
  const timestamp = req.headers.get("X-Capsule-Timestamp") ?? "";
  const signature = req.headers.get("X-Capsule-Signature") ?? "";
  const valid = await verifyWebhookSignature({
    secret: options.secret,
    timestamp,
    signature,
    rawBody,
  });
  if (!valid) {
    return new Response("invalid signature", { status: 401 });
  }

  const events = parseWebhookEvents(rawBody);
  for (const event of events) {
    await options.trigger(event);
  }
  return new Response("ok", { status: 200 });
}
