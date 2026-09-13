import { literals } from 'convex-helpers/validators';
import { type Infer, v } from 'convex/values';

import type {
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from 'convex/server';

export const vOnEmailEvent = v.object({
  fnHandle: v.string(),
});

export const vStatus = v.union(
  v.literal('queued'),
  v.literal('cancelled'),
  v.literal('sent'),
  v.literal('delivered'),
  v.literal('delivery_delayed'),
  v.literal('bounced'),
  v.literal('failed'),
);
export type Status = Infer<typeof vStatus>;

export const vPriority = v.union(v.literal('transactional'), v.literal('bulk'));
export type Priority = Infer<typeof vPriority>;

/**
 * Event names accepted on the webhook. The first seven are what PostShiba
 * emits today; the remaining four are accepted so an endpoint shared with an
 * engagement tracking provider does not fail.
 */
export const ACCEPTED_EVENT_TYPES = [
  'processed',
  'delivered',
  'deferred',
  'bounce',
  'dropped',
  'spamreport',
  'unsubscribe',
  'open',
  'click',
  'group_unsubscribe',
  'group_resubscribe',
] as const;

export const vEventType = v.union(literals(...ACCEPTED_EVENT_TYPES));
export type EventType = Infer<typeof vEventType>;

export const vUniqueArgValue = v.union(v.string(), v.number(), v.boolean());
export const vUniqueArgs = v.record(v.string(), vUniqueArgValue);
export type UniqueArgs = Infer<typeof vUniqueArgs>;

export const vTemplate = v.object({
  id: v.string(),
  variables: v.optional(v.record(v.string(), v.any())),
});
export type SendTemplate = Infer<typeof vTemplate>;

export const vEmailEvent = v.object({
  event: vEventType,
  email: v.optional(v.string()),
  timestamp: v.optional(v.number()),
  sgEventId: v.optional(v.string()),
  sgMessageId: v.optional(v.string()),
  smtpId: v.optional(v.string()),
  reason: v.optional(v.string()),
  response: v.optional(v.string()),
  status: v.optional(v.string()),
  attempt: v.optional(v.union(v.string(), v.number())),
  type: v.optional(v.string()),
  bounceClassification: v.optional(v.string()),
  tenantId: v.optional(v.string()),
  from: v.optional(v.string()),
  subject: v.optional(v.string()),
  category: v.optional(v.union(v.string(), v.array(v.string()))),
  uniqueArgs: v.optional(vUniqueArgs),
  raw: v.any(),
});
export type EmailEvent = Infer<typeof vEmailEvent>;

export const vOptions = v.object({
  apiKey: v.string(),
  teamId: v.string(),
  clusterId: v.string(),
  baseUrl: v.string(),
  initialBackoffMs: v.number(),
  retryAttempts: v.number(),
  hourlyLimit: v.number(),
  bulkShare: v.number(),
  testMode: v.boolean(),
  testDomains: v.array(v.string()),
  onEmailEvent: v.optional(vOnEmailEvent),
});
export type RuntimeConfig = Infer<typeof vOptions>;

export const CORRELATION_KEY = 'convex_email_id';

export const RESERVED_UNIQUE_ARG_KEYS = [
  'event',
  'email',
  'timestamp',
  'sg_event_id',
  'sg_message_id',
  'smtp-id',
  'tenant_id',
] as const;

export type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, 'runQuery'>;
export type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  'runQuery' | 'runMutation'
>;
export type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  'runQuery' | 'runMutation' | 'runAction'
>;
