import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  primaryKey,
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const channelEnum = pgEnum('channel', ['whatsapp', 'sms', 'email', 'rcs']);

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'active',
  'completed',
]);

export const deliveryModeEnum = pgEnum('delivery_mode', ['simulate', 'live']);

export const messageStatusEnum = pgEnum('message_status', [
  'queued',
  'sent',
  'delivered',
  'failed',
  'opened',
  'clicked',
]);

// ─── customers ────────────────────────────────────────────────────────────────

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull(),
  city: text('city').notNull(),
  totalSpend: numeric('total_spend', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  orderCount: integer('order_count').notNull().default(0),
  avgOrderValue: numeric('avg_order_value', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  lastOrderAt: timestamp('last_order_at', { withTimezone: true }),
  favouriteCategory: text('favourite_category'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── orders ───────────────────────────────────────────────────────────────────

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  // items: [{ name, category, price, qty }]
  items: jsonb('items').notNull().default([]),
  orderedAt: timestamp('ordered_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── segments ─────────────────────────────────────────────────────────────────

export const segments = pgTable('segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  // rules: { operator: "AND"|"OR", conditions: [{field, op, value}] }
  rules: jsonb('rules').notNull().default({}),
  customerCount: integer('customer_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── campaigns ────────────────────────────────────────────────────────────────

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  segmentId: uuid('segment_id')
    .notNull()
    .references(() => segments.id, { onDelete: 'cascade' }),
  channel: channelEnum('channel').notNull(),
  messageTemplate: text('message_template').notNull(),
  status: campaignStatusEnum('status').notNull().default('draft'),
  deliveryMode: deliveryModeEnum('delivery_mode').notNull().default('simulate'),
  launchedAt: timestamp('launched_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── messages ─────────────────────────────────────────────────────────────────

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id),
  channel: channelEnum('channel').notNull(),
  recipientContact: text('recipient_contact').notNull(), // phone or email
  messageBody: text('message_body').notNull(),
  status: messageStatusEnum('status').notNull().default('queued'),
  vendorRef: text('vendor_ref'), // returned by channel stub
  queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  clickedAt: timestamp('clicked_at', { withTimezone: true }),
});

// ─── campaign_stats ───────────────────────────────────────────────────────────

export const campaignStats = pgTable('campaign_stats', {
  campaignId: uuid('campaign_id')
    .primaryKey()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  total: integer('total').notNull().default(0),
  queued: integer('queued').notNull().default(0),
  sent: integer('sent').notNull().default(0),
  delivered: integer('delivered').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  opened: integer('opened').notNull().default(0),
  clicked: integer('clicked').notNull().default(0),
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── processed_receipts (idempotency store) ───────────────────────────────────

export const processedReceipts = pgTable('processed_receipts', {
  // composite key: messageId + '_' + status
  id: text('id').primaryKey(),
  processedAt: timestamp('processed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type Segment = typeof segments.$inferSelect;
export type NewSegment = typeof segments.$inferInsert;

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type CampaignStats = typeof campaignStats.$inferSelect;

// ─── Rule Engine Types ────────────────────────────────────────────────────────

export type SegmentCondition = {
  field:
    | 'last_order_at'
    | 'total_spend'
    | 'order_count'
    | 'avg_order_value'
    | 'favourite_category'
    | 'city';
  op: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq' | 'in';
  value: string | number | string[];
  // For date fields, value can be "90d", "30d", "1y" etc.
};

export type SegmentRules = {
  operator: 'AND' | 'OR';
  conditions: SegmentCondition[];
};

export type OrderItem = {
  name: string;
  category: string;
  price: number;
  qty: number;
};
