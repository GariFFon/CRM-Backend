import { db } from '../db/index.js';
import { messages, campaignStats, campaigns } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { isAlreadyProcessed, markAsProcessed } from '../lib/idempotency.js';
import { AppError } from '../middleware/errorHandler.js';

// Valid state transitions for the message state machine
const VALID_TRANSITIONS: Record<string, string[]> = {
  queued:    ['sent', 'failed'],
  sent:      ['delivered', 'failed'],
  delivered: ['opened', 'failed'],
  opened:    ['clicked'],
  clicked:   [],
  failed:    [],
};

export type ReceiptStatus = 'sent' | 'delivered' | 'failed' | 'opened' | 'clicked';

export async function processReceipt(data: {
  messageId: string;
  vendorRef: string;
  status: ReceiptStatus;
  timestamp?: string;
}) {
  const { messageId, vendorRef, status, timestamp } = data;

  // 1. Idempotency check — skip duplicates
  const alreadyDone = await isAlreadyProcessed(messageId, status);
  if (alreadyDone) {
    return { skipped: true, reason: 'Already processed' };
  }

  // 2. Fetch the message
  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!message) {
    throw AppError.notFound(`Message ${messageId} not found`);
  }

  // 3. State machine validation
  const allowedNext = VALID_TRANSITIONS[message.status] ?? [];
  if (!allowedNext.includes(status)) {
    // Not a valid transition — log and skip (don't throw, channel stub may send out-of-order)
    console.warn(
      `⚠️  Invalid transition: ${message.status} → ${status} for message ${messageId}. Skipping.`
    );
    await markAsProcessed(messageId, status); // still mark so we don't retry
    return { skipped: true, reason: `Invalid transition: ${message.status} → ${status}` };
  }

  const now = timestamp ? new Date(timestamp) : new Date();

  // 4. Build update object for messages table
  const updateData: Record<string, any> = { status, vendorRef };
  if (status === 'sent')      updateData.sentAt = now;
  if (status === 'delivered') updateData.deliveredAt = now;
  if (status === 'failed')    updateData.failedAt = now;
  if (status === 'opened')    updateData.openedAt = now;
  if (status === 'clicked')   updateData.clickedAt = now;

  // 5. Update message status
  await db.update(messages).set(updateData).where(eq(messages.id, messageId));

  // 6. Atomically update campaign_stats
  await updateCampaignStats(message.campaignId, message.status, status);

  // 7. Check if all messages are in terminal state → mark campaign completed
  await checkCampaignCompletion(message.campaignId);

  // 8. Mark as processed (idempotency)
  await markAsProcessed(messageId, status);

  return { skipped: false, messageId, status };
}

async function updateCampaignStats(
  campaignId: string,
  prevStatus: string,
  newStatus: string
) {
  // Decrement old status counter, increment new status counter
  const decrementField = prevStatus === 'queued' ? 'queued' :
                         prevStatus === 'sent' ? 'sent' :
                         prevStatus === 'delivered' ? 'delivered' : null;

  const incrementField = newStatus;

  if (incrementField && STAT_FIELDS.includes(incrementField)) {
    await db.execute(sql.raw(`
      UPDATE campaign_stats
      SET
        ${decrementField ? `${decrementField} = GREATEST(0, ${decrementField} - 1),` : ''}
        ${incrementField} = ${incrementField} + 1,
        last_updated_at = NOW()
      WHERE campaign_id = '${campaignId}'
    `));
  }
}

const STAT_FIELDS = ['queued', 'sent', 'delivered', 'failed', 'opened', 'clicked'];

async function checkCampaignCompletion(campaignId: string) {
  const [stats] = await db
    .select()
    .from(campaignStats)
    .where(eq(campaignStats.campaignId, campaignId))
    .limit(1);

  if (!stats) return;

  // Campaign is complete when no messages are queued or sent (all terminal)
  const inProgress = stats.queued + stats.sent;
  if (inProgress === 0 && stats.total > 0) {
    await db
      .update(campaigns)
      .set({ status: 'completed' })
      .where(eq(campaigns.id, campaignId));
  }
}
