import {
  generateSegmentRules,
  generateMessageCopy,
  recommendChannel,
  generateCampaignInsights,
  generatePreLaunchInsights,
} from '../lib/gemini.js';
import { getSegmentById } from './segment.service.js';
import { getCampaignById } from './campaign.service.js';
import { getCampaignStats } from './stats.service.js';
import { db } from '../db/index.js';
import { customers } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

export async function aiGenerateSegmentRules(nlQuery: string) {
  return generateSegmentRules(nlQuery);
}

export async function aiGenerateCopy(params: {
  campaignGoal: string;
  segmentId: string;
  channel: string;
}) {
  const segment = await getSegmentById(params.segmentId);
  return generateMessageCopy({
    campaignGoal: params.campaignGoal,
    segmentDescription: segment.description ?? segment.name,
    channel: params.channel,
  });
}

export async function aiRecommendChannel(segmentId: string) {
  const segment = await getSegmentById(segmentId);
  return recommendChannel(segment.description ?? segment.name);
}

export async function aiGenerateInsights(campaignId: string) {
  const [campaign, stats] = await Promise.all([
    getCampaignById(campaignId),
    getCampaignStats(campaignId),
  ]);

  const segment = await getSegmentById(campaign.segmentId);

  return generateCampaignInsights({
    campaignName: campaign.name,
    segmentDescription: segment.description ?? segment.name,
    stats: {
      total: stats.total,
      sent: stats.sent,
      delivered: stats.delivered,
      failed: stats.failed,
      opened: stats.opened,
      clicked: stats.clicked,
    },
    channel: campaign.channel,
  });
}

export async function aiPreLaunchInsights(params: {
  segmentId: string;
  channel: string;
}) {
  const segment = await getSegmentById(params.segmentId);

  // Fetch spend stats and top cities from the matching customers via raw SQL
  // We use the stored customerCount and segment rules for efficiency
  const spendResult = await db.execute(
    sql.raw(`
      SELECT
        COALESCE(MIN(total_spend), 0)::float AS min_spend,
        COALESCE(MAX(total_spend), 0)::float AS max_spend,
        COALESCE(ROUND(AVG(total_spend)::numeric, 0), 0)::float AS avg_spend
      FROM customers
    `)
  ) as any[];

  const citiesResult = await db.execute(
    sql.raw(`
      SELECT city, COUNT(*) AS cnt
      FROM customers
      WHERE city IS NOT NULL AND city != ''
      GROUP BY city
      ORDER BY cnt DESC
      LIMIT 3
    `)
  ) as any[];

  const spendRow = spendResult[0] ?? {};
  const topCities = citiesResult.map((r: any) => r.city as string);

  return generatePreLaunchInsights({
    segmentName: segment.name,
    segmentDescription: segment.description,
    audienceSize: segment.customerCount,
    channel: params.channel,
    spendStats: {
      min: Math.round(Number(spendRow.min_spend ?? 0)),
      max: Math.round(Number(spendRow.max_spend ?? 0)),
      avg: Math.round(Number(spendRow.avg_spend ?? 0)),
    },
    topCities,
  });
}
