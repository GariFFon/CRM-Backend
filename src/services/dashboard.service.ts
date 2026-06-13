import { db } from '../db/index.js';
import { customers, campaigns, segments, campaignStats } from '../db/schema.js';
import { sql, eq, desc } from 'drizzle-orm';

export async function getDashboardData() {
  const [
    customerCount,
    segmentCount,
    campaignCount,
    recentCampaigns,
    avgDelivery,
  ] = await Promise.all([
    // Total customers
    db.select({ count: sql<number>`count(*)::int` }).from(customers),

    // Total segments
    db.select({ count: sql<number>`count(*)::int` }).from(segments),

    // Total campaigns
    db.select({ count: sql<number>`count(*)::int` }).from(campaigns),

    // Recent 5 campaigns with stats
    db
      .select({ campaign: campaigns, stats: campaignStats })
      .from(campaigns)
      .leftJoin(campaignStats, eq(campaigns.id, campaignStats.campaignId))
      .orderBy(desc(campaigns.createdAt))
      .limit(5),

    // Average delivery rate across all campaigns
    db
      .select({
        avgRate: sql<number>`
          ROUND(
            AVG(
              CASE WHEN sent > 0
                THEN (delivered::float / sent::float) * 100
                ELSE 0
              END
            )::numeric, 1
          )
        `,
      })
      .from(campaignStats),
  ]);

  return {
    totalCustomers: customerCount[0].count,
    totalSegments: segmentCount[0].count,
    totalCampaigns: campaignCount[0].count,
    avgDeliveryRate: avgDelivery[0].avgRate ?? 0,
    recentCampaigns: recentCampaigns.map(({ campaign, stats }) => ({
      ...campaign,
      stats: stats ?? { total: 0, sent: 0, delivered: 0, failed: 0, opened: 0, clicked: 0 },
    })),
  };
}
