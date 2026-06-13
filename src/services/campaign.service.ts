import { db } from '../db/index.js';
import {
  campaigns,
  messages,
  campaignStats,
  customers,
  type SegmentRules,
} from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { AppError } from '../middleware/errorHandler.js';
import { getSegmentById, getMatchingCustomerIds } from './segment.service.js';
import { sendQueue } from '../queues/sendQueue.js';

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createCampaign(data: {
  name: string;
  segmentId: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'rcs';
  messageTemplate: string;
}) {
  // Validate segment exists
  await getSegmentById(data.segmentId);

  const [campaign] = await db
    .insert(campaigns)
    .values({
      name: data.name,
      segmentId: data.segmentId,
      channel: data.channel,
      messageTemplate: data.messageTemplate,
      status: 'draft',
    })
    .returning();

  return campaign;
}

export async function getAllCampaigns() {
  const rows = await db
    .select({
      campaign: campaigns,
      stats: campaignStats,
    })
    .from(campaigns)
    .leftJoin(campaignStats, eq(campaigns.id, campaignStats.campaignId))
    .orderBy(desc(campaigns.createdAt));

  return rows.map(({ campaign, stats }) => ({
    ...campaign,
    stats: stats ?? {
      total: 0, queued: 0, sent: 0,
      delivered: 0, failed: 0, opened: 0, clicked: 0,
    },
  }));
}

export async function getCampaignById(id: string) {
  const [row] = await db
    .select({
      campaign: campaigns,
      stats: campaignStats,
    })
    .from(campaigns)
    .leftJoin(campaignStats, eq(campaigns.id, campaignStats.campaignId))
    .where(eq(campaigns.id, id))
    .limit(1);

  if (!row) throw AppError.notFound(`Campaign ${id} not found`);

  return {
    ...row.campaign,
    stats: row.stats ?? {
      total: 0, queued: 0, sent: 0,
      delivered: 0, failed: 0, opened: 0, clicked: 0,
    },
  };
}

// ─── Launch Campaign ──────────────────────────────────────────────────────────

export async function launchCampaign(campaignId: string) {
  const campaign = await getCampaignById(campaignId);

  if (campaign.status !== 'draft') {
    throw AppError.badRequest(`Campaign is already ${campaign.status}. Only draft campaigns can be launched.`);
  }

  // Get segment and its rules
  const segment = await getSegmentById(campaign.segmentId);
  const rules = segment.rules as SegmentRules;

  // Get all matching customer IDs
  const customerIds = await getMatchingCustomerIds(rules);

  if (customerIds.length === 0) {
    throw AppError.badRequest('No customers match this segment. Update the segment rules.');
  }

  // Fetch customer contact details
  const customerRows = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
    })
    .from(customers)
    .where(sql`id = ANY(${sql`ARRAY[${sql.join(
      customerIds.map((id) => sql`${id}::uuid`),
      sql`, `
    )}]`})`);

  // Create one message row per customer (status: queued)
  const messageRows = customerRows.map((customer) => ({
    id: crypto.randomUUID(),
    campaignId,
    customerId: customer.id,
    channel: campaign.channel,
    recipientContact:
      campaign.channel === 'email' ? customer.email : customer.phone,
    messageBody: personalizeMessage(campaign.messageTemplate, customer.name),
    status: 'queued' as const,
  }));

  // Bulk insert messages
  await db.insert(messages).values(messageRows);

  // Initialize / reset campaign stats
  await db
    .insert(campaignStats)
    .values({
      campaignId,
      total: messageRows.length,
      queued: messageRows.length,
      sent: 0, delivered: 0, failed: 0, opened: 0, clicked: 0,
    })
    .onConflictDoUpdate({
      target: campaignStats.campaignId,
      set: {
        total: messageRows.length,
        queued: messageRows.length,
        sent: 0, delivered: 0, failed: 0, opened: 0, clicked: 0,
        lastUpdatedAt: new Date(),
      },
    });

  // Mark campaign as active
  await db
    .update(campaigns)
    .set({ status: 'active', launchedAt: new Date() })
    .where(eq(campaigns.id, campaignId));

  // Push each message to the BullMQ send queue
  const jobs = messageRows.map((msg) => ({
    name: 'send-message',
    data: {
      messageId: msg.id,
      campaignId,
      channel: msg.channel,
      recipientContact: msg.recipientContact,
      messageBody: msg.messageBody,
      customerId: msg.customerId,
      customerName: customerRows.find((c) => c.id === msg.customerId)?.name ?? '',
    },
  }));

  await sendQueue.addBulk(jobs);

  return {
    campaignId,
    messagesQueued: messageRows.length,
    status: 'active',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function personalizeMessage(template: string, customerName: string): string {
  const firstName = customerName.split(' ')[0];
  return template
    .replace(/\{name\}/gi, firstName)
    .replace(/\{customer\}/gi, firstName)
    .replace(/\{first_name\}/gi, firstName);
}
