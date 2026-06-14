import { db } from '../db/index.js';
import { messages } from '../db/schema.js';
import { eq, sql, desc } from 'drizzle-orm';
import { AppError } from '../middleware/errorHandler.js';

export async function getCampaignStats(campaignId: string) {
  // Compute stats live from the messages table — always accurate, no cache drift.
  const [row] = await db.execute(sql`
    SELECT
      COUNT(*)::int                                              AS total,
      COUNT(*) FILTER (WHERE status = 'queued')::int            AS queued,
      COUNT(*) FILTER (WHERE status = 'sent')::int              AS sent,
      COUNT(*) FILTER (WHERE status = 'delivered')::int         AS delivered,
      COUNT(*) FILTER (WHERE status = 'failed')::int            AS failed,
      COUNT(*) FILTER (WHERE status = 'opened')::int            AS opened,
      COUNT(*) FILTER (WHERE status = 'clicked')::int           AS clicked
    FROM messages
    WHERE campaign_id = ${campaignId}::uuid
  `);

  if (!row || (row as any).total === null) {
    throw AppError.notFound(`Stats for campaign ${campaignId} not found`);
  }

  const s = row as {
    total: number; queued: number; sent: number;
    delivered: number; failed: number; opened: number; clicked: number;
  };

  // Sent = all non-queued messages (they've left the queue)
  const dispatched = s.sent + s.delivered + s.failed + s.opened + s.clicked;

  const deliveryRate = dispatched > 0
    ? (((s.delivered + s.opened + s.clicked) / dispatched) * 100).toFixed(1)
    : '0.0';
  const openRate = (s.delivered + s.opened + s.clicked) > 0
    ? (((s.opened + s.clicked) / (s.delivered + s.opened + s.clicked)) * 100).toFixed(1)
    : '0.0';
  const clickRate = (s.opened + s.clicked) > 0
    ? ((s.clicked / (s.opened + s.clicked)) * 100).toFixed(1)
    : '0.0';

  return {
    campaignId,
    total:     Number(s.total),
    queued:    Number(s.queued),
    sent:      Number(s.sent),
    delivered: Number(s.delivered),
    failed:    Number(s.failed),
    opened:    Number(s.opened),
    clicked:   Number(s.clicked),
    lastUpdatedAt: new Date().toISOString(),
    rates: {
      delivery: parseFloat(deliveryRate),
      open:     parseFloat(openRate),
      click:    parseFloat(clickRate),
      fail:     dispatched > 0 ? parseFloat((s.failed / dispatched * 100).toFixed(1)) : 0,
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
