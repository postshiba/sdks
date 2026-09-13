import { RateLimiter } from '@convex-dev/rate-limiter';
import { Workpool } from '@convex-dev/workpool';
import { omit } from 'convex-helpers';
import { v } from 'convex/values';

import {
  PostShibaHttpError,
  sendEmail as httpSendEmail,
  type UniqueArgValue,
} from '../http/index.js';
import { api, components, internal } from './_generated/api.js';
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  query,
  type QueryCtx,
} from './_generated/server.js';
import schema from './schema.js';
import {
  CORRELATION_KEY,
  type EmailEvent,
  RESERVED_UNIQUE_ARG_KEYS,
  type RuntimeConfig,
  type Status,
  vOptions,
  vPriority,
  vStatus,
  vTemplate,
  vUniqueArgs,
} from './shared.js';
import {
  correlationIdFromEvent,
  isTestRecipient,
  normalizeWebhookEvent,
} from './utils.js';

import type { Doc, Id } from './_generated/dataModel.js';
import type { FunctionHandle } from 'convex/server';

const HOUR = 60 * 60 * 1000;

const FINALIZED_EPOCH = Number.MAX_SAFE_INTEGER;

const FINALIZED_EMAIL_RETENTION_MS = 1000 * 60 * 60 * 24 * 7;
const ABANDONED_EMAIL_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;

/**
 * Batches are sized in rows but paid for in bytes: each deleted email also
 * drops up to two content docs of up to 1 MB each plus its delivery events.
 * Both sweeps start from the oldest rows, so a batch that exceeds the
 * transaction read budget fails on the same rows every night and retention
 * stalls permanently rather than merely falling behind.
 */
const CLEANUP_BATCH_SIZE = 50;
const ABANDONED_BATCH_SIZE = 50;

const SEND_POOL_SIZE = 4;
const CALLBACK_POOL_SIZE = 4;

const RATE_LIMIT_JITTER_MS = 100;

const transactionalPool = new Workpool(components.transactionalPool, {
  maxParallelism: SEND_POOL_SIZE,
});
const bulkPool = new Workpool(components.bulkPool, {
  maxParallelism: SEND_POOL_SIZE,
});

const callbackPool = new Workpool(components.callbackPool, {
  maxParallelism: CALLBACK_POOL_SIZE,
});

function poolFor(priority: 'transactional' | 'bulk') {
  return priority === 'bulk' ? bulkPool : transactionalPool;
}

function rateLimiterFor(options: RuntimeConfig) {
  const transactionalRate = Math.max(1, options.hourlyLimit);
  const bulkRate = Math.max(1, transactionalRate * options.bulkShare);
  return new RateLimiter(components.rateLimiter, {
    transactional: {
      kind: 'token bucket',
      rate: transactionalRate,
      period: HOUR,
      capacity: Math.max(1, Math.round(transactionalRate * 0.25)),
    },
    bulk: {
      kind: 'token bucket',
      rate: bulkRate,
      period: HOUR,
      capacity: Math.max(1, Math.round(bulkRate * 0.25)),
    },
  });
}

async function reserveSendSlot(
  ctx: MutationCtx,
  options: RuntimeConfig,
  priority: 'transactional' | 'bulk',
): Promise<number> {
  const limiter = rateLimiterFor(options);
  const reservation = await limiter.limit(ctx, priority, { reserve: true });
  if (!reservation.retryAfter) return 0;
  return reservation.retryAfter + Math.random() * RATE_LIMIT_JITTER_MS;
}

async function upsertOptions(ctx: MutationCtx, options: RuntimeConfig) {
  const existing = await ctx.db.query('lastOptions').unique();
  if (!existing) {
    await ctx.db.insert('lastOptions', { options });
    return;
  }
  if (JSON.stringify(existing.options) !== JSON.stringify(options)) {
    await ctx.db.replace('lastOptions', existing._id, { options });
  }
}

async function requireOptions(ctx: QueryCtx): Promise<RuntimeConfig> {
  const stored = await ctx.db.query('lastOptions').unique();
  if (!stored) {
    throw new Error('No stored options. Send an email before running this.');
  }
  return stored.options;
}

const vHeaders = v.array(v.object({ name: v.string(), value: v.string() }));
const vAttachments = v.array(
  v.object({
    filename: v.string(),
    contentType: v.string(),
    content: v.string(),
  }),
);

export const sendEmail = mutation({
  args: {
    options: vOptions,
    from: v.string(),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    subject: v.string(),
    html: v.optional(v.string()),
    text: v.optional(v.string()),
    template: v.optional(vTemplate),
    replyTo: v.optional(v.array(v.string())),
    headers: v.optional(vHeaders),
    uniqueArgs: v.optional(vUniqueArgs),
    tenant: v.optional(v.string()),
    attachments: v.optional(vAttachments),
    priority: v.optional(vPriority),
  },
  returns: v.id('emails'),
  handler: async (ctx, args) => {
    const priority = args.priority ?? 'transactional';
    const options = args.options;

    if (options.testMode) {
      const recipients = [...args.to, ...(args.cc ?? []), ...(args.bcc ?? [])];
      for (const recipient of recipients) {
        if (!isTestRecipient(recipient, options.testDomains)) {
          throw new Error(
            `Test mode is on, so ${recipient} was refused. Allowed test domains: ${options.testDomains.join(
              ', ',
            )}. Set testMode: false to send to real recipients.`,
          );
        }
      }
    }

    if (args.to.length === 0) {
      throw new Error('At least one recipient is required');
    }
    if (
      args.template === undefined &&
      args.html === undefined &&
      args.text === undefined
    ) {
      throw new Error('Either html, text, or template must be provided');
    }
    if (args.template === undefined && args.subject.trim() === '') {
      throw new Error('Subject is required');
    }

    let htmlContentId: Id<'content'> | undefined;
    if (args.html !== undefined) {
      htmlContentId = await ctx.db.insert('content', {
        content: new TextEncoder().encode(args.html).buffer,
        mimeType: 'text/html',
      });
    }
    let textContentId: Id<'content'> | undefined;
    if (args.text !== undefined) {
      textContentId = await ctx.db.insert('content', {
        content: new TextEncoder().encode(args.text).buffer,
        mimeType: 'text/plain',
      });
    }

    const emailId = await ctx.db.insert('emails', {
      from: args.from,
      to: args.to,
      cc: args.cc,
      bcc: args.bcc,
      subject: args.subject,
      replyTo: args.replyTo ?? [],
      headers: args.headers,
      uniqueArgs: args.uniqueArgs,
      tenant: args.tenant,
      attachments: args.attachments,
      priority,
      html: htmlContentId,
      text: textContentId,
      template: args.template,
      status: 'queued',
      bounced: false,
      complained: false,
      failed: false,
      deliveryDelayed: false,
      dropped: false,
      unsubscribed: false,
      opened: false,
      clicked: false,
      finalizedAt: FINALIZED_EPOCH,
    });

    await upsertOptions(ctx, options);

    const runAfter = await reserveSendSlot(ctx, options, priority);
    const workId = await poolFor(priority).enqueueAction(
      ctx,
      internal.lib.deliver,
      { emailId },
      {
        retry: {
          maxAttempts: options.retryAttempts,
          initialBackoffMs: options.initialBackoffMs,
          base: 2,
        },
        runAfter,
        context: { emailId },
        onComplete: internal.lib.onDeliverComplete,
      },
    );

    await ctx.db.patch('emails', emailId, { workId });
    return emailId;
  },
});

const vDeliveryPayload = v.union(
  v.null(),
  v.object({
    from: v.string(),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    replyTo: v.array(v.string()),
    subject: v.string(),
    headers: v.optional(vHeaders),
    uniqueArgs: v.optional(vUniqueArgs),
    tenant: v.optional(v.string()),
    attachments: v.optional(vAttachments),
    html: v.optional(v.string()),
    text: v.optional(v.string()),
    template: v.optional(vTemplate),
    options: vOptions,
  }),
);

export const getDeliveryPayload = internalQuery({
  args: { emailId: v.id('emails') },
  returns: vDeliveryPayload,
  handler: async (ctx, args) => {
    const email = await ctx.db.get('emails', args.emailId);
    if (!email || email.status !== 'queued') return null;

    const options = await requireOptions(ctx);
    const html = email.html
      ? await ctx.db.get('content', email.html)
      : undefined;
    const text = email.text
      ? await ctx.db.get('content', email.text)
      : undefined;

    return {
      from: email.from,
      to: email.to,
      cc: email.cc,
      bcc: email.bcc,
      replyTo: email.replyTo,
      subject: email.subject,
      headers: email.headers,
      uniqueArgs: email.uniqueArgs,
      tenant: email.tenant,
      attachments: email.attachments,
      html: html ? new TextDecoder().decode(html.content) : undefined,
      text: text ? new TextDecoder().decode(text.content) : undefined,
      template: email.template,
      options,
    };
  },
});

const RESERVED: ReadonlySet<string> = new Set(RESERVED_UNIQUE_ARG_KEYS);

function buildUniqueArgs(
  emailId: Id<'emails'>,
  supplied: Record<string, UniqueArgValue> | undefined,
): Record<string, UniqueArgValue> {
  const out: Record<string, UniqueArgValue> = {};
  for (const [key, value] of Object.entries(supplied ?? {})) {
    if (RESERVED.has(key) || key === CORRELATION_KEY) continue;
    out[key] = value;
  }
  out[CORRELATION_KEY] = emailId;
  return out;
}

const vDeliverResult = v.union(
  v.null(),
  v.object({
    emailId: v.id('emails'),
    providerMessageId: v.string(),
  }),
);

export const deliver = internalAction({
  args: { emailId: v.id('emails') },
  returns: vDeliverResult,
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(internal.lib.getDeliveryPayload, {
      emailId: args.emailId,
    });
    if (payload === null) return null;

    const { options } = payload;

    try {
      const result = await httpSendEmail(
        {
          apiKey: options.apiKey,
          teamId: options.teamId,
          clusterId: options.clusterId,
          baseUrl: options.baseUrl,
        },
        {
          from: payload.from,
          to: payload.to,
          cc: payload.cc,
          bcc: payload.bcc,
          replyTo: payload.replyTo.length > 0 ? payload.replyTo : undefined,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          template: payload.template,
          headers: payload.headers
            ? Object.fromEntries(payload.headers.map((h) => [h.name, h.value]))
            : undefined,
          uniqueArgs: buildUniqueArgs(args.emailId, payload.uniqueArgs),
          tenant: payload.tenant,
          attachments: payload.attachments,
          idempotencyKey: args.emailId,
        },
      );
      if (!result.queued) {
        await ctx.runMutation(internal.lib.markFailed, {
          emailId: args.emailId,
          errorMessage: `PostShiba accepted the request but did not queue it (message_id ${result.messageId})`,
          errorCode: 'not_queued',
        });
        return null;
      }
      return {
        emailId: args.emailId,
        providerMessageId: result.messageId,
      };
    } catch (error) {
      if (error instanceof PostShibaHttpError && !error.retryable) {
        console.error(
          JSON.stringify({
            status: 'permanent_failure',
            httpStatus: error.status,
            code: error.code,
            emailId: args.emailId,
          }),
        );
        await ctx.runMutation(internal.lib.markFailed, {
          emailId: args.emailId,
          errorMessage: error.message,
          errorCode: error.code,
        });
        return null;
      }
      throw error;
    }
  },
});

async function markFailedHandler(
  ctx: MutationCtx,
  args: { emailId: Id<'emails'>; errorMessage: string; errorCode?: string },
) {
  const email = await ctx.db.get('emails', args.emailId);
  if (!email || email.status !== 'queued') return;
  await ctx.db.patch('emails', args.emailId, {
    status: 'failed',
    failed: true,
    errorMessage: args.errorMessage,
    errorCode: args.errorCode,
    finalizedAt: Date.now(),
  });
}

export const markFailed = internalMutation({
  args: {
    emailId: v.id('emails'),
    errorMessage: v.string(),
    errorCode: v.optional(v.string()),
  },
  returns: v.null(),
  handler: markFailedHandler,
});

export const onDeliverComplete = transactionalPool.defineOnComplete({
  context: v.object({ emailId: v.id('emails') }),
  handler: async (ctx, args) => {
    const emailId = args.context.emailId;
    if (args.result.kind === 'success') {
      const value = args.result.returnValue as {
        providerMessageId?: unknown;
      } | null;
      const providerMessageId =
        value && typeof value.providerMessageId === 'string'
          ? value.providerMessageId
          : undefined;
      if (providerMessageId === undefined) return;
      const email = await ctx.db.get('emails', emailId);
      if (!email || email.status === 'cancelled') return;
      const patch: Partial<Doc<'emails'>> = {};
      if (email.providerMessageId !== providerMessageId) {
        patch.providerMessageId = providerMessageId;
      }
      if (email.status === 'queued') patch.status = 'sent';
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch('emails', emailId, patch);
      }
      return;
    }
    if (args.result.kind === 'failed') {
      await markFailedHandler(ctx, {
        emailId,
        errorMessage: args.result.error,
      });
      return;
    }
    const email = await ctx.db.get('emails', emailId);
    if (!email || email.status !== 'queued') return;
    await ctx.db.patch('emails', emailId, {
      status: 'cancelled',
      errorMessage: 'Delivery was cancelled before it was sent',
      finalizedAt: Date.now(),
    });
  },
});

export const cancelEmail = mutation({
  args: { emailId: v.id('emails') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const email = await ctx.db.get('emails', args.emailId);
    if (!email) throw new Error('Email not found');
    if (email.status !== 'queued') {
      throw new Error('Email has already been sent');
    }
    await ctx.db.patch('emails', args.emailId, {
      status: 'cancelled',
      finalizedAt: Date.now(),
    });
  },
});

export const getStatus = query({
  args: { emailId: v.id('emails') },
  returns: v.union(
    v.object({
      status: vStatus,
      errorMessage: v.union(v.string(), v.null()),
      errorCode: v.union(v.string(), v.null()),
      bounced: v.boolean(),
      complained: v.boolean(),
      failed: v.boolean(),
      deliveryDelayed: v.boolean(),
      dropped: v.boolean(),
      unsubscribed: v.boolean(),
      opened: v.boolean(),
      clicked: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const email = await ctx.db.get('emails', args.emailId);
    if (!email) return null;
    return {
      status: email.status,
      errorMessage: email.errorMessage ?? null,
      errorCode: email.errorCode ?? null,
      bounced: email.bounced,
      complained: email.complained,
      failed: email.failed,
      deliveryDelayed: email.deliveryDelayed,
      dropped: email.dropped,
      unsubscribed: email.unsubscribed,
      opened: email.opened,
      clicked: email.clicked,
    };
  },
});

export const get = query({
  args: { emailId: v.id('emails') },
  returns: v.union(
    v.object({
      ...omit(schema.tables.emails.validator.fields, ['html', 'text']),
      createdAt: v.number(),
      html: v.optional(v.string()),
      text: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const email = await ctx.db.get('emails', args.emailId);
    if (!email) return null;
    const html = email.html
      ? await ctx.db.get('content', email.html)
      : undefined;
    const text = email.text
      ? await ctx.db.get('content', email.text)
      : undefined;
    return {
      ...omit(email, ['html', 'text', '_id', '_creationTime']),
      createdAt: email._creationTime,
      html: html ? new TextDecoder().decode(html.content) : undefined,
      text: text ? new TextDecoder().decode(text.content) : undefined,
    };
  },
});

const STATUS_RANK: Record<Status, number> = {
  queued: 1,
  sent: 2,
  delivery_delayed: 3,
  delivered: 4,
  bounced: 5,
  failed: 5,
  cancelled: 100,
};

const TERMINAL_STATUSES: ReadonlySet<Status> = new Set<Status>([
  'delivered',
  'bounced',
  'failed',
  'cancelled',
]);

type EmailPatch = Partial<Doc<'emails'>>;

function upgradeStatus(
  email: Doc<'emails'>,
  patch: EmailPatch,
  next: Status,
): void {
  if (email.status === 'cancelled') return;
  if (STATUS_RANK[next] <= STATUS_RANK[email.status]) return;
  patch.status = next;
  if (TERMINAL_STATUSES.has(next)) {
    patch.finalizedAt = Date.now();
  }
}

function patchForEvent(email: Doc<'emails'>, event: EmailEvent): EmailPatch {
  const patch: EmailPatch = {};
  switch (event.event) {
    case 'processed':
      upgradeStatus(email, patch, 'sent');
      break;
    case 'delivered':
      upgradeStatus(email, patch, 'delivered');
      break;
    case 'deferred':
      if (!email.deliveryDelayed) patch.deliveryDelayed = true;
      upgradeStatus(email, patch, 'delivery_delayed');
      break;
    case 'bounce': {
      if (!email.bounced) patch.bounced = true;
      const message = event.reason ?? event.response;
      if (message !== undefined && email.errorMessage !== message) {
        patch.errorMessage = message;
      }
      upgradeStatus(email, patch, 'bounced');
      break;
    }
    case 'dropped': {
      if (!email.dropped) patch.dropped = true;
      if (!email.failed) patch.failed = true;
      const message = event.reason ?? event.response;
      if (message !== undefined && email.errorMessage !== message) {
        patch.errorMessage = message;
      }
      upgradeStatus(email, patch, 'failed');
      break;
    }
    case 'spamreport':
      if (!email.complained) patch.complained = true;
      break;
    case 'unsubscribe':
    case 'group_unsubscribe':
      if (!email.unsubscribed) patch.unsubscribed = true;
      break;
    case 'group_resubscribe':
      if (email.unsubscribed) patch.unsubscribed = false;
      break;
    case 'open':
      if (!email.opened) patch.opened = true;
      break;
    case 'click':
      if (!email.clicked) patch.clicked = true;
      break;
  }
  return patch;
}

async function resolveEmail(
  ctx: MutationCtx,
  event: EmailEvent,
): Promise<Doc<'emails'> | null> {
  const correlationId = correlationIdFromEvent(event);
  if (correlationId !== undefined) {
    const emailId = ctx.db.normalizeId('emails', correlationId);
    if (emailId) {
      const email = await ctx.db.get('emails', emailId);
      if (email) return email;
    }
  }
  if (event.smtpId !== undefined && event.smtpId !== '') {
    return await ctx.db
      .query('emails')
      .withIndex('by_providerMessageId', (q) =>
        q.eq('providerMessageId', event.smtpId),
      )
      .first();
  }
  return null;
}

type OnEmailEventHandle = FunctionHandle<
  'mutation',
  { id: Id<'emails'>; event: EmailEvent },
  null
>;

async function onEmailEventHandle(
  ctx: MutationCtx,
): Promise<OnEmailEventHandle | undefined> {
  const stored = await ctx.db.query('lastOptions').unique();
  return stored?.options.onEmailEvent?.fnHandle as
    | OnEmailEventHandle
    | undefined;
}

async function enqueueCallback(
  ctx: MutationCtx,
  handle: OnEmailEventHandle | undefined,
  emailId: Id<'emails'>,
  event: EmailEvent,
): Promise<boolean> {
  if (handle === undefined) return false;
  await callbackPool.enqueueMutation(ctx, handle, { id: emailId, event });
  return true;
}

export const handleEvents = mutation({
  args: { events: v.any() },
  returns: v.object({
    applied: v.number(),
    ignored: v.number(),
    invalid: v.number(),
    duplicates: v.number(),
    callbacks: v.number(),
  }),
  handler: async (ctx, args) => {
    if (!Array.isArray(args.events)) {
      throw new Error('events must be an array of webhook events');
    }

    let applied = 0;
    let ignored = 0;
    let invalid = 0;
    let duplicates = 0;
    let callbacks = 0;

    const handle = await onEmailEventHandle(ctx);

    for (const element of args.events as unknown[]) {
      const event = normalizeWebhookEvent(element);
      if (event === null) {
        invalid += 1;
        console.warn('Skipping an unrecognized webhook event');
        continue;
      }

      const email = await resolveEmail(ctx, event);
      if (!email) {
        ignored += 1;
        console.info(
          `No email matched webhook event ${event.event}, ignoring it`,
        );
        continue;
      }

      if (event.sgEventId !== undefined && event.sgEventId !== '') {
        const seen = await ctx.db
          .query('deliveryEvents')
          .withIndex('by_sgEventId', (q) => q.eq('sgEventId', event.sgEventId))
          .first();
        if (seen) {
          duplicates += 1;
          continue;
        }
      }

      await ctx.db.insert('deliveryEvents', {
        emailId: email._id,
        eventType: event.event,
        occurredAt:
          event.timestamp !== undefined ? event.timestamp * 1000 : Date.now(),
        message: event.reason ?? event.response,
        sgEventId: event.sgEventId,
        raw: event.raw,
      });

      const patch = patchForEvent(email, event);
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch('emails', email._id, patch);
      }

      if (await enqueueCallback(ctx, handle, email._id, event)) callbacks += 1;
      applied += 1;
    }

    return { applied, ignored, invalid, duplicates, callbacks };
  },
});

async function deleteEmail(ctx: MutationCtx, email: Doc<'emails'>) {
  await ctx.db.delete('emails', email._id);
  if (email.html) await ctx.db.delete('content', email.html);
  if (email.text) await ctx.db.delete('content', email.text);
  const events = await ctx.db
    .query('deliveryEvents')
    .withIndex('by_emailId_eventType', (q) => q.eq('emailId', email._id))
    .collect();
  for (const event of events) {
    await ctx.db.delete('deliveryEvents', event._id);
  }
}

export const cleanupOldEmails = mutation({
  args: { olderThan: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const olderThan = args.olderThan ?? FINALIZED_EMAIL_RETENTION_MS;
    const done = await ctx.db
      .query('emails')
      .withIndex('by_finalizedAt', (q) =>
        q.lt('finalizedAt', Date.now() - olderThan),
      )
      .take(CLEANUP_BATCH_SIZE);
    for (const email of done) {
      await deleteEmail(ctx, email);
    }
    if (done.length === CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, api.lib.cleanupOldEmails, { olderThan });
    }
  },
});

export const cleanupAbandonedEmails = mutation({
  args: { olderThan: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const olderThan = args.olderThan ?? ABANDONED_EMAIL_RETENTION_MS;
    const abandoned = await ctx.db
      .query('emails')
      .withIndex('by_creation_time', (q) =>
        q.lt('_creationTime', Date.now() - olderThan),
      )
      .take(ABANDONED_BATCH_SIZE);
    for (const email of abandoned) {
      await deleteEmail(ctx, email);
    }
    if (abandoned.length === ABANDONED_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, api.lib.cleanupAbandonedEmails, {
        olderThan,
      });
    }
  },
});
