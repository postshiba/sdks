export const DEFAULT_BASE_URL = 'https://app.postshiba.com';

/** Tenant-less sends can return `{queued: false}`; the platform still requires a tenant on every POST. */
export const DEFAULT_TENANT_SLUG = 'default';

export const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300;

export type UniqueArgValue = string | number | boolean;

export type SendAttachment = {
  filename: string;
  contentType: string;
  content: string;
};

export type PostShibaHttpConfig = {
  apiKey: string;
  teamId: string;
  clusterId: string;
  baseUrl?: string;
};

export type SendRequest = {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  uniqueArgs?: Record<string, UniqueArgValue>;
  tenant?: string;
  idempotencyKey?: string;
  sandbox?: boolean;
  attachments?: SendAttachment[];
};

export type SendResult = {
  queued: boolean;
  messageId: string;
};

export class PostShibaHttpError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryable: boolean;
  readonly body: string;

  constructor(args: {
    message: string;
    status: number;
    code?: string;
    retryable: boolean;
    body: string;
  }) {
    super(args.message);
    this.name = 'PostShibaHttpError';
    this.status = args.status;
    this.code = args.code;
    this.retryable = args.retryable;
    this.body = args.body;
  }
}

const PERMANENT_STATUSES = new Set([
  400, 401, 403, 404, 405, 406, 409, 410, 413, 415, 422,
]);

function sendsUrl(config: PostShibaHttpConfig): string {
  const base = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  return `${base}/api/v1/teams/${config.teamId}/clusters/${config.clusterId}/sends`;
}

function replyToScalar(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value === '' ? undefined : value;
  return value.find((item) => item !== '');
}

function buildSendBody(req: SendRequest): string {
  const body: Record<string, unknown> = {
    from: req.from,
    to: req.to,
    subject: req.subject,
  };
  if (req.cc !== undefined && req.cc.length > 0) body.cc = req.cc;
  if (req.bcc !== undefined && req.bcc.length > 0) body.bcc = req.bcc;
  const replyTo = replyToScalar(req.replyTo);
  if (replyTo !== undefined) body.reply_to = replyTo;
  if (req.html !== undefined) body.html = req.html;
  if (req.text !== undefined) body.text = req.text;
  if (req.headers !== undefined) body.headers = req.headers;
  if (req.uniqueArgs !== undefined) body.unique_args = req.uniqueArgs;
  body.tenant = req.tenant ?? DEFAULT_TENANT_SLUG;
  if (req.sandbox !== undefined) body.sandbox = req.sandbox;
  if (req.attachments !== undefined && req.attachments.length > 0) {
    body.attachments = req.attachments.map((attachment) => ({
      filename: attachment.filename,
      content_type: attachment.contentType,
      content: attachment.content,
    }));
  }
  return JSON.stringify(body);
}

function readErrorCode(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { error?: unknown }).error === 'string'
    ) {
      return (parsed as { error: string }).error;
    }
  } catch {
  }
  return undefined;
}

export async function sendEmail(
  config: PostShibaHttpConfig,
  req: SendRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (req.idempotencyKey !== undefined) {
    headers['Idempotency-Key'] = req.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetchImpl(sendsUrl(config), {
      method: 'POST',
      headers,
      body: buildSendBody(req),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PostShibaHttpError({
      message: `PostShiba request failed: ${message}`,
      status: 0,
      retryable: true,
      body: message,
    });
  }

  const body = await response.text();

  if (!response.ok) {
    const code = readErrorCode(body);
    throw new PostShibaHttpError({
      message: `PostShiba send failed with ${response.status}${
        code ? ` (${code})` : ''
      }: ${body}`,
      status: response.status,
      code,
      retryable: !PERMANENT_STATUSES.has(response.status),
      body,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = undefined;
  }
  const messageId =
    typeof parsed === 'object' &&
    parsed !== null &&
    typeof (parsed as { message_id?: unknown }).message_id === 'string'
      ? (parsed as { message_id: string }).message_id
      : undefined;

  if (messageId === undefined) {
    throw new PostShibaHttpError({
      message: `PostShiba send returned ${response.status} without a message_id: ${body}`,
      status: response.status,
      retryable: true,
      body,
    });
  }

  const queued =
    typeof parsed === 'object' &&
    parsed !== null &&
    typeof (parsed as { queued?: unknown }).queued === 'boolean'
      ? (parsed as { queued: boolean }).queued
      : true;

  return { queued, messageId };
}

function toHex(buffer: ArrayBuffer): string {
  let out = '';
  for (const byte of new Uint8Array(buffer)) {
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyWebhookSignature(args: {
  secret: string;
  timestamp: string;
  signature: string;
  rawBody: string;
  toleranceSeconds?: number;
  now?: number;
}): Promise<boolean> {
  if (args.secret === '' || args.signature === '') return false;
  if (!args.signature.startsWith('sha256=')) return false;

  const seconds = Number(args.timestamp);
  if (!Number.isFinite(seconds)) return false;

  const tolerance =
    args.toleranceSeconds ?? DEFAULT_SIGNATURE_TOLERANCE_SECONDS;
  const nowSeconds = (args.now ?? Date.now()) / 1000;
  if (Math.abs(nowSeconds - seconds) > tolerance) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(args.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${args.timestamp}.${args.rawBody}`),
  );

  return timingSafeEqual(
    args.signature.slice('sha256='.length).toLowerCase(),
    toHex(mac),
  );
}

export function parseWebhookEvents(rawBody: string): unknown[] {
  const parsed: unknown = JSON.parse(rawBody);
  if (!Array.isArray(parsed)) {
    throw new Error('PostShiba webhook body must be a JSON array of events');
  }
  return parsed;
}
