import { db } from '../db/index.js';
import { campaignStats, messages, campaigns } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { AppError } from '../middleware/errorHandler.js';

export async function getCampaignStats(campaignId: string) {
  const [stats] = await db
    .select()
    .from(campaignStats)
    .where(eq(campaignStats.campaignId, campaignId))
    .limit(1);

  if (!stats) throw AppError.notFound(`Stats for campaign ${campaignId} not found`);

  // Compute rates
  const deliveryRate = stats.sent > 0
    ? ((stats.delivered / stats.sent) * 100).toFixed(1)
    : '0.0';
  const openRate = stats.delivered > 0
    ? ((stats.opened / stats.delivered) * 100).toFixed(1)
    : '0.0';
  const clickRate = stats.opened > 0
    ? ((stats.clicked / stats.opened) * 100).toFixed(1)
    : '0.0';
  const failRate = stats.sent > 0
    ? ((stats.failed / stats.sent) * 100).toFixed(1)
    : '0.0';

  return {
    ...stats,
    rates: {
      delivery: parseFloat(deliveryRate),
      open: parseFloat(openRate),
      click: parseFloat(clickRate),
      fail: parseFloat(failRate),
    },
  };
}

export async function getCampaignMessages(campaignId: string, limit = 100) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.campaignId, campaignId))
    .orderBy(desc(messages.queuedAt))
    .limit(limit);
}
