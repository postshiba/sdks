import { parse } from 'convex-helpers/validators';

import {
  ACCEPTED_EVENT_TYPES,
  CORRELATION_KEY,
  type EmailEvent,
  type EventType,
  type UniqueArgs,
} from './shared.js';

import type { Infer, Validator } from 'convex/values';

export const assertExhaustive = (value: never): never => {
  throw new Error(`Unhandled value: ${value as string}`);
};

export function attemptToParse<T extends Validator<unknown, 'required', never>>(
  validator: T,
  value: unknown,
): { kind: 'success'; data: Infer<T> } | { kind: 'error'; error: unknown } {
  try {
    return { kind: 'success', data: parse(validator, value) };
  } catch (error) {
    return { kind: 'error', error };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

const ACCEPTED: ReadonlySet<string> = new Set(ACCEPTED_EVENT_TYPES);

function asEventType(value: unknown): EventType | undefined {
  return typeof value === 'string' && ACCEPTED.has(value)
    ? (value as EventType)
    : undefined;
}

export function coerceUniqueArgs(value: unknown): UniqueArgs | undefined {
  if (!isRecord(value)) return undefined;
  const out: UniqueArgs = {};
  let found = false;
  for (const [key, raw] of Object.entries(value)) {
    if (
      typeof raw === 'string' ||
      typeof raw === 'boolean' ||
      (typeof raw === 'number' && Number.isFinite(raw))
    ) {
      out[key] = raw;
      found = true;
    }
  }
  return found ? out : undefined;
}

export function stripAngleBrackets(value: string): string {
  return value.replace(/^<|>$/g, '');
}

export function normalizeWebhookEvent(element: unknown): EmailEvent | null {
  if (!isRecord(element)) return null;
  const event = asEventType(element.event);
  if (event === undefined) return null;

  const smtpId = asString(element['smtp-id']);
  const attempt =
    typeof element.attempt === 'string' || typeof element.attempt === 'number'
      ? element.attempt
      : undefined;
  const category = Array.isArray(element.category)
    ? element.category.filter((c): c is string => typeof c === 'string')
    : asString(element.category);

  return {
    event,
    email: asString(element.email),
    timestamp: asNumber(element.timestamp),
    sgEventId: asString(element.sg_event_id),
    sgMessageId: asString(element.sg_message_id),
    smtpId: smtpId === undefined ? undefined : stripAngleBrackets(smtpId),
    reason: asString(element.reason),
    response: asString(element.response),
    status: asString(element.status),
    attempt,
    type: asString(element.type),
    bounceClassification: asString(element.bounce_classification),
    tenantId: asString(element.tenant_id),
    from: asString(element.from),
    subject: asString(element.subject),
    category,
    uniqueArgs: coerceUniqueArgs(element.unique_args),
    raw: element,
  };
}

export function correlationIdFromEvent(event: EmailEvent): string | undefined {
  const nested = event.uniqueArgs?.[CORRELATION_KEY];
  if (typeof nested === 'string' && nested !== '') return nested;
  const raw = event.raw as unknown;
  if (isRecord(raw)) {
    const flat = raw[CORRELATION_KEY];
    if (typeof flat === 'string' && flat !== '') return flat;
  }
  return undefined;
}

export function isTestRecipient(
  address: string,
  testDomains: readonly string[],
): boolean {
  const at = address.lastIndexOf('@');
  if (at === -1) return false;
  const domain = address.slice(at + 1).toLowerCase();
  if (domain === '') return false;
  return testDomains.some((allowed) => {
    const normalized = allowed.toLowerCase();
    return domain === normalized || domain.endsWith(`.${normalized}`);
  });
}
