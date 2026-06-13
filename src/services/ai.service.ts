import {
  generateSegmentRules,
  generateMessageCopy,
  recommendChannel,
  generateCampaignInsights,
} from '../lib/gemini.js';
import { getSegmentById } from './segment.service.js';
import { getCampaignById } from './campaign.service.js';
import { getCampaignStats } from './stats.service.js';

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
